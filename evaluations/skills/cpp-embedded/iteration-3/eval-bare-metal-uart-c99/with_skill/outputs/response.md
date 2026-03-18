# Bare-Metal UART Driver for ARM Cortex-M4 (C99, No HAL)

## Overview

This driver targets a UART peripheral at base address `0x40004400` on an ARM Cortex-M4 MCU with a 84 MHz peripheral clock. It implements:

- **Initialization** at 115200 baud, 8 data bits, no parity, 1 stop bit (8N1)
- **Blocking transmit** (single byte)
- **Interrupt-driven receive** into a power-of-2 ring buffer

The code is pure C99, uses no vendor HAL, and follows embedded best practices: all memory is statically allocated, `volatile` is used correctly for hardware registers and ISR-shared data, and the ring buffer uses bitmask indexing with a compile-time power-of-2 assertion.

---

## Register Map

The register struct matches a typical STM32-style UART peripheral layout. Every field is `volatile` because the hardware can modify these registers independently of the CPU -- without `volatile`, the compiler may cache a status register read in a CPU register and never re-read the hardware, causing infinite loops or missed events.

```c
/* uart.h */
#ifndef UART_H_
#define UART_H_

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/*==========================================================================
 * Register definitions
 *========================================================================*/

typedef volatile uint32_t reg32_t;

typedef struct {
    reg32_t SR;     /* 0x00: Status register          */
    reg32_t DR;     /* 0x04: Data register             */
    reg32_t BRR;    /* 0x08: Baud rate register         */
    reg32_t CR1;    /* 0x0C: Control register 1         */
    reg32_t CR2;    /* 0x10: Control register 2         */
    reg32_t CR3;    /* 0x14: Control register 3         */
} UART_TypeDef;

/* Peripheral base address */
#define UART1_BASE  (0x40004400U)
#define UART1       ((UART_TypeDef *)UART1_BASE)

/*==========================================================================
 * Status Register (SR) bit definitions
 *========================================================================*/
#define UART_SR_PE    (1U << 0)   /* Parity error                        */
#define UART_SR_FE    (1U << 1)   /* Framing error                       */
#define UART_SR_NE    (1U << 2)   /* Noise error                         */
#define UART_SR_ORE   (1U << 3)   /* Overrun error                       */
#define UART_SR_IDLE  (1U << 4)   /* Idle line detected                  */
#define UART_SR_RXNE  (1U << 5)   /* Receive data register not empty     */
#define UART_SR_TC    (1U << 6)   /* Transmission complete               */
#define UART_SR_TXE   (1U << 7)   /* Transmit data register empty        */

/*==========================================================================
 * Control Register 1 (CR1) bit definitions
 *========================================================================*/
#define UART_CR1_SBK     (1U << 0)   /* Send break                      */
#define UART_CR1_RE      (1U << 2)   /* Receiver enable                  */
#define UART_CR1_TE      (1U << 3)   /* Transmitter enable               */
#define UART_CR1_IDLEIE  (1U << 4)   /* IDLE interrupt enable            */
#define UART_CR1_RXNEIE  (1U << 5)   /* RXNE interrupt enable            */
#define UART_CR1_TCIE    (1U << 6)   /* Transmission complete IE         */
#define UART_CR1_TXEIE   (1U << 7)   /* TXE interrupt enable             */
#define UART_CR1_PEIE    (1U << 8)   /* Parity error interrupt enable    */
#define UART_CR1_PS      (1U << 9)   /* Parity selection (0=even,1=odd)  */
#define UART_CR1_PCE     (1U << 10)  /* Parity control enable            */
#define UART_CR1_M       (1U << 12)  /* Word length (0=8bit, 1=9bit)     */
#define UART_CR1_UE      (1U << 13)  /* UART enable                      */
#define UART_CR1_OVER8   (1U << 15)  /* Oversampling mode (0=16, 1=8)    */

/*==========================================================================
 * Control Register 2 (CR2) bit definitions
 *========================================================================*/
#define UART_CR2_STOP_1   (0U << 12)  /* 1 stop bit                     */
#define UART_CR2_STOP_2   (2U << 12)  /* 2 stop bits                    */

/*==========================================================================
 * Receive ring buffer configuration
 *========================================================================*/

/* Buffer size MUST be a power of 2 for bitmask indexing.
 * _Static_assert below catches misconfiguration at compile time. */
#define UART_RX_BUF_SIZE  256U

/*==========================================================================
 * Public API
 *========================================================================*/

void     uart_init(void);
void     uart_send_byte(uint8_t byte);
void     uart_send(const uint8_t *data, size_t len);
bool     uart_rx_available(void);
bool     uart_read_byte(uint8_t *out);
size_t   uart_read(uint8_t *buf, size_t max_len);

#endif /* UART_H_ */
```

---

## Implementation

```c
/* uart.c */
#include "uart.h"

/*==========================================================================
 * Compile-time validation
 *========================================================================*/

/* Validate buffer size is a power of 2 -- essential for bitmask indexing.
 * If someone changes UART_RX_BUF_SIZE to a non-power-of-2 value, this
 * fires at compile time instead of producing silent ring buffer bugs. */
_Static_assert(
    (UART_RX_BUF_SIZE & (UART_RX_BUF_SIZE - 1)) == 0,
    "UART_RX_BUF_SIZE must be a power of 2 for bitmask indexing"
);

_Static_assert(
    UART_RX_BUF_SIZE >= 16 && UART_RX_BUF_SIZE <= 4096,
    "UART_RX_BUF_SIZE out of practical range"
);

/*==========================================================================
 * Clock and baud rate configuration
 *========================================================================*/

#define PCLK_FREQ       84000000U   /* Peripheral clock: 84 MHz            */
#define TARGET_BAUD     115200U     /* Target baud rate                     */
#define OVERSAMPLING    16U         /* 16x oversampling (OVER8 = 0)         */

/* BRR value calculation for 16x oversampling:
 *   USARTDIV = PCLK / (16 * baud)
 *
 * For fractional baud rate register:
 *   Mantissa = integer part of USARTDIV
 *   Fraction = fractional part * 16 (rounded)
 *
 * 84000000 / (16 * 115200) = 45.572916...
 *   Mantissa = 45 = 0x2D
 *   Fraction = round(0.572916 * 16) = round(9.166) = 9 = 0x09
 *   BRR = (mantissa << 4) | fraction = (45 << 4) | 9 = 0x02D9
 *
 * Actual baud = 84000000 / (16 * 45.5625) = 115207.37 Hz
 * Error = (115207.37 - 115200) / 115200 = +0.006%, well within tolerance.
 */
#define UART_DIV_MANTISSA   (PCLK_FREQ / (OVERSAMPLING * TARGET_BAUD))
#define UART_DIV_REMAINDER  (PCLK_FREQ % (OVERSAMPLING * TARGET_BAUD))
#define UART_DIV_FRACTION   (((UART_DIV_REMAINDER * OVERSAMPLING) + \
                              (TARGET_BAUD / 2U)) / TARGET_BAUD)
#define UART_BRR_VALUE      ((UART_DIV_MANTISSA << 4) | (UART_DIV_FRACTION & 0x0FU))

/* Sanity check: mantissa must fit in 12 bits */
_Static_assert(UART_DIV_MANTISSA > 0 && UART_DIV_MANTISSA < 4096,
               "Baud rate mantissa out of range for BRR register");

/*==========================================================================
 * Receive ring buffer -- statically allocated, ISR-safe (SPSC)
 *
 * Producer: ISR (writes head)
 * Consumer: main/task context (reads tail)
 *
 * On a single-core Cortex-M4, volatile is sufficient for SPSC coordination
 * because:
 * - There is only one writer and one reader for each index
 * - The ISR preempts the main context atomically (no interleaving)
 * - 32-bit aligned loads/stores are atomic on Cortex-M4
 *========================================================================*/

#define RX_BUF_MASK  (UART_RX_BUF_SIZE - 1U)

static uint8_t  rx_buffer[UART_RX_BUF_SIZE];
static volatile uint32_t rx_head;  /* Written by ISR only                */
static volatile uint32_t rx_tail;  /* Written by consumer (task) only    */

/*==========================================================================
 * uart_init -- Configure UART for 115200 8N1 with RX interrupt
 *========================================================================*/
void uart_init(void)
{
    /* 1. Disable UART before configuration */
    UART1->CR1 = 0U;
    UART1->CR2 = 0U;
    UART1->CR3 = 0U;

    /* 2. Set baud rate
     * BRR contains mantissa (bits [15:4]) and fraction (bits [3:0])
     * for 16x oversampling mode. */
    UART1->BRR = UART_BRR_VALUE;

    /* 3. Configure frame format: 8 data bits, no parity, 1 stop bit
     *    - M bit = 0  -> 8 data bits
     *    - PCE   = 0  -> parity disabled
     *    - STOP  = 00 -> 1 stop bit (default in CR2) */
    UART1->CR2 = UART_CR2_STOP_1;

    /* 4. Initialize ring buffer indices */
    rx_head = 0U;
    rx_tail = 0U;

    /* 5. Enable UART with TX, RX, and RXNE interrupt
     *    - UE:     UART enable
     *    - TE:     Transmitter enable
     *    - RE:     Receiver enable
     *    - RXNEIE: Interrupt when receive data register is not empty */
    UART1->CR1 = UART_CR1_UE
               | UART_CR1_TE
               | UART_CR1_RE
               | UART_CR1_RXNEIE;

    /* NOTE: The caller must also:
     * - Enable the UART peripheral clock in the RCC register
     * - Configure the TX/RX GPIO pins for alternate function
     * - Enable the UART IRQ in the NVIC:
     *     NVIC_SetPriority(UARTx_IRQn, priority);
     *     NVIC_EnableIRQ(UARTx_IRQn);
     * These are board-specific and not part of this driver. */
}

/*==========================================================================
 * uart_send_byte -- Blocking transmit of a single byte
 *
 * Waits for the Transmit Data Register Empty (TXE) flag, then writes the
 * byte. TXE indicates the hardware has moved the previous byte from DR
 * to the shift register, so DR is free to accept new data.
 *========================================================================*/
void uart_send_byte(uint8_t byte)
{
    /* Spin until TXE is set -- each iteration re-reads SR from hardware
     * because SR is volatile. Without volatile, the compiler could hoist
     * the read out of the loop and spin forever. */
    while ((UART1->SR & UART_SR_TXE) == 0U) {
        /* Busy wait */
    }

    UART1->DR = (uint32_t)byte;
}

/*==========================================================================
 * uart_send -- Blocking transmit of a buffer
 *========================================================================*/
void uart_send(const uint8_t *data, size_t len)
{
    if (!data) return;

    for (size_t i = 0U; i < len; i++) {
        uart_send_byte(data[i]);
    }

    /* Optionally wait for the last byte to fully shift out.
     * TC (Transmission Complete) indicates the shift register is empty. */
    while ((UART1->SR & UART_SR_TC) == 0U) {
        /* Wait for final byte to leave the shift register */
    }
}

/*==========================================================================
 * UART RX Interrupt Handler
 *
 * This ISR is called when RXNE (Receive Data Register Not Empty) is set,
 * meaning the peripheral has received a complete byte.
 *
 * IMPORTANT: Reading DR has TWO effects (read-to-clear mechanism):
 *   1. Retrieves the received byte
 *   2. Clears the RXNE flag in SR (hardware auto-clear on DR read)
 *
 * If we only checked SR without reading DR, RXNE would stay asserted
 * and this ISR would fire endlessly (interrupt storm). This is a common
 * source of bugs for developers unfamiliar with UART hardware.
 *
 * The ISR name must match the vector table entry in the startup .s file.
 * A misspelled name silently falls through to Default_Handler, causing
 * the system to hang or reset with no obvious cause.
 *========================================================================*/
void UART1_IRQHandler(void)
{
    uint32_t sr = UART1->SR;

    if (sr & UART_SR_RXNE) {
        /* Reading DR clears RXNE -- this MUST happen to deassert the IRQ */
        uint8_t byte = (uint8_t)(UART1->DR & 0xFFU);

        /* Write to ring buffer if not full.
         * Only the ISR writes rx_head, so no race on the write side. */
        uint32_t next_head = (rx_head + 1U) & RX_BUF_MASK;
        if (next_head != rx_tail) {
            rx_buffer[rx_head] = byte;
            rx_head = next_head;
        }
        /* If buffer is full (next_head == rx_tail), the byte is silently
         * dropped. In production, you may want to set an overflow flag:
         *   static volatile bool rx_overflow = false;
         *   rx_overflow = true;
         * and check it from the task context. */
    }

    /* Handle overrun error: if ORE is set, the hardware received a byte
     * but the previous one was not yet read from DR. Clear by reading
     * SR then DR (which we already did above). If RXNE was not set but
     * ORE was, we still need to read DR to clear the error flag. */
    if ((sr & UART_SR_ORE) && !(sr & UART_SR_RXNE)) {
        (void)UART1->DR;  /* Dummy read to clear ORE */
    }
}

/*==========================================================================
 * uart_rx_available -- Check if received data is waiting
 *========================================================================*/
bool uart_rx_available(void)
{
    return (rx_head != rx_tail);
}

/*==========================================================================
 * uart_read_byte -- Non-blocking read of a single byte from the RX buffer
 *
 * Returns true if a byte was read, false if the buffer is empty.
 * Only the consumer (task context) modifies rx_tail, so no critical
 * section is needed.
 *========================================================================*/
bool uart_read_byte(uint8_t *out)
{
    if (!out) return false;

    if (rx_head == rx_tail) {
        return false;  /* Buffer empty */
    }

    *out = rx_buffer[rx_tail];
    rx_tail = (rx_tail + 1U) & RX_BUF_MASK;
    return true;
}

/*==========================================================================
 * uart_read -- Read up to max_len bytes from the RX buffer
 *
 * Returns the number of bytes actually read (0 if buffer was empty).
 *========================================================================*/
size_t uart_read(uint8_t *buf, size_t max_len)
{
    if (!buf || max_len == 0U) return 0U;

    size_t count = 0U;
    while (count < max_len && rx_head != rx_tail) {
        buf[count] = rx_buffer[rx_tail];
        rx_tail = (rx_tail + 1U) & RX_BUF_MASK;
        count++;
    }
    return count;
}
```

---

## Usage Example

```c
#include "uart.h"

int main(void)
{
    /* System init: clocks, GPIO, etc. (board-specific) */
    system_clock_init();

    /* Enable UART peripheral clock (board-specific, e.g.):
     *   RCC->APB1ENR |= RCC_APB1ENR_USART2EN;
     *
     * Configure GPIO pins for UART alternate function (board-specific, e.g.):
     *   GPIOA->MODER  |= (2U << (2 * 2)) | (2U << (3 * 2));  // AF mode
     *   GPIOA->AFR[0] |= (7U << (2 * 4)) | (7U << (3 * 4));  // AF7 = USART
     */

    uart_init();

    /* Enable the UART IRQ in NVIC */
    NVIC_SetPriority(UART1_IRQn, 3);
    NVIC_EnableIRQ(UART1_IRQn);

    /* Transmit a string */
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

---

## Design Decisions and Rationale

### Static Allocation Only

All memory (ring buffer, indices) is statically allocated. There is no `malloc` or dynamic allocation anywhere. This follows MISRA C Rule 21.3 and ensures deterministic behavior -- the driver uses exactly the same amount of RAM whether it has been running for 1 second or 1 year.

### Ring Buffer with Bitmask Indexing

The receive buffer size is constrained to a power of 2 (validated at compile time with `_Static_assert`). This allows using `& RX_BUF_MASK` instead of `% UART_RX_BUF_SIZE` for index wrapping. On Cortex-M4 without a hardware divider for modulo, the bitmask is a single AND instruction versus a multi-cycle division.

### Volatile Correctness

- **Hardware registers** are `volatile` (`reg32_t`) because the peripheral can change them independently of the CPU (e.g., SR flags set by received data).
- **`rx_head` and `rx_tail`** are `volatile` because they are shared between the ISR (producer writes `rx_head`) and the task context (consumer writes `rx_tail`). Without `volatile`, the compiler could cache `rx_head` in a register in the main loop and never see updates from the ISR.
- On single-core Cortex-M4, `volatile` is sufficient for SPSC ring buffer coordination because 32-bit aligned loads/stores are atomic and ISR preemption is not interleaved (the ISR runs to completion before the main context resumes).

### Read-to-Clear Mechanism

Reading the UART Data Register (DR) has a hardware side effect: it clears the RXNE flag in the Status Register (SR). This is not a software operation -- it is built into the peripheral's state machine. The ISR must always read DR when RXNE is set; otherwise RXNE remains asserted and the interrupt fires continuously (interrupt storm). This is documented in the ISR comments because it is a frequent source of bugs.

### Baud Rate Calculation

For 16x oversampling: `USARTDIV = PCLK / (16 * baud) = 84000000 / (16 * 115200) = 45.5729...`

The BRR register encodes this as a 12-bit mantissa (bits [15:4]) and 4-bit fraction (bits [3:0]):
- Mantissa = 45 (0x2D)
- Fraction = round(0.5729 * 16) = 9 (0x09)
- BRR = 0x02D9

Actual baud rate = 84000000 / (16 * 45.5625) = 115207 Hz, an error of +0.006% which is well within the UART tolerance of +/-2%.

### Error Handling

- **Buffer full:** Incoming bytes are silently dropped when the ring buffer is full. A production driver could set a `volatile bool rx_overflow` flag for the task to check.
- **Overrun error (ORE):** The ISR handles the ORE flag by performing a dummy read of DR to clear it, preventing the error flag from blocking subsequent reception.
- **NULL pointer checks:** `uart_send()` and `uart_read_byte()` check for NULL input pointers.

### ISR Safety

The ISR follows all embedded ISR rules:
- No allocation
- No blocking calls
- No non-reentrant function calls (no `printf`, no `malloc`)
- Minimal work: read one byte, write to ring buffer, exit
- The ring buffer push is O(1) with no loops
