# STM32 Pitfalls, CubeMX Best Practices & Hard-to-Debug Issues

## Table of Contents

1. [CubeMX Code Generation Pitfalls](#1-cubemx-code-generation-pitfalls)
2. [HAL vs LL Driver Selection](#2-hal-vs-ll-driver-selection)
3. [Hard-to-Debug Embedded Issues](#3-hard-to-debug-embedded-issues)
4. [Embedded Code Review Checklist](#4-embedded-code-review-checklist)

---

## 1. CubeMX Code Generation Pitfalls

### Custom code gets overwritten on regeneration

Only code between `/* USER CODE BEGIN */` and `/* USER CODE END */` markers survives regeneration. Everything else is replaced.

**Rules:**
- Never write application logic directly in CubeMX-generated files.
- Place all business logic in separate source files outside `Core/Src/`.
- Use `USER CODE` blocks only for calling into your application code (e.g., `App_Init()`, `App_MainLoop()`).

### Middleware configuration conflicts

CubeMX regeneration overwrites middleware configuration:
- **FreeRTOS:** Heap scheme selection (`heap_4.c` vs `heap_5.c`), `FreeRTOSConfig.h` tunables.
- **USB:** Descriptor strings, endpoint buffer sizes, class-specific callbacks.
- **LWIP:** `lwipopts.h` buffer pool sizes, TCP window settings.

**Fix:** Use CubeMX for peripheral init only. Maintain middleware configuration in your own files and `#include` them, or patch after generation with a script.

### Clock configuration gotchas

- PLL configuration errors silently fall back to HSI (16 MHz on most STM32). Your code runs 10x slower with no warning.
- USB requires exactly 48 MHz on the USB peripheral clock. A wrong PLL-Q divider causes enumeration failure.
- Ethernet MII/RMII needs 25/50 MHz reference clock from PHY or MCO.

**Always verify at startup:**
```c
void App_VerifyClocks(void) {
    SystemCoreClockUpdate();
    assert_param(SystemCoreClock == 168000000U); // expected HCLK
    // Check USB clock if used
    // assert_param(__HAL_RCC_GET_USB_OTG_FS_SOURCE() == RCC_USBCLKSOURCE_PLL);
}
```

### Recommended project structure

```
project/
├── Core/           # CubeMX-generated (don't edit outside USER CODE markers)
│   ├── Inc/
│   └── Src/
├── Drivers/        # CubeMX-generated HAL/LL/CMSIS (never edit)
├── App/            # YOUR application code (never touched by CubeMX)
│   ├── Inc/
│   └── Src/
├── Lib/            # Third-party libraries (ETL, nanopb, printf, etc.)
└── Tests/          # Host-side unit tests (compile with GCC, not cross-compiler)
```

Add `App/` to the include path in your build system. CubeMX will not delete it.

---

## 2. HAL vs LL Driver Selection

| Peripheral | Use HAL | Use LL | Rationale |
|---|---|---|---|
| USB, Ethernet, SDMMC | Yes | No | Complex state machines; HAL handles protocol-level details |
| SPI (ISR/DMA) | Either | Preferred | LL avoids HAL lock/state overhead in hot paths |
| UART (ISR) | Either | Preferred | LL inline reads DR register faster, lower latency |
| GPIO toggling | No | Yes | `HAL_GPIO_WritePin` has branch overhead; LL uses BSRR directly |
| I2C | Yes | No | HAL handles clock stretching, NACK recovery, repeated start |
| Timer (PWM) | HAL for setup | LL for runtime | Configure with HAL once, update CCR with LL at runtime |
| ADC (single shot) | Yes | No | HAL calibration and sequencer setup is complex |
| ADC (continuous/DMA) | HAL for init | LL for status | Start with HAL, poll/check flags with LL |

**Cost of HAL:** ~2-5 KB flash per peripheral module, microseconds per call due to lock/unlock and state checks.

**Cost of LL:** Near-zero overhead (static inline wrappers around register access). Less portable across STM32 families (register layouts differ between F4, H7, G4, etc.).

**Mixing HAL and LL:** Fully supported. Use HAL for init and complex operations, LL for performance-critical runtime access. Ensure you do not break HAL internal state (e.g., do not change peripheral config that HAL tracks).

---

## 3. Hard-to-Debug Embedded Issues

### 3.1 Cache coherency (Cortex-M7: STM32F7, H7)

**Symptom:** DMA returns stale data intermittently. Works perfectly under debugger (debugger invalidates cache as side effect).

**Root cause:** D-cache holds stale copy of memory that DMA has updated, or DMA reads stale memory because D-cache has not been flushed.

**Fixes (pick one):**
- Configure MPU region for DMA buffers as non-cacheable:
  ```c
  // MPU region: Device or Normal Non-Cacheable
  MPU_InitStruct.IsBufferable = MPU_ACCESS_NOT_BUFFERABLE;
  MPU_InitStruct.IsCacheable  = MPU_ACCESS_NOT_CACHEABLE;
  ```
- Manually maintain cache:
  ```c
  SCB_CleanDCache_by_Addr(tx_buf, len);       // before DMA TX
  SCB_InvalidateDCache_by_Addr(rx_buf, len);   // after DMA RX complete
  ```
- Place DMA buffers in a non-cacheable RAM section (e.g., SRAM4 on H7).

**Key detail:** Cache operations must be aligned to 32-byte cache lines. Buffers sharing a cache line with other data will corrupt that data on invalidation.

### 3.2 Priority inversion in RTOS

**Symptom:** High-priority task starves for hundreds of milliseconds. System appears to hang but recovers. Timing-dependent, hard to reproduce.

**Root cause:** Low-priority task holds mutex, medium-priority task preempts it, high-priority task blocks on the same mutex indefinitely.

**Fixes:**
- Use priority inheritance mutexes (`xSemaphoreCreateMutex()` in FreeRTOS enables inheritance by default).
- Redesign to avoid sharing mutexes between tasks of different priorities.
- Use lock-free queues (`xQueueSend`/`xQueueReceive`) instead of shared-state-with-mutex.

### 3.3 Stack-heap collision

**Symptom:** Random crashes, corrupted variables, behavior changes when adding or removing local variables. Often manifests differently in Debug vs Release builds.

**Root cause:** Task stack grows into heap (or another task's stack). No hardware protection by default on Cortex-M.

**Fixes:**
- Enable FreeRTOS stack overflow detection:
  ```c
  #define configCHECK_FOR_STACK_OVERFLOW 2  // pattern check (most thorough)
  ```
- Monitor at runtime:
  ```c
  UBaseType_t hwm = uxTaskGetStackHighWaterMark(NULL);
  // hwm < 64 words = dangerously close
  ```
- Configure MPU guard region at the bottom of each stack.
- Use linker script to place stack and heap in separate RAM regions.

### 3.4 Flash write-while-read stall

**Symptom:** System freezes for 10-100 ms during settings save to internal flash. Interrupts appear to stop. Watchdog may fire.

**Root cause:** Writing/erasing internal flash stalls ALL read access to the same flash bank, including instruction fetch. The entire CPU halts until the flash operation completes.

**Fixes:**
- Execute flash write routine from RAM:
  ```c
  __attribute__((section(".RamFunc")))
  void Flash_WriteFromRAM(uint32_t addr, uint32_t* data, uint32_t len) {
      // All called functions must also be in RAM
  }
  ```
- Use dual-bank flash: write bank 2 while executing from bank 1.
- Store settings in external flash (QSPI/SPI NOR) instead.
- Schedule flash writes during idle periods and disable time-critical interrupts.

### 3.5 NVIC priority misconfiguration (FreeRTOS)

**Symptom:** `configASSERT` fires in `port.c`, or HardFault inside `xQueueSendFromISR` / `xSemaphoreGiveFromISR`. May work for a while then crash under load.

**Root cause:** ISR priority is numerically lower (= higher priority on ARM) than `configMAX_SYSCALL_INTERRUPT_PRIORITY`. ARM Cortex-M uses inverted priority numbering: lower number = higher priority.

**Fix:** All ISRs that call FreeRTOS API must have priority ≥ `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (numerically higher value = lower priority).

```c
// BAD: Priority 1 is above the FreeRTOS safe ceiling
NVIC_SetPriority(USART1_IRQn, 1);

// GOOD: Priority 6 is below the ceiling (safe for FreeRTOS API)
NVIC_SetPriority(USART1_IRQn, configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY + 1);
```

**Why hard:** ARM's inverted numbering is counterintuitive. Additionally, `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (unshifted, human-readable) vs `configMAX_SYSCALL_INTERRUPT_PRIORITY` (shifted, used internally by FreeRTOS) causes confusion. Newly enabled interrupts default to priority 0 (highest) — if their handler calls FreeRTOS API, immediate crash.

### 3.6 Peripheral clock not enabled

**Symptom:** HardFault with BusFault PRECISERR (BFAR points to peripheral address) immediately on first register access.

**Root cause:** Peripheral clock gate not enabled in RCC. The bus access to an unclocked peripheral triggers a bus fault.

**Fix:**
```c
// ALWAYS enable clock before any register access
__HAL_RCC_USART2_CLK_ENABLE();
// Small delay may be needed (one APB clock cycle)
__NOP();

// Debug: check RCC enable register directly
if (!(RCC->APB1ENR & RCC_APB1ENR_USART2EN)) {
    Error_Handler(); // clock not enabled
}
```

**Tip:** CubeMX handles this in `MX_xxx_Init()`. If you add peripherals manually, you must enable the clock yourself.

---

## 4. Embedded Code Review Checklist

### Critical Checks (reject PR if violated)

| Category | Check | Why |
|---|---|---|
| Memory | No `malloc`/`new` in ISR or real-time path | Heap is non-deterministic; can fragment and block |
| Memory | All buffers have compile-time size bounds | Unbounded buffers cause stack overflow or heap exhaustion |
| Volatile | Hardware registers accessed through `volatile` pointers | Compiler may optimize away or reorder register reads/writes |
| Volatile | `volatile` NOT used for thread synchronization | `volatile` has no memory ordering guarantees; use `std::atomic` |
| ISR | ISR body completes in < 1 us (or has documented justification) | Long ISRs block other interrupts and break timing |
| ISR | No blocking calls in ISR (`mutex.lock`, `printf`, `HAL_Delay`) | Blocking in ISR = deadlock or watchdog reset |
| ISR | Uses `FromISR` RTOS API variants (`xQueueSendFromISR`, etc.) | Non-ISR variants may block and corrupt RTOS scheduler state |
| Concurrency | All shared data protected (mutex, atomic, or critical section) | Data races cause intermittent corruption |
| Stack | Task stack sizes verified with `uxTaskGetStackHighWaterMark()` | Unverified stacks will eventually overflow |
| Types | Fixed-width types (`uint32_t`, `int16_t`) for hardware interfaces | `int` size varies by platform; register widths are fixed |

### Important Checks (discuss if violated)

| Category | Check | Why |
|---|---|---|
| RAII | Resources released via RAII guards (locks, GPIO, peripherals) | Manual release is error-prone on early returns and exceptions |
| Error handling | HAL/driver return codes not silently discarded | `HAL_OK` != guaranteed; silent failure masks hardware issues |
| Naming | ISR handler names match startup vector table exactly | Misspelled handler falls through to `Default_Handler` (infinite loop) |
| DMA | DMA buffers placed in non-cacheable region or cache maintained | Cache coherency bugs are intermittent and near-impossible to reproduce |
| Alignment | DMA buffers aligned to cache line size (32 bytes on M7; 4 bytes sufficient on M0/M3/M4) | Misaligned cache maintenance corrupts adjacent data |
| NVIC | ISR priorities ≥ `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` for any ISR calling FreeRTOS API | Lower priority number = higher priority on ARM; wrong setting corrupts scheduler |
