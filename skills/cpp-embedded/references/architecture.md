# Architecture Reference — Embedded Firmware

## Table of Contents
1. [Firmware Architecture Selection](#1-firmware-architecture-selection)
2. [FreeRTOS Inter-Task Communication](#2-freertos-inter-task-communication)
3. [Low-Power Firmware Patterns](#3-low-power-firmware-patterns)
   - [ESP32 Deep Sleep and Fast Wake Patterns](#esp32-deep-sleep-and-fast-wake-patterns)
4. [CI/CD Pipeline for Firmware](#4-cicd-pipeline-for-firmware)
5. [Binary Size Budget Tracking](#5-binary-size-budget-tracking)

---

## 1. Firmware Architecture Selection

Ranked by complexity, simplest first. Always start with the simplest that meets requirements.

### Superloop

`while(1)` with ISR flags. Fully deterministic, zero overhead.

```c
volatile bool adc_ready;

void ADC_IRQHandler(void) { adc_ready = true; }

int main(void) {
    hw_init();
    while (1) {
        if (adc_ready) { adc_ready = false; process_adc(); }
        poll_uart();
        feed_watchdog();
    }
}
```

Good for <5 tasks with loose timing. Breaks down when tasks have conflicting timing requirements
or when one task blocks others.

### Time-Triggered Cooperative

SysTick-driven task table with fixed periods. Each task must complete within its slot.
Predictable and analyzable — good for IEC 61508 SIL 1-2. No priority inversion possible.

```c
typedef struct { void (*task)(void); uint32_t period_ms; uint32_t last_run; } SchedTask;

static SchedTask schedule[] = {
    { read_sensors,   10,  0 },
    { update_control, 50,  0 },
    { log_data,       1000, 0 },
};

void SysTick_Handler(void) {
    uint32_t now = HAL_GetTick();
    for (size_t i = 0; i < ARRAY_SIZE(schedule); i++) {
        if (now - schedule[i].last_run >= schedule[i].period_ms) {
            schedule[i].task();
            schedule[i].last_run = now;
        }
    }
}
```

### RTOS Preemptive (FreeRTOS / Zephyr / ThreadX)

Priority-based preemptive scheduling with rich IPC. Handles complex multi-task systems.
Introduces priority inversion, stack sizing complexity, and non-trivial debugging.

### Active Object / Event-Driven (QP Framework)

Objects run in their own threads, communicate via async events. Combines hierarchical state
machines with RTOS scheduling. Best for complex protocol handling and UI-heavy embedded systems.

### Selection Guide

| Requirement | Architecture |
|---|---|
| <5 tasks, loose timing | Superloop |
| Hard real-time, deterministic, certifiable | Time-Triggered Cooperative |
| Complex multi-priority, dynamic workloads | RTOS Preemptive |
| Event-heavy, nested state machines | Active Object |

**Rule of thumb:** if you can fit it in a superloop, do. Upgrade only when the simpler model
cannot meet timing or complexity requirements.

---

## 2. FreeRTOS Inter-Task Communication

### Mechanism Comparison

| Mechanism | RAM Overhead | Speed | Use Case |
|---|---|---|---|
| Task Notification | 0 extra bytes | Fastest | Single-recipient event/value signaling |
| Queue | Per-item copy | Moderate | Multi-sender/receiver, typed messages |
| Stream Buffer | Contiguous ring | Fast | Byte streams, ISR-to-task, UART RX |
| Message Buffer | Stream + length prefix | Fast | Variable-length messages, single producer/consumer |

### Task Notification — Simple Event Signaling

Zero-cost signaling when you have a single sender and single receiver.

```c
/* ISR signals task */
void UART_IRQHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    vTaskNotifyGiveFromISR(uart_task_handle, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

/* Task waits for signal */
void uart_task(void *param) {
    for (;;) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);  /* Block until notified */
        process_uart_data();
    }
}
```

### Queue — Multi-Sender Typed Messages

Use when multiple tasks need to send to the same consumer.

```c
typedef struct { uint8_t sensor_id; int16_t value; } SensorMsg;

static QueueHandle_t sensor_q;

void sensor_task_a(void *param) {
    SensorMsg msg = { .sensor_id = 1, .value = read_temp() };
    xQueueSend(sensor_q, &msg, pdMS_TO_TICKS(10));
}

void aggregator_task(void *param) {
    SensorMsg msg;
    for (;;) {
        if (xQueueReceive(sensor_q, &msg, portMAX_DELAY) == pdTRUE) {
            update_display(msg.sensor_id, msg.value);
        }
    }
}
```

### Stream Buffer — ISR Byte Streams

Stream buffers internally use task notifications, combining queue convenience with near-raw-buffer
speed. Ideal for ISR-to-task byte stream transfer (UART RX, ADC DMA completion).

```c
static StreamBufferHandle_t uart_stream;

void USART1_IRQHandler(void) {
    uint8_t byte = (uint8_t)(USART1->DR & 0xFF);
    BaseType_t woken = pdFALSE;
    xStreamBufferSendFromISR(uart_stream, &byte, 1, &woken);
    portYIELD_FROM_ISR(woken);
}

void uart_rx_task(void *param) {
    uint8_t buf[64];
    for (;;) {
        size_t n = xStreamBufferReceive(uart_stream, buf, sizeof(buf), portMAX_DELAY);
        process_uart_data(buf, n);
    }
}
```

### Design Rule

Task notifications for simple events. Stream buffers for ISR byte streams (UART RX, SPI).
Queues only when multiple readers or writers are required. Message buffers for variable-length
protocol frames from a single producer.

---

## 3. Low-Power Firmware Patterns

### ARM Cortex-M Power Modes

- **Run** — CPU clocked, all peripherals available.
- **Sleep** — CPU halted, peripherals and NVIC active. WFI/WFE wakes on any enabled interrupt/event.
- **Deep Sleep** — CPU + most clocks halted. Only RTC/LPUART/wakeup pins active. Microsecond wake penalty.

**WFI vs WFE:** WFI wakes on interrupt. WFE wakes on event register (set by SEV or peripheral
event). Use WFE for spinlock-style waits between cores; WFI for standard sleep.

### Sleep Entry Pattern

Always issue `__DSB()` before `__WFI()` to ensure all memory transactions complete.

```c
void enter_sleep(void) {
    /* Gate unused peripheral clocks */
    RCC->AHB1ENR &= ~(RCC_AHB1ENR_GPIOBEN | RCC_AHB1ENR_GPIOCEN);
    RCC->APB1ENR &= ~(RCC_APB1ENR_TIM3EN | RCC_APB1ENR_SPI2EN);

    /* Clear SLEEPDEEP to select normal Sleep (not Deep Sleep) */
    SCB->SCR &= ~SCB_SCR_SLEEPDEEP_Msk;

    __DSB();   /* Ensure all outstanding memory accesses complete */
    __WFI();   /* Wait For Interrupt — CPU halts here */

    /* Restore clocks after wake */
    RCC->AHB1ENR |= (RCC_AHB1ENR_GPIOBEN | RCC_AHB1ENR_GPIOCEN);
    RCC->APB1ENR |= (RCC_APB1ENR_TIM3EN | RCC_APB1ENR_SPI2EN);
}
```

### Sleep-On-Exit

For purely interrupt-driven applications, enable Sleep-On-Exit so the CPU sleeps automatically
after every ISR returns — no main loop needed.

```c
SCB->SCR |= SCB_SCR_SLEEPONEXIT_Msk;
__DSB();
__WFI();  /* CPU sleeps after each ISR completes, never returns to main */
```

### Checklist

- Turn off unused peripheral clocks before sleeping.
- Use `__DSB()` before `__WFI()` / `__WFE()` — always.
- Measure current draw with a shunt resistor or power analyzer to verify modes.
- Watch for debug probe holding the CPU awake (DBGMCU_CR).

### ESP32 Deep Sleep and Fast Wake Patterns

The ESP32 deep sleep cycle (wake → work → sleep) is a common pattern for battery-powered
sensor nodes. The challenge: WiFi reconnection dominates the wake time (3-5 seconds vs the
actual sensor read + MQTT publish which takes ~100ms).

**Key optimization: Store WiFi state in RTC memory.** RTC memory survives deep sleep. By
caching the WiFi channel and access point BSSID, the ESP32 can skip the 802.11 scan on
wake and connect directly (~300-500ms instead of 3-5s).

```cpp
// RTC_DATA_ATTR persists across deep sleep cycles
RTC_DATA_ATTR uint8_t saved_wifi_channel = 0;
RTC_DATA_ATTR uint8_t saved_bssid[6] = {0};
RTC_DATA_ATTR bool wifi_state_valid = false;

void fast_wifi_connect() {
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);  // Don't write credentials to flash every boot

    if (wifi_state_valid) {
        // Fast reconnect: skip scan, connect directly to known AP
        WiFi.begin(SSID, PASSWORD, saved_wifi_channel, saved_bssid, true);
    } else {
        // First boot or after failure: full scan
        WiFi.begin(SSID, PASSWORD);
    }

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
        delay(10);
    }

    if (WiFi.status() == WL_CONNECTED) {
        // Cache for next wake
        saved_wifi_channel = WiFi.channel();
        memcpy(saved_bssid, WiFi.BSSID(), 6);
        wifi_state_valid = true;
    } else {
        wifi_state_valid = false;  // Force full scan next time
    }
}
```

**Additional wake time optimizations:**
- **Static IP:** Eliminates DHCP negotiation (~1-2 seconds). Configure with `WiFi.config(ip, gateway, subnet, dns)` before `WiFi.begin()`.
- **Pre-format payload:** Build the MQTT/HTTP payload before calling `WiFi.begin()` — overlap sensor read time with connection.
- **Sensor forced mode:** Configure sensors (BME280, SHT31, etc.) in forced/single-shot mode. Trigger a measurement, read the result, then the sensor returns to standby automatically. Continuous mode wastes power between readings.

**Deep sleep sequence:**
```cpp
void setup() {
    // 1. Read sensor (while WiFi is not yet needed)
    float temp = read_bme280_forced();

    // 2. Format payload (no heap allocation)
    char payload[64];
    snprintf(payload, sizeof(payload), "{\"t\":%.1f}", temp);

    // 3. Connect WiFi (fast path via RTC-cached channel/BSSID)
    fast_wifi_connect();

    // 4. Publish and disconnect
    mqtt_publish("sensor/data", payload);
    WiFi.disconnect(true);

    // 5. Sleep for 30 seconds
    esp_sleep_enable_timer_wakeup(30 * 1000000ULL);  // microseconds
    esp_deep_sleep_start();
    // Execution never reaches here — wake restarts from setup()
}
```

**Power budget:** A well-optimized ESP32 deep sleep cycle draws ~10µA sleeping, ~160mA
active for ~800ms. On a 1000mAh battery, this gives months of operation at 30-second intervals.

---

## 4. CI/CD Pipeline for Firmware

Minimal GitHub Actions pipeline with three stages: host tests, cross-compile, hardware-in-loop via QEMU.

```yaml
name: firmware-ci

on: [push, pull_request]

jobs:
  host-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and run host tests
        run: |
          cmake -B build-host -DTARGET=host -DUSE_MOCK_HAL=ON
          cmake --build build-host -j$(nproc)
          ctest --test-dir build-host --output-on-failure

  firmware-build:
    runs-on: ubuntu-latest
    needs: host-tests
    steps:
      - uses: actions/checkout@v4
      - name: Install ARM toolchain
        run: |
          sudo apt-get update && sudo apt-get install -y gcc-arm-none-eabi
      - name: Cross-compile firmware
        run: |
          cmake -B build-fw -DCMAKE_TOOLCHAIN_FILE=cmake/arm-none-eabi.cmake
          cmake --build build-fw -j$(nproc)
      - uses: actions/upload-artifact@v4
        with:
          name: firmware-elf
          path: build-fw/*.elf

  qemu-integration:
    runs-on: ubuntu-latest
    needs: firmware-build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: firmware-elf
      - name: Install QEMU
        run: sudo apt-get update && sudo apt-get install -y qemu-system-arm
      - name: Run on QEMU mps2-an385
        run: |
          timeout 30 qemu-system-arm \
            -machine mps2-an385 -cpu cortex-m3 \
            -kernel firmware.elf \
            -nographic -semihosting \
            | tee qemu_output.txt
          grep -q "ALL TESTS PASSED" qemu_output.txt
```

---

## 5. Binary Size Budget Tracking

### Checking Size

```bash
arm-none-eabi-size firmware.elf
#    text    data     bss     dec     hex filename
#   45280    1024    8192   54496    d4e0 firmware.elf
```

- **text** = flash (code + const data)
- **data** = flash + RAM (initialized globals)
- **bss** = RAM only (zero-initialized globals)
- Total flash = text + data
- Total RAM = data + bss

### CI Budget Gate

Fail the build if flash exceeds 90% or RAM exceeds 80% of available capacity.

```bash
#!/bin/bash
FLASH_MAX=262144   # 256 KB
RAM_MAX=65536      # 64 KB
THRESHOLD_FLASH=90
THRESHOLD_RAM=80

read TEXT DATA BSS _ _ <<< $(arm-none-eabi-size firmware.elf | tail -1)

FLASH_USED=$((TEXT + DATA))
RAM_USED=$((DATA + BSS))
FLASH_PCT=$((FLASH_USED * 100 / FLASH_MAX))
RAM_PCT=$((RAM_USED * 100 / RAM_MAX))

echo "Flash: ${FLASH_USED}/${FLASH_MAX} (${FLASH_PCT}%)"
echo "RAM:   ${RAM_USED}/${RAM_MAX} (${RAM_PCT}%)"

if [ "$FLASH_PCT" -gt "$THRESHOLD_FLASH" ]; then
    echo "FAIL: Flash usage ${FLASH_PCT}% exceeds ${THRESHOLD_FLASH}% budget" >&2
    exit 1
fi
if [ "$RAM_PCT" -gt "$THRESHOLD_RAM" ]; then
    echo "FAIL: RAM usage ${RAM_PCT}% exceeds ${THRESHOLD_RAM}% budget" >&2
    exit 1
fi
```

Add size output as a CI artifact for trend tracking across commits. Catch bloat early — a 2 KB
jump in text is worth investigating before it compounds.
