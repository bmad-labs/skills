# Passing ADC DMA Samples from ISR to Task on STM32F4 with FreeRTOS

## Recommended Approach: Stream Buffer (or Message Buffer)

For burst transfers of fixed-size binary data from an ISR to a task, a **FreeRTOS Stream Buffer** is the best fit. It is zero-copy-friendly, lock-free for single-producer/single-consumer, requires no heap allocation at runtime, and has first-class ISR-safe APIs. A **Message Buffer** (built on top of Stream Buffer) adds per-message framing so the receiver always gets a complete burst, which is ideal here.

An alternative is a queue of pointers into a static pool of buffers (covered in the second section below), which gives you explicit backpressure control.

---

## Solution 1 -- Message Buffer (Preferred)

### adc_task.h

```c
#ifndef ADC_TASK_H
#define ADC_TASK_H

#include <stdint.h>

#define ADC_BURST_LEN       16U                          /* samples per burst */
#define ADC_SAMPLE_BYTES    (sizeof(uint16_t))
#define ADC_BURST_BYTES     (ADC_BURST_LEN * ADC_SAMPLE_BYTES)  /* 32 bytes  */

/* Number of bursts the buffer can hold before the ISR drops data.            */
#define ADC_BUFFER_BURSTS   8U

void ADC_Task_Init(void);
void ADC_Processing_Task(void *pvParameters);

#endif /* ADC_TASK_H */
```

### adc_task.c

```c
#include "adc_task.h"
#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "message_buffer.h"
#include "task.h"

/* ------------------------------------------------------------------ */
/*  Static storage -- no malloc anywhere                               */
/* ------------------------------------------------------------------ */

/*
 * MessageBuffer needs (burst_bytes + 4-byte size header) per message,
 * plus 1 extra byte for the internal ring-buffer sentinel.
 */
#define MSG_BUF_SIZE  (ADC_BUFFER_BURSTS * (ADC_BURST_BYTES + 4U) + 1U)

static uint8_t ucMessageBufStorage[MSG_BUF_SIZE];
static StaticMessageBuffer_t xMessageBufStruct;
static MessageBufferHandle_t xAdcMsgBuf;

/* DMA destination buffer -- double-buffered by hardware.                     */
static uint16_t usDmaBuffer[ADC_BURST_LEN * 2U];

/* Task stack and TCB (static allocation, no heap needed).                    */
#define ADC_TASK_STACK_SIZE  256U
static StackType_t  uxAdcTaskStack[ADC_TASK_STACK_SIZE];
static StaticTask_t xAdcTaskTCB;

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

extern ADC_HandleTypeDef hadc1;   /* from your CubeMX-generated code  */
extern DMA_HandleTypeDef hdma_adc1;

void ADC_Task_Init(void)
{
    /* Create the message buffer -- fully static, no heap.                    */
    xAdcMsgBuf = xMessageBufferCreateStatic(
                        MSG_BUF_SIZE,
                        ucMessageBufStorage,
                        &xMessageBufStruct);

    configASSERT(xAdcMsgBuf != NULL);

    /* Create the processing task -- fully static.                            */
    xTaskCreateStatic(
        ADC_Processing_Task,
        "ADC_Proc",
        ADC_TASK_STACK_SIZE,
        NULL,
        configMAX_PRIORITIES - 1U,   /* high priority                        */
        uxAdcTaskStack,
        &xAdcTaskTCB);

    /*
     * Start circular DMA into the double buffer.
     * HAL_ADC_ConvHalfCpltCallback fires after first 16 samples,
     * HAL_ADC_ConvCpltCallback fires after second 16 samples.
     */
    HAL_ADC_Start_DMA(&hadc1,
                       (uint32_t *)usDmaBuffer,
                       ADC_BURST_LEN * 2U);
}

/* ------------------------------------------------------------------ */
/*  ISR callbacks (called from DMA IRQ context)                        */
/* ------------------------------------------------------------------ */

/*
 * Helper: send one 32-byte burst from a given half of the DMA buffer
 * into the message buffer.  Entirely ISR-safe, no malloc.
 */
static void prvSendBurst(const uint16_t *pusSamples)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    /*
     * xMessageBufferSendFromISR copies the data into the ring buffer.
     * If the buffer is full the burst is silently dropped (returns 0).
     * You could increment an overflow counter here for diagnostics.
     */
    (void)xMessageBufferSendFromISR(
                xAdcMsgBuf,
                (const void *)pusSamples,
                ADC_BURST_BYTES,
                &xHigherPriorityTaskWoken);

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

/* First half of double buffer complete. */
void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    prvSendBurst(&usDmaBuffer[0]);
}

/* Second half of double buffer complete. */
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    prvSendBurst(&usDmaBuffer[ADC_BURST_LEN]);
}

/* ------------------------------------------------------------------ */
/*  Processing task                                                    */
/* ------------------------------------------------------------------ */

void ADC_Processing_Task(void *pvParameters)
{
    (void)pvParameters;
    uint16_t usLocalBuf[ADC_BURST_LEN];
    size_t   xReceived;

    for (;;)
    {
        /*
         * Block until a full burst arrives.
         * portMAX_DELAY means wait forever -- the task sleeps and
         * consumes zero CPU while waiting.
         */
        xReceived = xMessageBufferReceive(
                        xAdcMsgBuf,
                        (void *)usLocalBuf,
                        ADC_BURST_BYTES,
                        portMAX_DELAY);

        if (xReceived == ADC_BURST_BYTES)
        {
            /* ---- Process the 16 samples here ---- */
            /* Example: simple average                */
            uint32_t ulSum = 0U;
            for (uint32_t i = 0U; i < ADC_BURST_LEN; i++)
            {
                ulSum += usLocalBuf[i];
            }
            uint16_t usAverage = (uint16_t)(ulSum / ADC_BURST_LEN);
            (void)usAverage;  /* replace with your real processing */
        }
    }
}
```

### Integration -- main.c

```c
#include "adc_task.h"

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_DMA_Init();     /* DMA must be initialised before ADC */
    MX_ADC1_Init();

    ADC_Task_Init();    /* sets up buffer, task, and starts DMA */

    vTaskStartScheduler();

    for (;;) {}         /* should never reach here */
}
```

### FreeRTOSConfig.h changes required

```c
/* Enable static allocation (no heap) */
#define configSUPPORT_STATIC_ALLOCATION     1

/* Enable message/stream buffers */
#define configUSE_STREAM_BUFFERS            1   /* default 1 in most ports */
```

You also need to provide the idle-task memory when using fully static allocation:

```c
/* In a .c file linked into your project */
#include "FreeRTOS.h"
#include "task.h"

static StaticTask_t xIdleTaskTCB;
static StackType_t  uxIdleTaskStack[configMINIMAL_STACK_SIZE];

void vApplicationGetIdleTaskMemory(StaticTask_t **ppxIdleTaskTCBBuffer,
                                   StackType_t  **ppxIdleTaskStackBuffer,
                                   uint32_t      *pulIdleTaskStackSize)
{
    *ppxIdleTaskTCBBuffer   = &xIdleTaskTCB;
    *ppxIdleTaskStackBuffer = uxIdleTaskStack;
    *pulIdleTaskStackSize   = configMINIMAL_STACK_SIZE;
}
```

---

## Solution 2 -- Static Pool + Queue of Pointers

If you need zero-copy semantics (the task works directly on the buffer the DMA filled), use a pool of static buffers and pass pointers through a FreeRTOS queue.

```c
#include "FreeRTOS.h"
#include "queue.h"
#include "stm32f4xx_hal.h"
#include <stdint.h>
#include <string.h>

#define ADC_BURST_LEN    16U
#define POOL_SIZE         8U    /* number of buffers in the pool */

/* ---- Static pool ---- */
typedef struct {
    uint16_t samples[ADC_BURST_LEN];
} AdcBlock_t;

static AdcBlock_t       sPool[POOL_SIZE];
static QueueHandle_t    xFreeQ;      /* pool of free blocks   */
static QueueHandle_t    xReadyQ;     /* blocks ready to process */

/* Static queue storage */
static uint8_t          ucFreeQStorage[POOL_SIZE * sizeof(AdcBlock_t *)];
static StaticQueue_t    xFreeQStruct;
static uint8_t          ucReadyQStorage[POOL_SIZE * sizeof(AdcBlock_t *)];
static StaticQueue_t    xReadyQStruct;

/* DMA double-buffer */
static uint16_t         usDmaBuf[ADC_BURST_LEN * 2U];

void Pool_Init(void)
{
    xFreeQ = xQueueCreateStatic(
                POOL_SIZE, sizeof(AdcBlock_t *),
                ucFreeQStorage, &xFreeQStruct);

    xReadyQ = xQueueCreateStatic(
                POOL_SIZE, sizeof(AdcBlock_t *),
                ucReadyQStorage, &xReadyQStruct);

    /* Seed the free queue with all pool blocks. */
    for (uint32_t i = 0U; i < POOL_SIZE; i++)
    {
        AdcBlock_t *p = &sPool[i];
        xQueueSend(xFreeQ, &p, 0U);
    }
}

/* Called from DMA half/complete ISR */
static void prvIsrSendBlock(const uint16_t *pusSrc)
{
    BaseType_t xWake = pdFALSE;
    AdcBlock_t *pBlock = NULL;

    /* Grab a free block (non-blocking). */
    if (xQueueReceiveFromISR(xFreeQ, &pBlock, &xWake) == pdTRUE)
    {
        memcpy(pBlock->samples, pusSrc, ADC_BURST_LEN * sizeof(uint16_t));
        xQueueSendFromISR(xReadyQ, &pBlock, &xWake);
    }
    /* else: pool exhausted -- burst dropped (count overflow here). */

    portYIELD_FROM_ISR(xWake);
}

void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    prvIsrSendBlock(&usDmaBuf[0]);
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
    (void)hadc;
    prvIsrSendBlock(&usDmaBuf[ADC_BURST_LEN]);
}

/* Processing task */
void ADC_Processing_Task(void *pvParameters)
{
    (void)pvParameters;
    AdcBlock_t *pBlock;

    for (;;)
    {
        if (xQueueReceive(xReadyQ, &pBlock, portMAX_DELAY) == pdTRUE)
        {
            /* Process pBlock->samples[0..15] ... */

            /* Return block to the free pool. */
            xQueueSend(xFreeQ, &pBlock, 0U);
        }
    }
}
```

---

## Design Rationale

| Concern | How it is addressed |
|---|---|
| **No malloc** | All buffers, queues, tasks, and message buffers use static allocation (`xCreateStatic` variants). No heap allocator is needed; you can set `configTOTAL_HEAP_SIZE` to 0. |
| **ISR safety** | Only `FromISR` API variants are called inside the DMA callbacks. `portYIELD_FROM_ISR` ensures the processing task wakes immediately when data arrives. |
| **DMA coherency** | A double-buffer scheme (circular DMA with half-complete / complete callbacks) guarantees the ISR always reads from the half that DMA is not currently writing to. |
| **Backpressure** | If the processing task falls behind, the oldest unprocessed burst is preserved and new bursts are dropped. An overflow counter (not shown for brevity) should be added in production. |
| **Throughput** | At 1 kHz with 32-byte bursts the data rate is only 32 KB/s. Both message buffers and queues handle this with negligible overhead on Cortex-M4. |
| **Determinism** | Message buffer send/receive and queue send/receive are O(1) operations. No priority inversion is possible since the ISR side is always non-blocking. |

## Which Solution to Pick

- **Solution 1 (Message Buffer)** -- simpler, fewer moving parts, data is copied twice (DMA buf -> message buf -> local buf). Fine at 32 KB/s.
- **Solution 2 (Pool + Queue)** -- one fewer copy, explicit pool management, better when bursts are larger or rates are higher.

For 16 x uint16_t at 1 kHz, Solution 1 is the straightforward choice.
