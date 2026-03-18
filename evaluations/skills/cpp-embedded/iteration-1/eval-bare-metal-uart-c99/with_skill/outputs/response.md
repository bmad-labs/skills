# Bare-Metal UART Driver for ARM Cortex-M4 (C99)

## Overview

Below is a complete bare-metal UART driver targeting a peripheral at base address `0x40004400` on an ARM Cortex-M4 with an 84 MHz peripheral clock. The driver provides:

- **Initialization** -- 115200 baud, 8N1, with RX interrupt enabled
- **Blocking transmit** -- polls TXE before writing each byte
- **Interrupt-driven receive** -- incoming bytes are stored into a statically-allocated power-of-2 ring buffer, safe for concurrent ISR/task access

The design follows embedded best practices:

- All buffers are statically allocated (no `malloc`/`free`)
- Hardware registers are accessed through a `volatile`-qualified struct mapped to the peripheral base address
- Bit-field constants are named, not magic numbers
- The ring buffer uses a power-of-2 size with masking for branchless wrap-around
- ISR is minimal: writes one byte to the ring buffer and returns
- Shared state between ISR and main context uses `volatile` head/tail indices
- Fixed-width types from `<stdint.h>` throughout
- C99 designated initializers where appropriate
- No VLAs, no recursion, no dynamic allocation

## Register Map Assumptions

This driver assumes a UART peripheral with the following register layout at offsets from the base address (common in STM32F4-family parts):

| Offset | Register | Description |
|--------|----------|-------------|
| 0x00   | SR       | Status register |
| 0x04   | DR       | Data register (read = RX, write = TX) |
| 0x08   | BRR      | Baud rate register |
| 0x0C   | CR1      | Control register 1 |
| 0x10   | CR2      | Control register 2 |
| 0x14   | CR3      | Control register 3 |

## Baud Rate Calculation

For USARTDIV with 16x oversampling:

```
USARTDIV = PCLK / (16 * baud) = 84000000 / (16 * 115200) = 45.572916...
Mantissa = 45 = 0x2D
Fraction = 0.572916 * 16 = 9.166 => 9 = 0x09
BRR = (mantissa << 4) | fraction = 0x02D9
```

Actual baud = 84000000 / (16 * 45.5625) = 115068, error ~0.11%, well within tolerance.

## Complete Code

### uart.h

```c
/**
 * @file uart.h
 * @brief Bare-metal UART driver for ARM Cortex-M4 (C99)
 *
 * Peripheral base: 0x40004400
 * Configuration:   115200 baud, 8N1
 * TX:              Blocking (polls TXE)
 * RX:              Interrupt-driven into ring buffer
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
 * @brief Initialize the UART peripheral.
 *
 * Configures the UART for 115200 baud, 8N1, enables the transmitter
 * and receiver, and enables the RXNE interrupt. The caller must ensure
 * that the UART peripheral clock is already enabled in the RCC before
 * calling this function, and that the corresponding GPIO pins are
 * configured for alternate function.
 */
void uart_init(void);

/**
 * @brief Transmit a single byte (blocking).
 *
 * Polls the TXE flag until the transmit data register is empty,
 * then writes the byte. Returns after the byte is loaded into
 * the shift register.
 *
 * @param byte The byte to transmit.
 */
void uart_send_byte(uint8_t byte);

/**
 * @brief Transmit a buffer of bytes (blocking).
 *
 * Sends each byte sequentially using uart_send_byte().
 *
 * @param data Pointer to the data buffer. Must not be NULL.
 * @param len  Number of bytes to send.
 */
void uart_send(const uint8_t *data, size_t len);

/**
 * @brief Check whether received data is available.
 *
 * @return true if at least one byte is available in the RX ring buffer.
 */
bool uart_rx_available(void);

/**
 * @brief Read a single byte from the RX ring buffer.
 *
 * @param[out] out_byte Pointer to store the received byte. Must not be NULL.
 * @return true if a byte was read, false if the buffer was empty.
 */
bool uart_read_byte(uint8_t *out_byte);

/**
 * @brief Get the number of bytes currently in the RX ring buffer.
 *
 * @return Number of unread bytes.
 */
size_t uart_rx_count(void);

/**
 * @brief UART receive interrupt handler.
 *
 * Must be installed in the vector table for the UART peripheral's IRQ.
 * Reads the received byte from the data register and stores it in the
 * ring buffer. If the buffer is full, the incoming byte is discarded
 * (overflow). This function must not be called from user code.
 */
void UART_IRQHandler(void);

#ifdef __cplusplus
}
#endif

#endif /* UART_H */
```

### uart.c

```c
/**
 * @file uart.c
 * @brief Bare-metal UART driver implementation (C99)
 *
 * Target: ARM Cortex-M4, PCLK = 84 MHz
 * UART base address: 0x40004400
 * Config: 115200 baud, 8N1, RX interrupt-driven
 */

#include "uart.h"
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* ------------------------------------------------------------------ */
/* Hardware register definitions                                       */
/* ------------------------------------------------------------------ */

/**
 * Volatile-qualified register type. Every read/write goes to hardware;
 * the compiler will never cache or reorder these accesses.
 */
typedef volatile uint32_t reg32_t;

/**
 * UART register map. Members are laid out to match the hardware at
 * 32-bit (4-byte) offsets from the peripheral base address.
 */
typedef struct {
    reg32_t SR;     /* 0x00  Status register          */
    reg32_t DR;     /* 0x04  Data register             */
    reg32_t BRR;    /* 0x08  Baud rate register        */
    reg32_t CR1;    /* 0x0C  Control register 1        */
    reg32_t CR2;    /* 0x10  Control register 2        */
    reg32_t CR3;    /* 0x14  Control register 3        */
} UART_TypeDef;

/** Peripheral base address (from board/MCU datasheet) */
#define UART_BASE       (0x40004400U)
#define UART            ((UART_TypeDef *)UART_BASE)

/* ------------------------------------------------------------------ */
/* Status register (SR) bit definitions                                */
/* ------------------------------------------------------------------ */
#define UART_SR_PE      (1U << 0)   /**< Parity error                 */
#define UART_SR_FE      (1U << 1)   /**< Framing error                */
#define UART_SR_NF      (1U << 2)   /**< Noise detected flag          */
#define UART_SR_ORE     (1U << 3)   /**< Overrun error                */
#define UART_SR_IDLE    (1U << 4)   /**< Idle line detected            */
#define UART_SR_RXNE    (1U << 5)   /**< Read data register not empty  */
#define UART_SR_TC      (1U << 6)   /**< Transmission complete         */
#define UART_SR_TXE     (1U << 7)   /**< Transmit data register empty  */

/* ------------------------------------------------------------------ */
/* Control register 1 (CR1) bit definitions                            */
/* ------------------------------------------------------------------ */
#define UART_CR1_RE     (1U << 2)   /**< Receiver enable               */
#define UART_CR1_TE     (1U << 3)   /**< Transmitter enable            */
#define UART_CR1_RXNEIE (1U << 5)   /**< RXNE interrupt enable         */
#define UART_CR1_UE     (1U << 13)  /**< UART enable                   */

/* ------------------------------------------------------------------ */
/* Baud rate configuration                                             */
/* ------------------------------------------------------------------ */

/**
 * PCLK and target baud rate as compile-time constants.
 * BRR value for 16x oversampling:
 *   USARTDIV = PCLK / (16 * BAUD)
 *   BRR[15:4] = mantissa, BRR[3:0] = fraction (1/16ths)
 *
 *   84000000 / (16 * 115200) = 45.572916...
 *   mantissa = 45 (0x2D)
 *   fraction = round(0.572916 * 16) = 9 (0x09)
 *   BRR = (45 << 4) | 9 = 0x02D9
 */
#define PCLK_HZ         (84000000U)
#define TARGET_BAUD      (115200U)
#define BRR_MANTISSA     (PCLK_HZ / (16U * TARGET_BAUD))
#define BRR_FRACTION_X16 (PCLK_HZ % (16U * TARGET_BAUD))
#define BRR_FRACTION     ((BRR_FRACTION_X16 * 16U + (16U * TARGET_BAUD / 2U)) \
                          / (16U * TARGET_BAUD))
#define UART_BRR_VALUE   ((BRR_MANTISSA << 4) | (BRR_FRACTION & 0x0FU))

/* ------------------------------------------------------------------ */
/* RX ring buffer                                                      */
/* ------------------------------------------------------------------ */

/**
 * Buffer size MUST be a power of 2 so we can use bitwise AND for
 * wrap-around instead of a branch or modulo. This is both faster
 * and deterministic.
 */
#define UART_RX_BUF_SIZE  256U

#if (UART_RX_BUF_SIZE & (UART_RX_BUF_SIZE - 1U)) != 0U
    #error "UART_RX_BUF_SIZE must be a power of 2"
#endif

#define UART_RX_BUF_MASK  (UART_RX_BUF_SIZE - 1U)

/**
 * Ring buffer structure.
 *
 * - head: written by ISR, read by consumer (main/task context)
 * - tail: written by consumer, read by ISR (to check full)
 *
 * Both indices are volatile because they are shared between ISR
 * and non-ISR contexts. The single-producer (ISR writes head),
 * single-consumer (task reads tail) pattern is inherently safe
 * on Cortex-M without additional locking, as long as index
 * updates are atomic 32-bit stores (which they are on ARMv7-M).
 */
static uint8_t          rx_buf[UART_RX_BUF_SIZE];
static volatile size_t  rx_head;  /* Next write position (ISR)     */
static volatile size_t  rx_tail;  /* Next read position  (task)    */

/* ------------------------------------------------------------------ */
/* CMSIS-style intrinsics (if not using CMSIS headers)                 */
/* ------------------------------------------------------------------ */

#ifndef __disable_irq
/**
 * Disable interrupts globally (sets PRIMASK on Cortex-M).
 * Used for critical sections when reading multi-byte shared state.
 */
static inline void __disable_irq(void)
{
    __asm volatile ("cpsid i" ::: "memory");
}
#endif

#ifndef __enable_irq
/** Re-enable interrupts globally (clears PRIMASK). */
static inline void __enable_irq(void)
{
    __asm volatile ("cpsie i" ::: "memory");
}
#endif

/* ------------------------------------------------------------------ */
/* NVIC helpers (minimal, for the UART IRQ only)                       */
/* ------------------------------------------------------------------ */

/**
 * NVIC Interrupt Set-Enable Register base.
 * Each register covers 32 IRQs. The IRQ number for this UART
 * must be defined per the MCU datasheet (vector table position).
 *
 * Adjust UART_IRQn to match your MCU's interrupt assignment.
 */
#define UART_IRQn           38U  /* Example: adjust per MCU datasheet */

#define NVIC_ISER_BASE      ((volatile uint32_t *)0xE000E100U)

static inline void nvic_enable_irq(uint32_t irqn)
{
    NVIC_ISER_BASE[irqn >> 5U] = (1U << (irqn & 0x1FU));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

void uart_init(void)
{
    /*
     * Prerequisites (must be done by the caller / board init):
     *   1. Enable the UART peripheral clock in RCC
     *      e.g. RCC->APB1ENR |= RCC_APB1ENR_USARTxEN;
     *   2. Configure TX/RX GPIO pins for alternate function, correct AF mapping
     *   3. Optionally set GPIO speed / pull-up configuration
     */

    /* Disable UART during configuration */
    UART->CR1 = 0U;
    UART->CR2 = 0U;
    UART->CR3 = 0U;

    /*
     * Set baud rate.
     * BRR = mantissa[15:4] | fraction[3:0]
     * For 115200 baud @ 84 MHz PCLK, 16x oversampling:
     *   BRR = 0x02D9  (45 + 9/16 = 45.5625 => 115068 baud, 0.11% error)
     */
    UART->BRR = UART_BRR_VALUE;

    /*
     * Configure CR1:
     *   - 8-bit word length (M bit = 0, default after reset)
     *   - No parity        (PCE bit = 0, default)
     *   - TX enable        (TE)
     *   - RX enable        (RE)
     *   - RXNE interrupt   (RXNEIE) -- fires when data arrives
     *   - UART enable      (UE)
     *
     * 8N1 is the default with M=0, PCE=0, and CR2 STOP[1:0]=00 (1 stop bit).
     */
    UART->CR1 = UART_CR1_TE
              | UART_CR1_RE
              | UART_CR1_RXNEIE
              | UART_CR1_UE;

    /* Initialize the ring buffer indices */
    rx_head = 0U;
    rx_tail = 0U;

    /* Enable the UART interrupt in the NVIC */
    nvic_enable_irq(UART_IRQn);
}

void uart_send_byte(uint8_t byte)
{
    /* Wait until the transmit data register is empty */
    while ((UART->SR & UART_SR_TXE) == 0U) {
        /* Busy-wait. Each iteration re-reads SR from hardware
         * because SR is volatile. */
    }

    /* Write the byte. Writing DR clears TXE automatically. */
    UART->DR = (uint32_t)byte;
}

void uart_send(const uint8_t *data, size_t len)
{
    if (data == NULL) {
        return;
    }

    for (size_t i = 0U; i < len; i++) {
        uart_send_byte(data[i]);
    }

    /* Optionally wait for the last byte to fully shift out */
    while ((UART->SR & UART_SR_TC) == 0U) {
        /* Wait for transmission complete */
    }
}

bool uart_rx_available(void)
{
    return (rx_head != rx_tail);
}

bool uart_read_byte(uint8_t *out_byte)
{
    if (out_byte == NULL) {
        return false;
    }

    /* Snapshot head -- written by ISR, but a single 32-bit read
     * is atomic on Cortex-M, so no critical section needed. */
    size_t head = rx_head;

    if (head == rx_tail) {
        return false;   /* Buffer empty */
    }

    *out_byte = rx_buf[rx_tail & UART_RX_BUF_MASK];
    rx_tail = (rx_tail + 1U) & UART_RX_BUF_MASK;

    return true;
}

size_t uart_rx_count(void)
{
    /*
     * Disable interrupts briefly to get a consistent snapshot of
     * both head and tail. On Cortex-M, a single index read is
     * atomic, but reading two values that must be consistent
     * requires a critical section.
     */
    __disable_irq();
    size_t count = (rx_head - rx_tail) & UART_RX_BUF_MASK;
    __enable_irq();

    return count;
}

/* ------------------------------------------------------------------ */
/* Interrupt handler                                                   */
/* ------------------------------------------------------------------ */

/**
 * UART receive interrupt handler.
 *
 * This function is called by the hardware when the RXNE flag is set
 * (a byte has been received). It reads the byte from DR (which also
 * clears RXNE) and stores it in the ring buffer.
 *
 * ISR best practices followed:
 *   - No allocation
 *   - No blocking calls
 *   - No non-reentrant functions
 *   - Minimal work: read byte, write to buffer, return
 *   - Overflow: silently discard (alternative: set an error flag)
 */
void UART_IRQHandler(void)
{
    /* Check RXNE to confirm this is a receive interrupt.
     * Other flags (ORE, FE, NF) may also be set; reading
     * SR then DR clears most error flags automatically. */
    uint32_t sr = UART->SR;

    if (sr & UART_SR_RXNE) {
        uint8_t byte = (uint8_t)(UART->DR & 0xFFU);

        /* Calculate next write position */
        size_t next_head = (rx_head + 1U) & UART_RX_BUF_MASK;

        if (next_head != rx_tail) {
            /* Buffer has space -- store the byte */
            rx_buf[rx_head] = byte;
            rx_head = next_head;
        }
        /* else: buffer full -- byte is discarded (overflow).
         * In a production system, consider setting a volatile
         * overflow flag that the application can poll. */
    }

    /* Handle overrun error: reading SR then DR clears ORE on
     * many STM32 parts. If ORE persists, explicitly clear it. */
    if (sr & UART_SR_ORE) {
        (void)UART->DR;  /* Clear ORE by reading DR */
    }
}
```

### Example Usage (main.c)

```c
/**
 * @file main.c
 * @brief Example usage of the bare-metal UART driver.
 */

#include "uart.h"
#include <stdint.h>

/* Forward declaration -- board-specific clock/GPIO init */
extern void system_clock_init(void);
extern void uart_gpio_init(void);
extern void uart_clock_enable(void);

int main(void)
{
    /* 1. Initialize system clock to 84 MHz (board-specific) */
    system_clock_init();

    /* 2. Enable UART peripheral clock in RCC */
    uart_clock_enable();

    /* 3. Configure TX/RX pins as alternate function */
    uart_gpio_init();

    /* 4. Initialize the UART driver */
    uart_init();

    /* Transmit a greeting */
    const uint8_t msg[] = "UART ready\r\n";
    uart_send(msg, sizeof(msg) - 1U);

    /* Main loop: echo received bytes */
    for (;;) {
        uint8_t byte;
        if (uart_read_byte(&byte)) {
            uart_send_byte(byte);
        }

        /* Other application work here.
         * In a real system you would use WFI to sleep
         * until the next interrupt, reducing power consumption:
         *   __asm volatile ("wfi");
         */
    }

    /* Never reached */
    return 0;
}
```

## Design Decisions and Rationale

### Static allocation only

All buffers (`rx_buf`) and indices (`rx_head`, `rx_tail`) are file-scope `static`. There is no `malloc`, no `free`, and no heap involvement whatsoever. The memory footprint is known at link time and will not change at runtime. This follows MISRA C 2012 Rule 21.3.

### Volatile correctness

- The `UART_TypeDef` struct uses `volatile uint32_t` (via `reg32_t`) for every register field. This ensures the compiler re-reads hardware on every access and never optimizes away a status register poll.
- `rx_head` and `rx_tail` are `volatile` because they are shared between the ISR and main context. Without `volatile`, the compiler could hoist the read of `rx_head` outside a polling loop, causing the main context to never see new data.

### Power-of-2 ring buffer with masking

The buffer size is constrained to a power of 2 (256 bytes) and wrap-around is performed with `& UART_RX_BUF_MASK` instead of `% UART_RX_BUF_SIZE`. This compiles to a single AND instruction instead of a division, which is both faster and fully deterministic in timing. The compile-time `#if` check prevents accidental misconfiguration.

### Lock-free SPSC (Single-Producer, Single-Consumer)

The ring buffer uses the single-producer single-consumer pattern:
- The ISR is the only writer to `rx_head`
- The main context is the only writer to `rx_tail`
- On Cortex-M (ARMv7-M), aligned 32-bit reads and writes are atomic, so no critical section is needed for individual index accesses

The only place a critical section is used is `uart_rx_count()`, where both indices must be read consistently as a pair.

### Minimal ISR

The ISR does exactly three things: read the status register, read the data register, and store one byte. No allocation, no function calls to non-reentrant code, no blocking. If the buffer is full, the byte is silently discarded -- a deliberate choice to keep the ISR short and deterministic. A production variant could set a `volatile bool overflow_flag` for the application to check.

### Baud rate computed at compile time

The BRR value is computed entirely by the preprocessor from `PCLK_HZ` and `TARGET_BAUD`. Changing either constant automatically recalculates the correct register value. The fractional part is rounded to the nearest 1/16th for minimum baud rate error.

### Error flag clearing

Reading `SR` followed by `DR` is the standard sequence to clear error flags (ORE, FE, NF, PE) on STM32-family UART peripherals. The ISR reads both registers, which handles the common case. An explicit ORE handler reads DR a second time if the overrun flag is set, ensuring it gets cleared even if RXNE was not the interrupt source.

## Porting Notes

To port this driver to a different board or MCU variant:

1. **Base address**: Change `UART_BASE` to match the target UART peripheral
2. **IRQ number**: Change `UART_IRQn` to the correct vector table index
3. **Handler name**: Rename `UART_IRQHandler` to match the vector table symbol (e.g., `USART2_IRQHandler`)
4. **Clock**: Update `PCLK_HZ` to match the actual peripheral clock frequency
5. **Prerequisites**: Ensure RCC clock enable and GPIO alternate function setup are done before calling `uart_init()`
6. **Register layout**: Verify register offsets match the target MCU's reference manual; some families have a different register map (e.g., STM32F0/L0 use ISR/TDR/RDR instead of SR/DR)
