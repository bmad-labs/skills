# Bare-Metal UART Driver for ARM Cortex-M4 (C99)

## Overview

This driver targets a UART peripheral at base address `0x40004400` on an ARM Cortex-M4 MCU with a peripheral clock (PCLK) of 84 MHz. It implements:

- Initialization at 115200 baud, 8N1 configuration
- Blocking transmit (single byte)
- Interrupt-driven receive into a ring buffer

The register layout below assumes a common UART peripheral structure similar to what you find on many Cortex-M4 MCUs (e.g., STM32-style). You may need to adjust register offsets and bit positions to match your specific silicon.

---

## Register Map Assumptions

| Offset | Register | Description |
|--------|----------|-------------|
| 0x00   | SR       | Status Register |
| 0x04   | DR       | Data Register |
| 0x08   | BRR      | Baud Rate Register |
| 0x0C   | CR1      | Control Register 1 |
| 0x10   | CR2      | Control Register 2 |
| 0x14   | CR3      | Control Register 3 |

### Key Status Register (SR) Bits

| Bit | Name  | Description |
|-----|-------|-------------|
| 5   | RXNE  | Receive data register not empty |
| 6   | TC    | Transmission complete |
| 7   | TXE   | Transmit data register empty |
| 3   | ORE   | Overrun error |

### Key Control Register 1 (CR1) Bits

| Bit  | Name  | Description |
|------|-------|-------------|
| 2    | RE    | Receiver enable |
| 3    | TE    | Transmitter enable |
| 5    | RXNEIE| RXNE interrupt enable |
| 13   | UE    | USART enable |
| 12   | M     | Word length (0 = 8 data bits) |

### Key Control Register 2 (CR2) Bits

| Bit   | Name   | Description |
|-------|--------|-------------|
| 13:12 | STOP   | Stop bits (00 = 1 stop bit) |

---

## Source Code

### uart.h

```c
#ifndef UART_H
#define UART_H

#include <stdint.h>
#include <stdbool.h>

/**
 * @brief Initialize the UART peripheral.
 *
 * Configures for 115200 baud, 8 data bits, no parity, 1 stop bit (8N1).
 * Enables the RXNE interrupt for interrupt-driven receive.
 */
void uart_init(void);

/**
 * @brief Send a single byte over UART (blocking).
 *
 * Polls the TXE flag and blocks until the transmit data register is empty,
 * then writes the byte.
 *
 * @param byte The byte to transmit.
 */
void uart_send_byte(uint8_t byte);

/**
 * @brief Send a null-terminated string over UART (blocking).
 *
 * @param str Pointer to the null-terminated string.
 */
void uart_send_string(const char *str);

/**
 * @brief Read a byte from the receive ring buffer.
 *
 * @param byte Pointer to store the received byte.
 * @return true if a byte was available and read, false if buffer was empty.
 */
bool uart_read_byte(uint8_t *byte);

/**
 * @brief Check how many bytes are available in the receive buffer.
 *
 * @return Number of bytes available to read.
 */
uint16_t uart_rx_available(void);

/**
 * @brief UART IRQ handler. Must be called from the appropriate ISR vector.
 *
 * Reads received bytes from the data register into the ring buffer.
 */
void uart_irq_handler(void);

#endif /* UART_H */
```

### uart.c

```c
#include "uart.h"

/* ---- Peripheral base address ---- */
#define UART_BASE       ((uint32_t)0x40004400U)

/* ---- Register offsets ---- */
#define UART_SR_OFFSET  0x00U
#define UART_DR_OFFSET  0x04U
#define UART_BRR_OFFSET 0x08U
#define UART_CR1_OFFSET 0x0CU
#define UART_CR2_OFFSET 0x10U
#define UART_CR3_OFFSET 0x14U

/* ---- Register access macros ---- */
#define UART_SR   (*(volatile uint32_t *)(UART_BASE + UART_SR_OFFSET))
#define UART_DR   (*(volatile uint32_t *)(UART_BASE + UART_DR_OFFSET))
#define UART_BRR  (*(volatile uint32_t *)(UART_BASE + UART_BRR_OFFSET))
#define UART_CR1  (*(volatile uint32_t *)(UART_BASE + UART_CR1_OFFSET))
#define UART_CR2  (*(volatile uint32_t *)(UART_BASE + UART_CR2_OFFSET))
#define UART_CR3  (*(volatile uint32_t *)(UART_BASE + UART_CR3_OFFSET))

/* ---- Status register bit definitions ---- */
#define UART_SR_RXNE    (1U << 5)
#define UART_SR_TC      (1U << 6)
#define UART_SR_TXE     (1U << 7)
#define UART_SR_ORE     (1U << 3)

/* ---- Control register 1 bit definitions ---- */
#define UART_CR1_RE     (1U << 2)
#define UART_CR1_TE     (1U << 3)
#define UART_CR1_RXNEIE (1U << 5)
#define UART_CR1_UE     (1U << 13)
#define UART_CR1_M      (1U << 12)

/* ---- Control register 2 bit definitions ---- */
#define UART_CR2_STOP_MASK (3U << 12)

/* ---- Baud rate configuration ---- */
#define PCLK_HZ         84000000U
#define BAUD_RATE        115200U

/* ---- Receive ring buffer ---- */
#define RX_BUFFER_SIZE   256U  /* Must be a power of 2 for efficient masking */
#define RX_BUFFER_MASK   (RX_BUFFER_SIZE - 1U)

static volatile uint8_t  rx_buffer[RX_BUFFER_SIZE];
static volatile uint16_t rx_head;  /* Written by ISR */
static volatile uint16_t rx_tail;  /* Read by application */

/* ---- NVIC helper (Cortex-M4 standard addresses) ---- */
/*
 * The exact IRQ number depends on your MCU's vector table.
 * Replace UART_IRQn with the correct IRQ number for your UART peripheral.
 * For example, on STM32F4, USART2 is IRQ 38.
 */
#define UART_IRQn        38U

#define NVIC_ISER_BASE   ((volatile uint32_t *)0xE000E100U)

static inline void nvic_enable_irq(uint32_t irqn)
{
    /* Each ISER register covers 32 IRQs */
    NVIC_ISER_BASE[irqn >> 5U] = (1U << (irqn & 0x1FU));
}

/* ---- Baud rate calculation ----
 *
 * For standard (16x oversampling) UART:
 *   USARTDIV = PCLK / (16 * baud)
 *
 * The BRR register encodes this as a fixed-point value:
 *   BRR[15:4] = mantissa (integer part of USARTDIV)
 *   BRR[3:0]  = fraction (fractional part * 16, rounded)
 *
 * For PCLK = 84 MHz, baud = 115200:
 *   USARTDIV = 84000000 / (16 * 115200) = 45.572916...
 *   Mantissa = 45  -> 0x2D
 *   Fraction = round(0.572916 * 16) = round(9.167) = 9 -> 0x9
 *   BRR = (45 << 4) | 9 = 0x2D9
 */
static uint32_t compute_brr(uint32_t pclk, uint32_t baud)
{
    /*
     * We compute this using integer arithmetic to avoid floating point.
     *
     * USARTDIV * 16 = pclk / baud
     * mantissa = (pclk / baud) / 16
     * fraction = (pclk / baud) % 16
     *
     * But we need rounding, so we use:
     * usartdiv_x16 = (2 * pclk + baud) / (2 * baud)  [rounded division]
     */
    uint32_t usartdiv_x16 = (2U * pclk + baud) / (2U * baud);
    uint32_t mantissa = usartdiv_x16 >> 4U;
    uint32_t fraction = usartdiv_x16 & 0x0FU;

    return (mantissa << 4U) | fraction;
}

void uart_init(void)
{
    /* Reset ring buffer indices */
    rx_head = 0U;
    rx_tail = 0U;

    /*
     * NOTE: Before configuring the UART, you must ensure:
     * 1. The UART peripheral clock is enabled (via RCC).
     *    e.g., RCC->APB1ENR |= RCC_APB1ENR_USART2EN;
     * 2. The GPIO pins are configured for alternate function (UART TX/RX).
     *    e.g., GPIOA pins in AF mode, appropriate AF number selected.
     *
     * These steps are board/MCU-specific and are intentionally omitted here.
     * Failing to enable the clock will cause writes to UART registers to
     * have no effect (bus fault or silent ignore depending on MCU).
     */

    /* Step 1: Disable the UART while configuring */
    UART_CR1 = 0U;
    UART_CR2 = 0U;
    UART_CR3 = 0U;

    /* Step 2: Set baud rate */
    UART_BRR = compute_brr(PCLK_HZ, BAUD_RATE);

    /* Step 3: Configure 8N1
     * - Word length: 8 bits -> CR1.M = 0 (already 0 after reset)
     * - Parity: none -> CR1.PCE = 0 (already 0 after reset)
     * - Stop bits: 1 -> CR2.STOP = 00 (already 0 after reset)
     */
    UART_CR2 &= ~UART_CR2_STOP_MASK;  /* 1 stop bit (redundant after reset, but explicit) */

    /* Step 4: Enable transmitter, receiver, and RXNE interrupt */
    UART_CR1 |= UART_CR1_TE | UART_CR1_RE | UART_CR1_RXNEIE;

    /* Step 5: Enable the UART peripheral */
    UART_CR1 |= UART_CR1_UE;

    /* Step 6: Enable UART interrupt in NVIC */
    nvic_enable_irq(UART_IRQn);
}

void uart_send_byte(uint8_t byte)
{
    /* Wait until the transmit data register is empty */
    while (!(UART_SR & UART_SR_TXE))
    {
        /* Busy-wait. In a real system you might add a timeout or
         * feed a watchdog here to avoid hanging forever. */
    }

    /* Write the byte to the data register */
    UART_DR = (uint32_t)byte;

    /* Optionally wait for transmission complete (TC flag).
     * This ensures the byte is fully shifted out before returning.
     * Remove this if you only need to fill the TX buffer. */
    while (!(UART_SR & UART_SR_TC))
    {
        /* Busy-wait */
    }
}

void uart_send_string(const char *str)
{
    while (*str != '\0')
    {
        uart_send_byte((uint8_t)*str);
        str++;
    }
}

bool uart_read_byte(uint8_t *byte)
{
    if (rx_head == rx_tail)
    {
        /* Buffer is empty */
        return false;
    }

    *byte = rx_buffer[rx_tail];
    rx_tail = (rx_tail + 1U) & RX_BUFFER_MASK;
    return true;
}

uint16_t uart_rx_available(void)
{
    return (uint16_t)((rx_head - rx_tail) & RX_BUFFER_MASK);
}

void uart_irq_handler(void)
{
    uint32_t sr = UART_SR;

    /* Handle overrun error: reading SR then DR clears ORE on many MCUs */
    if (sr & UART_SR_ORE)
    {
        /* Read DR to clear the overrun flag */
        (void)UART_DR;
        /* In production code, you might increment an error counter here */
    }

    /* Handle received data */
    if (sr & UART_SR_RXNE)
    {
        uint8_t data = (uint8_t)(UART_DR & 0xFFU);

        uint16_t next_head = (rx_head + 1U) & RX_BUFFER_MASK;
        if (next_head != rx_tail)
        {
            /* Buffer is not full; store the byte */
            rx_buffer[rx_head] = data;
            rx_head = next_head;
        }
        else
        {
            /*
             * Buffer is full. The byte is discarded.
             * In production, you might set an overflow flag or
             * increment a counter for diagnostics.
             */
        }
    }
}
```

### Vector table hookup (startup file or interrupt vector)

You need to wire `uart_irq_handler` into your MCU's interrupt vector table. The exact mechanism depends on your startup file. For example, if you are using a CMSIS-style startup:

```c
/* In your startup assembly or C vector table, ensure the UART IRQ
 * entry points to uart_irq_handler. For many STM32-like devices
 * with USART2 at this address, the handler name might be:
 *
 *   void USART2_IRQHandler(void) __attribute__((alias("uart_irq_handler")));
 *
 * Or simply name your handler to match the vector table entry:
 */
void USART2_IRQHandler(void)
{
    uart_irq_handler();
}
```

---

## Baud Rate Calculation Details

For completeness, here is the manual calculation:

```
PCLK        = 84,000,000 Hz
Baud        = 115,200
Oversampling = 16

USARTDIV = PCLK / (16 * Baud)
         = 84,000,000 / (16 * 115,200)
         = 84,000,000 / 1,843,200
         = 45.572916...

Mantissa = 45 (integer part)
Fraction = round(0.572916 * 16) = round(9.1667) = 9

BRR = (45 << 4) | 9 = 0x2D9

Actual baud = 84,000,000 / (16 * 45.5625)
            = 84,000,000 / 728.9999
            = 115,246 (~0.04% error, well within UART tolerance)
```

---

## Usage Example

```c
#include "uart.h"

int main(void)
{
    /* Assumes system clock and GPIO already configured */
    uart_init();

    uart_send_string("Hello, UART!\r\n");

    uint8_t byte;
    while (1)
    {
        if (uart_read_byte(&byte))
        {
            /* Echo received byte back */
            uart_send_byte(byte);
        }
    }

    return 0;  /* Never reached */
}
```

---

## Important Notes

1. **Clock and GPIO setup**: This driver does **not** configure the RCC (clock gating) or GPIO alternate functions. You must enable the UART peripheral clock and configure the TX/RX pins before calling `uart_init()`. This is highly MCU-specific.

2. **IRQ number**: The `UART_IRQn` value of 38 is an example (matching STM32F4 USART2). Consult your MCU's reference manual for the correct IRQ number.

3. **Register layout**: The register offsets assume a common STM32-like UART peripheral. If your MCU uses a different peripheral IP block, you will need to adjust offsets and bit positions.

4. **Ring buffer size**: The 256-byte buffer is a power of 2 to allow efficient index wrapping with a bitmask instead of modulo division. Adjust the size based on your application's needs and available RAM.

5. **Thread safety**: The ring buffer uses a single-producer (ISR writes head) / single-consumer (main loop reads tail) pattern, which is safe without additional locking on Cortex-M as long as `rx_head` and `rx_tail` are accessed atomically (they are 16-bit values, and Cortex-M4 guarantees atomic 16-bit aligned access).

6. **No DMA**: This implementation uses interrupt-driven receive. For high-throughput applications, consider adding DMA support to reduce CPU overhead.

7. **Error handling**: The driver handles overrun errors by reading the data register to clear the flag. In production, you should track and report framing errors, noise errors, and buffer overflows.
