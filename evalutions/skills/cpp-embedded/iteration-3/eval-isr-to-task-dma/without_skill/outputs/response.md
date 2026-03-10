# Passing ADC DMA Samples from ISR to Task on STM32F4 with FreeRTOS

## Recommended Approach: Stream Buffer (or Queue of Static Buffers)

For your scenario — 16 x `uint16_t` bursts at 1 kHz from a DMA-complete ISR to a processing task, with no `malloc` — the best approach is a **pool of statically allocated buffers** combined with a **FreeRTOS queue** to pass buffer pointers. This gives you zero-copy, deterministic, malloc-free data transfer.

An alternative using FreeRTOS **Stream Buffers** is also shown below, which is simpler but involves a copy.

---

## Solution 1: Static Buffer Pool + Queue (Zero-Copy, Recommended)

This is the highest-performance approach. The ISR hands off a pointer to a filled buffer; the processing task works on it and returns it to the pool.

### adc_dma_transfer.h

```c
#ifndef ADC_DMA_TRANSFER_H
#define ADC_DMA_TRANSFER_H

#include <stdint.h>
#include "FreeRTOS.h"
#include "queue.h"

/* Configuration */
#define ADC_BLOCK_SAMPLES   16U
#define ADC_BUFFER_POOL_SIZE 4U   /* Number of buffers in the pool (tune to taste) */

/* A single sample block */
typedef struct {
    uint16_t samples[ADC_BLOCK_SAMPLES];
} adc_block_t;

/* Call once before starting ADC/DMA */
void adc_transfer_init(void);

/* Returns a pointer to a free block, or NULL if pool exhausted.
   Safe to call from ISR context. */
adc_block_t *adc_pool_alloc_from_isr(BaseType_t *pxHigherPriorityTaskWoken);

/* Return a block to the pool after the task is done processing.
   Call from task context. */
void adc_pool_free(adc_block_t *block);

/* The queue that carries filled-block pointers from ISR -> task */
extern QueueHandle_t g_adc_ready_queue;

#endif /* ADC_DMA_TRANSFER_H */
```

### adc_dma_transfer.c

```c
#include "adc_dma_transfer.h"
#include "queue.h"
#include <string.h>

/* ---- Static pool ---- */
static adc_block_t s_pool[ADC_BUFFER_POOL_SIZE];

/* Queue of free-block pointers (acts as the pool allocator) */
static QueueHandle_t s_free_queue;

/* Queue of ready-block pointers (ISR -> task) */
QueueHandle_t g_adc_ready_queue;

/* ---- Static backing storage for the queues (no heap needed) ---- */
static StaticQueue_t s_free_queue_cb;
static uint8_t s_free_queue_storage[ADC_BUFFER_POOL_SIZE * sizeof(adc_block_t *)];

static StaticQueue_t s_ready_queue_cb;
static uint8_t s_ready_queue_storage[ADC_BUFFER_POOL_SIZE * sizeof(adc_block_t *)];

void adc_transfer_init(void)
{
    /* Create the free-block pool queue (statically allocated) */
    s_free_queue = xQueueCreateStatic(
        ADC_BUFFER_POOL_SIZE,
        sizeof(adc_block_t *),
        s_free_queue_storage,
        &s_free_queue_cb
    );

    /* Create the ready queue (statically allocated) */
    g_adc_ready_queue = xQueueCreateStatic(
        ADC_BUFFER_POOL_SIZE,
        sizeof(adc_block_t *),
        s_ready_queue_storage,
        &s_ready_queue_cb
    );

    /* Seed the free queue with all pool buffers */
    for (uint32_t i = 0; i < ADC_BUFFER_POOL_SIZE; i++) {
        adc_block_t *p = &s_pool[i];
        xQueueSend(s_free_queue, &p, 0);
    }
}

adc_block_t *adc_pool_alloc_from_isr(BaseType_t *pxHigherPriorityTaskWoken)
{
    adc_block_t *block = NULL;
    xQueueReceiveFromISR(s_free_queue, &block, pxHigherPriorityTaskWoken);
    return block; /* NULL if pool is empty */
}

void adc_pool_free(adc_block_t *block)
{
    /* Return block to pool; should never fail unless double-freed */
    xQueueSend(s_free_queue, &block, 0);
}
```

### DMA and ADC Setup (main.c or adc.c)

```c
#include "stm32f4xx_hal.h"
#include "adc_dma_transfer.h"
#include "FreeRTOS.h"
#include "task.h"

/* Double-buffer for DMA — DMA writes here, ISR copies to pool block */
static uint16_t s_dma_buf[2][ADC_BLOCK_SAMPLES];

extern ADC_HandleTypeDef hadc1;

/* ---- The DMA half/full-complete callbacks ---- */

/*
 * We use double-buffering:
 *   - HalfCplt fires when s_dma_buf[0] is ready
 *   - CpltCplt fires when s_dma_buf[1] is ready
 */
static void adc_dma_publish(uint16_t *src)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    adc_block_t *block = adc_pool_alloc_from_isr(&xHigherPriorityTaskWoken);
    if (block != NULL) {
        /* Copy 16 x uint16_t = 32 bytes — very fast on Cortex-M4 */
        memcpy(block->samples, src, sizeof(block->samples));

        /* Enqueue the filled block for the processing task */
        xQueueSendFromISR(g_adc_ready_queue, &block, &xHigherPriorityTaskWoken);
    }
    /* else: pool exhausted — sample block dropped.
     * In production, increment an overflow counter here. */

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
    if (hadc->Instance == ADC1) {
        adc_dma_publish(&s_dma_buf[0][0]);
    }
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
    if (hadc->Instance == ADC1) {
        adc_dma_publish(&s_dma_buf[1][0]);
    }
}

/* ---- Processing Task ---- */

static StaticTask_t s_proc_task_cb;
static StackType_t  s_proc_task_stack[256]; /* 1 KiB stack — adjust as needed */

static void adc_processing_task(void *pvParameters)
{
    (void)pvParameters;
    adc_block_t *block;

    for (;;) {
        /* Block until a filled buffer is available */
        if (xQueueReceive(g_adc_ready_queue, &block, portMAX_DELAY) == pdTRUE) {

            /* ------- Process the 16 samples here ------- */
            /* Example: compute average */
            uint32_t sum = 0;
            for (uint32_t i = 0; i < ADC_BLOCK_SAMPLES; i++) {
                sum += block->samples[i];
            }
            uint16_t average = (uint16_t)(sum / ADC_BLOCK_SAMPLES);
            (void)average; /* Replace with your actual processing */

            /* Return the buffer to the pool */
            adc_pool_free(block);
        }
    }
}

/* ---- Initialization ---- */

void app_start(void)
{
    /* Initialize the buffer pool and queues */
    adc_transfer_init();

    /* Create the processing task (statically allocated) */
    xTaskCreateStatic(
        adc_processing_task,
        "ADC_Proc",
        sizeof(s_proc_task_stack) / sizeof(StackType_t),
        NULL,
        configMAX_PRIORITIES - 1,  /* High priority to keep up with 1 kHz */
        s_proc_task_stack,
        &s_proc_task_cb
    );

    /* Start ADC in circular DMA mode with double-buffer */
    HAL_ADC_Start_DMA(&hadc1, (uint32_t *)s_dma_buf, ADC_BLOCK_SAMPLES * 2);
}
```

### FreeRTOSConfig.h Requirements

Make sure these are enabled:

```c
#define configSUPPORT_STATIC_ALLOCATION  1
/* Optional: disable dynamic allocation entirely for a malloc-free build */
#define configSUPPORT_DYNAMIC_ALLOCATION 0
```

If you set `configSUPPORT_DYNAMIC_ALLOCATION` to 0, you must also provide `vApplicationGetIdleTaskMemory()` and (if using timers) `vApplicationGetTimerTaskMemory()`.

---

## Solution 2: Stream Buffer (Simpler, Involves a Copy)

If you prefer simplicity over zero-copy, a FreeRTOS **Stream Buffer** works well for byte-oriented data:

```c
#include "FreeRTOS.h"
#include "stream_buffer.h"
#include <string.h>

#define ADC_BLOCK_SAMPLES  16U
#define ADC_BLOCK_BYTES    (ADC_BLOCK_SAMPLES * sizeof(uint16_t))
#define STREAM_BUF_SIZE    (ADC_BLOCK_BYTES * 4)  /* room for 4 blocks */

static StaticStreamBuffer_t s_stream_cb;
static uint8_t s_stream_storage[STREAM_BUF_SIZE + 1]; /* +1 required by FreeRTOS */
static StreamBufferHandle_t s_stream;

static uint16_t s_dma_buf[2][ADC_BLOCK_SAMPLES];

void stream_init(void)
{
    s_stream = xStreamBufferCreateStatic(
        sizeof(s_stream_storage),
        ADC_BLOCK_BYTES,          /* trigger level: wake task when a full block arrives */
        s_stream_storage,
        &s_stream_cb
    );
}

/* Called from DMA ISR */
static void adc_dma_send_stream(uint16_t *src)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    xStreamBufferSendFromISR(
        s_stream,
        src,
        ADC_BLOCK_BYTES,
        &xHigherPriorityTaskWoken
    );

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

/* Processing task */
static void adc_stream_task(void *pvParameters)
{
    (void)pvParameters;
    uint16_t local_buf[ADC_BLOCK_SAMPLES];

    for (;;) {
        size_t received = xStreamBufferReceive(
            s_stream,
            local_buf,
            ADC_BLOCK_BYTES,
            portMAX_DELAY
        );

        if (received == ADC_BLOCK_BYTES) {
            /* Process local_buf[0..15] */
        }
    }
}
```

---

## Design Tradeoffs

| Aspect | Buffer Pool + Queue | Stream Buffer |
|---|---|---|
| **Copies** | 1 (DMA buf -> pool block) | 2 (DMA buf -> stream -> local buf) |
| **Latency** | Lower | Slightly higher |
| **Complexity** | Moderate | Simple |
| **Overflow handling** | Explicit (NULL from alloc) | Data dropped silently if full |
| **malloc-free** | Yes (StaticQueue) | Yes (StaticStreamBuffer) |
| **Best for** | High throughput, chained processing | Simple point-to-point transfer |

## Key Design Decisions

1. **Double-buffered DMA** (`s_dma_buf[2][16]`): The ADC DMA runs in circular mode. While DMA fills one half, the ISR processes the other. This is the standard pattern for continuous ADC sampling on STM32.

2. **Pool size of 4**: At 1 kHz with 16 samples per burst, each block is 32 bytes. Four buffers gives the processing task up to 4 ms of slack before data loss. Increase `ADC_BUFFER_POOL_SIZE` if your processing is bursty.

3. **All static allocation**: Every FreeRTOS object uses the `*Static()` creation variants. No `pvPortMalloc` is ever called. This is critical for safety-relevant embedded systems and eliminates fragmentation concerns.

4. **`memcpy` in ISR is acceptable**: Copying 32 bytes on a Cortex-M4 at 168 MHz takes roughly 0.2 us — negligible at 1 kHz.

5. **Overflow strategy**: When the pool is exhausted, the ISR drops the block. In production, add an atomic overflow counter so you can detect this condition.

6. **ISR priority**: The DMA interrupt priority must be at or below `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (typically 5) for the FreeRTOS `*FromISR()` API calls to be safe. This is configured in the NVIC/DMA setup, not shown here.
