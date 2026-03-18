# STM32F4 HardFault Analysis: CAN Message Parser memcpy Crash

## 1. Register Decode

### CFSR (Configurable Fault Status Register) = 0x00008200

The CFSR is a 32-bit register composed of three sub-registers:

| Sub-register | Bits | Value | Meaning |
|---|---|---|---|
| MMFSR (MemManage) | [7:0] | 0x00 | No memory management faults |
| BFSR (BusFault) | [15:8] | 0x82 | **Bus fault detected** |
| UFSR (UsageFault) | [31:16] | 0x0000 | No usage faults |

Breaking down **BFSR = 0x82**:

- **Bit 7 (BFARVALID) = 1**: The BFAR register holds a valid fault address.
- **Bit 1 (PRECISERR) = 1**: A **precise data bus error** occurred. The faulting instruction and address are known exactly.
- Bits 0, 2-4, 5 = 0: No imprecise errors, no unstacking/stacking errors, no instruction bus errors.

### HFSR (HardFault Status Register) = 0x40000000

- **Bit 30 (FORCED) = 1**: The HardFault was **forced** -- it escalated from a BusFault. This means the BusFault handler was either disabled or a fault occurred while processing another exception.

### MMFAR = 0x00000010

Not relevant here since MMFSR is clear (no MemManage fault). This register value is stale/meaningless in this context.

### BFAR (BusFault Address Register) = 0x00000000

Since BFARVALID is set, this is the **exact address that caused the bus fault**: **0x00000000**.

## 2. Root Cause Analysis

### What happened

The processor attempted to **read from address 0x00000000** during a `memcpy` operation inside your CAN message parser. On the STM32F4:

- Address 0x00000000 typically maps to the start of Flash (aliased), so reading from it would normally succeed.
- However, **BFAR = 0x00000000 combined with the fault at a memcpy** strongly suggests a **NULL pointer dereference** where the source pointer passed to `memcpy` was NULL, or a pointer to a struct was NULL and the code accessed a member at offset 0x10 (16 bytes in).

Wait -- let me re-examine. The MMFAR = 0x00000010 is notable. Even though the MMFSR bits are clear, consider this scenario: the actual faulting access was to address **0x00000000** (BFAR), and the MMFAR value of 0x00000010 may be residual. The key fact is:

**A NULL pointer (0x00000000) was dereferenced during memcpy in the CAN parser.**

### Why it is intermittent (2-30 minutes)

The intermittent nature points to a **race condition** or **use-after-free** scenario. Common causes in CAN message parsing:

1. **ISR/task race condition**: The CAN RX interrupt writes to a buffer that the parser reads. If the pointer to the current message buffer is updated in the ISR while the parser task is mid-read, the parser can see a NULL or partially-updated pointer.

2. **Double-buffer or ring-buffer index corruption**: If the ring buffer wraps and the pointer is momentarily NULL or invalid during the swap.

3. **Dangling pointer to a freed/reused buffer**: A CAN message buffer is freed or returned to a pool, and the parser still holds a stale pointer that eventually gets zeroed.

4. **Stack corruption**: A local pointer variable on the stack gets corrupted by a buffer overflow in an adjacent variable, eventually becoming NULL.

## 3. Debugging Steps

### Step 1: Examine the faulting code path

Look at the stacked PC from the exception frame. You said it points into `memcpy`. Inspect the disassembly:

```
arm-none-eabi-objdump -d -S your_firmware.elf | less
```

Find the `memcpy` call site in your CAN parser. Identify which argument (source or destination) corresponds to the NULL pointer. Typically:

```c
// Likely pattern in your CAN parser:
void parse_can_msg(can_msg_t *msg) {
    uint8_t local_buf[8];
    memcpy(local_buf, msg->data, msg->dlc);  // if msg is NULL, msg->data dereferences NULL+offset
}
```

If `msg` is NULL, then `msg->data` would access address `offsetof(can_msg_t, data)` which could be near 0x00000000.

### Step 2: Add a NULL check and fault trap

```c
void parse_can_msg(can_msg_t *msg) {
    if (msg == NULL) {
        __BKPT(0);  // Breakpoint -- attach debugger to catch this
        return;
    }
    if (msg->data == NULL) {
        __BKPT(1);
        return;
    }
    // ... proceed with memcpy
}
```

### Step 3: Check for ISR/task synchronization issues

If CAN RX happens in an interrupt and parsing happens in the main loop or an RTOS task, verify:

```c
// BAD -- race condition:
volatile can_msg_t *current_msg;

void CAN_RX_IRQHandler(void) {
    current_msg = dequeue_rx_buffer();  // Could be NULL if buffer empty
    // ... signal parser
}

void parser_task(void) {
    // current_msg could become NULL between check and use
    if (current_msg != NULL) {
        // ISR fires here, sets current_msg = NULL or a new pointer
        memcpy(buf, current_msg->data, current_msg->dlc);  // BOOM
    }
}
```

**Fix**: Use proper synchronization:

```c
// Option A: Copy under critical section
void parser_task(void) {
    __disable_irq();
    can_msg_t local_copy;
    if (current_msg != NULL) {
        local_copy = *current_msg;
        __enable_irq();
        // Parse local_copy safely
    } else {
        __enable_irq();
    }
}

// Option B: Use a proper queue (FreeRTOS xQueueReceive, etc.)
void parser_task(void) {
    can_msg_t msg;
    if (xQueueReceive(can_rx_queue, &msg, portMAX_DELAY) == pdTRUE) {
        parse_can_msg(&msg);  // msg is a local copy, no race
    }
}
```

### Step 4: Instrument to catch the fault earlier

Add a custom HardFault handler that dumps the full exception frame:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "TST   LR, #4          \n"
        "ITE   EQ               \n"
        "MRSEQ R0, MSP          \n"
        "MRSNE R0, PSP          \n"
        "B     hard_fault_dump  \n"
    );
}

void hard_fault_dump(uint32_t *stack) {
    volatile uint32_t r0  = stack[0];
    volatile uint32_t r1  = stack[1];
    volatile uint32_t r2  = stack[2];
    volatile uint32_t r3  = stack[3];
    volatile uint32_t r12 = stack[4];
    volatile uint32_t lr  = stack[5];
    volatile uint32_t pc  = stack[6];
    volatile uint32_t psr = stack[7];

    // Also read fault registers
    volatile uint32_t cfsr = *(volatile uint32_t *)0xE000ED28;
    volatile uint32_t bfar = *(volatile uint32_t *)0xE000ED38;

    // Log these values (UART, ITM, or store to a crash region in RAM)
    // r0-r3 will tell you the arguments to memcpy:
    //   r0 = destination, r1 = source, r2 = length
    // Whichever is 0x00000000 is your NULL pointer.

    __BKPT(0);  // Halt if debugger attached
    while(1);
}
```

**Key insight**: When the PC points into `memcpy`, the registers **r0**, **r1**, and **r2** from the exception stack frame tell you the `memcpy` arguments (dest, src, len). Check which one is NULL or near-NULL.

### Step 5: Check for stack overflow

The intermittent nature could also be caused by stack overflow corrupting local pointer variables:

```c
// If using FreeRTOS, enable stack overflow checking:
#define configCHECK_FOR_STACK_OVERFLOW  2

void vApplicationStackOverflowHook(TaskHandle_t task, char *name) {
    // Log task name, halt
    __BKPT(0);
    while(1);
}
```

For bare-metal, fill the stack with a known pattern (e.g., 0xDEADBEEF) at startup and periodically check how much remains.

### Step 6: Enable BusFault handler separately

Currently the BusFault escalates to HardFault (HFSR FORCED bit). Enable the BusFault handler directly for cleaner debugging:

```c
// In your startup or SystemInit:
SCB->SHCSR |= SCB_SHCSR_BUSFAULTENA_Msk;
```

Then implement `BusFault_Handler` with the same stack dump logic. This prevents escalation and gives you a cleaner fault context.

## 4. Most Likely Root Cause

Given the evidence:

| Clue | Implication |
|---|---|
| BFAR = 0x00000000 | NULL pointer access |
| Fault in memcpy | A pointer argument to memcpy is NULL |
| CAN message parser context | The CAN message pointer or its data field is NULL |
| Intermittent (2-30 min) | Race condition between CAN RX ISR and parser |

**Most probable cause**: The CAN RX ISR and the message parser have a race condition on a shared message pointer or buffer. Under certain timing conditions (dependent on CAN bus traffic patterns and task scheduling), the parser reads a pointer that the ISR has set to NULL or is in the process of updating.

## 5. Recommended Fix

1. **Never share raw pointers between ISR and task.** Use a message queue (if using an RTOS) or a double-buffer with atomic flag swapping (if bare-metal).

2. **Validate all pointers before memcpy** in the parser as a defensive measure.

3. **Enable BusFault handler** separately to get cleaner fault diagnostics.

4. **Examine the stacked r0/r1/r2** on next crash to confirm which memcpy argument is NULL (source vs destination).

5. **Review the CAN RX buffer management** for any path that could yield a NULL pointer -- empty queue returns, pool exhaustion, etc.
