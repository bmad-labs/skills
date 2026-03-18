# ISR-to-Task DMA Transfer: ADC Samples on STM32F4 with FreeRTOS

## Architecture Decision

You have a fixed-burst DMA transfer: 16 x `uint16_t` arriving at 1 kHz. Two patterns apply here:

1. **Ping-pong (double) buffering** -- the DMA fills one buffer while the task processes the other. Best fit for fixed-burst DMA like yours.
2. **SPSC ring buffer** -- best for variable-rate streams, and the canonical ISR-to-task pattern.

The recommended approach combines both: use **ping-pong DMA buffers** for the hardware-facing side (DMA fills one half while you process the other), and a **lock-free SPSC ring buffer** to decouple the ISR from the processing task. This gives you:

- Zero-copy on the DMA side (hardware writes directly to static buffers)
- No `malloc` anywhere -- all memory is statically allocated
- ISR does minimal work: copies 32 bytes into the ring buffer, notifies the task
- Processing task blocks on a FreeRTOS task notification (zero CPU cost while idle)
- Tolerates jitter in the processing task -- the ring buffer absorbs bursts

## Memory Layout

The STM32F4 has a Cortex-M4 core with **no D-cache**, so DMA buffers only need word alignment (`alignas(4)`), and no cache maintenance is required.

```
DMA (hardware)          ISR                    Ring Buffer              Task
+-----------+     +-----------+          +------------------+     +----------+
| Buffer A  | --> | half-cplt |  push()  | Slot 0 [32 B]    | --> | pop()    |
| Buffer B  | --> | cplt      | -------> | Slot 1 [32 B]    |     | process  |
+-----------+     +-----------+          | ...              |     +----------+
  ping-pong         minimal              | Slot N-1 [32 B]  |
  (circular)        set flag             +------------------+
                                           power-of-2 slots
```

## Complete Implementation

### adc_dma_transfer.h

```c
#ifndef ADC_DMA_TRANSFER_H
#define ADC_DMA_TRANSFER_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/*--------------------------------------------------------------------------
 * Configuration
 *------------------------------------------------------------------------*/
#define ADC_BURST_SIZE       16U    /* Samples per DMA burst                */
#define ADC_SAMPLE_RATE_HZ   1000U  /* Bursts per second                   */

/*--------------------------------------------------------------------------
 * Ring buffer for ADC sample blocks (ISR -> Task)
 *
 * Each slot holds one complete burst (16 x uint16_t = 32 bytes).
 * Capacity MUST be a power of 2 for bitmask indexing.
 *------------------------------------------------------------------------*/
#define ADC_RING_SLOTS       16U   /* 16 slots = 16 ms of buffering at 1 kHz */

_Static_assert((ADC_RING_SLOTS & (ADC_RING_SLOTS - 1)) == 0,
               "ADC_RING_SLOTS must be a power of 2");

typedef struct {
    uint16_t samples[ADC_BURST_SIZE];
} AdcBlock;

_Static_assert(sizeof(AdcBlock) == ADC_BURST_SIZE * sizeof(uint16_t),
               "AdcBlock must be tightly packed");

/*--------------------------------------------------------------------------
 * Lock-free SPSC ring buffer
 *
 * Single Producer (DMA complete ISR) / Single Consumer (processing task).
 * Uses volatile head/tail with explicit ordering appropriate for
 * single-core Cortex-M4 (no D-cache, no store reordering across cores).
 *
 * On single-core Cortex-M, std::atomic with memory_order_relaxed compiles
 * to plain loads/stores, which is equivalent to volatile for correctness.
 * We use volatile here for C99 compatibility. The key safety property is
 * that only the producer writes head, and only the consumer writes tail.
 *------------------------------------------------------------------------*/
typedef struct {
    AdcBlock   slots[ADC_RING_SLOTS];
    volatile size_t head;   /* Written only by producer (ISR)  */
    volatile size_t tail;   /* Written only by consumer (task) */
    volatile uint32_t overflow_count;  /* Diagnostic counter   */
} AdcRingBuffer;

/*--------------------------------------------------------------------------
 * Public API
 *------------------------------------------------------------------------*/

/** Initialize the ring buffer (call before starting DMA). */
void adc_ring_init(AdcRingBuffer *rb);

/**
 * Push a block into the ring buffer. Called from ISR context ONLY.
 * Returns true on success, false if the buffer is full (overflow).
 */
bool adc_ring_push(AdcRingBuffer *rb, const uint16_t samples[ADC_BURST_SIZE]);

/**
 * Pop a block from the ring buffer. Called from task context ONLY.
 * Returns true if a block was available, false if empty.
 */
bool adc_ring_pop(AdcRingBuffer *rb, AdcBlock *out);

/** Check if the ring buffer is empty. */
bool adc_ring_empty(const AdcRingBuffer *rb);

/** Initialize and start ADC + DMA in circular (ping-pong) mode. */
void adc_dma_start(void);

/** FreeRTOS task function for ADC processing. */
void adc_processing_task(void *param);

#ifdef __cplusplus
}
#endif

#endif /* ADC_DMA_TRANSFER_H */
```

### adc_dma_transfer.c

```c
#include "adc_dma_transfer.h"
#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"
#include <string.h>

/*--------------------------------------------------------------------------
 * Ping-pong DMA buffer
 *
 * HAL_ADC_Start_DMA in circular mode fills this buffer continuously.
 * The buffer holds 2 x ADC_BURST_SIZE samples:
 *   - First half  (samples[0..15])   -> HAL_ADC_ConvHalfCpltCallback
 *   - Second half (samples[16..31])  -> HAL_ADC_ConvCpltCallback
 *
 * While DMA fills one half, the ISR copies the other half into the ring
 * buffer. This is safe because the DMA and ISR never access the same half
 * simultaneously.
 *
 * STM32F4 (Cortex-M4) has no D-cache, so word alignment is sufficient
 * and no cache invalidation is needed.
 *------------------------------------------------------------------------*/
#define DMA_BUF_TOTAL_SAMPLES  (ADC_BURST_SIZE * 2U)

static alignas(4) uint16_t dma_buffer[DMA_BUF_TOTAL_SAMPLES];

/*--------------------------------------------------------------------------
 * Ring buffer instance and task handle (file-scope static)
 *------------------------------------------------------------------------*/
static AdcRingBuffer adc_rb;
static TaskHandle_t  adc_task_handle = NULL;

/* External: ADC handle initialized by CubeMX / HAL_ADC_MspInit */
extern ADC_HandleTypeDef hadc1;

/*--------------------------------------------------------------------------
 * Ring buffer implementation
 *------------------------------------------------------------------------*/

void adc_ring_init(AdcRingBuffer *rb) {
    memset(rb, 0, sizeof(*rb));
}

bool adc_ring_push(AdcRingBuffer *rb, const uint16_t samples[ADC_BURST_SIZE]) {
    const size_t head = rb->head;
    const size_t next = (head + 1U) & (ADC_RING_SLOTS - 1U);

    if (next == rb->tail) {
        /* Buffer full -- consumer is not keeping up */
        rb->overflow_count++;
        return false;
    }

    memcpy(rb->slots[head].samples, samples,
           ADC_BURST_SIZE * sizeof(uint16_t));

    /*
     * On Cortex-M4 (single core, no store buffer reordering to other
     * observers), a compiler barrier is sufficient to ensure the memcpy
     * completes before head is updated. __DMB() is not strictly required
     * on single-core Cortex-M but is included for defensive correctness.
     */
    __DMB();

    rb->head = next;
    return true;
}

bool adc_ring_pop(AdcRingBuffer *rb, AdcBlock *out) {
    const size_t tail = rb->tail;

    if (tail == rb->head) {
        return false;  /* Empty */
    }

    *out = rb->slots[tail];

    __DMB();

    rb->tail = (tail + 1U) & (ADC_RING_SLOTS - 1U);
    return true;
}

bool adc_ring_empty(const AdcRingBuffer *rb) {
    return rb->head == rb->tail;
}

/*--------------------------------------------------------------------------
 * DMA callbacks (called from ISR context by HAL)
 *
 * HAL_ADC_Start_DMA(&hadc1, buf, 2*N) in circular mode generates:
 *   - HalfCplt when the first N samples are done  (buf[0..N-1] valid)
 *   - Cplt     when the second N samples are done  (buf[N..2N-1] valid)
 *
 * The ISR pushes the completed half into the ring buffer and notifies
 * the processing task via a FreeRTOS direct task notification (zero
 * RAM overhead, faster than a queue or semaphore for single-recipient
 * signaling).
 *------------------------------------------------------------------------*/

void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc) {
    if (hadc->Instance != ADC1) return;

    /* First half of DMA buffer is complete -- push it */
    adc_ring_push(&adc_rb, &dma_buffer[0]);

    /* Notify the processing task */
    if (adc_task_handle != NULL) {
        BaseType_t xHigherPriorityTaskWoken = pdFALSE;
        vTaskNotifyGiveFromISR(adc_task_handle, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
    }
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc) {
    if (hadc->Instance != ADC1) return;

    /* Second half of DMA buffer is complete -- push it */
    adc_ring_push(&adc_rb, &dma_buffer[ADC_BURST_SIZE]);

    /* Notify the processing task */
    if (adc_task_handle != NULL) {
        BaseType_t xHigherPriorityTaskWoken = pdFALSE;
        vTaskNotifyGiveFromISR(adc_task_handle, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
    }
}

/*--------------------------------------------------------------------------
 * ADC + DMA initialization
 *------------------------------------------------------------------------*/

void adc_dma_start(void) {
    adc_ring_init(&adc_rb);

    /*
     * Start ADC with DMA in circular mode.
     * The ADC should be configured (via CubeMX or manual register setup) for:
     *   - Continuous conversion mode: ENABLED
     *   - DMA continuous requests: ENABLED (CONT bit in ADC_CR2)
     *   - DMA mode: Circular (set in DMA stream config)
     *   - Number of conversions: 16 (scan mode across 16 channels,
     *     or single channel with 16 sequential conversions via timer trigger)
     *
     * The HAL DMA transfer length is 2 * ADC_BURST_SIZE so that circular
     * mode ping-pongs between the two halves, generating HalfCplt and
     * Cplt interrupts alternately.
     */
    HAL_ADC_Start_DMA(&hadc1,
                      (uint32_t *)dma_buffer,
                      DMA_BUF_TOTAL_SAMPLES);
}

/*--------------------------------------------------------------------------
 * Processing task
 *
 * Blocks on task notification (zero CPU while idle). Drains all available
 * blocks from the ring buffer on each wake -- handles the case where
 * multiple DMA completions occurred before the task ran.
 *------------------------------------------------------------------------*/

void adc_processing_task(void *param) {
    (void)param;
    AdcBlock block;

    for (;;) {
        /* Block until ISR sends a notification. The pdTRUE argument clears
         * the notification count on exit, so if multiple notifications
         * arrived while we were processing, we still wake immediately
         * on the next iteration (count was > 0). */
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        /* Drain all available blocks */
        while (adc_ring_pop(&adc_rb, &block)) {
            /*
             * Process 16 x uint16_t samples here.
             * Examples:
             *   - Apply FIR/IIR filter
             *   - Compute RMS or peak-to-peak
             *   - Threshold detection
             *   - Forward to a logging queue
             */
            process_adc_block(block.samples, ADC_BURST_SIZE);
        }
    }
}
```

### main.c integration

```c
#include "adc_dma_transfer.h"
#include "FreeRTOS.h"
#include "task.h"

/* Task handle -- stored in the module, but we need to create it here */
extern TaskHandle_t adc_task_handle;

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_DMA_Init();     /* Must init DMA before ADC */
    MX_ADC1_Init();

    /* Create the processing task.
     * Stack: 512 bytes (256 words) is sufficient for this task.
     * Priority: above tskIDLE_PRIORITY to ensure it runs promptly. */
    xTaskCreate(adc_processing_task,
                "ADC_Proc",
                configMINIMAL_STACK_SIZE + 128,
                NULL,
                tskIDLE_PRIORITY + 2,
                &adc_task_handle);

    /* Start DMA after task is created (so notifications have a recipient) */
    adc_dma_start();

    /* Start the scheduler -- does not return */
    vTaskStartScheduler();

    /* Should never reach here */
    for (;;) {}
}
```

## Why This Design

| Decision | Rationale |
|----------|-----------|
| **Ping-pong DMA (circular mode)** | Hardware fills one half while ISR reads the other. Zero-copy from DMA perspective. The HAL circular mode handles the ping-pong automatically via HalfCplt/Cplt callbacks. |
| **SPSC ring buffer between ISR and task** | Decouples ISR timing from task scheduling. If the task is delayed (e.g., by a higher-priority task), samples queue up instead of being lost. 16 slots = 16 ms of buffering at 1 kHz. |
| **Power-of-2 ring size with bitmask** | `(index + 1) & (N - 1)` is a single AND instruction -- no division, no branch. `_Static_assert` enforces power-of-2 at compile time. |
| **Task notification instead of semaphore/queue** | Zero RAM overhead. Fastest FreeRTOS signaling mechanism. Perfect for single-producer (ISR) to single-consumer (task) notification. |
| **`volatile` head/tail (not `std::atomic`)** | C99 compatible. On single-core Cortex-M4, the SPSC invariant (only producer writes head, only consumer writes tail) plus `__DMB()` is sufficient. No atomic RMW needed. |
| **`alignas(4)` for DMA buffer** | STM32F4 is Cortex-M4 with no D-cache. Word alignment is sufficient. No cache invalidation needed (unlike Cortex-M7/STM32H7 where you would need `alignas(32)` and `SCB_InvalidateDCache_by_Addr`). |
| **All static allocation** | Zero `malloc`. MISRA C Rule 21.3 compliant. Every byte is accounted for at link time. Total static RAM: `dma_buffer` (64 B) + ring buffer (16 slots x 32 B + overhead = ~520 B) = under 600 bytes. |
| **Overflow counter** | In production, monitor `adc_rb.overflow_count`. If it's non-zero, either increase `ADC_RING_SLOTS` or ensure the processing task has sufficient priority and isn't being starved. |

## CubeMX Configuration Checklist

If using STM32CubeMX, ensure these settings:

1. **ADC1 Settings:**
   - Scan Conversion Mode: Enabled (if using multiple channels)
   - Continuous Conversion Mode: Enabled
   - DMA Continuous Requests: Enabled
   - End of Conversion Selection: End of sequence (if multi-channel)

2. **DMA Settings for ADC1:**
   - Mode: Circular
   - Data Width: Half Word (16-bit) for both peripheral and memory
   - Memory Increment: Enabled
   - Peripheral Increment: Disabled

3. **NVIC:**
   - DMA Stream IRQ: Enabled
   - ADC IRQ: Enabled (for overrun detection)
   - Set DMA IRQ priority numerically >= `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (typically 5) so that FreeRTOS API calls from the ISR are safe

4. **Init order in `main()`:**
   - `MX_DMA_Init()` **before** `MX_ADC1_Init()` -- CubeMX sometimes gets this wrong when regenerating code. If DMA is initialized after ADC, the DMA stream is not configured when the ADC tries to use it, causing silent failure.

## Scaling Notes

- **Higher sample rates:** At 10 kHz+, consider increasing `ADC_RING_SLOTS` to 32 or 64 to absorb scheduling jitter. The ring buffer cost scales linearly: 32 slots x 32 bytes = 1 KB.
- **Multiple ADC channels:** Change `ADC_BURST_SIZE` to `NUM_CHANNELS * SAMPLES_PER_CHANNEL`. The ring buffer and DMA buffer scale automatically via the compile-time constants.
- **Cortex-M7 (STM32F7/H7):** Change `alignas(4)` to `alignas(32)`, add `SCB_InvalidateDCache_by_Addr()` in the DMA callbacks before reading the buffer, and ensure buffer sizes are multiples of 32 bytes.
