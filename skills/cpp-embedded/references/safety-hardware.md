# Safety and Hardware Reference — Embedded C and C++

## Table of Contents
1. [MPU Protection Patterns](#1-mpu-protection-patterns)
2. [Watchdog Hierarchy](#2-watchdog-hierarchy)
3. [Safety-Critical Fault Recovery](#3-safety-critical-fault-recovery)
4. [Peripheral Protocol Selection](#4-peripheral-protocol-selection)
5. [Linker Script Memory Placement](#5-linker-script-memory-placement)

---

## 1. MPU Protection Patterns

Cortex-M MPU capabilities vary by core: M3/M4 support up to 8 regions, M7 up to 16 regions.
Regions are numbered by priority (higher number overrides lower on overlap). Plan region
assignments carefully — you will run out.

| Pattern | MPU Regions | Purpose |
|---|---|---|
| Null pointer guard | 1 | Region 0 at 0x0, size 32B-256B, no-access. Catches null dereferences immediately |
| Stack overflow guard | 1 per task | Region below stack bottom, no-access. Catches overflow at exact instruction |
| Peripheral isolation | 1-2 | Restrict task access to only its assigned peripherals |
| Flash write-protect | 1 | Prevent accidental writes to code/const region |
| RTOS task isolation | 2-3 per task | Stack, data, and peripheral regions; reconfigured at context switch |

**Key considerations:**
- Configure MPU before enabling — use a DMB barrier between config and enable
- Limited regions require careful planning — prefer message passing over shared memory
- RTOS context switch must reconfigure MPU (~100 cycle overhead)

### Null Pointer Guard Setup (STM32 HAL)

```c
void mpu_enable_null_guard(void) {
    HAL_MPU_Disable();

    MPU_Region_InitTypeDef region = {
        .Enable           = MPU_REGION_ENABLE,
        .Number           = MPU_REGION_NUMBER0,
        .BaseAddress      = 0x00000000,
        .Size             = MPU_REGION_SIZE_256B,
        .SubRegionDisable = 0x00,
        .TypeExtField     = MPU_TEX_LEVEL0,
        .AccessPermission = MPU_REGION_NO_ACCESS,
        .DisableExec      = MPU_INSTRUCTION_ACCESS_DISABLE,
        .IsShareable      = MPU_ACCESS_NOT_SHAREABLE,
        .IsCacheable      = MPU_ACCESS_NOT_CACHEABLE,
        .IsBufferable     = MPU_ACCESS_NOT_BUFFERABLE,
    };
    HAL_MPU_ConfigRegion(&region);

    __DMB();  /* Ensure all MPU config writes complete before enable */
    HAL_MPU_Enable(MPU_PRIVILEGED_DEFAULT);
}
```

Any dereference of a null (or near-null) pointer now triggers a MemManage fault instead of
silently reading whatever lives at address 0.

---

## 2. Watchdog Hierarchy

Ranked by robustness (IEC 61508 compliance, lowest to highest):

1. **Simple watchdog** — Periodic kick from main loop. Detects hangs only. Trivial to
   implement but misses stuck-in-wrong-loop and partial-system failures.

2. **Window watchdog** — Must be kicked within a time window (not too early, not too late).
   Detects both stuck loops AND runaway fast execution.

3. **Question-Answer watchdog** — Watchdog sends a challenge value, software must return the
   correct response (e.g., CRC of challenge + expected sequence number). Verifies program
   sequence integrity, not just liveness. Detects when code is stuck in the wrong loop —
   even if that loop kicks a simple watchdog.

4. **Task-level supervisor** — Each RTOS task reports alive status to a supervisor task.
   Supervisor kicks hardware watchdog only if ALL tasks reported in time. This catches
   per-task hangs that a main-loop watchdog misses.

### Task-Level Supervisor Pattern

```c
static volatile uint32_t task_alive_bits;
#define TASK_SENSOR_BIT  (1U << 0)
#define TASK_COMMS_BIT   (1U << 1)
#define ALL_TASKS_ALIVE  (TASK_SENSOR_BIT | TASK_COMMS_BIT)

void supervisor_task(void *param) {
    (void)param;
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(1000));
        if ((task_alive_bits & ALL_TASKS_ALIVE) == ALL_TASKS_ALIVE) {
            HAL_IWDG_Refresh(&hiwdg);
            task_alive_bits = 0;
        }
        /* If any task didn't check in, watchdog will fire */
    }
}

/* Each task calls this periodically: */
void task_check_in(uint32_t task_bit) {
    task_alive_bits |= task_bit;
}
```

This catches per-task hangs that a simple main-loop watchdog would miss. If the sensor task
deadlocks, the supervisor never sees `TASK_SENSOR_BIT` and lets the watchdog reset.

---

## 3. Safety-Critical Fault Recovery

### Patterns

- **Pre-reset logging:** Write fault reason + registers to NVM (EEPROM/flash) before watchdog
  reset. Without this, you have no post-mortem data after a field failure.
- **Boot-count limiter:** Track consecutive fault-resets. After N failures, enter safe mode
  instead of normal boot. Prevents infinite reset loops.
- **Dual-channel redundancy:** Two independent processing paths compare results. Disagreement
  triggers safe state.
- **Defensive programming:** `assert()` in debug builds, graceful degradation in release.

### IEC 61508 Safety Integrity Levels

| SIL Level | Requirement |
|---|---|
| SIL 1-2 | Single-channel with diagnostics (watchdog, CRC, stack monitoring) |
| SIL 3 | Dual-channel or single-channel with extensive self-diagnostics |
| SIL 4 | Dual-channel with diverse redundancy |

### Boot-Count Limiter

```c
#define MAX_BOOT_FAILURES 3

void app_boot(void) {
    uint32_t boot_count = nvm_read_boot_count();
    if (boot_count >= MAX_BOOT_FAILURES) {
        enter_safe_mode();  /* Reduced functionality, diagnostic only */
        return;
    }
    nvm_write_boot_count(boot_count + 1);

    /* ... normal initialization ... */

    /* If we get here, boot was successful */
    nvm_write_boot_count(0);  /* Reset counter */
}
```

The counter increments before init and clears after success. If the device crashes during
init three times in a row, it enters safe mode on the fourth boot.

---

## 4. Peripheral Protocol Selection

| Protocol | Speed | Wires | Topology | Best For |
|---|---|---|---|---|
| UART | Up to ~1 Mbps | 2 (TX/RX) | Point-to-point | Debug, GPS, Bluetooth, modems |
| I2C | 100k/400k/1M/3.4M | 2 (SDA/SCL) | Multi-drop bus | Sensors, EEPROMs, low-speed devices |
| SPI | Up to 50+ MHz | 4 (MOSI/MISO/SCK/CS) | Master + N slaves | ADCs, displays, flash, high-speed sensors |
| CAN | 1 Mbps classic / 5+ Mbps FD | 2 (CANH/CANL) | Multi-master bus | Automotive, industrial, safety-critical |

**Selection factors:**
- **EMI/noise:** CAN has differential signaling and built-in error detection — use it in
  electrically noisy environments (automotive, industrial).
- **Speed:** SPI wins for raw throughput (displays, high-speed ADCs, external flash).
- **Wiring simplicity:** I2C uses only 2 wires for many devices, but limited by bus capacitance
  and address conflicts.
- **Distance:** UART and CAN work over longer distances. I2C is limited to ~1 meter without
  bus extenders. SPI is short-distance only.
- **Industry standard:** CAN for automotive (ISO 11898), UART/Modbus for industrial.

---

## 5. Linker Script Memory Placement

### ARM Cortex-M Memory Regions (STM32H7 Example)

| Region | Address | Speed | Use For |
|---|---|---|---|
| FLASH | 0x08000000 | Slow (wait states) | Code, const data, lookup tables |
| ITCM | 0x00000000 | Zero wait state | Time-critical ISRs, control loops |
| DTCM | 0x20000000 | Zero wait state | Stack, frequently accessed data |
| AXI SRAM | 0x24000000 | 1-2 wait states | General data, heap |
| SRAM4 | 0x38000000 | Non-cached | DMA buffers (no cache coherency issues) |

**Key optimization:** Place time-critical ISRs in ITCM for deterministic execution. This avoids
flash wait states and cache miss variability, yielding 15%+ speed improvement for tight loops.
Profile before choosing what to place — ITCM is limited (typically 64K).

**AAPCS requirement:** Stack must be 8-byte aligned at public function boundaries.

### Linker Script: ITCM and DMA Buffer Sections

```ld
MEMORY {
    FLASH   (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
    ITCMRAM (xrw) : ORIGIN = 0x00000000, LENGTH = 64K
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    RAM     (xrw) : ORIGIN = 0x24000000, LENGTH = 512K
    SRAM4   (xrw) : ORIGIN = 0x38000000, LENGTH = 64K
}

.itcm_text : {
    *(.itcm_text)
    *(.itcm_text*)
} >ITCMRAM AT> FLASH

.dma_buf (NOLOAD) : {
    . = ALIGN(32);
    *(.dma_buf)
    . = ALIGN(32);
} >SRAM4
```

The `AT> FLASH` directive stores the ITCM code in flash and copies it to ITCM at startup
(your startup code must handle this copy — check `__itcm_text_start__` / `__itcm_text_end__`
symbols). The `NOLOAD` directive means DMA buffers are not initialized from flash.

### C Attributes for Section Placement

```c
/* Place time-critical code in ITCM — zero wait state execution */
__attribute__((section(".itcm_text")))
void critical_control_loop(void) {
    /* Runs from ITCM RAM, deterministic timing */
}

/* Place DMA buffer in non-cached SRAM4 — no cache maintenance needed */
__attribute__((section(".dma_buf"), aligned(32)))
static uint8_t dma_rx_buf[256];
```

Always verify placement in the `.map` file after linking. Search for your symbol name and
confirm the address falls within the expected memory region.
