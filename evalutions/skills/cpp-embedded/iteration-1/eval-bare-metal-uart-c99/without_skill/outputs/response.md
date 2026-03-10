# Bare-Metal UART Driver for ARM Cortex-M4 (C99)

## Overview

This driver targets a UART peripheral at base address `0x40004400` on an ARM Cortex-M4 MCU with an 84 MHz peripheral clock (PCLK). It implements:

- **Initialization**: 115200 baud, 8 data bits, no parity, 1 stop bit (8N1)
- **Blocking transmit**: Polls the TX-empty flag before writing each byte
- **Interrupt-driven receive**: Incoming bytes are stored in a lock-free ring buffer

The register layout used here follows a common STM32-like UART peripheral model (SR, DR, BRR, CR1, CR2, CR3), which is representative of many Cortex-M4 UART peripherals. Adjust register offsets if your specific silicon differs.

## Baud Rate Calculation

For a standard UART with 16x oversampling:

```
USARTDIV = PCLK / (16 * baud)
         = 84,000,000 / (16 * 115,200)
         = 84,000,000 / 1,843,200
         = 45.572916...
```

The BRR register encodes this as a 12-bit mantissa and 4-bit fraction:

- Mantissa = 45 = 0x2D
- Fraction = round(0.572916 * 16) = round(9.167) = 9 = 0x9
- BRR = (45 << 4) | 9 = 0x2D9

This yields an actual baud rate of 84,000,000 / (16 * 45.5625) = 115,068 baud, which is within the acceptable 2% tolerance.

## Complete Source Code

### uart.h - Header File

```c
/**
 * @file  uart.h
 * @brief Bare-metal UART driver for ARM Cortex-M4 (C99)
 *
 * Peripheral base: 0x40004400
 * Configuration:   115200 baud, 8N1
 * PCLK:            84 MHz
 */

#ifndef UART_H
#define UART_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Size of the receive ring buffer (must be a power of 2).
 */
#define UART_RX_BUF_SIZE  256u

/**
 * @brief Initialize the UART peripheral.
 *
 * Configures for 115200 baud, 8N1 with RXNE interrupt enabled.
 * The caller must also enable the corresponding NVIC IRQ
 * (see uart_get_irqn()) and ensure the UART peripheral clock
 * is already enabled in the RCC registers before calling this.
 */
void uart_init(void);

/**
 * @brief Transmit a single byte (blocking).
 *
 * Spins until the transmit data register is empty, then writes the byte.
 *
 * @param byte  The byte to transmit.
 */
void uart_send_byte(uint8_t byte);

/**
 * @brief Transmit a buffer of bytes (blocking).
 *
 * @param data  Pointer to the data buffer.
 * @param len   Number of bytes to transmit.
 */
void uart_send(const uint8_t *data, size_t len);

/**
 * @brief Transmit a null-terminated string (blocking).
 *
 * @param str  The string to transmit (must not be NULL).
 */
void uart_send_string(const char *str);

/**
 * @brief Read one byte from the receive ring buffer.
 *
 * @param[out] byte  Pointer to store the received byte.
 * @return true if a byte was available, false if the buffer was empty.
 */
bool uart_recv_byte(uint8_t *byte);

/**
 * @brief Return the number of bytes available in the receive buffer.
 */
size_t uart_rx_available(void);

/**
 * @brief UART receive interrupt handler.
 *
 * Must be called from the appropriate IRQ handler (e.g., USART2_IRQHandler).
 * Reads the data register and stores the byte into the ring buffer.
 */
void uart_irq_handler(void);

#ifdef __cplusplus
}
#endif

#endif /* UART_H */
```

### uart.c - Implementation File

```c
/**
 * @file  uart.c
 * @brief Bare-metal UART driver implementation for ARM Cortex-M4 (C99)
 */

#include "uart.h"

/* ------------------------------------------------------------------ */
/*  UART Register Definitions                                         */
/* ------------------------------------------------------------------ */

#define UART_BASE       0x40004400UL

/**
 * Register offsets (STM32-like USART peripheral layout).
 * Adjust these if your MCU uses a different register map.
 */
#define UART_SR_OFFSET  0x00U   /* Status register          */
#define UART_DR_OFFSET  0x04U   /* Data register            */
#define UART_BRR_OFFSET 0x08U   /* Baud rate register       */
#define UART_CR1_OFFSET 0x0CU   /* Control register 1       */
#define UART_CR2_OFFSET 0x10U   /* Control register 2       */
#define UART_CR3_OFFSET 0x14U   /* Control register 3       */

/** Helper macro: access a 32-bit memory-mapped register. */
#define UART_REG(offset) \
    (*(volatile uint32_t *)(UART_BASE + (offset)))

/* Shorthand register accessors */
#define UART_SR   UART_REG(UART_SR_OFFSET)
#define UART_DR   UART_REG(UART_DR_OFFSET)
#define UART_BRR  UART_REG(UART_BRR_OFFSET)
#define UART_CR1  UART_REG(UART_CR1_OFFSET)
#define UART_CR2  UART_REG(UART_CR2_OFFSET)
#define UART_CR3  UART_REG(UART_CR3_OFFSET)

/* ------------------------------------------------------------------ */
/*  Status Register (SR) Bit Definitions                              */
/* ------------------------------------------------------------------ */

#define UART_SR_TXE   (1U << 7)   /* Transmit data register empty */
#define UART_SR_TC    (1U << 6)   /* Transmission complete        */
#define UART_SR_RXNE  (1U << 5)   /* Read data register not empty */
#define UART_SR_ORE   (1U << 3)   /* Overrun error                */
#define UART_SR_FE    (1U << 1)   /* Framing error                */

/* ------------------------------------------------------------------ */
/*  Control Register 1 (CR1) Bit Definitions                          */
/* ------------------------------------------------------------------ */

#define UART_CR1_UE      (1U << 13)  /* USART enable              */
#define UART_CR1_M       (1U << 12)  /* Word length: 0=8bit 1=9bit*/
#define UART_CR1_PCE     (1U << 10)  /* Parity control enable     */
#define UART_CR1_RXNEIE  (1U << 5)   /* RXNE interrupt enable     */
#define UART_CR1_TE      (1U << 3)   /* Transmitter enable        */
#define UART_CR1_RE      (1U << 2)   /* Receiver enable           */

/* ------------------------------------------------------------------ */
/*  Control Register 2 (CR2) Bit Definitions                          */
/* ------------------------------------------------------------------ */

#define UART_CR2_STOP_MASK (3U << 12) /* STOP bits field           */
#define UART_CR2_STOP_1    (0U << 12) /* 1 stop bit                */

/* ------------------------------------------------------------------ */
/*  Baud Rate Configuration                                           */
/* ------------------------------------------------------------------ */

/**
 * PCLK = 84 MHz, Baud = 115200, oversampling = 16
 * USARTDIV = 84000000 / (16 * 115200) = 45.5729...
 * Mantissa = 45 (0x2D), Fraction = round(0.5729 * 16) = 9
 * BRR = (45 << 4) | 9 = 0x2D9
 */
#define UART_PCLK          84000000UL
#define UART_BAUD          115200UL
#define UART_BRR_VALUE     0x02D9U

/* ------------------------------------------------------------------ */
/*  Receive Ring Buffer                                               */
/* ------------------------------------------------------------------ */

/**
 * Compile-time check: buffer size must be a power of 2 so we can use
 * a bitmask instead of modulo for index wrapping.
 */
_Static_assert(
    (UART_RX_BUF_SIZE & (UART_RX_BUF_SIZE - 1u)) == 0u,
    "UART_RX_BUF_SIZE must be a power of 2"
);

#define UART_RX_BUF_MASK  (UART_RX_BUF_SIZE - 1u)

static volatile uint8_t  rx_buffer[UART_RX_BUF_SIZE];
static volatile uint32_t rx_head;  /* Written by ISR (producer)  */
static volatile uint32_t rx_tail;  /* Written by consumer thread */

/* ------------------------------------------------------------------ */
/*  Compiler Barrier                                                  */
/* ------------------------------------------------------------------ */

/**
 * On Cortex-M4, single-byte reads/writes to aligned addresses are
 * atomic.  We use a compiler barrier to prevent the optimizer from
 * reordering accesses across the barrier.  A full DSB/DMB is not
 * required for the single-producer / single-consumer ring buffer
 * pattern on a single-core Cortex-M, but a compiler barrier is
 * necessary to ensure correct ordering in optimized builds.
 */
#if defined(__GNUC__) || defined(__clang__)
  #define COMPILER_BARRIER() __asm volatile("" ::: "memory")
#elif defined(__ICCARM__)
  #define COMPILER_BARRIER() __asm volatile("" ::: "memory")
#else
  #define COMPILER_BARRIER() ((void)0)
#endif

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

void uart_init(void)
{
    /* -------------------------------------------------------------- */
    /* IMPORTANT: Before calling uart_init(), the caller must:        */
    /*   1. Enable the UART peripheral clock via RCC.                 */
    /*   2. Configure the GPIO pins for UART TX/RX as alternate       */
    /*      function, with appropriate speed and pull-up settings.    */
    /*   3. Enable the UART IRQ in the NVIC after this function       */
    /*      returns (e.g., NVIC_EnableIRQ(USART2_IRQn)).             */
    /* -------------------------------------------------------------- */

    /* Reset ring buffer indices */
    rx_head = 0u;
    rx_tail = 0u;

    /* Disable UART while configuring */
    UART_CR1 = 0u;
    UART_CR2 = 0u;
    UART_CR3 = 0u;

    /*
     * Configure baud rate.
     * BRR = mantissa[15:4] | fraction[3:0]
     */
    UART_BRR = UART_BRR_VALUE;

    /*
     * Configure CR2: 1 stop bit.
     * (The reset value already gives 1 stop bit, but we set it
     *  explicitly for clarity.)
     */
    UART_CR2 = UART_CR2_STOP_1;

    /*
     * Configure CR1:
     *   - 8-bit word length  (M = 0)
     *   - No parity          (PCE = 0)
     *   - TX enable          (TE = 1)
     *   - RX enable          (RE = 1)
     *   - RXNE interrupt     (RXNEIE = 1)
     *   - USART enable       (UE = 1)
     *
     * We write CR1 last so the peripheral starts only after all other
     * registers are configured.
     */
    UART_CR1 = UART_CR1_UE
              | UART_CR1_TE
              | UART_CR1_RE
              | UART_CR1_RXNEIE;
}

void uart_send_byte(uint8_t byte)
{
    /* Wait until the transmit data register is empty */
    while ((UART_SR & UART_SR_TXE) == 0u)
    {
        /* Busy-wait.  In a real system you might insert a WFI here
         * or yield to an RTOS if the TXE interrupt is used instead. */
    }

    /* Write the byte to the data register.  Only the lower 8 bits
     * are used in 8-bit mode. */
    UART_DR = (uint32_t)byte;
}

void uart_send(const uint8_t *data, size_t len)
{
    if (data == NULL)
    {
        return;
    }

    for (size_t i = 0u; i < len; i++)
    {
        uart_send_byte(data[i]);
    }
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

bool uart_recv_byte(uint8_t *byte)
{
    if (byte == NULL)
    {
        return false;
    }

    /* Snapshot head (written by ISR) with a compiler barrier to ensure
     * we read the latest value. */
    COMPILER_BARRIER();
    uint32_t head = rx_head;
    uint32_t tail = rx_tail;

    if (head == tail)
    {
        /* Buffer is empty */
        return false;
    }

    *byte = rx_buffer[tail & UART_RX_BUF_MASK];

    /* Ensure the byte is read before we advance the tail index */
    COMPILER_BARRIER();

    rx_tail = tail + 1u;

    return true;
}

size_t uart_rx_available(void)
{
    COMPILER_BARRIER();
    uint32_t head = rx_head;
    uint32_t tail = rx_tail;

    return (size_t)(head - tail);
}

void uart_irq_handler(void)
{
    uint32_t sr = UART_SR;

    /* ---- Handle overrun / framing errors ---- */
    if (sr & (UART_SR_ORE | UART_SR_FE))
    {
        /*
         * Reading SR followed by DR clears these error flags on most
         * STM32-like peripherals.  We read DR below, which serves
         * double duty.  If you need to track error statistics, do so
         * here.
         */
    }

    /* ---- Receive data register not empty ---- */
    if (sr & UART_SR_RXNE)
    {
        /* Read the data register (also clears the RXNE flag) */
        uint8_t data = (uint8_t)(UART_DR & 0xFFu);

        uint32_t head = rx_head;
        uint32_t tail = rx_tail;

        /* Check if there is room in the ring buffer */
        if ((head - tail) < UART_RX_BUF_SIZE)
        {
            rx_buffer[head & UART_RX_BUF_MASK] = data;

            /* Ensure the byte is stored before the head is advanced */
            COMPILER_BARRIER();

            rx_head = head + 1u;
        }
        else
        {
            /*
             * Buffer full -- the incoming byte is dropped.
             * In a production system you might set an overflow flag
             * or increment an error counter here.
             */
        }
    }
}
```

### main.c - Example Usage

```c
/**
 * @file  main.c
 * @brief Minimal example showing UART driver usage.
 */

#include <stdint.h>
#include "uart.h"

/* ------------------------------------------------------------------ */
/*  NVIC helpers (Cortex-M4 standard addresses)                       */
/* ------------------------------------------------------------------ */

#define NVIC_ISER_BASE  0xE000E100UL  /* Interrupt Set-Enable Registers */

static inline void nvic_enable_irq(uint32_t irqn)
{
    volatile uint32_t *iser = (volatile uint32_t *)(NVIC_ISER_BASE);
    iser[irqn >> 5u] = (1u << (irqn & 0x1Fu));
}

/* ------------------------------------------------------------------ */
/*  RCC clock enable (example for STM32F4 USART2 on APB1)             */
/*  Adjust for your specific MCU.                                     */
/* ------------------------------------------------------------------ */

#define RCC_BASE        0x40023800UL
#define RCC_APB1ENR     (*(volatile uint32_t *)(RCC_BASE + 0x40U))
#define RCC_APB1ENR_USART2EN  (1U << 17)

/* IRQ number -- check your MCU's vector table */
#define USART2_IRQn     38u

/* ------------------------------------------------------------------ */
/*  IRQ Handler (must match the name in your startup/vector table)    */
/* ------------------------------------------------------------------ */

void USART2_IRQHandler(void)
{
    uart_irq_handler();
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

int main(void)
{
    /* 1. Enable the UART peripheral clock */
    RCC_APB1ENR |= RCC_APB1ENR_USART2EN;

    /* Small delay for clock to stabilize (a few NOPs suffice) */
    for (volatile int i = 0; i < 10; i++) { }

    /*
     * 2. Configure GPIO pins for UART TX/RX.
     *    (Omitted for brevity -- set the appropriate pins to
     *     alternate function mode, e.g., AF7 for USART2 on STM32F4.)
     */

    /* 3. Initialize the UART peripheral */
    uart_init();

    /* 4. Enable the UART interrupt in NVIC */
    nvic_enable_irq(USART2_IRQn);

    /* 5. Transmit a greeting */
    uart_send_string("UART ready (115200 8N1)\r\n");

    /* 6. Echo received bytes */
    uint8_t ch;
    for (;;)
    {
        if (uart_recv_byte(&ch))
        {
            /* Echo the received byte back */
            uart_send_byte(ch);
        }

        /*
         * In a real application you might enter WFI here to save
         * power while waiting for interrupts:
         *   __asm volatile("wfi");
         */
    }

    /* Never reached */
    return 0;
}
```

## Design Decisions and Notes

### Register Layout

The register offsets used (SR at +0x00, DR at +0x04, BRR at +0x08, CR1 at +0x0C, etc.) follow the STM32F4 USART peripheral layout. This is one of the most common Cortex-M4 UART peripherals. If your custom board uses a different UART IP block, you will need to adjust the offsets and bit positions accordingly.

### Ring Buffer Design

The receive buffer uses a **lock-free single-producer / single-consumer (SPSC) ring buffer** pattern:

- The **ISR** is the sole producer and only writes `rx_head`.
- The **main thread** is the sole consumer and only writes `rx_tail`.
- Both indices are `uint32_t` and are allowed to wrap naturally through the full 32-bit range. The mask is applied only when indexing into the array.
- The buffer size must be a power of 2 (enforced by `_Static_assert`) so that `index & mask` correctly wraps the index.
- **No disabling of interrupts** is needed because each side writes only its own index, and single aligned 32-bit writes are atomic on Cortex-M4.

### Compiler Barriers

On a single-core Cortex-M4, hardware memory ordering is strong enough that `DMB`/`DSB` barriers are not required for the SPSC pattern. However, the C compiler may reorder loads and stores across function calls or within a single function during optimization. The `COMPILER_BARRIER()` macro (`__asm volatile("" ::: "memory")`) prevents this reordering without generating any actual instructions.

### Error Handling

The ISR checks for overrun (`ORE`) and framing (`FE`) errors. On most STM32-like peripherals, reading the status register followed by reading the data register clears these flags. In a production driver you would typically maintain error counters or set flags so the application layer can detect and respond to communication problems.

### What the Caller Must Do

Before calling `uart_init()`:

1. **Enable the peripheral clock** via the RCC (Reset and Clock Control) registers.
2. **Configure GPIO pins** for the UART TX and RX as alternate function with appropriate speed/pull settings.

After calling `uart_init()`:

3. **Enable the NVIC interrupt** for the UART (e.g., `NVIC_EnableIRQ(USART2_IRQn)` if using CMSIS, or write directly to the NVIC ISER register as shown in the example).

### Baud Rate Accuracy

With PCLK = 84 MHz and BRR = 0x2D9:

| Parameter      | Value         |
|----------------|---------------|
| USARTDIV       | 45.5625       |
| Actual baud    | 115,068 baud  |
| Error           | -0.11%       |

This is well within the +/-2% tolerance required for reliable UART communication.

### Extending This Driver

Common enhancements for a production system:

- **DMA transmit/receive**: Replace blocking TX with DMA for better CPU utilization.
- **Configurable baud rate**: Pass baud rate as a parameter to `uart_init()` and compute BRR at runtime.
- **TX interrupt/DMA**: Use a TX ring buffer with TXE interrupts instead of busy-waiting.
- **Flow control**: Enable RTS/CTS via CR3 if the hardware supports it.
- **Multiple UART instances**: Parameterize the driver by base address to support multiple peripherals.
