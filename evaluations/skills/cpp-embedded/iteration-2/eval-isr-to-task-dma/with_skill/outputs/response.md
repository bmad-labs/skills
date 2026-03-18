# ISR-to-Task ADC Sample Transfer on STM32F4 with FreeRTOS

## Design Decision

For your scenario -- 16 x `uint16_t` bursts at 1 kHz from a DMA complete ISR to a processing task -- the best approach is a **double-buffer (ping-pong) scheme** combined with a **FreeRTOS task notification** to wake the consumer. Here is why:

| Approach | Verdict | Reason |
|---|---|---|
| FreeRTOS Queue (`xQueueSendFromISR`) | Viable but wasteful | Copies 32 bytes per burst into queue storage; queue overhead per item |
| Stream/Message Buffer | Overkill | Designed for variable-length byte streams; your data is fixed-size |
| SPSC lock-free ring buffer | Good | Zero-copy possible, but adds complexity for a fixed-burst pattern |
| **Double buffer + task notification** | **Best fit** | Zero-copy, zero-allocation, minimal ISR work, deterministic timing |

The double-buffer pattern leverages the STM32 DMA controller's built-in half-transfer and transfer-complete interrupts. The DMA writes into one half of the buffer while the task processes the other half. No `malloc`, no copies, no queues -- the DMA peripheral does the work.

## Key Constraints Applied

- **No malloc/new anywhere** -- all buffers are statically allocated.
- **ISR is minimal** -- sets a pointer and issues a task notification; no blocking, no allocation.
- **STM32F4 (Cortex-M4) has no D-cache** -- word alignment (`alignas(4)`) is sufficient for DMA buffers. No cache maintenance needed.
- **`FromISR` API variants** used for all RTOS calls inside the ISR.

## Complete Implementation

### adc_dma.h

```c
#ifndef ADC_DMA_H_
#define ADC_DMA_H_

#include <stdint.h>
#include "FreeRTOS.h"
#include "task.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Number of samples per burst (one DMA half-transfer) */
#define ADC_BURST_SIZE      16U

/* Initialize ADC + DMA in circular double-buffer mode */
void adc_dma_init(void);

/* Start continuous ADC+DMA conversion */
void adc_dma_start(void);

/* Processing task entry point -- create with xTaskCreate() */
void adc_processing_task(void *param);

#ifdef __cplusplus
}
#endif

#endif /* ADC_DMA_H_ */
```

### adc_dma.c

```c
#include "adc_dma.h"
#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"

#include <string.h>

/* -----------------------------------------------------------------------
 * Static buffers -- no heap, no malloc
 * STM32F4 (Cortex-M4) has no D-cache, so alignas(4) is sufficient.
 * ----------------------------------------------------------------------- */

/* Double buffer: DMA writes the full 32-sample buffer in circular mode.
 * Half-transfer complete ISR fires after first 16 samples (index 0..15).
 * Transfer complete ISR fires after second 16 samples (index 16..31).
 * This gives us ping-pong behavior with a single DMA stream. */
#define ADC_DMA_BUF_TOTAL   (ADC_BURST_SIZE * 2U)

static uint16_t adc_dma_buf[ADC_DMA_BUF_TOTAL] __attribute__((aligned(4)));

/* Snapshot buffer: the task copies its half here for safe processing
 * while DMA writes the other half. */
static uint16_t adc_work_buf[ADC_BURST_SIZE];

/* Task handle for direct-to-task notification */
static TaskHandle_t adc_task_handle = NULL;

/* Pointer set by ISR to indicate which half is ready */
static volatile uint16_t *ready_half_ptr = NULL;

/* HAL handles -- assumed configured via CubeMX or manual init */
extern ADC_HandleTypeDef hadc1;
extern DMA_HandleTypeDef hdma_adc1;

/* -----------------------------------------------------------------------
 * Initialization
 * ----------------------------------------------------------------------- */

void adc_dma_init(void)
{
    /* ADC and DMA peripheral clocks + pin config are assumed done
     * in MX_ADC1_Init() and MX_DMA_Init() (CubeMX generated).
     *
     * ADC configuration requirements:
     *   - Continuous conversion mode: ENABLED
     *   - DMA continuous requests: ENABLED
     *   - Number of conversions: 1 (single channel) or sequencer for multi-channel
     *   - Sampling time: choose based on your source impedance and 1 kHz rate
     *
     * DMA configuration:
     *   - Mode: Circular
     *   - Data width: Half Word (16-bit)
     *   - Memory increment: ENABLED
     *
     * Timer trigger (recommended for precise 1 kHz):
     *   Use TIM2 or TIM3 TRGO at 1 kHz to trigger ADC start-of-conversion.
     *   This gives exact 1 kHz sample timing independent of CPU load.
     */
}

void adc_dma_start(void)
{
    /* Start ADC with DMA in circular mode.
     * DMA will continuously fill adc_dma_buf[0..31], wrapping around.
     * HAL enables both half-transfer and transfer-complete interrupts. */
    HAL_ADC_Start_DMA(&hadc1,
                      (uint32_t *)adc_dma_buf,
                      ADC_DMA_BUF_TOTAL);
}

/* -----------------------------------------------------------------------
 * DMA ISR callbacks -- called by HAL from DMA IRQ handler
 *
 * IMPORTANT: These are called from ISR context. Rules:
 *   - No malloc, no printf, no blocking
 *   - Use FromISR RTOS API variants only
 *   - Keep execution time minimal
 * ----------------------------------------------------------------------- */

/* Half-transfer complete: first half (indices 0..15) is ready.
 * DMA is now writing to second half (indices 16..31). */
void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    /* Point to the completed first half */
    ready_half_ptr = &adc_dma_buf[0];

    /* Wake the processing task */
    if (adc_task_handle != NULL) {
        vTaskNotifyGiveFromISR(adc_task_handle, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
    }
}

/* Transfer complete: second half (indices 16..31) is ready.
 * DMA has wrapped and is now writing to first half (indices 0..15). */
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    /* Point to the completed second half */
    ready_half_ptr = &adc_dma_buf[ADC_BURST_SIZE];

    /* Wake the processing task */
    if (adc_task_handle != NULL) {
        vTaskNotifyGiveFromISR(adc_task_handle, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
    }
}

/* -----------------------------------------------------------------------
 * Processing task
 * ----------------------------------------------------------------------- */

void adc_processing_task(void *param)
{
    (void)param;

    /* Store our handle so the ISR can notify us */
    adc_task_handle = xTaskGetCurrentTaskHandle();

    for (;;) {
        /* Block until the ISR signals that a half-buffer is ready.
         * pdTRUE = clear notification count on exit (binary semaphore style).
         * portMAX_DELAY = wait forever (no timeout). */
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        /* Snapshot the ready pointer (ISR may update it at any time).
         * Read the volatile pointer once, then copy data to local buffer.
         * The copy ensures we have a stable dataset even if DMA wraps
         * faster than expected (defensive). */
        const uint16_t *src = (const uint16_t *)ready_half_ptr;
        if (src != NULL) {
            memcpy(adc_work_buf, src, ADC_BURST_SIZE * sizeof(uint16_t));

            /* ---- Process the 16 samples in adc_work_buf ---- */
            process_adc_burst(adc_work_buf, ADC_BURST_SIZE);
        }
    }
}

/* -----------------------------------------------------------------------
 * Stub -- replace with your actual signal processing
 * ----------------------------------------------------------------------- */

__attribute__((weak))
void process_adc_burst(const uint16_t *samples, uint16_t count)
{
    (void)samples;
    (void)count;
    /* Example: compute RMS, apply FIR filter, detect threshold, etc. */
}
```

### main.c integration

```c
#include "adc_dma.h"
#include "FreeRTOS.h"
#include "task.h"

/* Stack size: 16 samples x 2 bytes + work buffer + processing headroom.
 * 256 words (1 KB) is conservative; verify with uxTaskGetStackHighWaterMark()
 * after running and tune down if needed. */
#define ADC_TASK_STACK_SIZE     256U
#define ADC_TASK_PRIORITY       (configMAX_PRIORITIES - 2U)

static StaticTask_t adc_task_tcb;
static StackType_t  adc_task_stack[ADC_TASK_STACK_SIZE];

int main(void)
{
    HAL_Init();
    SystemClock_Config();

    /* CubeMX peripheral init */
    MX_GPIO_Init();
    MX_DMA_Init();   /* Must be called BEFORE MX_ADC1_Init on STM32F4 */
    MX_ADC1_Init();

    adc_dma_init();

    /* Create task with static allocation -- no heap needed */
    xTaskCreateStatic(
        adc_processing_task,
        "ADC_Proc",
        ADC_TASK_STACK_SIZE,
        NULL,
        ADC_TASK_PRIORITY,
        adc_task_stack,
        &adc_task_tcb
    );

    /* Start DMA before scheduler so the first samples are captured immediately */
    adc_dma_start();

    /* Start FreeRTOS scheduler -- does not return */
    vTaskStartScheduler();

    /* Should never reach here */
    for (;;) {}
}
```

## How It Works (Timing Diagram)

```
Time -->   0ms    1ms    2ms    3ms    4ms
           |      |      |      |      |
DMA:       [--- writing buf[0..15] ---]
                  [--- writing buf[16..31] ---]
                         [--- writing buf[0..15] ---]
                                ...

ISR:       .      HT_IRQ .      TC_IRQ .      HT_IRQ
                  |              |              |
Task:      .      [process       [process       [process
                   buf[0..15]]    buf[16..31]]   buf[0..15]]
```

- **HT_IRQ**: Half-transfer complete -- first 16 samples done, DMA moves to second half.
- **TC_IRQ**: Transfer complete -- second 16 samples done, DMA wraps to first half.
- The task has a full 1 ms to process each burst before the next one arrives.

## FreeRTOSConfig.h Requirements

Ensure these settings in your FreeRTOS configuration:

```c
/* Static allocation support (no heap needed for tasks/queues) */
#define configSUPPORT_STATIC_ALLOCATION     1

/* Optional: disable dynamic allocation entirely to guarantee no malloc */
#define configSUPPORT_DYNAMIC_ALLOCATION    0

/* Task notification enabled (default, but verify) */
#define configUSE_TASK_NOTIFICATIONS        1

/* NVIC priority: DMA interrupt must be at or below this threshold
 * so that FromISR API calls are safe. On STM32F4, priorities 5-15
 * are typically safe for FreeRTOS ISR API calls. */
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY  5
```

## NVIC Priority Setup

This is a common source of hard-to-debug crashes. The DMA interrupt priority must be numerically >= `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (i.e., lower or equal urgency) for `FromISR` calls to be safe.

```c
/* In your NVIC configuration (CubeMX or manual): */
/* DMA1_Stream0 is typical for ADC1 on STM32F4 */
HAL_NVIC_SetPriority(DMA1_Stream0_IRQn, 6, 0);  /* preemption=6, sub=0 */
HAL_NVIC_EnableIRQ(DMA1_Stream0_IRQn);

/* configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY = 5
 * Priority 6 >= 5, so FromISR calls are safe. */
```

If the DMA priority is set higher (lower number) than `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY`, calling `vTaskNotifyGiveFromISR` will corrupt the FreeRTOS scheduler and cause intermittent crashes.

## Memory Budget

| Item | Size | Location |
|---|---|---|
| `adc_dma_buf` (DMA double buffer) | 64 bytes | `.bss` (static RAM) |
| `adc_work_buf` (task working copy) | 32 bytes | `.bss` (static RAM) |
| `adc_task_stack` (task stack) | 1024 bytes | `.bss` (static RAM) |
| `adc_task_tcb` (task control block) | ~92 bytes | `.bss` (static RAM) |
| **Total** | **~1.2 KB** | **All static, zero heap** |

## Why Not a Queue or Ring Buffer?

A FreeRTOS queue (`xQueueSendFromISR`) would work, but it copies the data into queue-managed storage. For 32 bytes at 1 kHz that copy is not a problem, but the double-buffer approach is strictly better here because:

1. **Zero copies in the ISR** -- the DMA writes directly to the buffer, the ISR only sets a pointer and sends a notification (a few CPU cycles).
2. **No queue storage overhead** -- a queue for 16 x `uint16_t` items needs the queue control block plus item storage.
3. **Natural fit for DMA circular mode** -- the STM32 HAL already provides the half-transfer and transfer-complete callbacks for exactly this pattern.
4. **Deterministic** -- no chance of queue-full backpressure in the ISR. If the task falls behind, the worst case is the `ready_half_ptr` is overwritten (latest data wins), which is usually the correct behavior for real-time signal processing.

If you later need to decouple the producer and consumer rates (e.g., burst processing at variable intervals), you can add an SPSC ring buffer of burst-sized blocks between the ISR and the task. The lock-free SPSC pattern from the skill reference works well for that extension.

## Verification Checklist

- [ ] `MX_DMA_Init()` is called **before** `MX_ADC1_Init()` (STM32F4 HAL requirement)
- [ ] DMA is configured as Circular mode, Half Word, Memory Increment
- [ ] DMA interrupt priority is >= `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY`
- [ ] ADC trigger source matches your timer TRGO configuration for 1 kHz
- [ ] `configSUPPORT_STATIC_ALLOCATION` is 1 in `FreeRTOSConfig.h`
- [ ] After running, check `uxTaskGetStackHighWaterMark()` and verify > 64 words remaining
- [ ] No `malloc` or `new` anywhere in the data path
