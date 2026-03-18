# Bare-Metal UART Driver for ARM Cortex-M4 (C99)

## Overview

This driver targets a UART peripheral at base address `0x40004400` on an ARM Cortex-M4 MCU. It implements:

- **Initialization** at 115200 baud, 8N1 (8 data bits, no parity, 1 stop bit)
- **Blocking transmit** (single byte)
- **Interrupt-driven receive** into a ring buffer

PCLK = 84 MHz. No vendor HAL is used; all register access is direct.

---

## Register Map

We define the UART register layout based on a typical ARM UART peripheral (similar to STM32 USART). Offsets from base `0x40004400`:

| Offset | Register | Description                  |
|--------|----------|------------------------------|
| 0x00   | SR       | Status register              |
| 0x04   | DR       | Data register                |
| 0x08   | BRR      | Baud rate register           |
| 0x0C   | CR1      | Control register 1           |
| 0x10   | CR2      | Control register 2           |
| 0x14   | CR3      | Control register 3           |

---

## Header File: `uart.h`

```c
#ifndef UART_H
#define UART_H

#include <stdint.h>
#include <stdbool.h>

/**
 * Initialize the UART peripheral.
 * Configures for 115200 baud, 8N1, enables TX and RX,
 * and enables the RXNE interrupt.
 */
void uart_init(void);

/**
 * Transmit a single byte (blocking).
 * Waits until the TX data register is empty, then writes the byte.
 *
 * @param byte  The byte to transmit.
 */
void uart_send_byte(uint8_t byte);

/**
 * Transmit a null-terminated string (blocking).
 *
 * @param str  Pointer to the null-terminated string.
 */
void uart_send_string(const char *str);

/**
 * Read a byte from the receive ring buffer.
 *
 * @param byte  Pointer to store the received byte.
 * @return      true if a byte was available, false if the buffer was empty.
 */
bool uart_receive_byte(uint8_t *byte);

/**
 * Query how many bytes are available in the receive buffer.
 *
 * @return  Number of unread bytes in the ring buffer.
 */
uint32_t uart_rx_available(void);

#endif /* UART_H */
```

---

## Implementation File: `uart.c`

```c
#include "uart.h"
#include <stddef.h>

/* ------------------------------------------------------------------ */
/*  UART Register Definitions                                         */
/* ------------------------------------------------------------------ */

#define UART_BASE       ((uint32_t)0x40004400)

/* Register offsets */
#define UART_SR_OFFSET  0x00U
#define UART_DR_OFFSET  0x04U
#define UART_BRR_OFFSET 0x08U
#define UART_CR1_OFFSET 0x0CU
#define UART_CR2_OFFSET 0x10U
#define UART_CR3_OFFSET 0x14U

/* Register access macros */
#define UART_SR   (*(volatile uint32_t *)(UART_BASE + UART_SR_OFFSET))
#define UART_DR   (*(volatile uint32_t *)(UART_BASE + UART_DR_OFFSET))
#define UART_BRR  (*(volatile uint32_t *)(UART_BASE + UART_BRR_OFFSET))
#define UART_CR1  (*(volatile uint32_t *)(UART_BASE + UART_CR1_OFFSET))
#define UART_CR2  (*(volatile uint32_t *)(UART_BASE + UART_CR2_OFFSET))
#define UART_CR3  (*(volatile uint32_t *)(UART_BASE + UART_CR3_OFFSET))

/* ------------------------------------------------------------------ */
/*  Status Register (SR) Bit Definitions                              */
/* ------------------------------------------------------------------ */

#define UART_SR_RXNE    (1U << 5)   /* Read data register not empty   */
#define UART_SR_TXE     (1U << 7)   /* Transmit data register empty   */
#define UART_SR_TC      (1U << 6)   /* Transmission complete          */
#define UART_SR_ORE     (1U << 3)   /* Overrun error                  */
#define UART_SR_FE      (1U << 1)   /* Framing error                  */
#define UART_SR_PE      (1U << 0)   /* Parity error                   */

/* ------------------------------------------------------------------ */
/*  Control Register 1 (CR1) Bit Definitions                          */
/* ------------------------------------------------------------------ */

#define UART_CR1_UE     (1U << 13)  /* USART enable                   */
#define UART_CR1_TE     (1U << 3)   /* Transmitter enable             */
#define UART_CR1_RE     (1U << 2)   /* Receiver enable                */
#define UART_CR1_RXNEIE (1U << 5)   /* RXNE interrupt enable          */
#define UART_CR1_TXEIE  (1U << 7)   /* TXE interrupt enable           */
#define UART_CR1_M      (1U << 12)  /* Word length: 0 = 8 bits        */
#define UART_CR1_PCE    (1U << 10)  /* Parity control enable          */

/* ------------------------------------------------------------------ */
/*  Control Register 2 (CR2) Bit Definitions                          */
/* ------------------------------------------------------------------ */

#define UART_CR2_STOP_MASK (3U << 12)
#define UART_CR2_STOP_1    (0U << 12)  /* 1 stop bit                  */
#define UART_CR2_STOP_2    (2U << 12)  /* 2 stop bits                 */

/* ------------------------------------------------------------------ */
/*  Baud Rate Calculation                                             */
/* ------------------------------------------------------------------ */

/*
 * For standard (oversampling by 16) mode:
 *   USARTDIV = PCLK / (16 * baud)
 *
 * PCLK = 84,000,000 Hz, baud = 115200
 *   USARTDIV = 84000000 / (16 * 115200) = 45.572916...
 *
 * BRR encoding:
 *   Bits [15:4] = mantissa (integer part) = 45 = 0x2D
 *   Bits [3:0]  = fraction = round(0.572916 * 16) = round(9.166) = 9 = 0x9
 *
 * BRR = (45 << 4) | 9 = 0x02D9
 *
 * Actual baud = 84000000 / (16 * 45.5625) = 115,246 Hz
 * Error = (115246 - 115200) / 115200 = ~0.04% (well within tolerance)
 */

#define PCLK_HZ         84000000U
#define UART_BAUD        115200U

/* Compute BRR value at compile time using integer arithmetic.
 * Multiply fractional calculation by 16 and round. */
#define USARTDIV_100     ((PCLK_HZ * 100U) / (16U * UART_BAUD))
#define BRR_MANTISSA     (USARTDIV_100 / 100U)
#define BRR_FRACTION_X16 (((USARTDIV_100 - (BRR_MANTISSA * 100U)) * 16U + 50U) / 100U)
#define UART_BRR_VALUE   ((BRR_MANTISSA << 4) | (BRR_FRACTION_X16 & 0x0FU))

/* ------------------------------------------------------------------ */
/*  Receive Ring Buffer                                               */
/* ------------------------------------------------------------------ */

#define RX_BUFFER_SIZE  256U  /* Must be a power of 2 */

static volatile uint8_t  rx_buffer[RX_BUFFER_SIZE];
static volatile uint32_t rx_head;  /* Written by ISR  */
static volatile uint32_t rx_tail;  /* Read by consumer */

/* ------------------------------------------------------------------ */
/*  NVIC Helpers (Cortex-M4 standard addresses)                       */
/* ------------------------------------------------------------------ */

/*
 * The actual IRQ number depends on the specific MCU.  For this example
 * we assume UART IRQ number 37 (typical for USART2 on STM32F4).
 * Adjust UART_IRQ_NUMBER for your silicon.
 */
#define UART_IRQ_NUMBER  37U

/* NVIC register addresses (ARM Cortex-M4 standard) */
#define NVIC_ISER_BASE   ((volatile uint32_t *)0xE000E100U)
#define NVIC_IPR_BASE    ((volatile uint8_t  *)0xE000E400U)

static inline void nvic_enable_irq(uint32_t irq)
{
    NVIC_ISER_BASE[irq >> 5U] = (1U << (irq & 0x1FU));
}

static inline void nvic_set_priority(uint32_t irq, uint8_t priority)
{
    /* Cortex-M4 uses the upper bits of the 8-bit priority field.
     * Shift the logical priority into the implemented bits.
     * Most Cortex-M4 implementations have 4 bits (16 levels). */
    NVIC_IPR_BASE[irq] = (priority << 4U);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

void uart_init(void)
{
    /* Reset buffer indices */
    rx_head = 0U;
    rx_tail = 0U;

    /* 1. Disable UART while configuring */
    UART_CR1 = 0U;
    UART_CR2 = 0U;
    UART_CR3 = 0U;

    /* 2. Set baud rate */
    UART_BRR = UART_BRR_VALUE;

    /* 3. Configure frame format: 8 data bits (M=0), no parity (PCE=0) */
    /*    CR1: M bit cleared, PCE bit cleared — already 0 from reset above */

    /* 4. Configure 1 stop bit in CR2 */
    UART_CR2 = UART_CR2_STOP_1;  /* bits [13:12] = 00 */

    /* 5. Enable UART, TX, RX, and RXNE interrupt */
    UART_CR1 = UART_CR1_UE      /* Enable USART               */
             | UART_CR1_TE      /* Enable transmitter          */
             | UART_CR1_RE      /* Enable receiver             */
             | UART_CR1_RXNEIE; /* Enable RXNE interrupt       */

    /* 6. Configure NVIC for this UART interrupt */
    nvic_set_priority(UART_IRQ_NUMBER, 6U);  /* Medium priority */
    nvic_enable_irq(UART_IRQ_NUMBER);
}

void uart_send_byte(uint8_t byte)
{
    /* Wait until TXE (transmit data register empty) is set */
    while (!(UART_SR & UART_SR_TXE))
    {
        /* Busy-wait */
    }

    /* Write byte to data register — this clears TXE */
    UART_DR = (uint32_t)byte;
}

void uart_send_string(const char *str)
{
    if (str == NULL)
    {
        return;
    }

    while (*str != '\0')
    {
        uart_send_byte((uint8_t)*str);
        str++;
    }
}

bool uart_receive_byte(uint8_t *byte)
{
    if (byte == NULL)
    {
        return false;
    }

    /* Check if buffer has data */
    if (rx_head == rx_tail)
    {
        return false;  /* Buffer empty */
    }

    *byte = rx_buffer[rx_tail];
    rx_tail = (rx_tail + 1U) & (RX_BUFFER_SIZE - 1U);

    return true;
}

uint32_t uart_rx_available(void)
{
    return (rx_head - rx_tail) & (RX_BUFFER_SIZE - 1U);
}

/* ------------------------------------------------------------------ */
/*  Interrupt Service Routine                                         */
/* ------------------------------------------------------------------ */

/*
 * This ISR name must match your MCU's vector table entry.
 * Common names:
 *   USART2_IRQHandler  (STM32F4 USART2)
 *   UART4_IRQHandler   (STM32F4 UART4)
 * Adjust as needed for your specific MCU and linker script.
 */
void USART2_IRQHandler(void)
{
    uint32_t status = UART_SR;

    /* Check for overrun — clear by reading SR then DR */
    if (status & UART_SR_ORE)
    {
        (void)UART_DR;  /* Discard — clears ORE flag */
    }

    /* RXNE: received data ready to be read */
    if (status & UART_SR_RXNE)
    {
        uint8_t data = (uint8_t)(UART_DR & 0xFFU);

        uint32_t next_head = (rx_head + 1U) & (RX_BUFFER_SIZE - 1U);

        if (next_head != rx_tail)
        {
            /* Buffer not full — store byte */
            rx_buffer[rx_head] = data;
            rx_head = next_head;
        }
        /* else: buffer full, incoming byte is dropped */
    }
}
```

---

## Usage Example

```c
#include "uart.h"
#include <stdint.h>

int main(void)
{
    /* Assume system clock and GPIO are already configured:
     *  - PCLK running at 84 MHz
     *  - UART TX/RX pins configured as alternate function
     *  - Peripheral clock gate enabled for this UART
     */

    uart_init();
    uart_send_string("UART initialized at 115200 8N1\r\n");

    uint8_t byte;
    while (1)
    {
        /* Echo received bytes */
        if (uart_receive_byte(&byte))
        {
            uart_send_byte(byte);
        }
    }

    return 0;  /* Never reached */
}
```

---

## Design Notes

### Baud Rate Calculation

The baud rate generator uses 16x oversampling (the default). The divisor is:

```
USARTDIV = PCLK / (16 * BAUD) = 84,000,000 / (16 * 115,200) = 45.5729...
```

The BRR register encodes this as a 12-bit mantissa and 4-bit fraction:
- Mantissa = 45 (0x2D)
- Fraction = round(0.5729 * 16) = 9
- BRR = `0x02D9`

This yields an actual baud rate of approximately 115,246 baud (0.04% error), well within the UART tolerance of +/-3%.

### Ring Buffer

- Size is 256 bytes (power of 2) to allow efficient masking instead of modulo.
- `rx_head` is written only by the ISR; `rx_tail` is written only by the consumer. This single-producer / single-consumer pattern is safe without locks on a Cortex-M4, since aligned 32-bit reads and writes are atomic.
- Both index variables are declared `volatile` to prevent the compiler from caching stale values.

### Error Handling

- **Overrun (ORE):** Cleared in the ISR by reading SR then DR (per hardware requirements). Data that caused the overrun is lost.
- **Buffer full:** If the ring buffer is full when a new byte arrives, the incoming byte is silently dropped. For production use, consider tracking an overflow counter or asserting.
- **Framing / parity errors:** Not explicitly handled here since parity is disabled (8N1). For robustness, you could check `FE` in the SR and discard corrupted bytes.

### Prerequisites (Not Shown)

Before calling `uart_init()`, your board setup code must:

1. **Enable the peripheral clock** for this UART (e.g., set the appropriate bit in `RCC_APB1ENR`).
2. **Configure GPIO pins** for UART TX and RX as alternate function, with appropriate speed and pull-up settings.
3. **Ensure the system clock** is configured so that the APB bus feeding this UART runs at 84 MHz.

These steps are highly MCU-specific and are typically done in a separate `system_init()` or board support package.
