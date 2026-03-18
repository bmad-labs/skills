# ESP32-S3 Data Logger: Restructuring for Long-Term Reliability

## Root Cause Analysis

Your crashes after 2-3 days are almost certainly **heap fragmentation**. Here is why:

- `std::vector::push_back` reallocates on growth -- every reallocation frees an old block and allocates a larger one, leaving holes in the heap.
- `std::string` for CSV formatting allocates on every concatenation (`operator+=`, `+`). At 100Hz with 3 sensors, that is 300 string allocations per second -- over **25 million alloc/free cycles per day**.
- The ESP32-S3 has ~512KB DRAM with no MMU. After millions of variable-sized alloc/free cycles, free memory becomes fragmented into many small non-contiguous blocks. Eventually a routine allocation fails or an internal ESP-IDF allocation (WiFi, logging, etc.) cannot find a large enough contiguous block, and the system crashes.

You can confirm this diagnosis by adding periodic heap monitoring:

```cpp
void log_heap_health() {
    size_t free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    size_t largest_block = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    size_t min_free_ever = heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);

    ESP_LOGI("HEAP", "Free: %u  Largest block: %u  Min ever: %u",
             free_heap, largest_block, min_free_ever);

    // Fragmentation indicator: lots of free memory but no large contiguous block
    if (free_heap > 50000 && largest_block < 10000) {
        ESP_LOGW("HEAP", "Heap is heavily fragmented!");
    }
}
```

If `free_heap` stays high but `largest_block` shrinks over hours, fragmentation is confirmed.

## Architecture Overview

The restructured design eliminates **all** dynamic allocation from the periodic data path:

1. **ADC timer ISR** fires at 100Hz, reads 3 ADC channels, writes a `SensorSample` into a statically-allocated SPSC ring buffer.
2. **Logger task** (FreeRTOS) consumes samples from the ring buffer, formats CSV into a pre-allocated `char[]` buffer using `snprintf`, and writes to SD card every 10 seconds.
3. **Watchdog + heap monitor** task runs every 60 seconds for diagnostics.

Zero heap allocation after initialization. Zero `std::vector`. Zero `std::string`.

## Complete Implementation

### sensor_types.h -- Data Structures

```cpp
#pragma once

#include <cstdint>

// Fixed-size sample -- no heap, no padding surprises
struct SensorSample {
    int64_t timestamp_us;           // esp_timer_get_time()
    uint16_t adc_raw[3];            // 3 ADC channels
};

// Conversion constants (ESP32-S3 ADC is 12-bit, 0-3.3V default attenuation)
static constexpr float ADC_VOLTAGE_SCALE = 3.3f / 4095.0f;
```

### spsc_ring_buffer.h -- Lock-Free Ring Buffer

```cpp
#pragma once

#include <atomic>
#include <array>
#include <cstddef>
#include <optional>

// Single-Producer Single-Consumer ring buffer.
// Producer: ISR (timer callback). Consumer: FreeRTOS task.
// Power-of-2 capacity for bitmask modulo -- no division in ISR.
template<typename T, size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "Capacity must be a power of 2");
    static_assert(N > 0, "Capacity must be > 0");
    static constexpr size_t MASK = N - 1;

public:
    // Called from ISR context. Returns false if buffer is full (sample dropped).
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & MASK;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;  // Full -- caller should increment a drop counter
        }
        buf_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    // Called from task context. Returns nullopt if empty.
    std::optional<T> pop() {
        const size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) {
            return std::nullopt;
        }
        T item = buf_[tail];
        tail_.store((tail + 1) & MASK, std::memory_order_release);
        return item;
    }

    [[nodiscard]] bool empty() const {
        return head_.load(std::memory_order_acquire)
            == tail_.load(std::memory_order_acquire);
    }

    [[nodiscard]] size_t capacity() const { return N; }

private:
    std::array<T, N> buf_{};
    std::atomic<size_t> head_{0};
    std::atomic<size_t> tail_{0};
};
```

### data_logger.cpp -- Main Application

```cpp
#include "sensor_types.h"
#include "spsc_ring_buffer.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gptimer.h"
#include "driver/adc.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_task_wdt.h"

#include <cstdio>
#include <cstring>

static const char* TAG = "DataLogger";

// ---------------------------------------------------------------------
// Configuration -- all sizes known at compile time
// ---------------------------------------------------------------------
static constexpr size_t NUM_CHANNELS        = 3;
static constexpr uint32_t SAMPLE_RATE_HZ    = 100;
static constexpr uint32_t TIMER_PERIOD_US   = 1000000 / SAMPLE_RATE_HZ;  // 10000 us
static constexpr uint32_t FLUSH_INTERVAL_MS = 10000;  // Write to SD every 10s
static constexpr size_t SAMPLES_PER_FLUSH   = SAMPLE_RATE_HZ * (FLUSH_INTERVAL_MS / 1000);  // 1000

// Ring buffer: 2048 slots (power of 2) > 1000 samples per flush period.
// Provides ~10 seconds of headroom if the SD write stalls briefly.
static constexpr size_t RING_BUF_CAPACITY   = 2048;

// CSV format buffer: each line is at most ~80 chars
// "1234567890123456,1234,1234,1234\n" = ~32 chars, round up to 48 for safety
static constexpr size_t CSV_LINE_MAX        = 48;
static constexpr size_t CSV_BUF_SIZE        = SAMPLES_PER_FLUSH * CSV_LINE_MAX;  // ~48KB

// ADC channels (adjust to your wiring)
static constexpr adc_channel_t ADC_CHANNELS[NUM_CHANNELS] = {
    ADC_CHANNEL_0,  // GPIO1
    ADC_CHANNEL_1,  // GPIO2
    ADC_CHANNEL_2,  // GPIO3
};

// ---------------------------------------------------------------------
// Static allocations -- no heap involvement after init
// ---------------------------------------------------------------------

// SPSC ring buffer: ISR pushes, logger task pops
static SpscRingBuffer<SensorSample, RING_BUF_CAPACITY> s_sample_ring;

// CSV formatting buffer -- statically allocated, reused every flush cycle
static char s_csv_buf[CSV_BUF_SIZE];

// Diagnostics counters
static std::atomic<uint32_t> s_samples_pushed{0};
static std::atomic<uint32_t> s_samples_dropped{0};

// ADC handle
static adc_oneshot_unit_handle_t s_adc_handle = nullptr;

// GP Timer handle
static gptimer_handle_t s_gptimer = nullptr;

// ---------------------------------------------------------------------
// ADC Initialization (ESP-IDF oneshot driver)
// ---------------------------------------------------------------------
static void adc_init() {
    adc_oneshot_unit_init_cfg_t unit_cfg = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_cfg, &s_adc_handle));

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,       // 0-3.3V range on ESP32-S3
        .bitwidth = ADC_BITWIDTH_12,
    };
    for (size_t i = 0; i < NUM_CHANNELS; i++) {
        ESP_ERROR_CHECK(adc_oneshot_config_channel(s_adc_handle, ADC_CHANNELS[i], &chan_cfg));
    }
}

// ---------------------------------------------------------------------
// Timer ISR Callback -- runs at 100Hz in ISR context
// ---------------------------------------------------------------------
// IRAM_ATTR: place in IRAM so it runs even during flash operations (e.g., SD write).
// This callback must be fast and must not allocate.
static bool IRAM_ATTR timer_isr_callback(gptimer_handle_t timer,
                                          const gptimer_alarm_event_data_t* edata,
                                          void* user_ctx) {
    SensorSample sample;
    sample.timestamp_us = esp_timer_get_time();

    // Read 3 ADC channels (oneshot reads are safe from ISR on ESP32-S3
    // when using the low-level register approach, but for the oneshot driver
    // we read from a high-priority timer task instead -- see note below).
    int raw = 0;
    for (size_t i = 0; i < NUM_CHANNELS; i++) {
        // NOTE: adc_oneshot_read() is NOT ISR-safe on ESP-IDF >= 5.x.
        // In production, use continuous ADC mode with DMA, or defer the
        // read to a high-priority task notified by this ISR.
        // For clarity, we show the deferred approach below.
        sample.adc_raw[i] = 0;  // Placeholder -- filled by adc_reader_task
    }

    if (!s_sample_ring.push(sample)) {
        s_samples_dropped.fetch_add(1, std::memory_order_relaxed);
    } else {
        s_samples_pushed.fetch_add(1, std::memory_order_relaxed);
    }

    return false;  // No need to yield to a higher-priority task from here
}

// ---------------------------------------------------------------------
// ADC Reader Task -- high-priority task triggered by timer
// ---------------------------------------------------------------------
// Since adc_oneshot_read() is not ISR-safe, we use a high-priority task
// that wakes on a task notification from the timer ISR.
static TaskHandle_t s_adc_task_handle = nullptr;

static bool IRAM_ATTR timer_notify_callback(gptimer_handle_t timer,
                                             const gptimer_alarm_event_data_t* edata,
                                             void* user_ctx) {
    BaseType_t higher_woken = pdFALSE;
    vTaskNotifyGiveFromISR(s_adc_task_handle, &higher_woken);
    return higher_woken == pdTRUE;
}

static void adc_reader_task(void* param) {
    while (true) {
        // Block until timer ISR notifies us (100Hz)
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        SensorSample sample;
        sample.timestamp_us = esp_timer_get_time();

        for (size_t i = 0; i < NUM_CHANNELS; i++) {
            int raw = 0;
            esp_err_t err = adc_oneshot_read(s_adc_handle, ADC_CHANNELS[i], &raw);
            sample.adc_raw[i] = (err == ESP_OK) ? static_cast<uint16_t>(raw) : 0;
        }

        if (!s_sample_ring.push(sample)) {
            s_samples_dropped.fetch_add(1, std::memory_order_relaxed);
        } else {
            s_samples_pushed.fetch_add(1, std::memory_order_relaxed);
        }
    }
}

// ---------------------------------------------------------------------
// Timer Initialization
// ---------------------------------------------------------------------
static void timer_init() {
    gptimer_config_t timer_cfg = {
        .clk_src = GPTIMER_CLK_SRC_DEFAULT,
        .direction = GPTIMER_COUNT_UP,
        .resolution_hz = 1000000,  // 1MHz = 1us resolution
    };
    ESP_ERROR_CHECK(gptimer_new_timer(&timer_cfg, &s_gptimer));

    gptimer_alarm_config_t alarm_cfg = {
        .alarm_count = TIMER_PERIOD_US,
        .reload_count = 0,
        .flags = {
            .auto_reload_on_alarm = true,
        },
    };
    ESP_ERROR_CHECK(gptimer_set_alarm_action(s_gptimer, &alarm_cfg));

    gptimer_event_callbacks_t cbs = {
        .on_alarm = timer_notify_callback,
    };
    ESP_ERROR_CHECK(gptimer_register_event_callbacks(s_gptimer, &cbs, nullptr));
    ESP_ERROR_CHECK(gptimer_enable(s_gptimer));
    ESP_ERROR_CHECK(gptimer_start(s_gptimer));
}

// ---------------------------------------------------------------------
// SD Card Writer (skeleton -- replace with your SDMMC/SPI SD driver)
// ---------------------------------------------------------------------
#include <cstdio>

static FILE* s_log_file = nullptr;

static bool sd_init() {
    // TODO: Initialize SDMMC or SPI SD card host
    // sdmmc_host_t host = SDMMC_HOST_DEFAULT();
    // ...
    // For this example, assume the SD card is mounted at /sdcard
    s_log_file = fopen("/sdcard/datalog.csv", "a");
    if (!s_log_file) {
        ESP_LOGE(TAG, "Failed to open log file");
        return false;
    }
    // Write CSV header if file is empty
    fseek(s_log_file, 0, SEEK_END);
    if (ftell(s_log_file) == 0) {
        fprintf(s_log_file, "timestamp_us,ch0_raw,ch1_raw,ch2_raw\n");
    }
    return true;
}

// Flush accumulated CSV data to SD card.
// Returns the number of bytes written, or -1 on error.
[[nodiscard]] static int sd_write_csv(const char* buf, size_t len) {
    if (!s_log_file) return -1;

    size_t written = fwrite(buf, 1, len, s_log_file);
    fflush(s_log_file);  // Ensure data reaches the SD card
    // Periodically fsync to guard against power loss
    fsync(fileno(s_log_file));

    if (written != len) {
        ESP_LOGE(TAG, "SD write error: wrote %u of %u bytes", written, len);
        return -1;
    }
    return static_cast<int>(written);
}

// Rotate log file to prevent unbounded growth
static void sd_rotate_if_needed() {
    if (!s_log_file) return;

    long pos = ftell(s_log_file);
    static constexpr long MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB per file

    if (pos >= MAX_FILE_SIZE) {
        fclose(s_log_file);

        // Generate filename with timestamp
        char new_name[64];
        int64_t now = esp_timer_get_time();
        snprintf(new_name, sizeof(new_name), "/sdcard/datalog_%lld.csv", now);
        rename("/sdcard/datalog.csv", new_name);

        s_log_file = fopen("/sdcard/datalog.csv", "w");
        if (s_log_file) {
            fprintf(s_log_file, "timestamp_us,ch0_raw,ch1_raw,ch2_raw\n");
        }
    }
}

// ---------------------------------------------------------------------
// Logger Task -- consumes ring buffer, formats CSV, writes to SD
// ---------------------------------------------------------------------
static void logger_task(void* param) {
    TickType_t last_flush = xTaskGetTickCount();

    while (true) {
        // Wait for the flush interval
        vTaskDelayUntil(&last_flush, pdMS_TO_TICKS(FLUSH_INTERVAL_MS));

        // Drain ring buffer into the static CSV buffer
        size_t buf_offset = 0;
        size_t sample_count = 0;

        while (auto sample = s_sample_ring.pop()) {
            // Format one CSV line using snprintf into the static buffer.
            // No heap allocation. No std::string. No std::stringstream.
            int written = snprintf(
                s_csv_buf + buf_offset,
                CSV_BUF_SIZE - buf_offset,
                "%lld,%u,%u,%u\n",
                sample->timestamp_us,
                sample->adc_raw[0],
                sample->adc_raw[1],
                sample->adc_raw[2]
            );

            if (written < 0 || buf_offset + written >= CSV_BUF_SIZE) {
                ESP_LOGW(TAG, "CSV buffer full at %u samples, flushing early", sample_count);
                break;
            }

            buf_offset += written;
            sample_count++;
        }

        if (sample_count > 0) {
            int result = sd_write_csv(s_csv_buf, buf_offset);
            if (result < 0) {
                ESP_LOGE(TAG, "SD write failed! %u samples may be lost", sample_count);
                // TODO: Consider buffering to PSRAM or retrying
            } else {
                ESP_LOGI(TAG, "Wrote %u samples (%u bytes) to SD", sample_count, buf_offset);
            }
        }

        // Check if log file needs rotation
        sd_rotate_if_needed();

        // Feed task watchdog
        esp_task_wdt_reset();
    }
}

// ---------------------------------------------------------------------
// Health Monitor Task -- periodic diagnostics
// ---------------------------------------------------------------------
static void health_monitor_task(void* param) {
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(60000));  // Every 60 seconds

        // Heap health (catches any regressions if a library allocates internally)
        size_t free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
        size_t largest_block = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
        size_t min_free = heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);

        ESP_LOGI(TAG, "HEAP  free=%u  largest_block=%u  min_ever=%u",
                 free_heap, largest_block, min_free);

        // Sample statistics
        uint32_t pushed = s_samples_pushed.load(std::memory_order_relaxed);
        uint32_t dropped = s_samples_dropped.load(std::memory_order_relaxed);
        ESP_LOGI(TAG, "STATS pushed=%u  dropped=%u  drop_rate=%.2f%%",
                 pushed, dropped,
                 pushed > 0 ? (100.0f * dropped / (pushed + dropped)) : 0.0f);

        // Stack high water marks
        ESP_LOGI(TAG, "STACK adc_reader=%u words  logger=%u words  monitor=%u words",
                 uxTaskGetStackHighWaterMark(s_adc_task_handle),
                 uxTaskGetStackHighWaterMark(nullptr),  // current task
                 uxTaskGetStackHighWaterMark(nullptr));

        // Fragmentation warning
        if (free_heap > 50000 && largest_block < 10000) {
            ESP_LOGW(TAG, "HEAP FRAGMENTATION DETECTED");
        }

        esp_task_wdt_reset();
    }
}

// ---------------------------------------------------------------------
// Application Entry Point
// ---------------------------------------------------------------------
extern "C" void app_main() {
    ESP_LOGI(TAG, "Data Logger starting...");
    ESP_LOGI(TAG, "Ring buffer capacity: %u samples", RING_BUF_CAPACITY);
    ESP_LOGI(TAG, "CSV buffer size: %u bytes", CSV_BUF_SIZE);
    ESP_LOGI(TAG, "Flush interval: %u ms (%u samples expected)",
             FLUSH_INTERVAL_MS, SAMPLES_PER_FLUSH);

    // Initialize peripherals (heap allocation happens here, during init -- this is OK)
    adc_init();
    if (!sd_init()) {
        ESP_LOGE(TAG, "SD card init failed -- halting");
        return;
    }

    // Create tasks BEFORE starting the timer
    // Stack sizes chosen with headroom; monitor high water marks and adjust.
    xTaskCreatePinnedToCore(
        adc_reader_task,
        "adc_reader",
        4096,           // 4KB stack (snprintf not used here, just ADC reads)
        nullptr,
        configMAX_PRIORITIES - 1,  // Highest app priority -- must not miss samples
        &s_adc_task_handle,
        1               // Pin to core 1 (core 0 runs WiFi/BT if enabled)
    );

    TaskHandle_t logger_handle = nullptr;
    xTaskCreatePinnedToCore(
        logger_task,
        "logger",
        8192,           // 8KB stack (snprintf uses ~1KB internally)
        nullptr,
        5,              // Medium priority -- SD writes can take time
        &logger_handle,
        1
    );

    xTaskCreate(
        health_monitor_task,
        "health_mon",
        4096,
        nullptr,
        2,              // Low priority
        nullptr
    );

    // Subscribe tasks to the task watchdog (ESP-IDF 5.x)
    esp_task_wdt_add(logger_handle);

    // Start the 100Hz timer -- this begins producing samples
    timer_init();

    ESP_LOGI(TAG, "Data Logger running.");
}
```

## Key Design Decisions Explained

### Why the crashes stop with this design

| Your original code | This design | Why it matters |
|---|---|---|
| `std::vector<SensorSample>` grows dynamically | `SpscRingBuffer<SensorSample, 2048>` statically allocated | Zero alloc/free after init. No fragmentation possible. |
| `std::string` for CSV formatting | `char s_csv_buf[48000]` + `snprintf` | Fixed buffer, no heap. `snprintf` writes directly into it. |
| Accumulate then copy | Ring buffer drains directly into CSV buffer | No intermediate containers. Single pass. |
| Implicit `new`/`delete` from STL | All storage is `static` | MISRA C++ Rule 21.6.1: no dynamic memory after initialization. |

### Why SPSC ring buffer instead of a FreeRTOS queue

FreeRTOS queues work, but the SPSC ring buffer is lighter:
- No mutex overhead (lock-free with atomics).
- Power-of-2 bitmask indexing is a single AND instruction vs. modulo division.
- The ISR callback is minimal -- just a `push()` and a task notification.
- FreeRTOS queues copy data; the ring buffer also copies, but with zero kernel overhead.

If you prefer FreeRTOS primitives for simplicity, a `xQueueSend` / `xQueueReceive` pair will also work without fragmentation, since FreeRTOS queues use statically-allocated internal storage when created with `xQueueCreateStatic()`.

### Why `snprintf` instead of `std::string` or `std::stringstream`

`snprintf` writes directly into a pre-allocated `char[]` buffer. It never allocates heap memory. In contrast:
- `std::string::operator+=` allocates on the heap with every append that exceeds the small string optimization (SSO) threshold (~15 bytes on most implementations).
- `std::stringstream` allocates internally for its string buffer.
- At 100Hz x 3 channels x 10 seconds = 3000 format operations per flush cycle, that is 3000 potential heap allocations you avoid.

### Task priority and core pinning

- **`adc_reader` at highest priority on core 1**: Ensures 100Hz sampling is never preempted by the logger or monitor. Core 1 is chosen because core 0 handles WiFi/BT protocol tasks on ESP32-S3.
- **`logger` at medium priority**: SD card writes can take 50-200ms. This must not block ADC reading.
- **`health_mon` at low priority**: Purely diagnostic -- runs when nothing else needs the CPU.

### File rotation

Without rotation, a single log file will grow indefinitely and eventually fill the SD card. The `sd_rotate_if_needed()` function closes the file at 10MB and renames it, preventing unbounded growth over weeks of operation.

### Watchdog integration

For weeks-long operation, a watchdog is essential. If the logger task hangs (SD card failure, filesystem corruption), the task watchdog will trigger a system reset rather than silently failing. The health monitor logs diagnostic data before any watchdog-triggered reset, giving you post-mortem information.

## Compile Flags

Add these to your `CMakeLists.txt` to catch issues at compile time:

```cmake
# In your component's CMakeLists.txt
target_compile_options(${COMPONENT_LIB} PRIVATE
    -fno-exceptions        # No exception overhead (code size + stack)
    -fno-rtti              # No RTTI tables (ROM savings)
    -fstack-usage          # Generate .su files for stack analysis
    -Wall -Wextra -Werror
    -Wno-missing-field-initializers  # ESP-IDF structs trigger this
)
```

## Verification Checklist

After deploying, monitor these values via the health monitor log output:

1. **`largest_block` should stay constant** over days. If it decreases, something is still allocating dynamically (likely an ESP-IDF library or driver).
2. **`dropped` should stay at 0**. If samples are dropped, either the ring buffer is too small or the SD write is taking too long. Increase `RING_BUF_CAPACITY` or optimize SD writes (larger block sizes, faster SPI clock).
3. **Stack high water marks** should show at least 25% remaining. If a task is close to its limit, increase the stack size in `xTaskCreatePinnedToCore`.
4. **Uptime beyond 7 days** without heap metric degradation confirms the fix.
