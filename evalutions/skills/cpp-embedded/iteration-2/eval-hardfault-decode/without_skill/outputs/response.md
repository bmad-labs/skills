# STM32F4 HardFault Debugging Analysis

## Register Decode

### CFSR (Configurable Fault Status Register) = 0x00008200

The CFSR is a 32-bit register composed of three sub-registers:

| Sub-register | Bits | Your Value | Meaning |
|---|---|---|---|
| UFSR (UsageFault) | [31:16] | 0x0000 | No usage faults |
| BFSR (BusFault) | [15:8] | 0x82 | **Bus fault detected** |
| MMFSR (MemManage) | [7:0] | 0x00 | No memory management faults |

**BFSR breakdown (0x82):**

- Bit 7 (BFARVALID) = **1** -- The BFAR register holds a valid fault address.
- Bit 1 (PRECISERR) = **1** -- A precise data bus error has occurred.

This means the processor attempted a data access that resulted in a bus error, and the exact address that caused it is captured in BFAR.

### HFSR (HardFault Status Register) = 0x40000000

- Bit 30 (FORCED) = **1** -- The HardFault was caused by a forced escalation of a configurable fault (in this case, the BusFault). This happens when BusFault is not enabled as a separate exception or cannot be handled.

### MMFAR = 0x00000010

This value is **not valid** in your case because MMFSR shows no MemManage fault (MMARVALID bit is 0). Ignore this register.

### BFAR (BusFault Address Register) = 0x00000000

This is the key finding. BFARVALID is set, so this address **is** valid. The faulting access was to address **0x00000000**.

## Root Cause Analysis

**You have a NULL pointer dereference.** The processor tried to read from or write to address 0x00000000, which on STM32F4 is a valid address (it maps to the start of Flash or SRAM depending on BOOT pins), but the fact that it triggered a bus fault combined with the memcpy context points to a **NULL pointer being passed to memcpy**.

Wait -- let me refine this. BFAR = 0x00000000 with a precise bus error. On STM32F4, address 0x00000000 is typically aliased to Flash and is readable. However, looking more carefully at the context:

The BFAR value of 0x00000000 combined with MMFAR = 0x00000010 suggests the actual faulting scenario is a **NULL pointer dereference with an offset**. The memcpy is likely reading from a struct pointer that is NULL, and the offset 0x10 (16 bytes) into that struct is the field being accessed. The processor faulted accessing address 0x00000010 (NULL + offset to a struct field).

**Correction on register interpretation:** On some Cortex-M4 implementations, when both BFAR and MMFAR show values and the fault escalated, the actual faulting address may be reflected in MMFAR even though the MMFSR bits are not set due to escalation. The address 0x00000010 is the more informative value here -- it represents NULL + 16 bytes of offset.

## The Likely Bug

Given that:
1. The fault is in **memcpy inside a CAN message parser**
2. The faulting address is very close to NULL (0x00000000 or 0x00000010)
3. The fault is **intermittent** (2-30 minutes)

The most probable scenario is:

**A CAN message buffer pointer or parsed message struct pointer is NULL or uninitialized when memcpy is called.**

The intermittent nature strongly suggests a **race condition** -- likely between the CAN receive ISR and the parser task/main loop.

### Common Patterns That Cause This

```c
// Pattern 1: Race condition with buffer pointer
// ISR sets the pointer, main loop reads it
volatile CAN_Message_t* rx_msg = NULL;

// In CAN RX ISR:
void CAN1_RX0_IRQHandler(void) {
    rx_msg = &rx_buffer[write_index];  // Set pointer
    // ...
}

// In main loop / parser task:
void parse_can_message(void) {
    if (rx_msg != NULL) {
        // RACE: rx_msg can become NULL between check and use
        memcpy(&local_copy, rx_msg, sizeof(CAN_Message_t));
        //                   ^--- FAULT: rx_msg is NULL by now
    }
}
```

```c
// Pattern 2: Stale pointer from a ring buffer
CAN_Message_t* get_next_message(void) {
    if (read_index == write_index)
        return NULL;  // Empty
    return &ring_buffer[read_index++];
}

void parser(void) {
    CAN_Message_t* msg = get_next_message();
    // Missing NULL check before memcpy!
    memcpy(&parsed, msg->data, 8);  // Fault if msg is NULL
    //                                 accessing msg->data at offset ~0x10
}
```

```c
// Pattern 3: Double-fetch / TOCTOU
CAN_Message_t* msg = get_next_message();
if (msg != NULL) {
    process_id(msg->id);
    // ISR fires here, ring buffer wraps, memory is reused
    memcpy(dest, msg->data, msg->dlc);  // msg may now point to invalid memory
}
```

## Step-by-Step Debugging Plan

### 1. Identify the Exact Fault Location

Add a HardFault handler that captures the exception stack frame:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "TST LR, #4          \n"
        "ITE EQ              \n"
        "MRSEQ R0, MSP       \n"
        "MRSNE R0, PSP       \n"
        "B hard_fault_handler \n"
    );
}

void hard_fault_handler(uint32_t* stack_frame) {
    volatile uint32_t r0  = stack_frame[0];
    volatile uint32_t r1  = stack_frame[1];
    volatile uint32_t r2  = stack_frame[2];
    volatile uint32_t r3  = stack_frame[3];
    volatile uint32_t r12 = stack_frame[4];
    volatile uint32_t lr  = stack_frame[5];
    volatile uint32_t pc  = stack_frame[6];  // Faulting instruction
    volatile uint32_t psr = stack_frame[7];

    // Also capture fault registers
    volatile uint32_t cfsr  = SCB->CFSR;
    volatile uint32_t hfsr  = SCB->HFSR;
    volatile uint32_t mmfar = SCB->MMFAR;
    volatile uint32_t bfar  = SCB->BFAR;

    // Breakpoint or store to persistent memory for post-mortem
    __BKPT(0);

    while(1) {}
}
```

Use the **PC** value to find the exact line in your `.map` file or with `arm-none-eabi-addr2line`:

```bash
arm-none-eabi-addr2line -e your_firmware.elf -f -C <PC_value>
```

Check **R0 and R1** -- for memcpy, these are the destination and source pointers. One of them will be NULL or near-NULL (0x00000010 range).

### 2. Check the memcpy Arguments

Once you know which memcpy call faults, examine what pointer is being passed. Look for:

- The source pointer being NULL (most likely, since this is a CAN *parser* reading received data)
- A struct pointer that is NULL, with memcpy accessing a field at offset 0x10

### 3. Look for the Race Condition

Since the fault is intermittent (timing-dependent), search for these patterns in your CAN parser code:

**Check for missing interrupt guards:**
```c
// BAD - no protection
CAN_Message_t* msg = dequeue_can_message();
memcpy(&local, msg, sizeof(*msg));

// GOOD - disable interrupts around the critical section
__disable_irq();
CAN_Message_t* msg = dequeue_can_message();
if (msg != NULL) {
    memcpy(&local, msg, sizeof(*msg));
}
__enable_irq();
```

**Or better, use a proper copy-then-release pattern:**
```c
// GOOD - copy in ISR, consume in main loop
// ISR:
void CAN1_RX0_IRQHandler(void) {
    CAN_Message_t msg;
    // Read directly from CAN peripheral registers
    msg.id = CAN1->sFIFOMailBox[0].RIR >> 21;
    msg.dlc = CAN1->sFIFOMailBox[0].RDTR & 0x0F;
    memcpy(msg.data, (void*)&CAN1->sFIFOMailBox[0].RDLR, msg.dlc);
    CAN1->RF0R |= CAN_RF0R_RFOM0;  // Release FIFO

    ring_buffer_push(&can_rx_ring, &msg);  // Must be ISR-safe
}

// Main loop:
void parse_can_messages(void) {
    CAN_Message_t msg;
    while (ring_buffer_pop(&can_rx_ring, &msg)) {  // Returns false if empty
        // msg is a local copy -- safe to use without ISR concerns
        process_message(&msg);
    }
}
```

### 4. Verify Your Ring Buffer Implementation

If you are using a ring buffer between the CAN ISR and parser, check for:

- **Missing volatile** on read/write indices
- **Non-atomic index updates** (use `read_idx % BUFFER_SIZE` consistently)
- **Buffer overflow** when messages arrive faster than they are consumed
- **Pointer invalidation** -- never return pointers into the ring buffer; always copy out

### 5. Add Defensive Checks (Temporary Debugging Aid)

```c
void parse_can_message(CAN_Message_t* msg) {
    // Temporary assertion for debugging
    if (msg == NULL || (uint32_t)msg < 0x20000000) {
        // Log error -- pointer is NULL or in Flash/invalid region
        error_log("NULL msg pointer in parser, caller LR = 0x%08X",
                  __builtin_return_address(0));
        return;
    }

    memcpy(&parsed_data, msg->data, msg->dlc);
    // ... rest of parsing
}
```

### 6. Enable BusFault Handler Separately

Enable the BusFault exception so it does not escalate to HardFault. This gives you a cleaner stack trace:

```c
// In system init, before enabling CAN:
SCB->SHCSR |= SCB_SHCSR_BUSFAULTENA_Msk;
```

Then add a `BusFault_Handler` with the same stack-dumping code.

## Summary

| Finding | Detail |
|---|---|
| **Fault type** | Precise BusFault escalated to HardFault |
| **Faulting address** | 0x00000000 (NULL pointer) with likely offset 0x10 |
| **Root cause** | NULL pointer passed to memcpy in CAN message parser |
| **Why intermittent** | Race condition between CAN RX ISR and parser |
| **Fix** | Add NULL checks, protect shared data with interrupt disable or use a copy-based ring buffer, never pass raw pointers from ISR context to main loop |

The critical next step is to deploy the HardFault handler above, reproduce the fault, and examine R0/R1 to confirm which memcpy argument is NULL. Then trace back through your CAN receive path to find where the pointer is set and where the race window exists.
