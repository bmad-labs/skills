# HardFault Diagnosis: STM32F4 CAN Message Parser

## 1. Fault Register Decode

Starting from your captured registers:

```
CFSR  = 0x00008200
HFSR  = 0x40000000
MMFAR = 0x00000010
BFAR  = 0x00000000
```

### Step-by-step CFSR decode

The CFSR is a 32-bit composite of three sub-registers:

```
CFSR = 0x00008200

UFSR = (CFSR >> 16) & 0xFFFF = 0x0000  --> no UsageFault bits set
BFSR = (CFSR >> 8)  & 0xFF   = 0x82    --> BusFault bits set
MMFSR = CFSR & 0xFF          = 0x00    --> no MemManage bits set
```

### BFSR = 0x82 (binary: 1000_0010)

| Bit | Name       | Value | Meaning |
|-----|------------|-------|---------|
| 7   | BFARVALID  | 1     | BFAR register holds the valid faulting address |
| 1   | PRECISERR  | 1     | Precise data bus error -- the stacked PC points to the exact faulting instruction |

### HFSR = 0x40000000

| Bit | Name    | Value | Meaning |
|-----|---------|-------|---------|
| 30  | FORCED  | 1     | The HardFault was caused by escalation of a configurable fault (BusFault in this case) |

This means a BusFault occurred but BusFault was not enabled in SCB->SHCSR, so it escalated to HardFault. This is the normal behavior on most STM32F4 projects that do not explicitly enable BusFault as a separate exception.

### Fault Address Registers

- **BFAR = 0x00000000** -- BFARVALID is set, so this is the valid faulting address. The code tried to read from or write to address **0x00000000**, which is a **null pointer dereference**.
- **MMFAR = 0x00000010** -- MMFSR is 0x00, meaning MMARVALID is NOT set. This value is **stale from a previous fault and must be completely ignored**. It has no diagnostic value whatsoever.

## 2. Diagnosis: Null Pointer Dereference in memcpy

**The fault is a precise BusFault caused by accessing address 0x00000000 -- a null pointer dereference.**

The stacked PC points to a `memcpy` inside your CAN message parser. The `memcpy` itself is not broken; it was given a null (or near-null) source or destination pointer. Since the fault address is exactly 0x00000000, one of the pointer arguments to `memcpy` is NULL.

The intermittent nature (sometimes 2 minutes, sometimes 30 minutes) strongly suggests a **race condition** rather than a straightforward logic bug. If it were a simple logic error, it would fault every time the same CAN message type is processed.

## 3. Root Cause Analysis: Why Is the Pointer Null?

Given this is a CAN message parser with random timing, the most likely causes in order of probability:

### Cause A: Race condition on a shared buffer pointer (most likely)

The CAN RX ISR and the parser task share a pointer or buffer structure. Under certain timing conditions, the task reads the pointer before the ISR has fully written it, or after it has been cleared.

**Example of the bug pattern:**
```c
// Shared between ISR and task -- NOT properly synchronized
static CAN_Message* current_msg = NULL;

// In CAN RX ISR:
void CAN1_RX0_IRQHandler(void) {
    current_msg = &msg_pool[next_slot];
    memcpy(current_msg->data, rx_fifo_data, dlc);
    notify_parser_task();
}

// In parser task:
void parser_task(void) {
    // BUG: current_msg may be NULL if task runs before ISR writes it,
    // or may point to a slot that ISR is about to overwrite
    memcpy(parsed_buf, current_msg->data, current_msg->dlc);  // FAULT when current_msg == NULL
}
```

**Fix:** Use a proper ISR-to-task communication mechanism:

```c
// FreeRTOS queue -- ISR sends a copy, task receives it safely
static QueueHandle_t can_rx_queue;  // created at init: xQueueCreate(16, sizeof(CAN_Message))

void CAN1_RX0_IRQHandler(void) {
    CAN_Message msg;
    // Copy from hardware FIFO into local struct
    msg.id = CAN1->sFIFOMailBox[0].RIR >> 21;
    msg.dlc = CAN1->sFIFOMailBox[0].RDTR & 0x0F;
    memcpy(msg.data, (void*)&CAN1->sFIFOMailBox[0].RDLR, msg.dlc);

    BaseType_t woken = pdFALSE;
    xQueueSendFromISR(can_rx_queue, &msg, &woken);
    portYIELD_FROM_ISR(woken);
}

void parser_task(void *arg) {
    CAN_Message msg;
    for (;;) {
        if (xQueueReceive(can_rx_queue, &msg, portMAX_DELAY) == pdTRUE) {
            // msg is a private copy -- no race possible
            parse_can_message(&msg);
        }
    }
}
```

### Cause B: Unvalidated pointer from a lookup table or pool

The parser uses a message ID to index into a handler table or buffer pool, and under certain IDs or pool-exhaustion conditions, it gets back NULL without checking:

```c
// BUG: pool_alloc returns NULL when pool is exhausted, but caller does not check
ParsedFrame* frame = pool_alloc(&frame_pool);
memcpy(frame->payload, raw_data, len);  // FAULT when pool is exhausted
```

**Fix:** Always check allocator return values (mark them `[[nodiscard]]`):

```c
[[nodiscard]] ParsedFrame* pool_alloc(FramePool* pool);

// Caller:
ParsedFrame* frame = pool_alloc(&frame_pool);
if (frame == NULL) {
    // Handle: drop message, increment error counter, log
    can_stats.dropped_frames++;
    return;
}
memcpy(frame->payload, raw_data, len);
```

### Cause C: DLC exceeding expected bounds, causing memcpy to run past a buffer and corrupt a nearby pointer

CAN frames have a DLC of 0-8, but a malformed CAN frame (or CAN FD frame in classical mode) could have a DLC value that, if not validated, causes a buffer overrun. The overrun corrupts an adjacent pointer, which later becomes the null-dereference source.

**Fix:** Always clamp the DLC:

```c
uint8_t dlc = CAN1->sFIFOMailBox[0].RDTR & 0x0F;
if (dlc > 8U) {
    dlc = 8U;  // CAN 2.0B maximum
}
```

## 4. Debugging Steps to Confirm

### Step 1: Examine the stacked exception frame

In your HardFault handler, recover the stacked registers to find the exact faulting instruction and the arguments that were passed to `memcpy`:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "TST LR, #4        \n"  // Test bit 2 of EXC_RETURN
        "ITE EQ             \n"
        "MRSEQ R0, MSP      \n"  // Main stack
        "MRSNE R0, PSP      \n"  // Process stack (FreeRTOS tasks)
        "B HardFault_Handler_C \n"
    );
}

void HardFault_Handler_C(uint32_t* stack_frame) {
    volatile uint32_t r0   = stack_frame[0];  // First arg to memcpy (dest)
    volatile uint32_t r1   = stack_frame[1];  // Second arg to memcpy (src)
    volatile uint32_t r2   = stack_frame[2];  // Third arg to memcpy (len)
    volatile uint32_t r3   = stack_frame[3];
    volatile uint32_t r12  = stack_frame[4];
    volatile uint32_t lr   = stack_frame[5];  // Link register (caller)
    volatile uint32_t pc   = stack_frame[6];  // Faulting PC
    volatile uint32_t xpsr = stack_frame[7];

    volatile uint32_t cfsr  = SCB->CFSR;
    volatile uint32_t bfar  = SCB->BFAR;

    // Log these to UART, ITM, or non-volatile storage
    // r0 or r1 will be 0x00000000 (the null pointer)

    __BKPT(0);  // Halt if debugger attached
    for(;;);
}
```

When the fault triggers, inspect `r0` and `r1`. Since `memcpy(dest, src, len)` puts the destination in R0 and source in R1 on ARM calling convention, one of them will be 0x00000000. That tells you whether the null is the source or destination pointer.

### Step 2: Use GDB watchpoint on the pointer

If you can connect a debugger, set a hardware watchpoint on the pointer variable that becomes NULL:

```gdb
# Find the address of the buffer pointer
print &parser_ctx.current_buffer
# Set watchpoint
watch *(void**)0x2000XXXX
continue
```

GDB will halt the moment the pointer changes to NULL, showing you exactly which code path cleared it.

### Step 3: Add defensive null checks with logging

As a temporary diagnostic measure, add null checks before every `memcpy` in the parser:

```c
void parse_can_message(const CAN_Message* msg) {
    if (msg == NULL) {
        fault_log("parse_can_message: msg is NULL");
        return;
    }

    TargetBuffer* buf = get_buffer_for_id(msg->id);
    if (buf == NULL) {
        fault_log("parse_can_message: no buffer for ID 0x%03X", msg->id);
        return;
    }

    if (msg->dlc > 8U) {
        fault_log("parse_can_message: invalid DLC %u", msg->dlc);
        return;
    }

    memcpy(buf->data, msg->data, msg->dlc);
}
```

### Step 4: Run the parser logic on host with AddressSanitizer

Extract the CAN parser into a host-testable module and fuzz it:

```bash
gcc -fsanitize=address,undefined -fno-omit-frame-pointer -g -O1 \
    -o test_parser test_parser_host.c src/can_parser.c

# Feed random and edge-case CAN messages
./test_parser
```

ASan will catch any out-of-bounds `memcpy` at the exact moment it happens, giving you a stack trace pointing to the offending line.

## 5. Summary

| Finding | Detail |
|---------|--------|
| **Fault type** | Precise BusFault, escalated to HardFault (FORCED) |
| **Faulting address** | 0x00000000 (null pointer dereference) |
| **BFARVALID** | Set -- BFAR is reliable |
| **MMARVALID** | NOT set -- MMFAR = 0x00000010 is stale garbage, ignore it entirely |
| **Faulting instruction** | `memcpy` in CAN message parser (from stacked PC) |
| **Root cause** | A pointer argument to `memcpy` is NULL under specific timing conditions |
| **Most likely reason** | Race condition between CAN RX ISR and parser task on a shared buffer/pointer |
| **Fix** | Use a queue (or ring buffer) to pass CAN messages from ISR to task by copy, eliminate shared mutable state, validate all pointers before use, clamp DLC to 8 |

The intermittent 2-to-30-minute timing is the signature of a data race -- the fault only triggers when the ISR and task execution overlap in exactly the wrong way. Proper ISR-to-task communication with a queue or lock-free ring buffer will eliminate the race entirely.
