# HardFault Diagnosis: STM32F4 CAN Message Parser

## 1. Register Decode

Let's decode each fault register systematically.

### CFSR = 0x00008200

The CFSR is a 32-bit register composed of three sub-registers:

- **Bits [7:0] - MemManage Fault Status Register (MMFSR)**
- **Bits [15:8] - BusFault Status Register (BFSR)**
- **Bits [31:16] - UsageFault Status Register (UFSR)**

Breaking down 0x00008200:

| Field | Hex | Binary | Bits set |
|-------|-----|--------|----------|
| UFSR [31:16] | 0x0000 | 0000 0000 0000 0000 | None |
| BFSR [15:8] | 0x82 | 1000 0010 | Bit 15 (BFARVALID) + Bit 9 (PRECISERR) |
| MMFSR [7:0] | 0x00 | 0000 0000 | None |

**Wait** -- let me re-examine. CFSR = 0x00008200:

- Byte 0 (MMFSR): 0x00 -- no MemManage faults
- Byte 1 (BFSR): 0x82 -- but BFSR occupies bits [15:8], so the byte value is (0x8200 >> 8) = 0x82
  - Bit 9 (PRECISERR) = 1: **Precise data bus error** -- the faulting instruction is the one pointed to by the stacked PC
  - Bit 15 (BFARVALID) = 1: **BFAR register contains the address that caused the fault**
- Bytes 2-3 (UFSR): 0x0000 -- no usage faults

**However**, you also report MMFAR = 0x00000010 and BFAR = 0x00000000. Since BFARVALID is set, BFAR = 0x00000000 is the faulting address. But wait -- let me re-examine more carefully.

Actually, re-reading the value: 0x00008200.

- Bits [7:0] = 0x00 (MMFSR)
- Bits [15:8] = 0x82 (BFSR): bit 1 of BFSR (bit 9 of CFSR) = PRECISERR, bit 7 of BFSR (bit 15 of CFSR) = BFARVALID
- Bits [31:16] = 0x0000 (UFSR)

Correction: CFSR bit numbering within the BFSR byte:
- BFSR bit 0 (CFSR bit 8) = IBUSERR
- BFSR bit 1 (CFSR bit 9) = PRECISERR
- BFSR bit 2 (CFSR bit 10) = IMPRECISERR
- BFSR bit 7 (CFSR bit 15) = BFARVALID

0x82 = 1000 0010:
- Bit 1 = PRECISERR = 1
- Bit 7 = BFARVALID = 1

**Conclusion: Precise bus fault with a valid BFAR address.**

### HFSR = 0x40000000

- Bit 30 (FORCED) = 1: The HardFault was caused by a configurable fault that was escalated. This means a BusFault occurred but the BusFault handler is not enabled (or has the same or lower priority), so it escalated to HardFault.

This is the normal pattern -- unless you have explicitly enabled the BusFault handler via `SCB->SHCSR`, bus faults escalate to HardFault.

### MMFAR = 0x00000010

MMFAR is only valid when MMARVALID (CFSR bit 7) is set. In this case MMARVALID = 0, so **MMFAR is stale/invalid**. Ignore this value.

### BFAR = 0x00000000

BFAR IS valid (BFARVALID = 1). The bus fault occurred when accessing **address 0x00000000**.

On STM32F4, address 0x00000000 is typically mapped to Flash (via the SYSCFG memory remap register) or to the vector table. A read from address 0x00000000 would normally succeed (it's valid flash). However, a **write** to address 0x00000000 (Flash) would cause a bus error because Flash is not directly writable via normal store instructions.

But more importantly: **BFAR = 0x00000000 combined with a memcpy strongly suggests a NULL pointer dereference** -- specifically, memcpy is writing to (or reading from) a NULL destination/source pointer.

## 2. Root Cause Analysis

Combining all evidence:

| Evidence | Implication |
|----------|-------------|
| PRECISERR + BFARVALID | Precise bus fault -- we know the exact faulting address |
| BFAR = 0x00000000 | Access to address zero -- classic NULL pointer dereference |
| PC points to memcpy in CAN parser | memcpy's source or destination pointer is NULL |
| Intermittent (2-30 minutes) | Not a static bug -- a race condition or stale pointer that depends on timing |

### Most Likely Root Cause: Data Race on a Shared CAN Buffer Pointer

The intermittent nature is the critical clue. A simple NULL pointer bug would crash every time. The fact that it happens "randomly" after varying periods points to one of these scenarios:

**Scenario A -- Race condition between CAN RX ISR and parser task:**
The CAN receive ISR writes a message pointer or buffer, and the parser task reads it without proper synchronization. Occasionally, the task reads the pointer after it has been cleared (set to NULL) by the ISR but before the new message pointer is written. The memcpy then dereferences NULL.

**Scenario B -- Use-after-free / use-after-pool-return:**
A CAN message buffer is returned to a pool (or freed) while the parser still holds a pointer to it. The pool resets the memory (or another allocation overwrites it), and a pointer field within the message struct becomes zero. When memcpy uses that zeroed pointer, it faults.

**Scenario C -- Missing volatile or stale cached pointer:**
A pointer variable shared between the CAN ISR and the parser task is not marked `volatile` or `atomic`. The compiler caches the pointer value in a register. The ISR updates the pointer, but the task still uses the stale (possibly NULL or pre-initialization) value.

## 3. Debugging Steps

Follow this systematic workflow to identify the exact root cause.

### Step 1: Extract the Full Exception Frame

When the HardFault fires, the CPU pushes 8 registers onto the stack: R0, R1, R2, R3, R12, LR, PC, xPSR. The PC at offset 0x18 from the stack pointer tells you the exact faulting instruction.

Add this to your HardFault handler to capture the full context:

```c
void HardFault_Handler(void) {
    __asm volatile (
        "tst lr, #4          \n"  /* Test EXC_RETURN bit 2 */
        "ite eq              \n"
        "mrseq r0, msp       \n"  /* Main stack was used */
        "mrsne r0, psp       \n"  /* Process stack was used */
        "b hard_fault_handler_c \n"
    );
}

void hard_fault_handler_c(uint32_t *frame) {
    volatile uint32_t r0   = frame[0];
    volatile uint32_t r1   = frame[1];
    volatile uint32_t r2   = frame[2];
    volatile uint32_t r3   = frame[3];
    volatile uint32_t r12  = frame[4];
    volatile uint32_t lr   = frame[5];
    volatile uint32_t pc   = frame[6];  /* Faulting instruction */
    volatile uint32_t xpsr = frame[7];

    volatile uint32_t cfsr  = SCB->CFSR;
    volatile uint32_t hfsr  = SCB->HFSR;
    volatile uint32_t bfar  = SCB->BFAR;
    volatile uint32_t mmfar = SCB->MMFAR;

    /* Log all of these to UART, ITM, or NVM */
    /* Then halt for debugger or let watchdog reset */
    __BKPT(0);
    for (;;);
}
```

Since PC points into memcpy, examine R0 and R1 -- these are the `dst` and `src` arguments to memcpy on ARM (AAPCS calling convention). **One of them will be 0x00000000 or very close to it (e.g., 0x00000010 if it's a struct member offset from a NULL base pointer).**

Note: MMFAR = 0x00000010 in your capture is interesting. While MMARVALID is not set, if R0 or R1 is 0x00000000 and the memcpy is copying a struct, the fault may actually occur at offset 0x10 (16 bytes) into the copy -- this is the address 0x00000010. This would mean memcpy started copying from/to NULL and faulted when it hit offset 16. This is consistent with memcpy processing the first few bytes from address 0x00000000 (which maps to readable Flash on STM32F4) and then faulting at 0x00000010 due to a bus error on write.

**This strongly suggests the destination pointer of memcpy is NULL.**

### Step 2: Identify the NULL Pointer Source

With the stacked LR (return address), you can trace back to the caller of memcpy in your CAN parser:

```gdb
target remote :3333
file build/firmware.elf

# Use the stacked PC and LR values from the fault handler
list *<stacked_LR_value>

# This shows you the exact line in your CAN parser that called memcpy
# Examine what pointer was passed as the destination
```

Look at the CAN parser code around that call site. Identify:
1. Where does the destination buffer pointer come from?
2. Is it a pointer stored in a struct that is shared with the CAN ISR?
3. Is there a NULL check before memcpy?

### Step 3: Audit Shared State Between CAN ISR and Parser

Search for shared variables between the CAN receive path and parser:

```bash
# Find CAN ISR handlers and shared buffers
grep -rn "CAN.*IRQ\|CAN.*Callback\|HAL_CAN_RxFifo" src/ --include="*.c" --include="*.cpp"

# Find volatile-qualified variables related to CAN
grep -rn "volatile.*can\|volatile.*CAN\|volatile.*msg" src/ --include="*.c" --include="*.cpp" -i
```

Check for these specific issues:

**Missing synchronization pattern (BUG):**
```c
/* ISR writes: */
void HAL_CAN_RxFifo0MsgPendingCallback(CAN_HandleTypeDef *hcan) {
    can_msg_ptr = &rx_buffer[write_idx];  /* (1) Update pointer */
    HAL_CAN_GetRxMessage(hcan, CAN_RX_FIFO0, &rx_header, can_msg_ptr->data);
    write_idx = (write_idx + 1) % BUFFER_SIZE;
}

/* Task reads: */
void parse_can_messages(void) {
    if (read_idx != write_idx) {
        CanMsg *msg = &rx_buffer[read_idx];  /* Could be stale or NULL */
        memcpy(output.payload, msg->data, msg->len);  /* FAULT HERE if msg is bad */
    }
}
```

**The fix requires proper synchronization:**

```c
/* Option A: Use a queue (FreeRTOS) */
static QueueHandle_t can_rx_queue;

void HAL_CAN_RxFifo0MsgPendingCallback(CAN_HandleTypeDef *hcan) {
    CanMsg msg;
    HAL_CAN_GetRxMessage(hcan, CAN_RX_FIFO0, &msg.header, msg.data);
    BaseType_t woken = pdFALSE;
    xQueueSendFromISR(can_rx_queue, &msg, &woken);
    portYIELD_FROM_ISR(woken);
}

void parse_can_messages(void) {
    CanMsg msg;
    if (xQueueReceive(can_rx_queue, &msg, portMAX_DELAY) == pdTRUE) {
        /* msg is a local copy -- no race */
        if (msg.len <= MAX_PAYLOAD) {
            memcpy(output.payload, msg.data, msg.len);
        }
    }
}
```

```c
/* Option B: Lock-free SPSC ring buffer with proper memory barriers */
/* See the skill's references/memory-patterns.md for a full implementation */
```

### Step 4: Add Defensive NULL Check and Bounds Validation

Even after fixing the race, add defensive checks:

```c
bool parse_can_message(const CanMsg *msg, ParsedOutput *out) {
    if (msg == NULL || out == NULL) {
        log_error("NULL pointer in CAN parser");
        return false;
    }
    if (msg->len > MAX_CAN_PAYLOAD) {
        log_error("Invalid CAN payload length: %u", msg->len);
        return false;
    }
    memcpy(out->payload, msg->data, msg->len);
    out->payload_len = msg->len;
    return true;
}
```

### Step 5: Reproduce on Host with AddressSanitizer

Extract the CAN message parser logic (the pure computation, no HAL dependencies) and run it on PC with ASan:

```bash
gcc -fsanitize=address,undefined \
    -fno-omit-frame-pointer \
    -g -O1 \
    -o test_can_parser \
    test_can_parser_host.c \
    src/can_parser.c
```

Write test cases that simulate:
- Rapid message arrival (stress the race window)
- NULL message pointers
- Messages with len = 0, len = 8, len > 8 (invalid)
- Buffer wraparound in the ring buffer

ASan will catch any out-of-bounds access or use-after-free at the exact source line.

### Step 6: Set a GDB Watchpoint to Catch the NULL Write

If you cannot reproduce on host, use a hardware watchpoint on the pointer variable that becomes NULL:

```gdb
target remote :3333
file build/firmware.elf

# Find the address of the pointer that feeds into memcpy
print &can_msg_ptr
# Suppose it's at 0x20001234

# Watch for writes that set it to zero
watch *(uint32_t*)0x20001234
condition 1 *(uint32_t*)0x20001234 == 0

continue
# GDB will halt the instant something writes NULL to that pointer
backtrace full
```

### Step 7: Prevent Future Occurrence with MPU

Configure the MPU to make the first 32 bytes of address space (0x00000000 - 0x0000001F) inaccessible. This turns every NULL pointer dereference into an immediate MemManage fault with a clean stack trace, rather than potentially reading stale Flash data and crashing later:

```c
void mpu_configure_null_guard(void) {
    HAL_MPU_Disable();
    MPU_Region_InitTypeDef region = {
        .Enable           = MPU_REGION_ENABLE,
        .Number           = MPU_REGION_NUMBER0,
        .BaseAddress      = 0x00000000,
        .Size             = MPU_REGION_SIZE_32B,
        .SubRegionDisable = 0x00,
        .TypeExtField     = MPU_TEX_LEVEL0,
        .AccessPermission = MPU_REGION_NO_ACCESS,
        .DisableExec      = MPU_INSTRUCTION_ACCESS_DISABLE,
        .IsShareable      = MPU_ACCESS_NOT_SHAREABLE,
        .IsCacheable      = MPU_ACCESS_NOT_CACHEABLE,
        .IsBufferable     = MPU_ACCESS_NOT_BUFFERABLE,
    };
    HAL_MPU_ConfigRegion(&region);
    HAL_MPU_Enable(MPU_PRIVILEGED_DEFAULT);
}
```

## 4. Summary

| Finding | Detail |
|---------|--------|
| **Fault type** | Precise bus fault (PRECISERR), escalated to HardFault (FORCED) |
| **Faulting address** | BFAR = 0x00000000 (NULL pointer dereference) |
| **Faulting instruction** | memcpy inside CAN message parser |
| **Root cause** | A pointer passed to memcpy is NULL due to a race condition or use-after-free between the CAN RX ISR and the parser task |
| **Why intermittent** | The race window is narrow -- it only manifests when the ISR and task interleave at exactly the wrong moment |
| **Immediate fix** | Add NULL check before memcpy; validate message length |
| **Proper fix** | Replace shared buffer with a FreeRTOS queue or properly synchronized SPSC ring buffer |
| **Prevention** | Configure MPU null-pointer guard; run parser logic through ASan on host |
