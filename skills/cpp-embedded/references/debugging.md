# Debugging Reference — Embedded C and C++

## Table of Contents
1. [Stack Overflow Diagnosis and Fix](#1-stack-overflow-diagnosis-and-fix)
2. [Heap Corruption Investigation](#2-heap-corruption-investigation)
3. [Data Race Between Task and ISR](#3-data-race-between-task-and-isr)
4. [MPU Fault Analysis on Cortex-M](#4-mpu-fault-analysis-on-cortex-m)
5. [AddressSanitizer Workflow for Host Testing](#5-addresssanitizer-workflow-for-host-testing)
6. [GDB Watchpoint Workflow](#6-gdb-watchpoint-workflow)

---

## 1. Stack Overflow Diagnosis and Fix

Stack overflows are silent killers — the MCU doesn't throw an exception, it corrupts whatever
memory sits below the stack. Symptoms: random crashes after deep call chains, corrupted global
variables, HardFaults with no obvious cause, watchdog resets after specific operations.

### Step 1: Enable Stack Canaries (FreeRTOS)

In `FreeRTOSConfig.h`:
```c
#define configCHECK_FOR_STACK_OVERFLOW  2   /* Method 2: checks canary pattern */
```

Implement the hook — this is called when overflow is detected:
```c
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    /* Log the task name to NVM or debug output before halting */
    log_fault("Stack overflow in task: %s", pcTaskName);
    taskDISABLE_INTERRUPTS();
    for(;;);   /* Halt — let watchdog reset */
}
```

### Step 2: Measure Worst-Case Stack Usage with `-fstack-usage`

Add to your CMakeLists.txt or Makefile:
```cmake
target_compile_options(firmware PRIVATE -fstack-usage)
```

This generates a `.su` file alongside each `.o` file. Each line reports worst-case stack usage
for that function. Find the deepest call chain manually or with a script:

```bash
# Find functions using more than 256 bytes of stack
grep -r " [0-9]\{4,\} " build/ --include="*.su" | sort -t' ' -k3 -rn | head -20
```

**What to look for:**
- Functions with `dynamic` or `dynamic,bounded` annotations use VLAs or `alloca` — eliminate these
- Functions with large fixed arrays on the stack — consider moving to static or using a pool

### Step 3: Add MPU Guard Region Below Stack

Configure the MPU to make the last 32 bytes (or one cache line) below the stack execute/read/write
fault. This catches the overflow at the moment it happens, giving you a HardFault with a valid PC.

```c
/* ARM Cortex-M MPU guard region — example for STM32 HAL */
void mpu_configure_stack_guard(uint32_t stack_bottom_addr) {
    MPU_Region_InitTypeDef region = {
        .Enable           = MPU_REGION_ENABLE,
        .Number           = MPU_REGION_NUMBER7,  /* Highest priority */
        .BaseAddress      = stack_bottom_addr,
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
}
```

### Step 4: Increase Stack Size

In FreeRTOS task creation:
```c
/* Increase stack depth — each unit is sizeof(StackType_t) = 4 bytes */
xTaskCreate(my_task, "MyTask", 512 /* words = 2KB */, NULL, 5, &task_handle);
```

In linker script for the MSP (main stack):
```ld
_Min_Stack_Size = 0x2000;   /* Increase from 0x400 to 0x2000 (8KB) */
```

---

## 2. Heap Corruption Investigation

Heap corruption manifests long after the corrupting write — you'll crash in `malloc`/`free` during
an integrity check, or in completely unrelated code whose data was overwritten.

**Common causes:** Writing past the end of a heap block (off-by-one), freeing a pointer twice
(double-free), using memory after `free()` (use-after-free), or freeing a stack pointer.

### Step 1: Reproduce on Host with ASan

The fastest path to finding heap corruption is running the same logic on a PC with
AddressSanitizer. See §5 for the full workflow.

### Step 2: Enable Heap Integrity Checking

Many embedded RTOSes have a heap integrity check function. Call it periodically:

```c
/* FreeRTOS heap_5.c */
void periodic_heap_check(void) {
    if (!xPortGetFreeHeapSize()) return;  /* No heap in use */
    /* If vPortGetHeapStats is available (FreeRTOS 10.4+): */
    HeapStats_t stats;
    vPortGetHeapStats(&stats);
    if (stats.xNumberOfSuccessfulAllocations == 0) return;
    /* Custom integrity walk — walk free list and check boundary tags */
}
```

### Step 3: Add Boundary Tags (Custom Allocator)

If using a custom allocator, surround each allocation with sentinel values:

```c
#define SENTINEL_VALUE 0xDEADC0DEU

typedef struct {
    uint32_t pre_sentinel;
    size_t   size;
    uint8_t  data[];      /* Flexible array member */
} AllocHeader;

typedef struct {
    uint32_t post_sentinel;
} AllocFooter;

void *debug_alloc(size_t size) {
    size_t total = sizeof(AllocHeader) + size + sizeof(AllocFooter);
    AllocHeader *hdr = malloc(total);
    if (!hdr) return NULL;

    hdr->pre_sentinel = SENTINEL_VALUE;
    hdr->size = size;

    AllocFooter *ftr = (AllocFooter *)((uint8_t *)hdr->data + size);
    ftr->post_sentinel = SENTINEL_VALUE;

    return hdr->data;
}

bool debug_check(void *ptr) {
    AllocHeader *hdr = (AllocHeader *)((uint8_t *)ptr - offsetof(AllocHeader, data));
    if (hdr->pre_sentinel != SENTINEL_VALUE) return false;  /* Pre-sentinel corrupt */
    AllocFooter *ftr = (AllocFooter *)((uint8_t *)ptr + hdr->size);
    return ftr->post_sentinel == SENTINEL_VALUE;  /* Post-sentinel check */
}
```

---

## 3. Data Race Between Task and ISR

A data race exists when two execution contexts access the same variable concurrently and at
least one access is a write, without synchronization. In embedded: ISR vs. task, or two tasks
on a multi-core MCU. Symptoms: intermittent wrong values, tearing of multi-byte fields,
non-reproducible behavior that changes with debug probes attached.

### Step 1: Identify Shared Data

Audit for variables that are:
- Written in an ISR and read in a task
- Written in a task and read in an ISR (for config/commands to ISR)
- Accessed by multiple RTOS tasks without a mutex

```bash
# Find variables marked volatile (a hint they're shared with ISRs)
grep -rn "volatile" src/ --include="*.c" --include="*.cpp"
```

Then verify each `volatile` variable is actually protected correctly.

### Step 2: Apply Atomic Access

For single variables that fit in one load/store (≤ 4 bytes on 32-bit MCU):

```c
/* C11 atomics */
#include <stdatomic.h>

static atomic_uint32_t g_sample = ATOMIC_VAR_INIT(0);

/* ISR: */
void ADC_IRQHandler(void) {
    atomic_store_explicit(&g_sample, ADC1->DR, memory_order_relaxed);
}

/* Task: */
uint32_t val = atomic_load_explicit(&g_sample, memory_order_relaxed);
```

```cpp
// C++11 atomics
#include <atomic>

static std::atomic<uint32_t> g_sample{0};

// ISR:
void ADC_IRQHandler() {
    g_sample.store(ADC1->DR, std::memory_order_relaxed);
}

// Task:
uint32_t val = g_sample.load(std::memory_order_relaxed);
```

### Step 3: Critical Section for Larger Data

For structs larger than one word, or on MCUs that don't have atomic 32-bit operations:

```c
/* ARM Cortex-M: disable/enable interrupts */
static volatile uint32_t g_timestamp;
static volatile uint16_t g_x, g_y, g_z;

/* ISR-safe write */
void update_from_isr(uint32_t ts, uint16_t x, uint16_t y, uint16_t z) {
    uint32_t primask = __get_PRIMASK();
    __disable_irq();
    g_timestamp = ts;
    g_x = x; g_y = y; g_z = z;
    __set_PRIMASK(primask);   /* Restore, not blindly re-enable */
}

/* Task-safe read */
void read_sample(uint32_t *ts, uint16_t *x, uint16_t *y, uint16_t *z) {
    uint32_t primask = __get_PRIMASK();
    __disable_irq();
    *ts = g_timestamp; *x = g_x; *y = g_y; *z = g_z;
    __set_PRIMASK(primask);
}
```

---

## 4. MPU Fault Analysis on Cortex-M

A HardFault or MemManage fault means the CPU tried to do something the MPU or bus matrix
prohibited: access a null pointer, execute from RAM when not allowed, write to read-only flash,
or overflow a protected stack guard.

### Step 1: Read the Fault Registers

The Configurable Fault Status Register (CFSR) and associated address registers tell you exactly
what happened. Read them in your fault handler:

```c
void HardFault_Handler(void) {
    volatile uint32_t cfsr  = SCB->CFSR;    /* Configurable Fault Status */
    volatile uint32_t hfsr  = SCB->HFSR;    /* HardFault Status */
    volatile uint32_t dfsr  = SCB->DFSR;    /* Debug Fault Status */
    volatile uint32_t mmfar = SCB->MMFAR;   /* MemManage Fault Address */
    volatile uint32_t bfar  = SCB->BFAR;    /* BusFault Address */

    /* CFSR bits — read the ARM TRM for full decode */
    /* CFSR[0]  IACCVIOL: instruction access violation */
    /* CFSR[1]  DACCVIOL: data access violation */
    /* CFSR[3]  MUNSTKERR: fault on exception unstack */
    /* CFSR[4]  MSTKERR: fault on exception stack */
    /* CFSR[7]  MMARVALID: MMFAR is valid */
    /* CFSR[8]  IBUSERR: instruction bus error */
    /* CFSR[9]  PRECISERR: precise data bus error — BFAR valid */
    /* CFSR[10] IMPRECISERR: imprecise data bus error */
    /* CFSR[16] UNDEFINSTR: undefined instruction */
    /* CFSR[17] INVSTATE: invalid state (e.g., bad EPSR.T bit) */
    /* CFSR[24] UNALIGNED: unaligned access */
    /* CFSR[25] DIVBYZERO: divide by zero */

    /* Log to NVM or ITM before halting */
    log_fault_registers(cfsr, hfsr, mmfar, bfar);

    for(;;);
}
```

### Step 2: Map Fault Address to Symbol in GDB

```gdb
# Connect to target with OpenOCD or J-Link GDB server
target remote :3333

# Read fault registers
p/x *(uint32_t*)0xE000ED28   # CFSR
p/x *(uint32_t*)0xE000ED34   # MMFAR
p/x *(uint32_t*)0xE000ED38   # BFAR

# Find what code/data lives at the faulting address
info symbol 0x20001234       # Map address to symbol
list *0x08003456             # Show source at PC address

# Read stacked PC from exception frame (SP + 24 on Cortex-M)
# When fault occurs, CPU pushes: r0,r1,r2,r3,r12,LR,PC,xPSR
# PC is at offset 0x18 from SP at time of fault
x/8wx $sp
```

### Step 3: Common Fault Patterns and Fixes

| CFSR bits set | What happened | Likely fix |
|---|---|---|
| DACCVIOL + MMARVALID, MMFAR = 0x00000000..0x0000001C | Null pointer dereference | Check pointer before use; enable MPU region 0 as no-access |
| DACCVIOL + MMARVALID, MMFAR below stack bottom | Stack overflow into guard | Increase stack; reduce local variable sizes |
| PRECISERR + BFARVALID | Precise bus fault | Unaligned access or invalid peripheral address |
| UNDEFINSTR | Executed invalid opcode | Corrupted function pointer, missing `thumb` bit, or executing data |
| INVSTATE | Invalid processor state | Function pointer missing Thumb bit (LSB must be 1 for Thumb) |

---

## 5. AddressSanitizer Workflow for Host Testing

ASan catches memory errors at the moment they happen — not when symptoms appear later.
The trick: compile your embedded business logic for the host PC (no HAL/RTOS dependencies)
and run it with ASan. This finds 80% of memory bugs without needing the target hardware.

### Step 1: Isolate Business Logic

Factor out pure computation from hardware I/O. The pure functions can run on PC:

```c
/* Pure function — no HAL, no registers, testable on PC */
bool parse_packet(const uint8_t *buf, size_t len, ParsedPacket *out) {
    if (len < sizeof(PacketHeader)) return false;
    const PacketHeader *hdr = (const PacketHeader *)buf;
    if (hdr->magic != MAGIC_VALUE) return false;
    if (hdr->payload_len > len - sizeof(PacketHeader)) return false;
    out->cmd = hdr->cmd;
    memcpy(out->payload, buf + sizeof(PacketHeader), hdr->payload_len);
    out->payload_len = hdr->payload_len;
    return true;
}
```

### Step 2: Build for Host with ASan

```bash
# GCC or Clang — add both ASan and UBSan for maximum coverage
gcc -fsanitize=address,undefined \
    -fno-omit-frame-pointer \
    -g -O1 \
    -o test_parser \
    test_parser_host.c \
    src/parser.c

# Run — any memory error prints a detailed report and exits non-zero
./test_parser
```

### Step 3: Interpret ASan Output

```
==12345==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x60200000ef74
READ of size 4 at 0x60200000ef74 thread T0
    #0 0x401234 in parse_packet src/parser.c:42
    #1 0x401890 in main test_parser_host.c:15

0x60200000ef74 is located 0 bytes to the right of 128-byte region [0x60200000ef74,0x60200000eff4)
allocated by thread T0 here:
    #0 0x7f... in malloc
    #1 0x401800 in main test_parser_host.c:10
```

The report tells you: what type of error, which line caused it, and what the allocation was.
Go directly to `parser.c:42` — that's the corrupting access.

### Step 4: Common ASan Findings Relevant to Embedded

| ASan error | Embedded implication |
|---|---|
| `heap-buffer-overflow` | Same bug exists in pool/arena — fix the bounds logic |
| `use-after-free` | In embedded: use-after-pool-return; add ownership tracking |
| `stack-buffer-overflow` | Real stack overflow risk on target; increase buffer size |
| `global-buffer-overflow` | Off-by-one on static array; fix bounds check |
| UBSan: `signed-integer-overflow` | Undefined behavior; use unsigned arithmetic or explicit check |
| UBSan: `misaligned-address` | Will trap on Cortex-M0 (no unaligned access); fix alignment |

---

## 6. GDB Watchpoint Workflow

A watchpoint halts execution the moment a specific memory address is read or written. This is
the most direct way to catch "who is writing to this variable" without modifying any code.

### Step 1: Connect and Identify the Address

```gdb
# Connect via OpenOCD
target remote localhost:3333

# Load symbols (if not already)
file build/firmware.elf

# Find the address of the corrupted variable
print &g_corrupted_counter
# Output: $1 = (volatile uint32_t *) 0x20001234
```

### Step 2: Set a Watchpoint

```gdb
# Hardware watchpoint — pauses on any WRITE to this address
watch *(uint32_t*)0x20001234

# Hardware watchpoint — pauses on any READ
rwatch *(uint32_t*)0x20001234

# Hardware watchpoint — pauses on read OR write
awatch *(uint32_t*)0x20001234

# Resume execution — it will stop at the corrupting write
continue
```

### Step 3: Capture the Corrupting Write

When GDB halts at the watchpoint:

```gdb
# Show what value was written (old and new)
# GDB output: Old value = 1234, New value = 0xDEADBEEF

# Show the full call stack at the moment of the write
backtrace full

# Inspect local variables in each frame
frame 2
info locals

# Show the instruction that wrote the value
x/4i $pc-8
```

### Hardware vs. Software Watchpoints

**Hardware watchpoints** (limited number — typically 2–4 on Cortex-M):
- No performance overhead
- Stop at the exact instruction
- Set with `watch`, `rwatch`, `awatch`

**Software watchpoints** (unlimited, but slow):
- GDB single-steps through every instruction — very slow on target
- Use only if you've exhausted hardware watchpoints
- Consider narrowing the suspect code first (binary search with `break` statements)

**Cortex-M watchpoint tip:** If the corruption happens inside an ISR and GDB doesn't catch it
(some debug configurations don't halt in ISRs), enable ITM/DWT data tracing instead:

```c
/* Enable DWT comparator 0 to watch address 0x20001234 */
CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
DWT->COMP0 = 0x20001234U;
DWT->MASK0 = 0U;              /* Watch exact address, no mask */
DWT->FUNCTION0 = 0x6U;       /* Watch for write access */
```

This will trigger a DebugMonitor exception on write, which you can handle to log the PC.
