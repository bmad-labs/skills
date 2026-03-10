# Bare-Metal UART Driver for ARM Cortex-M4 (C99)

Below is a complete bare-metal UART driver targeting a Cortex-M4 MCU with the UART peripheral at base address `0x40004400`. It implements:

- **Init:** 115200 baud, 8N1, PCLK = 84 MHz
- **Blocking send byte**
- **Interrupt-driven receive** into a ring buffer

The code follows embedded best practices: all buffers are statically allocated, the ring buffer uses a power-of-2 size with bitmask indexing, all hardware registers are accessed through `volatile` structs, and the ISR is kept minimal (write to buffer, nothing else).

---

## uart_driver.h

```c
#ifndef UART_DRIVER_H_
#define UART_DRIVER_H_

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize UART at 115200 baud, 8N1.
 * Enables RX interrupt (RXNE). Caller must ensure the UART IRQ
 * is enabled in the NVIC before calling this function.
 */
void uart_init(void);

/**
 * Send a single byte (blocking).
 * Polls the TXE flag until the transmit data register is empty,
 * then writes the byte.
 */
void uart_send_byte(uint8_t byte);

/**
 * Send a buffer of bytes (blocking, convenience wrapper).
 */
void uart_send(const uint8_t *buf, size_t len);

/**
 * Read a byte from the receive ring buffer.
 * Returns true if a byte was available (written to *out_byte),
 * false if the buffer is empty.
 */
bool uart_read_byte(uint8_t *out_byte);

/**
 * Returns the number of bytes available in the receive buffer.
 */
size_t uart_rx_available(void);

/**
 * UART RX interrupt handler.
 * Must be called from the appropriate IRQHandler in the vector table
 * (e.g., USART2_IRQHandler or whichever vector maps to this peripheral).
 */
void uart_irq_handler(void);

#ifdef __cplusplus
}
#endif

#endif /* UART_DRIVER_H_ */
```

---

## uart_driver.c

```c
#include "uart_driver.h"

/* ------------------------------------------------------------------ */
/*  Hardware register definitions                                      */
/* ------------------------------------------------------------------ */

/** Register type: volatile 32-bit for memory-mapped I/O. */
typedef volatile uint32_t reg32_t;

/**
 * UART register layout.
 *
 * This struct maps to the UART peripheral registers at their
 * hardware offsets. Every field is volatile so the compiler
 * re-reads/writes actual hardware on each access.
 *
 * Offsets are typical for STM32-style USART peripherals:
 *   SR  @ 0x00   Status register
 *   DR  @ 0x04   Data register
 *   BRR @ 0x08   Baud rate register
 *   CR1 @ 0x0C   Control register 1
 *   CR2 @ 0x10   Control register 2
 *   CR3 @ 0x14   Control register 3
 */
typedef struct {
    reg32_t SR;     /* 0x00: Status register      */
    reg32_t DR;     /* 0x04: Data register         */
    reg32_t BRR;    /* 0x08: Baud rate register    */
    reg32_t CR1;    /* 0x0C: Control register 1    */
    reg32_t CR2;    /* 0x10: Control register 2    */
    reg32_t CR3;    /* 0x14: Control register 3    */
} UART_Regs;

/** Base address of the UART peripheral (provided by the board). */
#define UART_BASE   (0x40004400U)
#define UART        ((UART_Regs *)UART_BASE)

/* ---- Status register (SR) bit definitions ---- */
#define UART_SR_TXE     (1U << 7)   /* Transmit data register empty  */
#define UART_SR_TC      (1U << 6)   /* Transmission complete          */
#define UART_SR_RXNE    (1U << 5)   /* Receive data register not empty */
#define UART_SR_ORE     (1U << 3)   /* Overrun error                   */

/* ---- Control register 1 (CR1) bit definitions ---- */
#define UART_CR1_UE     (1U << 13)  /* UART enable                     */
#define UART_CR1_M      (1U << 12)  /* Word length: 0 = 8 bits         */
#define UART_CR1_PCE    (1U << 10)  /* Parity control enable           */
#define UART_CR1_TE     (1U << 3)   /* Transmitter enable              */
#define UART_CR1_RE     (1U << 2)   /* Receiver enable                 */
#define UART_CR1_RXNEIE (1U << 5)   /* RXNE interrupt enable           */

/* ---- Control register 2 (CR2) bit definitions ---- */
#define UART_CR2_STOP_MASK (3U << 12)
#define UART_CR2_STOP_1    (0U << 12)  /* 1 stop bit */

/* ------------------------------------------------------------------ */
/*  Baud rate calculation                                              */
/* ------------------------------------------------------------------ */

/**
 * PCLK frequency in Hz. This must match the actual peripheral clock
 * feeding this UART. On many STM32F4 devices USART2 sits on APB1
 * at 42 MHz, but the task specifies 84 MHz.
 */
#define PCLK_HZ         (84000000U)

/**
 * Target baud rate.
 */
#define TARGET_BAUD      (115200U)

/**
 * BRR divisor for 16x oversampling:
 *   USARTDIV = PCLK / (16 * baud)
 *
 * For 84 MHz / (16 * 115200) = 45.572916...
 *   Mantissa = 45  (integer part)
 *   Fraction = 0.572916... * 16 = 9.166... -> round to 9
 *
 * BRR register format (16x oversampling):
 *   [15:4] = mantissa
 *   [3:0]  = fraction (in 1/16ths)
 *
 * We compute this at compile time so there is zero runtime cost.
 */
#define UART_DIV_MANTISSA  (PCLK_HZ / (16U * TARGET_BAUD))
#define UART_DIV_FRACTION  ((((PCLK_HZ % (16U * TARGET_BAUD)) * 16U) + \
                             (8U * TARGET_BAUD)) / (16U * TARGET_BAUD))

/* BRR value: mantissa in bits [15:4], fraction in bits [3:0] */
#define UART_BRR_VALUE     ((UART_DIV_MANTISSA << 4U) | (UART_DIV_FRACTION & 0x0FU))

/* ------------------------------------------------------------------ */
/*  Receive ring buffer                                                */
/* ------------------------------------------------------------------ */

/**
 * Buffer size MUST be a power of 2 so we can use bitmask instead of
 * modulo for index wrapping. This gives O(1) wrap with a single AND.
 */
#define UART_RX_BUF_SIZE  256U

#if (UART_RX_BUF_SIZE & (UART_RX_BUF_SIZE - 1U)) != 0U
    #error "UART_RX_BUF_SIZE must be a power of 2"
#endif

#define UART_RX_BUF_MASK  (UART_RX_BUF_SIZE - 1U)

/** Receive ring buffer — statically allocated, no heap. */
static volatile uint8_t  rx_buf[UART_RX_BUF_SIZE];

/**
 * Head and tail indices.
 *   head: written by ISR  (producer)
 *   tail: read    by task (consumer)
 *
 * Both are volatile because they are shared between ISR and
 * main-line code. On Cortex-M4 a single 32-bit load/store is
 * atomic, so no critical section is needed for SPSC access.
 */
static volatile uint32_t rx_head;  /* Next write position (ISR)  */
static volatile uint32_t rx_tail;  /* Next read  position (task) */

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

void uart_init(void)
{
    /* 1. Disable UART while configuring */
    UART->CR1 = 0U;
    UART->CR2 = 0U;
    UART->CR3 = 0U;

    /* 2. Set baud rate (computed at compile time) */
    UART->BRR = UART_BRR_VALUE;

    /* 3. Configure frame format: 8 data bits, no parity, 1 stop bit */
    /*    CR1.M = 0   -> 8 data bits                                  */
    /*    CR1.PCE = 0 -> no parity                                    */
    /*    CR2.STOP = 00 -> 1 stop bit                                 */
    UART->CR2 &= ~UART_CR2_STOP_MASK;
    UART->CR2 |= UART_CR2_STOP_1;

    /* 4. Clear any pending status flags by reading SR then DR */
    (void)UART->SR;
    (void)UART->DR;

    /* 5. Initialize ring buffer indices */
    rx_head = 0U;
    rx_tail = 0U;

    /* 6. Enable UART: transmitter, receiver, RXNE interrupt, UE */
    UART->CR1 = UART_CR1_TE
              | UART_CR1_RE
              | UART_CR1_RXNEIE
              | UART_CR1_UE;

    /*
     * NOTE: The caller must also enable the corresponding NVIC IRQ:
     *
     *   NVIC_SetPriority(UARTx_IRQn, priority);
     *   NVIC_EnableIRQ(UARTx_IRQn);
     *
     * The exact IRQ number depends on the MCU and which USART
     * instance is at 0x40004400 (often USART2 on STM32F4).
     */
}

void uart_send_byte(uint8_t byte)
{
    /* Wait until the transmit data register is empty */
    while ((UART->SR & UART_SR_TXE) == 0U) {
        /* Busy-wait. Each iteration re-reads SR from hardware
         * because SR is volatile. */
    }
    UART->DR = byte;
}

void uart_send(const uint8_t *buf, size_t len)
{
    if (buf == NULL) {
        return;
    }
    for (size_t i = 0U; i < len; i++) {
        uart_send_byte(buf[i]);
    }
    /* Wait for the last byte to fully shift out */
    while ((UART->SR & UART_SR_TC) == 0U) {
        /* Busy-wait for transmission complete */
    }
}

bool uart_read_byte(uint8_t *out_byte)
{
    if (out_byte == NULL) {
        return false;
    }

    /* Snapshot tail (only we modify it) and head (ISR modifies it) */
    uint32_t tail = rx_tail;
    uint32_t head = rx_head;

    if (tail == head) {
        return false;   /* Buffer empty */
    }

    *out_byte = rx_buf[tail & UART_RX_BUF_MASK];
    rx_tail   = tail + 1U;
    return true;
}

size_t uart_rx_available(void)
{
    uint32_t head = rx_head;
    uint32_t tail = rx_tail;
    return (head - tail) & UART_RX_BUF_MASK;
}

/* ------------------------------------------------------------------ */
/*  Interrupt handler                                                  */
/* ------------------------------------------------------------------ */

void uart_irq_handler(void)
{
    uint32_t sr = UART->SR;

    if (sr & UART_SR_RXNE) {
        /* Read DR to clear the RXNE flag and get the received byte */
        uint8_t byte = (uint8_t)(UART->DR & 0xFFU);

        uint32_t head = rx_head;
        uint32_t next = head + 1U;

        /* Check for buffer full (would overwrite unread data) */
        if ((next & UART_RX_BUF_MASK) != (rx_tail & UART_RX_BUF_MASK)) {
            rx_buf[head & UART_RX_BUF_MASK] = byte;
            rx_head = next;
        }
        /* If buffer is full, the byte is silently dropped.
         * In production you may want to set an overflow flag here. */
    }

    if (sr & UART_SR_ORE) {
        /* Overrun error: clear by reading SR then DR (already done above).
         * The hardware has already lost the byte. Log or count if needed. */
        (void)UART->DR;
    }
}
```

---

## Integration Notes

### 1. Vector Table Hookup

The `uart_irq_handler()` function must be called from the correct vector table entry. In most STM32 startup files, you would either:

- **Name the function directly** to match the vector table symbol (e.g., rename to `USART2_IRQHandler`), or
- **Call it from the existing handler:**

```c
void USART2_IRQHandler(void)
{
    uart_irq_handler();
}
```

Verify the handler name against the startup `.s` file vector table. A misspelled ISR name silently falls through to `Default_Handler` and the system hangs.

### 2. NVIC Configuration

Before calling `uart_init()`, enable the clock for the UART peripheral and configure the NVIC:

```c
/* Enable USART2 clock (example for STM32F4, APB1) */
RCC->APB1ENR |= RCC_APB1ENR_USART2EN;

/* Enable GPIO clock and configure TX/RX pins to AF mode */
/* ... (board-specific GPIO setup) ... */

/* Initialize the UART driver */
uart_init();

/* Enable the interrupt in the NVIC */
NVIC_SetPriority(USART2_IRQn, 5);
NVIC_EnableIRQ(USART2_IRQn);
```

### 3. Baud Rate Verification

With PCLK = 84 MHz and 16x oversampling:

```
USARTDIV = 84000000 / (16 * 115200) = 45.572916...
Mantissa = 45 = 0x2D
Fraction = round(0.572916 * 16) = round(9.166) = 9 = 0x9
BRR = (45 << 4) | 9 = 0x02D9

Actual baud = 84000000 / (16 * 45.5625) = 115207.37 Hz
Error = +0.006% (well within UART tolerance of +/- 2%)
```

### 4. Ring Buffer Design Rationale

| Decision | Rationale |
|----------|-----------|
| Power-of-2 size (256) | Enables bitmask wrapping (`& 0xFF`) instead of modulo -- cheaper on Cortex-M |
| `volatile` head/tail | Shared between ISR (producer) and task (consumer); `volatile` ensures each access reads from memory |
| No critical section | SPSC (single-producer single-consumer) with 32-bit indices on Cortex-M4 gives atomic loads/stores; no lock needed |
| Static allocation | No heap -- buffer lives in `.bss`, zero-initialized before `main()` |
| Silent drop on full | ISR must not block; dropping is the only safe option. Add an overflow counter for diagnostics |

### 5. Usage Example

```c
int main(void)
{
    system_clock_init();   /* Configure clocks: PCLK = 84 MHz */
    gpio_uart_init();      /* Configure TX/RX pins for AF      */
    uart_init();
    NVIC_SetPriority(USART2_IRQn, 5);
    NVIC_EnableIRQ(USART2_IRQn);

    /* Transmit a greeting */
    const char *msg = "UART ready\r\n";
    uart_send((const uint8_t *)msg, 12);

    /* Main loop: echo received bytes */
    for (;;) {
        uint8_t byte;
        if (uart_read_byte(&byte)) {
            uart_send_byte(byte);
        }
    }
}
```

### 6. Compiler Flags

```
arm-none-eabi-gcc -std=c99 -mcpu=cortex-m4 -mthumb -mfloat-abi=hard -mfpu=fpv4-sp-d16 \
    -Wall -Wextra -Werror -Wuninitialized \
    -ffunction-sections -fdata-sections -fstack-usage \
    -Os -DNDEBUG \
    -Wl,--gc-sections \
    -o firmware.elf main.c uart_driver.c
```

Key flags:
- `-std=c99`: strict C99 compliance
- `-fstack-usage`: generates `.su` files to audit stack depth per function
- `-ffunction-sections -fdata-sections` + `-Wl,--gc-sections`: dead-code elimination
- `-Wuninitialized`: catch uninitialized local variables
