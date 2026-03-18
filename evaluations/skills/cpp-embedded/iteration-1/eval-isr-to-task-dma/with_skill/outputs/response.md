# Passing ADC DMA Samples from ISR to FreeRTOS Task (STM32F4)

## Approach

The best pattern here is a **statically-allocated SPSC (Single-Producer Single-Consumer) ring buffer of fixed-size sample blocks**, combined with a **FreeRTOS task notification** to wake the processing task without polling.

Key design decisions:

1. **No malloc, no heap** -- all buffers are statically allocated with known sizes at compile time. This satisfies MISRA C 2012 Rule 21.3 and eliminates fragmentation risk.

2. **Block-level transfer, not sample-level** -- since samples arrive in bursts of 16 x `uint16_t`, we define a `AdcBlock` struct holding 16 samples and push entire blocks through the ring buffer. This is more efficient than pushing 16 individual samples per ISR invocation.

3. **Lock-free SPSC ring buffer** -- the DMA complete ISR is the single producer; the processing task is the single consumer. With `std::atomic` head/tail and correct memory ordering, no critical sections or mutexes are needed. The ISR never blocks.

4. **FreeRTOS task notification as a lightweight semaphore** -- after pushing a block, the ISR calls `vTaskNotifyGiveFromISR()` to wake the consumer task. This avoids wasteful polling with `vTaskDelay()` and gives immediate wakeup with minimal ISR overhead.

5. **Double-buffered DMA** -- we use two DMA buffers (ping-pong) so DMA fills one while we copy from the other. This prevents data loss between the DMA complete callback and the copy into the ring buffer.

## Architecture

```
DMA (hardware)
    |
    v
[dma_buf_0 / dma_buf_1]   <-- ping-pong, aligned, static
    |
    | (HAL_ADC_ConvCpltCallback -- ISR context)
    v
[SpscRingBuffer<AdcBlock, 8>]  <-- lock-free, static
    |
    | (xTaskNotifyGive wakes task)
    v
[adc_processing_task]         <-- FreeRTOS task, does real work
```

## Full Code

### adc_types.h -- Shared type definitions

```cpp
#pragma once

#include <cstdint>
#include <cstddef>

// Number of ADC samples per DMA burst
static constexpr size_t kAdcSamplesPerBlock = 16;

// One block of ADC samples -- matches a single DMA transfer
struct AdcBlock {
    uint16_t samples[kAdcSamplesPerBlock];
};
```

### spsc_ring_buffer.h -- Lock-free SPSC ring buffer

```cpp
#pragma once

#include <atomic>
#include <array>
#include <cstddef>
#include <cstdint>

/// Lock-free Single-Producer Single-Consumer ring buffer.
/// N must be a power of 2.
/// Producer (ISR) calls push(). Consumer (task) calls pop().
/// No mutexes, no critical sections, no dynamic allocation.
template<typename T, size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "N must be a power of 2");
    static_assert(N >= 2, "N must be at least 2");
    static constexpr size_t kMask = N - 1;

public:
    /// Push an item. Called from ISR (producer) only.
    /// Returns false if the buffer is full (oldest data is NOT overwritten).
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & kMask;

        // If next == tail, the buffer is full
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;
        }

        buf_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    /// Pop an item. Called from task (consumer) only.
    /// Returns true and writes to *out if data was available.
    /// Returns false if the buffer is empty.
    [[nodiscard]] bool pop(T& out) {
        const size_t tail = tail_.load(std::memory_order_relaxed);

        if (tail == head_.load(std::memory_order_acquire)) {
            return false;  // Empty
        }

        out = buf_[tail];
        tail_.store((tail + 1) & kMask, std::memory_order_release);
        return true;
    }

    bool empty() const {
        return head_.load(std::memory_order_acquire) ==
               tail_.load(std::memory_order_acquire);
    }

    size_t capacity() const { return N - 1; }

private:
    std::array<T, N> buf_{};
    // head_ and tail_ on separate cache lines is ideal, but on Cortex-M4
    // (no data cache) it doesn't matter. Keep them together for simplicity.
    std::atomic<size_t> head_{0};
    std::atomic<size_t> tail_{0};
};
```

**Memory ordering rationale:**
- `relaxed` on the producer's own head read -- only the producer writes head, so no synchronization needed for self-reads.
- `acquire` when reading the *other* side's index -- this synchronizes with the other side's `release` store, ensuring the data written before the index update is visible.
- `release` when storing our own index -- publishes all prior writes (the data) to the other side.

### adc_isr_task.h -- Module interface

```cpp
#pragma once

#include "FreeRTOS.h"
#include "task.h"

/// Initialize the ADC + DMA hardware and create the processing task.
/// Call once from main() before starting the scheduler.
void adc_processing_init();

/// The FreeRTOS task function. Created internally by adc_processing_init().
/// Do not call directly.
void adc_processing_task(void* params);
```

### adc_isr_task.cpp -- Implementation

```cpp
#include "adc_isr_task.h"
#include "adc_types.h"
#include "spsc_ring_buffer.h"

#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"

#include <cstring>
#include <cstdint>

// ---------------------------------------------------------------------------
// Static storage -- no heap allocation anywhere
// ---------------------------------------------------------------------------

// Ring buffer: 8 slots = 7 usable (SPSC wastes one slot to distinguish
// full from empty). At 1kHz input rate, this gives 7ms of buffering.
// Increase to 16 if the processing task may be delayed by other work.
static SpscRingBuffer<AdcBlock, 8> s_adc_ring;

// Double-buffered DMA target. The STM32F4 has no D-cache, so no
// cache management is needed. We still align to 4 bytes for DMA.
// Using half-complete + complete callbacks with circular DMA gives us
// ping-pong behavior automatically.
alignas(4) static uint16_t s_dma_buf[kAdcSamplesPerBlock * 2];

// Task handle for notification from ISR
static TaskHandle_t s_processing_task_handle = nullptr;

// ADC handle (assumed configured elsewhere by CubeMX-generated code)
extern ADC_HandleTypeDef hadc1;

// Overflow counter for diagnostics
static volatile uint32_t s_overflow_count = 0;

// ---------------------------------------------------------------------------
// DMA complete callbacks (called from ISR context)
// ---------------------------------------------------------------------------

/// Called when DMA fills the first half of s_dma_buf (samples 0..15)
extern "C" void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef* hadc) {
    if (hadc != &hadc1) return;

    AdcBlock block;
    std::memcpy(block.samples, &s_dma_buf[0],
                kAdcSamplesPerBlock * sizeof(uint16_t));

    if (!s_adc_ring.push(block)) {
        // Ring full -- processing task is not keeping up.
        // Increment counter for diagnostics; do NOT block in ISR.
        s_overflow_count++;
        return;
    }

    // Wake the processing task
    if (s_processing_task_handle != nullptr) {
        BaseType_t higher_priority_woken = pdFALSE;
        vTaskNotifyGiveFromISR(s_processing_task_handle,
                               &higher_priority_woken);
        portYIELD_FROM_ISR(higher_priority_woken);
    }
}

/// Called when DMA fills the second half of s_dma_buf (samples 16..31)
extern "C" void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
    if (hadc != &hadc1) return;

    AdcBlock block;
    std::memcpy(block.samples, &s_dma_buf[kAdcSamplesPerBlock],
                kAdcSamplesPerBlock * sizeof(uint16_t));

    if (!s_adc_ring.push(block)) {
        s_overflow_count++;
        return;
    }

    if (s_processing_task_handle != nullptr) {
        BaseType_t higher_priority_woken = pdFALSE;
        vTaskNotifyGiveFromISR(s_processing_task_handle,
                               &higher_priority_woken);
        portYIELD_FROM_ISR(higher_priority_woken);
    }
}

// ---------------------------------------------------------------------------
// Processing task
// ---------------------------------------------------------------------------

void adc_processing_task(void* params) {
    (void)params;
    AdcBlock block;

    for (;;) {
        // Block until ISR signals new data. Timeout after 100ms as a
        // watchdog -- if no data arrives, something is wrong with DMA.
        uint32_t notification = ulTaskNotifyTake(pdTRUE,
                                                  pdMS_TO_TICKS(100));

        if (notification == 0) {
            // Timeout -- no ADC data in 100ms. Handle error:
            // e.g., log, toggle an error LED, or restart DMA.
            continue;
        }

        // Drain all available blocks (there could be more than one if
        // the task was delayed).
        while (s_adc_ring.pop(block)) {
            // -------------------------------------------------------
            // Your processing goes here. Examples:
            //
            //   - Compute RMS of the 16 samples
            //   - Apply a digital filter (IIR/FIR)
            //   - Accumulate into a larger buffer for FFT
            //   - Threshold detection / peak finding
            //
            // The block is a local copy -- safe to take your time.
            // -------------------------------------------------------

            process_adc_block(block);  // user-defined
        }
    }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

void adc_processing_init() {
    // Create the processing task. 512 words = 2048 bytes of stack,
    // which is plenty for basic DSP. Increase if using large local arrays.
    BaseType_t result = xTaskCreate(
        adc_processing_task,
        "ADC_Proc",
        512,                         // Stack depth in words
        nullptr,                     // Task parameter
        configMAX_PRIORITIES - 1,    // High priority -- processes sensor data
        &s_processing_task_handle
    );
    configASSERT(result == pdPASS);

    // Start ADC with DMA in circular mode.
    // CubeMX should have configured:
    //   - ADC1 with DMA in circular mode
    //   - Timer trigger at 1kHz (TIM2 TRGO, etc.) or continuous mode
    //     with prescaler to achieve 1kHz burst rate
    //   - 16 conversions per trigger (scan mode with 16 channels,
    //     or 16 conversions of a single channel in sequence)
    HAL_ADC_Start_DMA(&hadc1,
                       reinterpret_cast<uint32_t*>(s_dma_buf),
                       kAdcSamplesPerBlock * 2);
}
```

### Example processing function

```cpp
#include "adc_types.h"
#include <cstdint>
#include <cmath>

// Example: compute RMS value of a block
static float compute_rms(const AdcBlock& block) {
    uint32_t sum_sq = 0;
    for (size_t i = 0; i < kAdcSamplesPerBlock; ++i) {
        uint32_t s = block.samples[i];
        sum_sq += s * s;
    }
    return sqrtf(static_cast<float>(sum_sq) / kAdcSamplesPerBlock);
}

void process_adc_block(const AdcBlock& block) {
    float rms = compute_rms(block);

    // Do something with rms:
    // - Send over UART
    // - Update a control loop setpoint
    // - Store in a result buffer for the display task
    (void)rms;
}
```

### main.cpp integration

```cpp
#include "adc_isr_task.h"
#include "FreeRTOS.h"
#include "task.h"

int main() {
    HAL_Init();
    SystemClock_Config();

    // Peripheral init (CubeMX-generated)
    MX_GPIO_Init();
    MX_DMA_Init();    // DMA must be initialized BEFORE ADC
    MX_ADC1_Init();
    MX_TIM2_Init();   // Timer that triggers ADC at 1kHz

    // Initialize the ADC processing module
    adc_processing_init();

    // Start the scheduler -- never returns
    vTaskStartScheduler();

    // Should never reach here
    for (;;) {}
}
```

## Why This Design

### No malloc, fully deterministic

Every byte of memory is accounted for at compile time:

| Item | Size (bytes) | Storage |
|------|-------------|---------|
| `s_dma_buf` | 64 | `.bss` (static) |
| `s_adc_ring` (8 x `AdcBlock`) | 264 | `.bss` (static) |
| Task stack | 2048 | FreeRTOS heap (allocated once at init) |
| **Total** | **~2.4 KB** | |

No allocation happens after `adc_processing_init()` returns.

### ISR is minimal

The DMA complete callback does exactly three things:
1. `memcpy` 32 bytes from the DMA buffer into a local `AdcBlock`
2. Push the block into the ring buffer (a few atomic stores)
3. Send a task notification (one FreeRTOS API call)

No blocking, no allocation, no floating-point math. Execution time is bounded and predictable.

### No data loss with double buffering

The DMA runs in circular mode over a buffer of `2 x 16` samples. The HAL fires `HalfCpltCallback` when the first 16 are done (DMA is now filling the second 16), and `CpltCallback` when the second 16 are done (DMA wraps back to fill the first 16). This means we always copy from the half that DMA is *not* currently writing to.

### Task notification vs. queue vs. semaphore

FreeRTOS task notifications are faster and use less RAM than a queue or binary semaphore. The notification acts as a lightweight counting semaphore. `ulTaskNotifyTake(pdTRUE, ...)` clears the count and returns it, so even if multiple blocks arrived before the task ran, it wakes once and drains them all in the `while (s_adc_ring.pop(...))` loop.

### Overflow handling

If the processing task falls behind (e.g., preempted by a higher-priority task for several milliseconds), the ring buffer will fill. The ISR detects this via the `push()` return value, increments a diagnostic counter, and discards the block. It never blocks or waits. The counter can be checked during debugging or reported via telemetry to detect a systemic throughput problem.

## CubeMX Configuration Checklist

For this code to work, configure the following in STM32CubeMX:

1. **ADC1**: Enable, set resolution to 12-bit, enable scan mode if using multiple channels, set number of conversions to 16.
2. **DMA**: Add DMA request for ADC1, set mode to **Circular**, data width to Half Word (16-bit) for both peripheral and memory.
3. **Timer (TIM2)**: Configure to trigger at 1kHz. Set TRGO to Update Event. In ADC settings, set external trigger source to TIM2 TRGO, trigger edge to rising.
4. **NVIC**: Enable DMA interrupt (the HAL callbacks rely on it). Set the DMA interrupt priority to be within the `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` range so FreeRTOS API calls from the callback are safe.
5. **FreeRTOS**: Enable via CubeMX or manually configure. Ensure `configUSE_TASK_NOTIFICATIONS` is 1 (it is by default).
