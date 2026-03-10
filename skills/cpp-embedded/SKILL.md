---
name: cpp-embedded
description: >
  Expert guidance for writing C (C99/C11) and C++ (C++17) code for embedded systems and microcontrollers.
  Use this skill whenever the user is working with: STM32, ESP32, Arduino, PIC, AVR, nRF52, or any other MCU;
  FreeRTOS, Zephyr, ThreadX, or any RTOS; bare-metal firmware; hardware registers, DMA, interrupts, or
  memory-mapped I/O; memory pools, allocators, or fixed-size buffers; MISRA C or MISRA C++ compliance;
  smart pointers or RAII in embedded contexts; stack vs heap decisions; placement new; volatile correctness;
  alignment and struct packing; C99/C11 patterns; C and C++ interoperability; or debugging firmware crashes,
  HardFaults, stack overflows, or heap corruption. Also trigger on implicit cues like "my MCU keeps crashing",
  "writing firmware", "ISR safe", "embedded allocator", or "no dynamic memory".
---

# Embedded C and C++ Skill

> **Quick navigation**
> - Memory patterns and full code examples → `references/memory-patterns.md`
> - C99/C11 specific patterns and idioms → `references/c-patterns.md`
> - Debugging workflows (stack overflow, heap corruption, HardFault) → `references/debugging.md`
> - Coding style and conventions → `references/coding-style.md`

---

## Embedded Memory Mindset

Embedded systems have no OS safety net. A bad pointer dereference doesn't produce a polite segfault — it
silently corrupts memory, triggers a HardFault hours later, or hangs in an ISR. The stakes of every
allocation decision are higher than in hosted environments.

Three principles govern embedded memory:

**Determinism over convenience.** Dynamic allocation (malloc/new) is non-deterministic in both time and
failure mode. MISRA C 2012 Rule 21.3 and MISRA C++ Rule 18-4-1 ban dynamic memory after initialization.
Even outside MISRA, avoid heap allocation in production paths.

**Size is known at compile time.** Embedded software has a fixed maximum number of each object type.
Design around this. If you need 8 UART message buffers, declare 8 at compile time. Don't discover the
maximum at runtime.

**ISRs are sacred ground.** Never allocate, never block, never call non-reentrant functions from an ISR.
Keep ISRs minimal — set a flag or write to a ring buffer, then do the real work in a task.

---

## Allocation Decision Table

| Need | Solution | Notes |
|------|----------|-------|
| Short-lived local data | Stack | Keep < 256 bytes per frame; profile with `-fstack-usage` |
| Fixed singleton objects | `static` at file or function scope | Zero-initialized before `main()` |
| Fixed array of objects | Object pool (`ObjectPool<T, N>`) | O(1) alloc/free, no fragmentation |
| Temporary scratch space | Arena / bump allocator | Reset whole arena at end of operation |
| Variable-size messages | Ring buffer of fixed-size slots | Simplest ISR-safe comms pattern |
| Custom lifetime control | Placement new + static storage | Full control, no heap involvement |
| **Never in ISR** | Any of the above except stack | Allocator calls are not ISR-safe |
| **Avoid entirely** | `malloc`/`new` / `std::vector` | Non-deterministic; fragmentation risk |

---

## Critical Patterns

### RAII Resource Guard

Acquire on construction, release on destruction. Guarantees release even through early returns or exceptions
(if using exceptions — rare in embedded, but possible in C++ environments that allow them).

```cpp
class SpiGuard {
public:
    explicit SpiGuard(SPI_HandleTypeDef* spi) : spi_(spi) {
        HAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_RESET);
    }
    ~SpiGuard() {
        HAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_SET);
    }
    // Non-copyable, non-movable — guard is tied to this scope
    SpiGuard(const SpiGuard&) = delete;
    SpiGuard& operator=(const SpiGuard&) = delete;
private:
    SPI_HandleTypeDef* spi_;
};

// Usage: CS deasserts automatically at end of scope
void read_sensor() {
    SpiGuard guard(&hspi1);
    // ... transfer bytes ...
}  // CS deasserts here
```

### Static Object Pool

Pre-allocates N objects of type T with O(1) alloc/free and no heap involvement.
Read `references/memory-patterns.md` §1 for the full arena allocator and §2 for CRTP patterns.

```cpp
template<typename T, size_t N>
class ObjectPool {
public:
    template<typename... Args>
    T* allocate(Args&&... args) {
        for (auto& slot : slots_) {
            if (!slot.used) {
                slot.used = true;
                return new (&slot.storage) T(std::forward<Args>(args)...);
            }
        }
        return nullptr;  // Pool exhausted — handle at call site
    }

    void free(T* obj) {
        obj->~T();
        for (auto& slot : slots_) {
            if (reinterpret_cast<T*>(&slot.storage) == obj) {
                slot.used = false;
                return;
            }
        }
    }

private:
    struct Slot {
        alignas(T) std::byte storage[sizeof(T)];
        bool used = false;
    };
    Slot slots_[N]{};
};
```

### Volatile Hardware Register Access

`volatile` tells the compiler the value can change outside its knowledge (hardware can write it).
Without `volatile`, the compiler may cache the read in a register and never see the hardware update.

```cpp
// Define register layout matching the hardware manual
struct UartRegisters {
    volatile uint32_t SR;   // Status register
    volatile uint32_t DR;   // Data register
    volatile uint32_t BRR;  // Baud rate register
    volatile uint32_t CR1;  // Control register 1
};

// Map to the hardware base address
auto* uart = reinterpret_cast<UartRegisters*>(0x40011000U);

// Read status — volatile ensures each read hits the hardware
if (uart->SR & (1U << 5)) {   // RXNE bit
    uint8_t byte = static_cast<uint8_t>(uart->DR);
}
```

### Interrupt-Safe Access

Sharing data between an ISR and a task requires either a critical section or `std::atomic`.
Use atomics when the type fits in a single load/store (usually ≤ pointer size). Use critical sections
for larger structures.

```cpp
#include <atomic>

// Atomic: ISR and task can access without disabling interrupts
std::atomic<uint32_t> adc_value{0};

// In ISR:
void ADC_IRQHandler() {
    adc_value.store(ADC1->DR, std::memory_order_relaxed);
}

// In task:
uint32_t val = adc_value.load(std::memory_order_relaxed);

// Critical section for larger structures (ARM Cortex-M):
struct SensorFrame { uint32_t timestamp; int16_t x, y, z; };
volatile SensorFrame latest_frame{};

void update_frame_from_isr(const SensorFrame& f) {
    __disable_irq();
    latest_frame = f;
    __enable_irq();
}
```

---

## Smart Pointer Policy

| Pointer type | Use in embedded? | Guidance |
|---|---|---|
| Raw pointer (observing) | Yes | For non-owning references; make ownership explicit in naming |
| Raw pointer (owning) | Carefully | Only into static/pool storage where lifetime is obvious |
| `std::unique_ptr` | Yes, with care | Zero overhead; use with custom deleters for pool objects |
| `std::unique_ptr` + custom deleter | Yes | Returns pool objects to their pool on destruction |
| `std::shared_ptr` | Avoid | Reference counting uses heap and is non-deterministic |
| `std::weak_ptr` | Avoid | Tied to `shared_ptr`; same concerns |

```cpp
// unique_ptr with pool deleter — zero heap, automatic return to pool
ObjectPool<SensorData, 8> sensor_pool;

auto deleter = [](SensorData* p) { sensor_pool.free(p); };
using PooledSensor = std::unique_ptr<SensorData, decltype(deleter)>;

PooledSensor acquire_sensor() {
    return PooledSensor(sensor_pool.allocate(), deleter);
}
```

---

## Compile-Time Preferences

Prefer compile-time computation and verification over runtime checks:

```cpp
// constexpr: computed at compile time, no runtime cost
constexpr uint32_t BAUD_DIVISOR = PCLK_FREQ / (16U * TARGET_BAUD);
static_assert(BAUD_DIVISOR > 0 && BAUD_DIVISOR < 65536, "Baud divisor out of range");

// std::array: bounds info preserved, unlike raw arrays
std::array<uint8_t, 64> tx_buffer{};

// std::span: non-owning view, no allocation, C++20 but often available via ETL
// std::string_view: for string literals and buffers, no heap

// CRTP replaces virtual dispatch — zero runtime overhead
// See references/memory-patterns.md §2 for full example
```

**C++ features to avoid in embedded:**

| Avoid | Reason | Alternative |
|---|---|---|
| `-fexceptions` | Code size, non-deterministic stack unwind | `std::optional`, error codes |
| `-frtti` / `typeid` / `dynamic_cast` | Runtime type tables increase ROM | CRTP, explicit type tags |
| `std::vector`, `std::string`, `std::map` | Heap allocation | `std::array`, ETL containers |
| `std::thread` | Requires OS primitives | RTOS tasks |
| `std::function` | Heap allocation for captures | Function pointers, templates |
| Virtual destructors in deep hierarchies | vtable size, indirect dispatch | CRTP or flat hierarchies |

Compile with `-fno-exceptions -fno-rtti` for ARM targets. Use the [Embedded Template Library (ETL)](https://www.etlcpp.com)
for fixed-size `etl::vector`, `etl::map`, `etl::string` alternatives.

---

## Common Memory Bug Diagnosis

| Symptom | Likely cause | First action |
|---|---|---|
| Crash after N hours of uptime | Heap fragmentation | Switch to pools; audit all `malloc`/`new` calls |
| HardFault with BFAR valid | Null/wild pointer dereference | Read CFSR; check BFAR in GDB; see `references/debugging.md` §4 |
| Stack pointer in wrong region | Stack overflow | Check `.su` files; add MPU guard region; see `references/debugging.md` §1 |
| ISR data looks stale | Missing `volatile` | Add `volatile` to shared variables; audit ISR data paths |
| Random corruption near ISR | Data race | Apply atomics or critical section; see `references/debugging.md` §3 |
| Use-after-free | Object returned to pool while still referenced | Verify no aliasing; use unique_ptr with pool deleter |
| MPU fault in task | Task overflowed its stack into neighboring region | Increase stack size or reduce frame depth |
| Uninitialized read | Local variable used before assignment | Enable `-Wuninitialized`; initialize all locals |

---

## Debugging Tools Decision Tree

```
Is the bug reproducible on a host (PC)?
├── YES → Use AddressSanitizer (ASan) + Valgrind
│         Compile embedded logic for PC with -fsanitize=address
│         See references/debugging.md §5
└── NO  → Is it a memory layout/access issue?
          ├── YES → Enable MPU; add stack canaries; read CFSR on fault
          │         See references/debugging.md §1, §4
          └── NO  → Is it a data-race between ISR and task?
                    ├── YES → Audit shared state; apply atomics/critical section
                    │         See references/debugging.md §3
                    └── NO  → Use GDB watchpoint on the corrupted address
                              See references/debugging.md §6
```

Static analysis: run `clang-tidy` with `clang-analyzer-*` and `cppcoreguidelines-*` checks.
Run `cppcheck --enable=all` for C code. Both catch many issues before target hardware.

---

## Error Handling Philosophy

Three patterns, each for a distinct failure category:

**Recoverable errors** — use `std::optional` or `std::expected` (C++23, or a polyfill):
```cpp
std::optional<SensorReading> read_sensor() {
    if (!sensor_ready()) return std::nullopt;
    return SensorReading{.temp = read_temp(), .humidity = read_humidity()};
}

// Caller:
if (auto reading = read_sensor()) {
    process(*reading);
} else {
    log_warning("Sensor not ready");
}
```

**Programming errors** — use `assert` or a trap that halts with debug info:
```cpp
void write_to_pool(uint8_t* buf, size_t len) {
    assert(buf != nullptr);
    assert(len <= MAX_PACKET_SIZE);  // Trips in debug, removed in release with NDEBUG
    // ...
}
```

**Unrecoverable runtime errors** — let the watchdog reset the system. Log the fault reason to
non-volatile memory (flash/EEPROM) first if possible, then spin or trigger a software reset.

---

## Coding Conventions Summary

See `references/coding-style.md` for the full guide. Key rules:

- **Variables and functions**: `snake_case`
- **Classes and structs**: `PascalCase`
- **Constants**: `kConstantName` (Google style) or `ALL_CAPS` for macros
- **Member variables**: `trailing_underscore_`
- **Include guards**: `#pragma once` (prefer) or `#ifndef HEADER_H_` guard
- **const correctness**: const every non-mutating method, const every parameter that isn't modified
- **`[[nodiscard]]`**: on any function whose return value must not be silently dropped (error codes, pool allocate)

---

## Reference File Index

| File | Read when |
|---|---|
| `references/memory-patterns.md` | Implementing arena, ring buffer, DMA buffers, lock-free SPSC, singletons, linker sections |
| `references/c-patterns.md` | Writing C99/C11 firmware, C memory pools, C error handling, C/C++ interop, MISRA C rules |
| `references/debugging.md` | Diagnosing stack overflow, heap corruption, HardFault, data races, or running ASan/GDB |
| `references/coding-style.md` | Naming conventions, feature usage table, struct packing, attributes, include guards |
