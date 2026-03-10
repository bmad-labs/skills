# Passing ADC DMA Samples from ISR to Task on STM32F4 with FreeRTOS

## Problem Analysis

You have:
- STM32F4 with ADC using DMA in circular or normal mode
- DMA Transfer Complete ISR fires at 1 kHz
- Each burst: 16 x `uint16_t` (32 bytes)
- A processing task that must receive every burst
- No dynamic allocation (`malloc`) allowed

## Recommended Approach: Stream Buffer (FreeRTOS v10+)

The best mechanism for this scenario is **`xStreamBufferSendFromISR`**. Here is why:

| Mechanism | Verdict |
|---|---|
| **Queue of uint16_t** | 16 `xQueueSendFromISR` calls per ISR -- too much overhead at 1 kHz. |
| **Queue of pointers** | Needs a pool manager, adds complexity. |
| **Message Buffer** | Adds a 4-byte length header per message -- unnecessary when every message is the same fixed size. |
| **Stream Buffer** | Zero-copy-style bulk transfer, single API call in ISR, trigger threshold = one full burst. Ideal. |
| **Task Notification + shared buffer** | Fast, but you must manage your own double-buffer and synchronisation. Good alternative (shown below as Option B). |

Stream buffers were designed exactly for single-producer / single-consumer byte-stream transfers between an ISR and a task. They use no `malloc` at runtime (the backing store is allocated once at init with a static buffer).

---

## Option A -- Stream Buffer (Recommended)

### adc_stream.h

```c
#ifndef ADC_STREAM_H
#define ADC_STREAM_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Tunable constants */
#define ADC_BURST_SAMPLES   16U
#define ADC_BURST_BYTES     (ADC_BURST_SAMPLES * sizeof(uint16_t))  /* 32 */

/*
 * How many bursts the stream buffer can hold before the producer (ISR)
 * would have to drop data.  4 bursts = 4 ms of slack at 1 kHz.
 */
#define ADC_STREAM_BURSTS   4U
#define ADC_STREAM_BYTES    (ADC_BURST_BYTES * ADC_STREAM_BURSTS)   /* 128 */

/**
 * Initialise the ADC stream buffer and processing task.
 * Call once from main() before the scheduler starts.
 */
void ADC_Stream_Init(void);

/**
 * Call from the DMA Transfer Complete ISR.
 * @param pSamples  pointer to the 16-sample burst just completed by DMA
 */
void ADC_Stream_SendFromISR(const uint16_t *pSamples);

#ifdef __cplusplus
}
#endif

#endif /* ADC_STREAM_H */
```

### adc_stream.c

```c
#include "adc_stream.h"

#include "FreeRTOS.h"
#include "stream_buffer.h"
#include "task.h"

#include <string.h>   /* memcpy */

/* ------------------------------------------------------------------ */
/*  Static allocation for the stream buffer                           */
/* ------------------------------------------------------------------ */

/*
 * FreeRTOS stream buffers need (size + 1) bytes internally,
 * hence the +1 below.
 */
static uint8_t ucStreamStorage[ADC_STREAM_BYTES + 1];
static StaticStreamBuffer_t xStreamStruct;
static StreamBufferHandle_t xStream;

/* ------------------------------------------------------------------ */
/*  Static allocation for the processing task                         */
/* ------------------------------------------------------------------ */
#define PROC_TASK_STACK_WORDS  256U
#define PROC_TASK_PRIORITY     (configMAX_PRIORITIES - 1U)  /* high */

static StackType_t  uxProcStack[PROC_TASK_STACK_WORDS];
static StaticTask_t xProcTCB;

/* ------------------------------------------------------------------ */
/*  DMA double-buffer (the DMA writes here)                           */
/* ------------------------------------------------------------------ */

/*
 * DMA peripheral writes into this buffer.  We use "double-buffer"
 * style: DMA runs in circular mode over 2 x 16 samples.  The
 * Half-Transfer ISR fires for the first half, Transfer-Complete ISR
 * fires for the second half.  This guarantees the DMA is not
 * overwriting the half we are reading.
 */
uint16_t g_adcDmaBuf[ADC_BURST_SAMPLES * 2]
    __attribute__((aligned(4)));

/* ------------------------------------------------------------------ */
/*  ISR entry point                                                   */
/* ------------------------------------------------------------------ */

void ADC_Stream_SendFromISR(const uint16_t *pSamples)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    size_t sent = xStreamBufferSendFromISR(
        xStream,
        (const void *)pSamples,
        ADC_BURST_BYTES,
        &xHigherPriorityTaskWoken);

    /*
     * If sent < ADC_BURST_BYTES the stream buffer was full -- the
     * consumer task is not keeping up.  In a production system you
     * would increment an overflow counter here.
     */
    (void)sent;

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

/* ------------------------------------------------------------------ */
/*  Processing task                                                   */
/* ------------------------------------------------------------------ */

static void vProcessingTask(void *pvParameters)
{
    (void)pvParameters;

    uint16_t rxBuf[ADC_BURST_SAMPLES];

    for (;;)
    {
        /*
         * Block until a full burst (32 bytes) has arrived.
         * The trigger level was set to ADC_BURST_BYTES when the
         * stream buffer was created, so xStreamBufferReceive will
         * unblock exactly when 32 bytes are available.
         *
         * Timeout: portMAX_DELAY -- block forever.  Change to a
         * finite value if you need a watchdog/health check.
         */
        size_t rxBytes = xStreamBufferReceive(
            xStream,
            (void *)rxBuf,
            ADC_BURST_BYTES,
            portMAX_DELAY);

        if (rxBytes == ADC_BURST_BYTES)
        {
            /*
             * --------------------------------------------------
             * >>> Your DSP / filtering / logging code goes here.
             * >>> rxBuf[0..15] contains the 16 ADC samples.
             * --------------------------------------------------
             */
            ProcessAdcBurst(rxBuf, ADC_BURST_SAMPLES);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Initialisation (call before vTaskStartScheduler)                  */
/* ------------------------------------------------------------------ */

void ADC_Stream_Init(void)
{
    /*
     * Create the stream buffer with:
     *   - Total capacity: ADC_STREAM_BYTES (128 bytes = 4 bursts)
     *   - Trigger level:  ADC_BURST_BYTES  (32 bytes = 1 burst)
     *
     * The trigger level means the receiving task will unblock as
     * soon as one full burst is inside the buffer.
     */
    xStream = xStreamBufferCreateStatic(
        sizeof(ucStreamStorage),   /* buffer size in bytes     */
        ADC_BURST_BYTES,           /* trigger level            */
        ucStreamStorage,
        &xStreamStruct);

    configASSERT(xStream != NULL);

    /* Create the processing task (fully static). */
    xTaskCreateStatic(
        vProcessingTask,
        "ADC_Proc",
        PROC_TASK_STACK_WORDS,
        NULL,
        PROC_TASK_PRIORITY,
        uxProcStack,
        &xProcTCB);
}
```

### DMA ISR Glue (stm32f4xx_it.c)

```c
#include "adc_stream.h"

extern uint16_t g_adcDmaBuf[];

/*
 * Assuming ADC1 uses DMA2 Stream0 (the default for STM32F4).
 * Adjust the IRQ handler name for your DMA stream.
 */
void DMA2_Stream0_IRQHandler(void)
{
    if (DMA2->LISR & DMA_LISR_HTIF0)          /* Half-transfer */
    {
        DMA2->LIFCR = DMA_LIFCR_CHTIF0;       /* Clear flag    */
        ADC_Stream_SendFromISR(&g_adcDmaBuf[0]);
    }

    if (DMA2->LISR & DMA_LISR_TCIF0)          /* Transfer-complete */
    {
        DMA2->LIFCR = DMA_LIFCR_CTCIF0;       /* Clear flag    */
        ADC_Stream_SendFromISR(&g_adcDmaBuf[ADC_BURST_SAMPLES]);
    }
}
```

### ADC + DMA Peripheral Setup (adc_hw_init.c)

```c
#include "stm32f4xx.h"
#include "adc_stream.h"

extern uint16_t g_adcDmaBuf[];

void ADC_HW_Init(void)
{
    /* ---- Clocks ---- */
    RCC->AHB1ENR |= RCC_AHB1ENR_DMA2EN;
    RCC->APB2ENR |= RCC_APB2ENR_ADC1EN;

    /* ---- DMA2 Stream 0, Channel 0 (ADC1) ---- */
    DMA2_Stream0->CR = 0;                          /* Disable first  */
    while (DMA2_Stream0->CR & DMA_SxCR_EN) {}      /* Wait           */

    DMA2_Stream0->PAR  = (uint32_t)&ADC1->DR;
    DMA2_Stream0->M0AR = (uint32_t)g_adcDmaBuf;
    DMA2_Stream0->NDTR = ADC_BURST_SAMPLES * 2;    /* 32 half-words  */

    DMA2_Stream0->CR =
          (0U << DMA_SxCR_CHSEL_Pos)               /* Channel 0      */
        | DMA_SxCR_MSIZE_0                          /* Memory: 16-bit */
        | DMA_SxCR_PSIZE_0                          /* Periph: 16-bit */
        | DMA_SxCR_MINC                             /* Memory inc     */
        | DMA_SxCR_CIRC                             /* Circular mode  */
        | DMA_SxCR_TCIE                             /* TC interrupt   */
        | DMA_SxCR_HTIE;                            /* HT interrupt   */

    DMA2_Stream0->CR |= DMA_SxCR_EN;               /* Enable stream  */

    /* ---- NVIC ---- */
    NVIC_SetPriority(DMA2_Stream0_IRQn,
        configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY);  /* FreeRTOS-safe */
    NVIC_EnableIRQ(DMA2_Stream0_IRQn);

    /* ---- ADC1 ---- */
    ADC1->CR2  = ADC_CR2_ADON | ADC_CR2_DMA | ADC_CR2_DDS;
    ADC1->CR1  = ADC_CR1_SCAN;
    ADC1->SQR1 = ((ADC_BURST_SAMPLES - 1U) << ADC_SQR1_L_Pos);

    /*
     * Configure sequence registers SQR3/SQR2/SQR1 for your
     * 16 channels here.  Example for channels 0-15:
     */
    ADC1->SQR3 = (0U)  | (1U << 5)  | (2U << 10) | (3U << 15)
               | (4U << 20) | (5U << 25);
    ADC1->SQR2 = (6U)  | (7U << 5)  | (8U << 10) | (9U << 15)
               | (10U << 20) | (11U << 25);
    ADC1->SQR1 |= (12U) | (13U << 5) | (14U << 10) | (15U << 15);

    /* Set sample time for all channels (e.g., 84 cycles) */
    ADC1->SMPR2 = 0x00249249;  /* 3 = 84 cycles for ch0-9  */
    ADC1->SMPR1 = 0x00249249;  /* 3 = 84 cycles for ch10-15 */

    /* Trigger: use a timer (e.g., TIM2 TRGO) for 1 kHz rate */
    ADC1->CR2 |= ADC_CR2_EXTEN_0       /* Rising edge    */
              |  (0x6U << ADC_CR2_EXTSEL_Pos); /* TIM2 TRGO */

    /* Start conversion -- first trigger from TIM2 will kick it off */
    ADC1->CR2 |= ADC_CR2_SWSTART;
}
```

### main.c Integration

```c
#include "FreeRTOS.h"
#include "task.h"
#include "adc_stream.h"

extern void ADC_HW_Init(void);
extern void SystemClock_Config(void);

int main(void)
{
    HAL_Init();
    SystemClock_Config();

    ADC_Stream_Init();    /* Creates stream buffer + processing task */
    ADC_HW_Init();        /* Configures ADC + DMA + timer trigger    */

    vTaskStartScheduler();

    /* Should never reach here */
    for (;;) {}
}
```

---

## Option B -- Double-Buffer + Task Notification (Lighter Weight)

If you are on an older FreeRTOS (before v10) or want absolute minimum ISR overhead, use a hand-rolled double buffer with a direct-to-task notification.

```c
#include "FreeRTOS.h"
#include "task.h"
#include <string.h>

#define ADC_BURST_SAMPLES 16U

/* Double buffer: ISR writes to one half while the task reads the other. */
static uint16_t s_buf[2][ADC_BURST_SAMPLES];
static volatile uint8_t s_writeIdx = 0;   /* Toggled by ISR */

static TaskHandle_t s_procTaskHandle = NULL;

/* --- ISR side --- */
void ADC_DMA_Complete_ISR(const uint16_t *pDmaBuf)
{
    /* Copy DMA data into the "write" half */
    memcpy(s_buf[s_writeIdx], pDmaBuf,
           ADC_BURST_SAMPLES * sizeof(uint16_t));

    /* Flip: the task will read from what was the write side */
    uint8_t readyIdx = s_writeIdx;
    s_writeIdx ^= 1U;

    /* Notify the task -- pass the ready index in the notification value */
    BaseType_t xWoken = pdFALSE;
    xTaskNotifyFromISR(s_procTaskHandle, readyIdx,
                       eSetValueWithOverwrite, &xWoken);
    portYIELD_FROM_ISR(xWoken);
}

/* --- Task side --- */
static void vProcessingTask(void *pvParameters)
{
    (void)pvParameters;
    uint32_t notifValue;

    for (;;)
    {
        /* Block until ISR sends a notification */
        xTaskNotifyWait(0, UINT32_MAX, &notifValue, portMAX_DELAY);

        uint8_t idx = (uint8_t)(notifValue & 1U);

        /*
         * s_buf[idx] is safe to read -- the ISR is now writing
         * to the other half.
         */
        ProcessAdcBurst(s_buf[idx], ADC_BURST_SAMPLES);
    }
}
```

**Trade-offs vs. Stream Buffer:**

| | Stream Buffer | Double-Buffer + Notify |
|---|---|---|
| ISR overhead | ~memcpy + stream insert | ~memcpy + notify |
| Buffering depth | Configurable (N bursts) | Exactly 1 burst |
| Overrun tolerance | Absorbs up to N-1 slow cycles | If task misses one, data lost |
| FreeRTOS version | v10.0.0+ | Any |
| Code complexity | Lower (API does the work) | Slightly more manual |

---

## Key Design Decisions Explained

### 1. Why no `malloc`?

All buffers are statically allocated (`static` arrays, `StaticStreamBuffer_t`, `StaticTask_t`). The `xStreamBufferCreateStatic` and `xTaskCreateStatic` APIs avoid the FreeRTOS heap entirely. Set `configSUPPORT_STATIC_ALLOCATION` to `1` in `FreeRTOSConfig.h`.

### 2. Why circular DMA with Half-Transfer + Transfer-Complete?

This is the standard double-buffering technique for STM32 DMA:

```
DMA buffer:  [  half 0 (16 samples)  |  half 1 (16 samples)  ]
              ^                        ^
              HT interrupt fires       TC interrupt fires
```

While the ISR copies half 0 out, the DMA is filling half 1, and vice versa. No race condition, no missed samples.

### 3. ISR Priority

The DMA interrupt priority **must** be at or below `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (numerically >= that value on Cortex-M, where lower number = higher priority). This is a hard FreeRTOS requirement for any ISR that calls `...FromISR()` APIs. Typical value: priority 5 or 6 when `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY = 5`.

### 4. FreeRTOSConfig.h Requirements

Make sure these are set:

```c
#define configSUPPORT_STATIC_ALLOCATION     1
#define configUSE_STREAM_BUFFERS            1   /* Usually enabled by default */
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY  5
```

If you enable static allocation, you must also provide these two functions:

```c
/* Required by FreeRTOS when configSUPPORT_STATIC_ALLOCATION == 1 */
void vApplicationGetIdleTaskMemory(
    StaticTask_t **ppxIdleTaskTCBBuffer,
    StackType_t  **ppxIdleTaskStackBuffer,
    uint32_t      *pulIdleTaskStackSize)
{
    static StaticTask_t xIdleTCB;
    static StackType_t  uxIdleStack[configMINIMAL_STACK_SIZE];

    *ppxIdleTaskTCBBuffer   = &xIdleTCB;
    *ppxIdleTaskStackBuffer = uxIdleStack;
    *pulIdleTaskStackSize   = configMINIMAL_STACK_SIZE;
}

void vApplicationGetTimerTaskMemory(
    StaticTask_t **ppxTimerTaskTCBBuffer,
    StackType_t  **ppxTimerTaskStackBuffer,
    uint32_t      *pulTimerTaskStackSize)
{
    static StaticTask_t xTimerTCB;
    static StackType_t  uxTimerStack[configTIMER_TASK_STACK_DEPTH];

    *ppxTimerTaskTCBBuffer   = &xTimerTCB;
    *ppxTimerTaskStackBuffer = uxTimerStack;
    *pulTimerTaskStackSize   = configTIMER_TASK_STACK_DEPTH;
}
```

### 5. Memory Footprint

| Item | Bytes |
|---|---|
| DMA buffer (`g_adcDmaBuf`) | 64 |
| Stream buffer storage | 129 |
| Stream buffer struct | ~76 |
| Task stack (256 words) | 1024 |
| Task TCB | ~168 |
| **Total** | **~1,461 bytes** |

This fits comfortably in even the smallest STM32F4 variants (e.g., STM32F401 with 96 KB SRAM).

---

## Summary

- **Use Option A (Stream Buffer)** for most projects. It is the cleanest, most robust approach with built-in buffering for multiple bursts. One `xStreamBufferSendFromISR` call per half-transfer, one `xStreamBufferReceive` on the task side. All statically allocated.
- **Use Option B (Double-Buffer + Notify)** if you need FreeRTOS v9 compatibility or want the absolute minimum ISR latency and can tolerate zero slack (task must complete before the next burst).
