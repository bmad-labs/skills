# STM32F4 HardFault Debugging Analysis

## 1. Register Decode

### CFSR (Configurable Fault Status Register) = 0x00008200

The CFSR is a 32-bit register composed of three sub-registers:

| Sub-register | Bits | Value | Meaning |
|---|---|---|---|
| UFSR (UsageFault) | [31:16] | 0x0000 | No usage faults |
| BFSR (BusFault) | [15:8] | 0x82 | Bus fault detected |
| MMFSR (MemManage) | [7:0] | 0x00 | No memory management faults |

**BFSR breakdown (bits [15:8]):**

- Bit 15 (BFARVALID) = 1 -- The BFAR register holds a valid address.
- Bit 14 (LSPERR) = 0 -- No lazy FP state preservation error.
- Bit 13 (STKERR) = 0 -- No bus fault on stacking for exception entry.
- Bit 12 (UNSTKERR) = 0 -- No bus fault on unstacking for exception return.
- Bit 11 (IMPRECISERR) = 0 -- Not an imprecise bus error.
- Bit 10 (PRECISERR) = 0 -- Not a precise data bus error.
- Bit 9 (IBUSERR) = 1 -- **Instruction bus error.**
- Bit 8 (reserved) = 0

**Wait -- let me re-examine.** 0x82 in binary is `1000_0010`. Mapping to bits [15:8]:

- Bit 15 (BFARVALID) = 1
- Bit 9 (IBUSERR) = 1

**Correction:** Actually, BFSR is byte [15:8], so value 0x82 means bits 7 and 1 of the byte are set, which correspond to:

- Bit 7 of BFSR = BFARVALID (bit 15 of CFSR) = **1** -- BFAR is valid
- Bit 1 of BFSR = PRECISERR (bit 9 of CFSR) = **1** -- Precise data bus error

So the correct decode is: **Precise data bus error, and BFAR contains the faulting address.**

### HFSR (HardFault Status Register) = 0x40000000

- Bit 31 (DEBUGEVT) = 0 -- Not caused by debug event.
- Bit 30 (FORCED) = 1 -- **Forced HardFault.** The fault escalated because the corresponding fault handler (BusFault) is either disabled or caused another fault.
- Bit 1 (VECTTBL) = 0 -- Not caused by a vector table read error.

This confirms: a BusFault was escalated to a HardFault. This typically happens because the BusFault handler is not enabled in the SCB->SHCSR register.

### MMFAR = 0x00000010

This register is **not valid** in this case (MMFSR shows no MemManage fault, and MMARVALID bit is 0). The value 0x00000010 is stale/irrelevant.

### BFAR (Bus Fault Address Register) = 0x00000000

BFARVALID = 1, so this address IS valid. The faulting access was to **address 0x00000000**.

## 2. Root Cause Analysis

### What the registers tell us

The processor attempted a **precise data access (read or write) to address 0x00000000**, which caused a bus error that escalated to a HardFault.

On STM32F4, address 0x00000000 is typically mapped to either Flash or the aliased boot region. A data access to address 0x00000000 itself may succeed, but accessing it as a **dereferenced NULL pointer** (e.g., reading a struct member at offset 0x10 from a NULL base) is the classic signature.

**However**, note that BFAR = 0x00000000 while MMFAR = 0x00000010. While MMFAR is marked invalid here, the combination with the PC pointing to `memcpy` inside your CAN parser is extremely revealing.

### The most likely scenario: NULL pointer dereference

Your CAN message parser is passing a **NULL pointer** (or a pointer to address 0x00000000) to `memcpy`. The `memcpy` function then tries to read from that address. Since BFAR = 0x00000000 and the fault is precise, the processor faulted when `memcpy` attempted to access memory starting at address 0x00000000.

Given the context that:
- The fault is in `memcpy` inside a CAN message parser
- The faulting address is 0x00000000 (NULL)
- The fault is **intermittent** (2-30 minutes)

This points to a **race condition** or **use-after-free/stale pointer** in the CAN receive path.

### Why it is intermittent

Common reasons for intermittent NULL pointer dereference in CAN parsers:

1. **Race condition between CAN RX ISR and parser task**: The ISR fills a buffer/queue, and the parser reads from it. If there is no proper synchronization, the parser may read a partially-written message descriptor where the data pointer is still NULL/zero.

2. **Buffer overrun in a CAN message queue**: If the CAN message queue overflows, a ring buffer index might wrap incorrectly, causing the parser to read an uninitialized or zeroed-out entry.

3. **Use-after-free**: A CAN message buffer is freed (or zeroed) by one context while the parser still holds a pointer to it.

4. **Stack corruption**: A local pointer variable on the stack gets corrupted by a stack overflow in an adjacent task or ISR, intermittently becoming NULL.

## 3. Actionable Debugging Steps

### Step 1: Examine the exception stack frame

When the HardFault fires, the ARM Cortex-M4 pushes a stack frame. Read these values from the stack:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "TST LR, #4          \n"  // Check EXC_RETURN bit 2
        "ITE EQ              \n"
        "MRSEQ R0, MSP       \n"  // Main stack
        "MRSNE R0, PSP       \n"  // Process stack (if using RTOS)
        "B hard_fault_handler \n"
    );
}

void hard_fault_handler(uint32_t *stack_frame) {
    volatile uint32_t r0  = stack_frame[0];
    volatile uint32_t r1  = stack_frame[1];
    volatile uint32_t r2  = stack_frame[2];
    volatile uint32_t r3  = stack_frame[3];
    volatile uint32_t r12 = stack_frame[4];
    volatile uint32_t lr  = stack_frame[5];  // Return address
    volatile uint32_t pc  = stack_frame[6];  // Faulting instruction
    volatile uint32_t psr = stack_frame[7];

    // Breakpoint here -- inspect r0, r1, r2 to see memcpy arguments
    // memcpy(dest, src, n) -> r0=dest, r1=src, r2=n
    __BKPT(0);
}
```

**Key**: Since PC points into `memcpy`, check **R0** (destination) and **R1** (source). One of them will be 0x00000000 -- this tells you whether the NULL pointer was the source or destination buffer.

### Step 2: Trace the caller of memcpy

The **LR (Link Register)** from the exception frame will point to the instruction after the `memcpy` call in your CAN parser. Use `addr2line` or your IDE's disassembly view:

```bash
arm-none-eabi-addr2line -e your_firmware.elf -f -p <LR_value>
```

This will give you the exact line in your CAN parser that calls `memcpy` with the NULL pointer.

### Step 3: Audit the CAN parser for NULL pointer sources

Look at the `memcpy` call site in the CAN parser. Identify the pointer argument that could be NULL. Common patterns:

```c
// Pattern A: Direct buffer pointer from a message struct
void parse_can_message(CanMsg_t *msg) {
    uint8_t local_buf[8];
    memcpy(local_buf, msg->data, msg->dlc);  // msg could be NULL
    // or msg->data could be NULL
}

// Pattern B: Lookup table returning NULL
void handle_can_rx(uint32_t id, uint8_t *data) {
    CanHandler_t *handler = find_handler(id);
    memcpy(handler->buffer, data, 8);  // handler could be NULL
}
```

**Add a NULL check** before the `memcpy`, and log/assert when it triggers:

```c
if (msg == NULL || msg->data == NULL) {
    // Log the error with CAN ID, timestamp, queue state
    error_log(ERR_CAN_NULL_PTR, can_id, queue_read_idx, queue_write_idx);
    return;
}
```

### Step 4: Check for race conditions in the CAN RX path

This is the most likely root cause given the intermittent nature. Audit these areas:

**a) Disable interrupts around shared data access:**

```c
// In the CAN RX ISR:
void CAN1_RX0_IRQHandler(void) {
    CanMsg_t msg;
    // ... read from CAN peripheral ...

    __disable_irq();  // or use a critical section
    can_queue[write_idx] = msg;
    write_idx = (write_idx + 1) % QUEUE_SIZE;
    __enable_irq();
}

// In the parser task:
void can_parser_task(void) {
    __disable_irq();
    if (read_idx != write_idx) {
        CanMsg_t msg = can_queue[read_idx];
        read_idx = (read_idx + 1) % QUEUE_SIZE;
        __enable_irq();
        process_message(&msg);  // Work on local copy
    } else {
        __enable_irq();
    }
}
```

**b) If using an RTOS**, use a proper message queue (e.g., FreeRTOS `xQueueSendFromISR` / `xQueueReceive`) instead of a hand-rolled ring buffer.

**c) Check for volatile qualification**: Shared index variables (`read_idx`, `write_idx`) and shared buffer pointers must be declared `volatile`.

### Step 5: Check for stack overflow

If you are using an RTOS, the intermittent timing suggests possible stack overflow corrupting local pointer variables:

- **Enable stack overflow detection** in FreeRTOS: set `configCHECK_FOR_STACK_OVERFLOW` to 2 in `FreeRTOSConfig.h`.
- **Increase the stack size** of the CAN parser task temporarily (double it) and see if the fault disappears.
- **Use stack watermark checking**: `uxTaskGetStackHighWaterMark()` to see how close to the limit each task gets.

### Step 6: Enable BusFault handler for better diagnostics

Enable the BusFault handler so future faults do not escalate to HardFault:

```c
// In your initialization code:
SCB->SHCSR |= SCB_SHCSR_BUSFAULTENA_Msk;
```

Then implement `BusFault_Handler` with the same stack frame inspection logic. This gives you a cleaner fault path.

### Step 7: Add runtime instrumentation

To catch the fault in action, add lightweight instrumentation:

```c
// Global diagnostic variables (volatile, never optimized out)
volatile uint32_t g_last_can_id = 0;
volatile uint32_t g_last_can_ptr = 0;
volatile uint32_t g_can_parse_count = 0;

void parse_can_message(CanMsg_t *msg) {
    g_can_parse_count++;
    g_last_can_ptr = (uint32_t)msg;
    if (msg) g_last_can_id = msg->id;

    // ... existing code ...
}
```

When the HardFault fires, inspect these globals in the debugger to see the state just before the crash.

## 4. Summary

| Finding | Detail |
|---|---|
| Fault type | Precise BusFault escalated to HardFault |
| Faulting address | 0x00000000 (NULL pointer dereference) |
| Faulting instruction | Inside `memcpy` in CAN message parser |
| Root cause (likely) | Race condition in CAN RX path causes parser to read a NULL/zeroed pointer |
| Why intermittent | Timing-dependent race between CAN ISR and parser task |
| Fix priority | (1) Add NULL checks, (2) Fix synchronization in CAN RX queue, (3) Check stack sizes |

The intermittent 2-30 minute timing is characteristic of a race condition that depends on specific CAN bus traffic patterns and task scheduling alignment. The fix is almost certainly proper synchronization of the shared CAN message buffer between the ISR and the parser context.
