# HardFault Debugging: STM32F4 CAN Message Parser

## 1. Fault Register Decode

### CFSR = 0x00008200

The CFSR is a 32-bit composite of three sub-registers:

```
CFSR = 0x00008200
        ^^^^       UFSR [31:16] = 0x0000 -> no usage faults
            ^^     BFSR [15:8]  = 0x82   -> BFARVALID (bit 15) + PRECISERR (bit 9)
              ^^   MMFSR [7:0]  = 0x00   -> no MemManage faults
```

**BFSR breakdown:**
- **Bit 15 (BFARVALID) = 1**: The BFAR register contains the valid address that caused the fault.
- **Bit 9 (PRECISERR) = 1**: A precise data bus error occurred. The faulting instruction is the one pointed to by the stacked PC.

### HFSR = 0x40000000

- **Bit 30 (FORCED) = 1**: The HardFault was caused by a configurable fault (BusFault in this case) that was escalated because the BusFault handler is not enabled or the fault occurred within an exception handler.

**Action:** If you have not enabled the BusFault handler separately, the BusFault escalates to HardFault. Enable it to get more granular fault information:

```c
SCB->SHCSR |= SCB_SHCSR_BUSFAULTENA_Msk;
```

### MMFAR = 0x00000010

This is the MemManage Fault Address Register. Since MMFSR shows no MemManage fault (all bits zero), this value is **not valid** for the current fault. Ignore it.

### BFAR = 0x00000000

**This is the critical clue.** BFAR = 0x00000000 with BFARVALID set means the CPU attempted a data access at address **0x00000000** -- a classic **null pointer dereference**.

However, MMFAR = 0x00000010 is also interesting. Combined with BFAR = 0x00000000, this suggests the code is dereferencing a null pointer and accessing an offset from it (0x00000010 = offset 16 bytes from NULL). This is the pattern you see when accessing a struct member through a null pointer:

```c
// If ptr == NULL, accessing ptr->field_at_offset_16 reads address 0x10
some_struct_t *ptr = NULL;
ptr->field_at_offset_16;  // Accesses 0x00000010
```

Wait -- re-reading the registers: BFAR = 0x00000000 is the BFAR value, but BFARVALID is set. On STM32F4, the address 0x00000000 itself is typically mapped to flash (or aliased depending on BOOT pins), so a read from 0x00000000 would not normally fault. Let me reconsider.

Actually, the key is that MMFAR = 0x00000010. Even though MMFSR bits are zero, the combination of **PRECISERR + BFARVALID + BFAR=0x00000000** tells us the bus fault address is 0x00000000. But the stacked PC points to `memcpy` -- and `memcpy` at address 0x00000010 is the source or destination pointer being NULL + 0x10 offset, or a pointer value of 0x00000010 which is in the reserved/system region.

**Most likely scenario:** The `memcpy` inside your CAN parser is reading from or writing to a pointer that is either NULL or a very small invalid address (0x00000010). The address 0x00000010 is in the vendor-specific/reserved region on Cortex-M, which can trigger a bus fault on STM32F4.

## 2. Root Cause Analysis

Given that:
- The fault is in `memcpy` inside a CAN message parser
- The faulting address is near-zero (null pointer region)
- The fault is **intermittent** (2 to 30 minutes)

The most probable causes, ranked by likelihood:

### Cause A: Race condition on the CAN RX buffer pointer (MOST LIKELY)

The intermittent timing (2-30 minutes) is the signature of a **data race**. Your CAN RX ISR and the parser task are likely sharing a pointer or buffer without proper synchronization.

Typical buggy pattern:

```c
// GLOBAL shared state -- DATA RACE
volatile CAN_Message_t *current_msg = NULL;

// CAN RX ISR
void CAN1_RX0_IRQHandler(void) {
    static CAN_Message_t rx_buf;
    HAL_CAN_GetRxMessage(&hcan1, CAN_RX_FIFO0, &rx_header, rx_buf.data);
    current_msg = &rx_buf;  // (1) Pointer set
}

// Parser task
void can_parser_task(void) {
    if (current_msg != NULL) {
        CAN_Message_t local;
        memcpy(&local, current_msg, sizeof(local));  // (2) FAULT HERE
        current_msg = NULL;
        parse_message(&local);
    }
}
```

**The race:** Between step (1) and step (2), if the ISR fires again and `rx_buf` is being reused or if the pointer is momentarily set to NULL by another code path, `memcpy` reads from an invalid address. On a lightly-loaded CAN bus, this race window is hit rarely -- explaining the 2-30 minute range.

**Even worse:** If `current_msg` is a multi-byte pointer being written non-atomically (unlikely on 32-bit Cortex-M for a 32-bit pointer, but possible for a struct containing a pointer + length), you could get a torn read where the pointer is partially updated.

### Cause B: Use-after-free from a message pool

If you are using a pool or queue for CAN messages:

```c
CAN_Message_t *msg = pool_alloc();
// ... fill msg from CAN RX ...
queue_send(msg);

// Consumer:
CAN_Message_t *msg = queue_receive();
memcpy(&local, msg->payload, msg->len);  // If msg was already returned to pool
pool_free(msg);
```

If the pool object is freed before the `memcpy` completes, or if the pool reuses the memory and overwrites the pointer field with zero, you get a null-pointer dereference inside `memcpy`.

### Cause C: Stack overflow in the parser task

If the CAN parser task has a tight stack and `memcpy` pushes it over the edge, the stack pointer wraps into invalid memory. This would manifest as a bus fault at a near-zero address if the stack descends past the bottom of RAM.

## 3. Debugging Steps

### Step 1: Capture the full exception frame

Add this HardFault handler to extract the stacked registers:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "TST LR, #4       \n"  /* Test bit 2 of EXC_RETURN */
        "ITE EQ            \n"
        "MRSEQ R0, MSP     \n"  /* Main Stack Pointer */
        "MRSNE R0, PSP     \n"  /* Process Stack Pointer (if using RTOS) */
        "B HardFault_Handler_C \n"
    );
}

void HardFault_Handler_C(uint32_t *stack_frame) {
    volatile uint32_t r0   = stack_frame[0];
    volatile uint32_t r1   = stack_frame[1];
    volatile uint32_t r2   = stack_frame[2];
    volatile uint32_t r3   = stack_frame[3];
    volatile uint32_t r12  = stack_frame[4];
    volatile uint32_t lr   = stack_frame[5];
    volatile uint32_t pc   = stack_frame[6];  /* Faulting instruction */
    volatile uint32_t xpsr = stack_frame[7];

    volatile uint32_t cfsr  = SCB->CFSR;
    volatile uint32_t hfsr  = SCB->HFSR;
    volatile uint32_t mmfar = SCB->MMFAR;
    volatile uint32_t bfar  = SCB->BFAR;

    /* Log these to a persistent location (backup SRAM, EEPROM, or ITM) */
    /* r0-r3 are the first four arguments to memcpy: dest, src, len */
    /* Check which of r0 or r1 is 0x00000000 or 0x00000010 */

    __BKPT(0);  /* Halt here if debugger attached */
    for (;;);
}
```

**What to look for:** When the fault triggers, inspect `r0`, `r1`, and `r2` (the arguments to `memcpy`):
- `r0` = destination pointer
- `r1` = source pointer
- `r2` = byte count

One of `r0` or `r1` will be NULL or near-zero. That tells you whether it is the source or destination that is invalid.

### Step 2: Check for the data race

Audit every access to the CAN message buffer/pointer shared between the CAN RX ISR and the parser:

```bash
# Search for shared CAN-related variables
grep -rn "volatile.*CAN\|CAN.*volatile\|can_rx\|can_msg\|rx_msg\|rx_buf" src/ --include="*.c" --include="*.h"
```

For every shared variable, verify:
- Single-word pointers/flags: use `std::atomic` or C11 `_Atomic`
- Multi-field structs: use a critical section (`__disable_irq()` / `__enable_irq()`) or an SPSC ring buffer

### Step 3: Fix with an SPSC ring buffer

Replace the shared pointer with a proper lock-free queue:

```c
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define CAN_QUEUE_SIZE  16  /* Must be power of 2 */
#define CAN_QUEUE_MASK  (CAN_QUEUE_SIZE - 1)

typedef struct {
    uint32_t id;
    uint8_t  data[8];
    uint8_t  dlc;
} CanMessage;

typedef struct {
    CanMessage buf[CAN_QUEUE_SIZE];
    volatile uint32_t head;  /* Written by ISR only */
    volatile uint32_t tail;  /* Written by task only */
} CanQueue;

static CanQueue can_rx_queue = {0};

/* Called from CAN RX ISR -- non-blocking, no allocation */
bool can_queue_push(CanQueue *q, const CanMessage *msg) {
    uint32_t head = q->head;
    uint32_t next = (head + 1) & CAN_QUEUE_MASK;
    if (next == q->tail) return false;  /* Full -- drop message */

    q->buf[head] = *msg;               /* Copy into slot */
    __DMB();                            /* Ensure data is written before head advances */
    q->head = next;
    return true;
}

/* Called from parser task -- non-blocking */
bool can_queue_pop(CanQueue *q, CanMessage *out) {
    uint32_t tail = q->tail;
    if (tail == q->head) return false;  /* Empty */

    *out = q->buf[tail];               /* Copy out of slot */
    __DMB();                            /* Ensure data is read before tail advances */
    q->tail = (tail + 1) & CAN_QUEUE_MASK;
    return true;
}

/* CAN RX ISR */
void CAN1_RX0_IRQHandler(void) {
    CAN_RxHeaderTypeDef header;
    CanMessage msg;

    if (HAL_CAN_GetRxMessage(&hcan1, CAN_RX_FIFO0, &header, msg.data) == HAL_OK) {
        msg.id = header.StdId;
        msg.dlc = header.DLC;
        can_queue_push(&can_rx_queue, &msg);
    }

    /* Clear interrupt -- HAL does this internally if using HAL callback */
}

/* Parser task */
void can_parser_task(void *param) {
    CanMessage msg;
    for (;;) {
        while (can_queue_pop(&can_rx_queue, &msg)) {
            /* Safe: msg is a local copy, no shared state */
            parse_can_message(&msg);
        }
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}
```

### Step 4: Verify the parser itself

Even after fixing the race, audit the `memcpy` call inside `parse_can_message()`:

```c
/* BEFORE (buggy): no bounds check on DLC */
void parse_can_message(const CanMessage *msg) {
    uint8_t payload[8];
    memcpy(payload, msg->data, msg->dlc);  /* If dlc > 8 => buffer overflow */
}

/* AFTER (safe): clamp DLC to maximum CAN frame size */
void parse_can_message(const CanMessage *msg) {
    uint8_t payload[8];
    uint8_t safe_dlc = (msg->dlc <= 8u) ? msg->dlc : 8u;
    memcpy(payload, msg->data, safe_dlc);
}
```

CAN DLC should be 0-8 for classic CAN, but a corrupted message or a race condition could produce a DLC value > 8 or even 255, causing `memcpy` to read far past the buffer into unmapped memory.

### Step 5: Check stack usage of the parser task

```c
/* Add to a diagnostic task or periodic timer callback */
void check_stacks(void) {
    UBaseType_t hwm = uxTaskGetStackHighWaterMark(can_parser_task_handle);
    if (hwm < 64) {
        /* Dangerously low -- increase stack size */
        log_warning("CAN parser stack HWM: %u words", hwm);
    }
}
```

Compile with `-fstack-usage` and check the `.su` files for the parser call chain:

```bash
grep -r "parse_can\|memcpy" build/ --include="*.su" | sort -t' ' -k3 -rn
```

## 4. Summary: Most Likely Diagnosis

| Evidence | Points to |
|---|---|
| CFSR = 0x00008200 (PRECISERR + BFARVALID) | Precise bus fault with valid faulting address |
| BFAR = 0x00000000 | Null pointer dereference |
| HFSR = 0x40000000 (FORCED) | BusFault escalated to HardFault (enable BusFault handler separately) |
| Intermittent (2-30 min) | Data race -- timing-dependent, not a logic error |
| PC in memcpy, CAN parser | Source or destination pointer to memcpy is NULL |
| MMFAR = 0x00000010 | Likely a struct member access at offset 16 through a null pointer |

**Primary diagnosis:** A data race between the CAN RX ISR and the parser task causes the parser to occasionally read a NULL pointer (or a pointer that has been zeroed), which it then passes to `memcpy`. The `memcpy` accesses address 0x00000010 (null + struct offset 16), triggering a precise bus fault.

**Fix priority:**
1. Replace shared CAN buffer pointer with an SPSC ring buffer (eliminates the race)
2. Add DLC bounds checking before every `memcpy` in the parser (defense in depth)
3. Enable the BusFault handler for better diagnostics on future faults
4. Add stack high-water-mark monitoring for the parser task
5. Run the parser logic on a host PC with AddressSanitizer to catch any remaining memory bugs
