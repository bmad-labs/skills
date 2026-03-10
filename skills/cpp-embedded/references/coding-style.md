# Coding Style Reference — Embedded C and C++

## Table of Contents
1. [Naming Conventions](#1-naming-conventions)
2. [File Organization](#2-file-organization)
3. [C++ Feature Guide](#3-c-feature-guide)
4. [Include Guards](#4-include-guards)
5. [const Correctness](#5-const-correctness)
6. [Attributes and Annotations](#6-attributes-and-annotations)
7. [Struct Packing and Alignment](#7-struct-packing-and-alignment)

---

## 1. Naming Conventions

Consistency enables grep, static analysis, and code review. Embedded codebases frequently mix C
and C++ files — establish and document these conventions in your project's CONTRIBUTING.md.

| Entity | Convention | Examples |
|--------|-----------|---------|
| Local variables | `snake_case` | `byte_count`, `retry_limit`, `raw_adc` |
| Global variables | `g_snake_case` | `g_tick_count`, `g_uart_handle` |
| Function parameters | `snake_case` | `buf_len`, `out_result` |
| Functions (C and C++) | `snake_case` | `uart_send_byte()`, `compute_checksum()` |
| Member functions (C++) | `snake_case` | `sensor.read_temperature()` |
| Classes and structs | `PascalCase` | `UartManager`, `SensorReading`, `ObjectPool` |
| Constants (`constexpr`/`const`) | `kCamelCase` | `kMaxRetries`, `kUartBaudRate` |
| Macros | `UPPER_SNAKE_CASE` | `MAX_PACKET_SIZE`, `ASSERT_NOT_NULL` |
| Enum type | `PascalCase` | `ErrorCode`, `SensorState` |
| Enum values | `kPascalCase` or `UPPER_SNAKE` | `kOk`, `kTimeout` / `ERR_OK`, `ERR_TIMEOUT` |
| Member variables (C++) | `trailing_underscore_` | `size_`, `handle_`, `buf_len_` |
| Type aliases | `PascalCase` | `using Callback = void(*)(uint8_t)` |
| Namespaces | `snake_case` | `namespace hal`, `namespace bsp` |
| Files | `snake_case` | `uart_driver.cpp`, `sensor_htu21.h` |
| ISR functions | Per-vendor convention | `USART1_IRQHandler`, `DMA1_Stream0_IRQHandler` |

**Prefixing in C:** Since C has no namespaces, use module prefixes to avoid name collisions:
```c
/* uart module */
void uart_init(uint32_t baud);
bool uart_send(const uint8_t *buf, size_t len);
void uart_flush(void);

typedef struct { ... } UartConfig;    /* or uart_config_t */
```

---

## 2. File Organization

**Header files** (`.h`) — public interface:
- Type declarations (structs, enums, typedefs)
- Function declarations
- `inline` and `template` function definitions (C++)
- `constexpr` constants
- `#pragma once` or include guard
- Forward declarations to minimize includes

**Source files** (`.c`, `.cpp`) — implementation:
- `#include "module.h"` first (catches missing self-containment)
- Then system headers: `<stdint.h>`, `<stdbool.h>`, etc.
- Then project headers
- Static helper functions (not in header — reduces coupling)
- Module-private state as `static` variables

```cpp
// sensor_htu21.h — public header
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <optional>  // C++ only

struct SensorReading {
    float temperature_c;
    float humidity_pct;
};

class Htu21 {
public:
    explicit Htu21(I2C_HandleTypeDef* i2c);
    std::optional<SensorReading> read();
    bool is_ready() const;
private:
    I2C_HandleTypeDef* i2c_;
    bool initialized_{false};
};
```

```cpp
// sensor_htu21.cpp — implementation
#include "sensor_htu21.h"   // Own header first
#include <cstring>          // System headers
#include "i2c_hal.h"        // Project headers

// Private helper — not exposed in header
static float convert_temp(uint16_t raw) {
    return -46.85f + 175.72f * (raw / 65536.0f);
}

Htu21::Htu21(I2C_HandleTypeDef* i2c) : i2c_(i2c) {
    initialized_ = htu21_init(i2c_);
}
```

**Forward declarations** reduce compile-time coupling. Prefer them over includes in headers:

```cpp
// Good: forward declare instead of including the full type
class SpiDriver;   // Forward declaration
void configure_sensor(SpiDriver& driver, uint32_t freq);

// Only include SpiDriver's header in the .cpp file where it's actually used
```

---

## 3. C++ Feature Guide

The embedded C++ feature landscape is divided by two constraints: binary size and runtime
determinism. This table reflects best practices for MCUs with 64KB–2MB flash.

| Category | Use | Avoid |
|---|---|---|
| **Constants** | `constexpr`, `const` | `#define` for numeric constants |
| **Compile-time checks** | `static_assert` | Runtime assertions for compile-time-known facts |
| **Arrays** | `std::array<T, N>` | Raw C arrays (lose size info), `std::vector` |
| **String views** | `std::string_view` | `std::string` (heap allocation) |
| **Spans** | `std::span<T>` (C++20 / ETL) | Pointer + length pairs |
| **Optionals** | `std::optional<T>` | Sentinel values (`-1`, `nullptr`, `UINT32_MAX`) |
| **Polymorphism** | CRTP (static polymorphism) | `virtual` in tight control loops |
| **Smart pointers** | `std::unique_ptr` with custom deleter | `std::shared_ptr`, `std::weak_ptr` |
| **Containers** | `etl::vector<T,N>`, `etl::map<K,V,N>` | `std::vector`, `std::map`, `std::list` |
| **Strings** | `etl::string<N>` | `std::string` |
| **Lambdas** | Stateless lambdas, captures in templates | `std::function` (heap for captures) |
| **Type traits** | `<type_traits>` for compile-time introspection | `typeid`, `dynamic_cast` |
| **Initialization** | Aggregate init, designated init (C++20) | Complex constructor hierarchies |
| **Algorithms** | `<algorithm>` on `std::array` | Hand-rolled loops for common algorithms |
| **Concurrency** | `std::atomic<T>` | `std::thread`, `std::mutex` (use RTOS primitives) |
| **Error handling** | `std::optional`, error codes | Exceptions (`-fno-exceptions`) |
| **Type info** | None | RTTI, `typeid`, `dynamic_cast` (`-fno-rtti`) |
| **Exceptions** | None | `throw`, `try`, `catch` (`-fno-exceptions`) |
| **Inheritance** | Shallow (1–2 levels max) | Deep hierarchies with `virtual` at each level |
| **Templates** | For compile-time parameterization | Deeply nested template metaprogramming |
| **`new`/`delete`** | Placement new into static storage only | Heap `new`/`delete` in production paths |

**Compiler flags for ARM targets (add to CMakeLists.txt):**
```cmake
target_compile_options(firmware PRIVATE
    -fno-exceptions          # No C++ exception support — saves significant code size
    -fno-rtti                # No runtime type information — saves vtable overhead
    -fno-threadsafe-statics  # No mutex for local static init — use your own if needed
    -ffunction-sections      # Each function in its own section (enables dead-code removal)
    -fdata-sections          # Each variable in its own section
)
target_link_options(firmware PRIVATE
    -Wl,--gc-sections        # Remove unused sections — reduces binary size
)
```

---

## 4. Include Guards

**Prefer `#pragma once`** — supported by all major embedded compilers (GCC, Clang, IAR, ARMCC):

```cpp
#pragma once
// ... header content ...
```

**Use `#ifndef` guards** only for legacy compatibility or cross-platform portability where
`#pragma once` might not be supported. The guard macro must be unique — use the full path:

```c
/* For file: drivers/uart/uart_driver.h */
#ifndef DRIVERS_UART_UART_DRIVER_H_
#define DRIVERS_UART_UART_DRIVER_H_

/* ... header content ... */

#endif /* DRIVERS_UART_UART_DRIVER_H_ */
```

Never include `using namespace std;` in a header file — it pollutes every translation unit that
includes it.

---

## 5. const Correctness

`const` is not just style — it enables the compiler to enforce invariants, allows placing data
in flash (`.rodata`), and communicates intent to readers.

```cpp
// Member functions: const if they don't modify *this
class Sensor {
public:
    float read_temperature();        // Non-const: modifies internal state (triggers read)
    bool is_initialized() const;     // Const: just checks a flag
    uint32_t get_address() const;    // Const: returns stored value
};

// Parameters: const& for inputs you won't modify
void process_buffer(const uint8_t* buf, size_t len);  // buf is read-only
void fill_buffer(uint8_t* buf, size_t len, uint8_t val);  // buf is written

// Local variables: const by default, non-const only when you need to modify
void parse_frame(const uint8_t* data, size_t len) {
    const uint16_t magic = (data[0] << 8) | data[1];  // Never changes after assignment
    const size_t payload_len = len - 4;
    // ...
}

// Pointers to hardware registers — const pointer, volatile data:
volatile uint32_t* const uart_sr = reinterpret_cast<volatile uint32_t*>(0x40011000U);
// Can't point elsewhere (const pointer), but value changes (volatile data)

// const data goes to .rodata (flash on most MCUs) — saves RAM:
static const uint8_t crc_table[256] = { ... };  // Stored in flash, not RAM
```

---

## 6. Attributes and Annotations

GCC/Clang attributes control code generation and help the compiler and readers understand intent.

### C++ Standard Attributes (portable)

```cpp
// [[nodiscard]]: warn if caller discards the return value
[[nodiscard]] ErrorCode send_packet(const uint8_t* buf, size_t len);
[[nodiscard]] SensorData* pool_allocate();   // Must not ignore NULL return

// [[maybe_unused]]: suppress unused warnings for intentionally unused variables
void isr_handler([[maybe_unused]] uint32_t context) { ... }

// [[noreturn]]: function never returns (infinite loop, abort, etc.)
[[noreturn]] void fatal_error(const char* msg);

// [[deprecated]]: warn at call site
[[deprecated("Use send_packet_v2 instead")]]
void send_packet_v1(const uint8_t* buf);
```

### GCC/Clang Attributes for Embedded

```c
/* ISR decorator — saves/restores registers correctly */
void __attribute__((interrupt)) USART1_IRQHandler(void);

/* Suppress pipelining — use when processor must not reorder reads */
void __attribute__((optimize("O0"))) read_sensor_critical(void);

/* Force inline — bypass compiler's inlining heuristic */
static inline __attribute__((always_inline)) uint32_t read_reg(uint32_t addr) {
    return *(volatile uint32_t*)addr;
}

/* Prevent inlining — useful for ISRs and fault handlers */
void __attribute__((noinline)) hard_fault_handler(void);

/* Place in specific memory section */
uint8_t __attribute__((section(".ccmram"))) fast_buffer[1024];

/* Alignment */
uint8_t __attribute__((aligned(32))) dma_buffer[512];

/* Packed struct — no padding between members */
typedef struct __attribute__((packed)) {
    uint8_t  cmd;
    uint16_t len;
    uint32_t crc;
} WirePacket;   /* sizeof = 7, not 8 */

/* Weak symbol — can be overridden by application code */
__attribute__((weak)) void application_tick_hook(void) { /* default no-op */ }
```

---

## 7. Struct Packing and Alignment

The compiler inserts padding between struct members to ensure each member is naturally aligned
(address is a multiple of its size). This padding can waste RAM and cause surprises with wire
formats or memory-mapped registers.

### Natural Alignment Rules

| Type | Size | Natural alignment |
|------|------|------------------|
| `uint8_t` | 1 | 1 |
| `uint16_t` | 2 | 2 |
| `uint32_t` | 4 | 4 |
| `uint64_t` | 8 | 8 (or 4 on Cortex-M0/M3) |
| `float` | 4 | 4 |
| `double` | 8 | 8 (or 4 on Cortex-M) |
| pointer | 4 | 4 (32-bit MCU) |

### Padding Insertion

```c
struct Padded {
    uint8_t  a;    /* offset 0, size 1 */
    /* 1 byte padding here */
    uint16_t b;    /* offset 2, size 2 */
    /* 0 bytes padding */
    uint32_t c;    /* offset 4, size 4 */
    uint8_t  d;    /* offset 8, size 1 */
    /* 3 bytes padding here */
};
/* sizeof(Padded) = 12, not 8 */

/* Reorder to minimize padding: largest-to-smallest */
struct Packed {
    uint32_t c;    /* offset 0, size 4 */
    uint16_t b;    /* offset 4, size 2 */
    uint8_t  a;    /* offset 6, size 1 */
    uint8_t  d;    /* offset 7, size 1 */
};
/* sizeof(Packed) = 8 — same fields, no waste */
```

### When `__attribute__((packed))` is Appropriate

Use packed **only** for:
1. Wire format structures (network packets, serial protocols, binary file formats)
2. Memory-mapped register layouts where the hardware defines exact byte offsets
3. Shared memory structures between different processors with different alignment rules

**Do not** use packed for general-purpose data structures. Packed structures cause:
- Unaligned access traps on Cortex-M0/M0+ (no hardware unaligned support)
- Performance penalty on Cortex-M3/M4 (multi-cycle unaligned access)
- Undefined behavior if you take the address of a packed field and cast to a pointer

```c
/* Good: packed for wire format only */
typedef struct __attribute__((packed)) {
    uint8_t  sof;           /* Start of frame */
    uint16_t length;        /* Big-endian in wire format */
    uint8_t  cmd;
    uint8_t  payload[60];
    uint16_t crc;
} __attribute__((packed)) WireFrame;

/* Guard the layout — catches accidental padding */
_Static_assert(sizeof(WireFrame) == 65, "WireFrame must be exactly 65 bytes");
_Static_assert(offsetof(WireFrame, crc) == 63, "CRC must be at offset 63");
```

Always add `static_assert`/`_Static_assert` for any struct whose layout is contractually
fixed by a hardware spec or communication protocol. This catches changes immediately at compile
time rather than during integration testing.
