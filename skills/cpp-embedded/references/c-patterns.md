# C Patterns Reference — Embedded C99/C11

## Table of Contents
1. [Memory Management in C](#1-memory-management-in-c)
2. [Static Allocation in C](#2-static-allocation-in-c)
3. [C Memory Pool](#3-c-memory-pool)
4. [Volatile and Hardware Registers in C](#4-volatile-and-hardware-registers-in-c)
5. [Error Handling in C (no exceptions)](#5-error-handling-in-c-no-exceptions)
6. [C99/C11 Useful Features](#6-c99c11-useful-features)
7. [C and C++ Interop](#7-c-and-c-interop)
8. [MISRA C Key Rules for Memory Safety](#8-misra-c-key-rules-for-memory-safety)

---

## 1. Memory Management in C

`malloc`/`free` are available in embedded C but carry the same risks as C++ `new`/`delete`:
non-deterministic timing, heap fragmentation, and no OS safety net on failure.

**Embedded rule:** Avoid `malloc`/`free` entirely in production firmware paths. Use them during
initialization only if necessary, then never again.

```c
/* BAD: malloc in a periodic task — unpredictable behavior over time */
void process_sample(void) {
    uint8_t *buf = malloc(64);   /* May fail after hours of fragmentation */
    if (!buf) return;
    /* ... */
    free(buf);
}

/* GOOD: static buffer — always available, zero allocation cost */
static uint8_t process_buf[64];

void process_sample(void) {
    /* buf is always valid, no allocation needed */
    /* ... use process_buf ... */
}
```

If you must use `malloc` during init (e.g., for third-party libraries):

```c
#include <stdlib.h>

static bool heap_locked = false;

/* Wrapper that panics if called after initialization */
void *safe_malloc(size_t size) {
    if (heap_locked) {
        /* Trap: malloc called after init — programming error */
        __BKPT(0);   /* ARM breakpoint / assert trap */
        for(;;);
    }
    void *p = malloc(size);
    if (!p) {
        for(;;);     /* Out of memory during init — unrecoverable */
    }
    return p;
}

void app_init(void) {
    /* All dynamic allocation here */
    g_state = safe_malloc(sizeof(AppState));
    heap_locked = true;  /* No more malloc after this point */
}
```

---

## 2. Static Allocation in C

Static allocation is the embedded C workhorse. Objects with `static` storage duration are
allocated by the linker and zero-initialized before `main()`.

```c
/* File-scope static: lives for entire program, zero-initialized */
static uint8_t rx_buffer[256];
static uint32_t packet_count;    /* = 0 before main() */

/* Function-scope static: initialized once, persists across calls */
uint32_t get_uptime_seconds(void) {
    static uint32_t last_tick = 0;
    static uint32_t seconds = 0;
    uint32_t now = HAL_GetTick();
    if (now - last_tick >= 1000U) {
        seconds++;
        last_tick = now;
    }
    return seconds;
}

/* Compound literals (C99): unnamed temporary aggregate */
void send_header(void) {
    /* Compound literal — stack-allocated, scope-limited */
    const PacketHeader hdr = (PacketHeader){
        .magic   = 0xDEADBEEF,
        .version = 1,
        .length  = sizeof(PacketHeader),
    };
    uart_send((const uint8_t*)&hdr, sizeof(hdr));
}

/* Fixed-size arrays with known worst case */
#define MAX_NODES 16
typedef struct { uint32_t id; float value; } Node;
static Node node_pool[MAX_NODES];
static uint8_t node_count = 0;

Node *node_alloc(void) {
    if (node_count >= MAX_NODES) return NULL;
    return &node_pool[node_count++];
}
```

---

## 3. C Memory Pool

A linked-list free pool in C. Pre-allocates N fixed-size blocks, then hands them out and returns
them in O(1). No fragmentation — all blocks are the same size.

```c
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <string.h>

#define POOL_BLOCK_SIZE  64U
#define POOL_BLOCK_COUNT 16U

typedef struct FreeNode {
    struct FreeNode *next;
} FreeNode;

typedef struct {
    uint8_t     storage[POOL_BLOCK_COUNT][POOL_BLOCK_SIZE];
    FreeNode   *head;
    uint32_t    free_count;
} MemPool;

void pool_init(MemPool *pool) {
    pool->head = NULL;
    pool->free_count = POOL_BLOCK_COUNT;
    /* Link all blocks into the free list */
    for (size_t i = 0; i < POOL_BLOCK_COUNT; i++) {
        FreeNode *node = (FreeNode *)pool->storage[i];
        node->next = pool->head;
        pool->head = node;
    }
}

void *pool_alloc(MemPool *pool) {
    if (!pool->head) return NULL;   /* Pool exhausted */
    FreeNode *block = pool->head;
    pool->head = block->next;
    pool->free_count--;
    memset(block, 0, POOL_BLOCK_SIZE);
    return block;
}

void pool_free(MemPool *pool, void *ptr) {
    if (!ptr) return;
    FreeNode *node = (FreeNode *)ptr;
    node->next = pool->head;
    pool->head = node;
    pool->free_count++;
}

/* Type-safe access macros */
#define POOL_ALLOC_AS(pool, T) ((T *)pool_alloc(pool))

/* Usage */
static MemPool msg_pool;

void app_init(void) {
    pool_init(&msg_pool);
}

void send_message(const char *text) {
    char *buf = POOL_ALLOC_AS(&msg_pool, char);
    if (!buf) return;   /* Handle pool exhaustion */
    strncpy(buf, text, POOL_BLOCK_SIZE - 1);
    uart_send_async(buf, strlen(buf));
    /* uart_send_async calls pool_free(&msg_pool, buf) on completion */
}
```

---

## 4. Volatile and Hardware Registers in C

`volatile` prevents the compiler from caching reads or optimizing away writes to hardware registers.
Without it, the compiler may read a status register once, cache it in a CPU register, and never
re-read the hardware — causing infinite loops or missed events.

```c
#include <stdint.h>

/* Method 1: typedef for clarity */
typedef volatile uint32_t reg32_t;
typedef volatile uint16_t reg16_t;
typedef volatile uint8_t  reg8_t;

/* Method 2: struct matching hardware register layout */
typedef struct {
    reg32_t SR;     /* 0x00: Status register */
    reg32_t DR;     /* 0x04: Data register */
    reg32_t BRR;    /* 0x08: Baud rate register */
    reg32_t CR1;    /* 0x0C: Control register 1 */
    reg32_t CR2;    /* 0x10: Control register 2 */
    reg32_t CR3;    /* 0x14: Control register 3 */
} UART_TypeDef;

#define USART1  ((UART_TypeDef *)0x40011000U)

/* Bit field access — use constants, not magic numbers */
#define UART_SR_RXNE  (1U << 5)   /* Receive data register not empty */
#define UART_SR_TXE   (1U << 7)   /* Transmit data register empty */
#define UART_CR1_UE   (1U << 13)  /* UART enable */

bool uart_rx_ready(void) {
    return (USART1->SR & UART_SR_RXNE) != 0U;
}

uint8_t uart_read_byte(void) {
    while (!uart_rx_ready()) {}   /* Each loop reads SR from hardware */
    return (uint8_t)(USART1->DR & 0xFFU);
}

/* Sharing data with an ISR — also needs volatile */
static volatile bool g_data_ready = false;
static volatile uint32_t g_latest_sample = 0U;

void ADC_IRQHandler(void) {
    g_latest_sample = ADC1->DR;
    g_data_ready = true;
}

uint32_t get_latest_sample(void) {
    while (!g_data_ready) {}   /* Reads g_data_ready from memory each iteration */
    g_data_ready = false;
    return g_latest_sample;
}
```

**Key rule:** Any variable written by an ISR and read by a task (or vice versa) must be `volatile`.
Any memory-mapped hardware register must be `volatile`. Forgetting this is a common source of
hard-to-reproduce bugs that disappear when you add a `printf`.

### Hardware Auto-Clear Registers (Read-to-Clear)

Many UART/SPI/I2C peripherals use **read-to-clear** (RTC) status mechanisms. The most common:
reading the Data Register (DR) automatically clears the Receive Data Register Not Empty (RXNE)
flag in the Status Register (SR). This is a hardware-level side effect — the peripheral's state
machine clears RXNE when the CPU reads DR, not through a separate write operation.

**Why this matters for ISR handlers:** In a UART RX ISR, you must read DR to retrieve the byte.
As a hardware side effect, this read clears RXNE, which in turn deasserts the interrupt request
line. If you only check SR without reading DR, the RXNE flag stays set and the ISR fires
endlessly (interrupt storm). Always explain this mechanism in UART driver code — it's a common
source of confusion for developers coming from software-only backgrounds.

```c
/* UART RX ISR — reading DR has TWO effects:
 * 1. Retrieves the received byte
 * 2. Clears the RXNE flag (hardware auto-clear on DR read)
 * Without the DR read, RXNE stays asserted → interrupt fires forever */
void USART1_IRQHandler(void) {
    if (USART1->SR & UART_SR_RXNE) {
        uint8_t byte = (uint8_t)(USART1->DR & 0xFFU);  /* Read clears RXNE */
        ring_buffer_push(&rx_buf, byte);
    }
}
```

Other common read-to-clear patterns:
- **ADC DR read** clears EOC (End of Conversion) flag
- **SPI DR read** clears RXNE; **SPI DR write** clears TXE
- **I2C SR1 read followed by DR read** clears ADDR flag (two-step clear sequence)
- **Timer SR write-0-to-clear**: Unlike UART, timer flags require writing 0 to the specific bit

---

## 5. Error Handling in C (no exceptions)

C has no exceptions. The three idiomatic patterns are: return error codes, output parameters for
results, and `errno`-style global error state.

```c
#include <stdint.h>
#include <stdbool.h>

/* Pattern 1: Return error code, pass result via pointer */
typedef enum {
    ERR_OK          = 0,
    ERR_TIMEOUT     = 1,
    ERR_CRC         = 2,
    ERR_NO_RESOURCE = 3,
    ERR_INVALID_ARG = 4,
} ErrCode;

ErrCode sensor_read(float *out_temp, float *out_humidity) {
    if (!out_temp || !out_humidity) return ERR_INVALID_ARG;
    if (!sensor_is_ready()) return ERR_TIMEOUT;

    uint16_t raw_t = sensor_read_reg(REG_TEMP);
    if (!sensor_crc_ok(raw_t)) return ERR_CRC;

    *out_temp     = convert_temp(raw_t);
    *out_humidity = convert_humidity(sensor_read_reg(REG_HUM));
    return ERR_OK;
}

/* Caller must check the return value — use [[nodiscard]] in C23 or _Pragma in some compilers */
void update_display(void) {
    float temp, hum;
    ErrCode err = sensor_read(&temp, &hum);
    if (err != ERR_OK) {
        display_error(err);
        return;
    }
    display_values(temp, hum);
}

/* Pattern 2: Boolean success with output parameter */
bool uart_read_packet(uint8_t *buf, size_t buf_len, size_t *out_len) {
    /* ... */
    if (timeout) return false;
    *out_len = received;
    return true;
}

/* Pattern 3: Errno-style (for library code) */
static ErrCode g_last_error = ERR_OK;

ErrCode get_last_error(void) { return g_last_error; }

bool spi_transfer(const uint8_t *tx, uint8_t *rx, size_t len) {
    if (!tx || !rx || !len) {
        g_last_error = ERR_INVALID_ARG;
        return false;
    }
    /* ... */
    g_last_error = ERR_OK;
    return true;
}
```

**ISR error handling:** ISRs cannot return values or block. Set a flag in a `volatile` variable
or write to a ring buffer, then let the task handle the error.

---

## 6. C99/C11 Useful Features

These features improve clarity, safety, and expressiveness in C without the overhead of C++.

### Designated Initializers (C99)

```c
typedef struct { uint32_t id; float x, y, z; uint8_t flags; } Sensor;

/* Without designated initializers: order-dependent, fragile */
Sensor s1 = {42, 1.0f, 2.0f, 3.0f, 0x01};

/* With designated initializers: order-independent, self-documenting */
Sensor s2 = {
    .id    = 42,
    .x     = 1.0f,
    .y     = 2.0f,
    .z     = 3.0f,
    .flags = 0x01,
};
/* Unspecified members are zero-initialized */
Sensor s3 = { .id = 99 };  /* x, y, z, flags all 0 */
```

### _Static_assert (C11)

Use `_Static_assert` (C11) to catch configuration errors and struct layout mistakes at compile
time rather than runtime. This is especially valuable for ring buffer sizes (must be power-of-2
for bitmask indexing) and wire-format structs (padding must not change layout). Prefer
`_Static_assert` over `#if`/`#error` because it works inside function scope, evaluates actual
`sizeof`/`_Alignof` expressions, and produces clearer diagnostics.

```c
#include <stdint.h>

/* Verify struct layout at compile time — catches accidental padding */
typedef struct { uint8_t cmd; uint16_t len; uint32_t crc; } __attribute__((packed)) PacketHeader;
_Static_assert(sizeof(PacketHeader) == 7, "PacketHeader must be 7 bytes for wire format");

/* Verify buffer sizes — essential for ring buffers using bitmask indexing */
#define UART_BUF_SIZE 256
_Static_assert((UART_BUF_SIZE & (UART_BUF_SIZE - 1)) == 0, "Buffer size must be power of 2");

/* Verify alignment for DMA buffers */
_Static_assert(_Alignof(max_align_t) >= 4, "Platform alignment insufficient for DMA");
```

When writing UART or ring buffer drivers in C99/C11, always add a `_Static_assert` to validate
that the buffer capacity is a power of 2. This catches misconfigurations at build time instead
of producing silent bugs from incorrect bitmask indexing at runtime.

### _Alignas / _Alignof (C11)

```c
#include <stdalign.h>

/* Align DMA buffer to cache line (32 bytes on Cortex-M7) */
_Alignas(32) static uint8_t dma_buf[512];

/* Check alignment of a type */
_Static_assert(_Alignof(double) == 8, "Unexpected double alignment");

/* Ensure struct member is naturally aligned */
typedef struct {
    uint8_t    cmd;
    _Alignas(4) uint32_t data;   /* Force 4-byte alignment */
} AlignedMsg;
```

### Fixed-Width Types (C99 `<stdint.h>`)

Always use these in embedded code — `int` and `long` have implementation-defined widths:

```c
#include <stdint.h>
#include <stdbool.h>   /* bool, true, false (C99) */
#include <stddef.h>    /* size_t, ptrdiff_t */

uint8_t  byte_val;     /* Exactly 8 bits, unsigned */
int16_t  adc_reading;  /* Exactly 16 bits, signed */
uint32_t timestamp_ms; /* Exactly 32 bits, unsigned */
int32_t  position_um;  /* Exactly 32 bits, signed — micrometers */

/* Minimum-width when exact is too restrictive */
uint_fast8_t  loop_counter;  /* Fastest type >= 8 bits */
uint_least16_t config_flags; /* Smallest type >= 16 bits */
```

### Flexible Array Members (C99)

```c
/* Variable-length message with inline payload */
typedef struct {
    uint16_t  msg_id;
    uint16_t  payload_len;
    uint8_t   payload[];   /* Zero-length array at end — must be last member */
} Message;

/* Allocate from pool based on actual payload size */
static uint8_t msg_storage[512];
static size_t  msg_offset = 0;

Message *msg_create(uint16_t id, const uint8_t *data, uint16_t len) {
    size_t total = sizeof(Message) + len;
    if (msg_offset + total > sizeof(msg_storage)) return NULL;
    Message *m = (Message *)&msg_storage[msg_offset];
    msg_offset += total;
    m->msg_id = id;
    m->payload_len = len;
    memcpy(m->payload, data, len);
    return m;
}
```

---

## 7. C and C++ Interop

Mixed C/C++ projects are common — HAL and RTOS headers are often C, application logic in C++.

### `extern "C"` Guards

```c
/* mylib.h — shared between C and C++ */
#ifdef __cplusplus
extern "C" {
#endif

/* All C declarations here */
typedef struct { float x, y, z; } Vec3;
void vec3_normalize(Vec3 *v);
float vec3_dot(const Vec3 *a, const Vec3 *b);

#ifdef __cplusplus
}  /* extern "C" */
#endif
```

### Calling C from C++

```cpp
// In C++ source — include the guarded C header
#include "mylib.h"   // Has extern "C" guard — works directly

void cpp_function() {
    Vec3 v = {1.0f, 2.0f, 3.0f};
    vec3_normalize(&v);          // Calls C function with C linkage
}
```

### Calling C++ from C (opaque handle pattern)

C cannot call C++ methods directly. Expose a C interface that hides the C++ object behind an opaque pointer:

```cpp
/* sensor_cpp.h — C-compatible interface to a C++ class */
#ifdef __cplusplus
extern "C" {
#endif

typedef void* SensorHandle;  /* Opaque pointer — C doesn't see the class */

SensorHandle sensor_create(uint32_t i2c_addr);
void         sensor_destroy(SensorHandle h);
int          sensor_read(SensorHandle h, float *out_temp);

#ifdef __cplusplus
}
#endif
```

```cpp
/* sensor_cpp.cpp — C++ implementation */
#include "sensor_cpp.h"
#include "MySensor.hpp"

extern "C" {
    SensorHandle sensor_create(uint32_t addr) {
        return new MySensor(addr);   /* OK here — init only */
    }
    void sensor_destroy(SensorHandle h) {
        delete static_cast<MySensor*>(h);
    }
    int sensor_read(SensorHandle h, float *out_temp) {
        return static_cast<MySensor*>(h)->read(out_temp) ? 0 : -1;
    }
}
```

```c
/* main.c — pure C caller */
#include "sensor_cpp.h"

int main(void) {
    SensorHandle s = sensor_create(0x40);
    float temp;
    if (sensor_read(s, &temp) == 0) {
        printf("Temp: %.1f\n", temp);
    }
    sensor_destroy(s);
}
```

---

## 8. MISRA C Key Rules for Memory Safety

MISRA C:2025 (published March 2025) is the current edition, covering C90/C99/C11/C18 with 225
guidelines. It retains all critical memory safety rules from MISRA C:2012. MISRA C++:2023 targets
C++17 with 179 guidelines, merging MISRA C++:2008 with AUTOSAR C++14.

The rules below are verified current in MISRA C:2025:

MISRA C is the dominant coding standard for safety-critical embedded C. These are the rules
most relevant to memory safety. Violations are bugs waiting to happen.

| Rule | Category | What it says | Why it matters |
|------|----------|--------------|----------------|
| **Rule 21.3** | Required | Do not use `<stdlib.h>` memory allocation functions (`malloc`, `calloc`, `realloc`, `free`) | Non-deterministic timing and fragmentation |
| **Rule 17.2** | Required | No recursion (direct or indirect) | Stack depth cannot be statically bounded |
| **Rule 18.6** | Required | Do not store the address of an auto variable beyond its lifetime | Dangling pointer — classic UAF bug |
| **Rule 18.4** | Advisory | Do not use `+`, `-`, `+=`, `-=` on pointer types (except array indexing) | Pointer arithmetic errors are hard to catch |
| **Rule 11.3** | Required | No casting between pointer types and non-pointer types (except `uintptr_t`) | Type-punning via casts causes UB |
| **Rule 11.4** | Advisory | Avoid casting between pointer to object and integer | Alignment and aliasing hazards |
| **Rule 14.2** | Required | `for` loop counter must not be modified in the loop body | Prevents unpredictable iteration counts |
| **Rule 15.5** | Advisory | One return per function | Simplifies static analysis of resource release |
| **Rule 22.1** | Required | All resources acquired must be released (files, mutexes, etc.) | Resource leak detection |
| **Rule 1.3** | Required | No undefined behavior | Covers all UB including signed overflow, strict aliasing |

**Variable-length arrays (VLAs) — Rule 18.8:** MISRA C bans VLAs (also banned in C11 as
optional feature). VLA size is runtime-determined, making stack usage statically unanalyzable.
Always use fixed-size arrays or pools instead:

```c
/* MISRA violation: VLA */
void process(size_t n) {
    uint8_t buf[n];   /* VLA: stack size unknown at compile time */
}

/* MISRA compliant: fixed size with bounds check */
#define MAX_PROCESS_N 128U
void process(size_t n) {
    if (n > MAX_PROCESS_N) { handle_error(); return; }
    uint8_t buf[MAX_PROCESS_N];   /* Fixed size: stack usage statically known */
}
```
