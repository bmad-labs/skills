# Design Patterns Reference — Embedded C/C++

## Table of Contents
1. [HAL Design Patterns](#1-hal-design-patterns)
2. [Dependency Injection Strategies](#2-dependency-injection-strategies)
3. [SOLID Principles for Embedded](#3-solid-principles-for-embedded)
4. [Key Embedded Design Patterns](#4-key-embedded-design-patterns)
5. [Callback Patterns for C/C++ Interop](#5-callback-patterns-for-cc-interop)

---

## 1. HAL Design Patterns

Ranked by suitability for embedded, best first. Hardware is known at compile time, so prefer
static dispatch over runtime polymorphism.

### 1. CRTP-Based Static HAL

Zero runtime overhead. All types resolved at compile time via the Curiously Recurring Template Pattern.

```cpp
template <typename Derived>
class UartBase {
public:
    void send(const uint8_t* data, size_t len) {
        static_cast<Derived*>(this)->do_send(data, len);
    }
    bool rx_ready() const {
        return static_cast<const Derived*>(this)->do_rx_ready();
    }
};

class Stm32Uart : public UartBase<Stm32Uart> {
    friend class UartBase<Stm32Uart>;
    void do_send(const uint8_t* data, size_t len) { /* write to USARTx->DR */ }
    bool do_rx_ready() const { return USART1->SR & USART_SR_RXNE; }
};
```

No vtable, no indirect calls. The compiler inlines everything.

**C++23 improvement:** Deducing `this` (`this auto&& self`) eliminates the CRTP boilerplate
while preserving zero-overhead static polymorphism. Use when C++23 is available.

**Don't overestimate virtual call cost** on Cortex-M3/M4 (no branch predictor penalty on simple
cores). Reserve CRTP for hot paths and ISR-adjacent code; virtual dispatch is fine for init,
configuration, and non-real-time paths.

### 2. Template-Parameterized HAL

Peripheral config as template parameters. Compile-time validation of pin assignments and clock.

```cpp
template <uint32_t BaseAddr, IRQn_Type Irq, uint32_t BaudRate>
class UartDriver {
public:
    void init() {
        auto* reg = reinterpret_cast<USART_TypeDef*>(BaseAddr);
        reg->BRR = SystemCoreClock / BaudRate;
        reg->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_UE;
        NVIC_EnableIRQ(Irq);
    }
};

using DebugUart = UartDriver<USART1_BASE, USART1_IRQn, 115200>;
```

### 3. Virtual Interface HAL

Classical DI with virtual methods. Higher overhead from vtable lookup, but enables mock testing
on a host PC.

```cpp
class IDigitalOutput {
public:
    virtual ~IDigitalOutput() = default;
    virtual void set() = 0;
    virtual void clear() = 0;
};
```

Use for non-critical paths only. Avoid in ISRs and tight loops.

### 4. Opaque Handle + extern "C"

C-compatible API hiding C++ implementation behind `void*` handles. Essential for mixed C/C++
codebases. See [Callback Patterns](#5-callback-patterns-for-cc-interop) for full example.

**Key principle:** For every HAL, write a mock that compiles on PC. This enables unit testing
without target hardware.

---

## 2. Dependency Injection Strategies

| Technique | Overhead | Flexibility | Use When |
|---|---|---|---|
| Template parameter | Zero | Compile-time only | Production drivers, HAL wrappers, hot paths |
| Link-time substitution | Zero | Per-build target | C code, swapping entire HAL implementations |
| Callback + opaque `void*` | 1 indirect call | Runtime | C/C++ interop, ISR callbacks |
| Virtual interface | vtable lookup | Full runtime | Test mocks on PC, non-critical paths only |

**Rule:** Reserve virtual interfaces for test boundaries only. In production firmware, prefer
template parameters (zero-cost) or link-time substitution (zero-cost, works with C).

### Link-Time Substitution Example

```c
/* hal_gpio.h — abstract interface */
void hal_gpio_set(uint8_t pin);
void hal_gpio_clear(uint8_t pin);

/* hal_gpio_stm32.c — production implementation, linked on target */
void hal_gpio_set(uint8_t pin) { GPIOx->BSRR = (1U << pin); }

/* hal_gpio_mock.c — mock implementation, linked on host */
static uint32_t gpio_state = 0;
void hal_gpio_set(uint8_t pin) { gpio_state |= (1U << pin); }
uint32_t mock_gpio_get_state(void) { return gpio_state; }
```

Select implementation via CMake target or build flag. No runtime cost, no code changes.

---

## 3. SOLID Principles for Embedded

| Principle | Embedded Adaptation |
|---|---|
| **SRP** | Each module owns one peripheral or one protocol. UART driver delivers bytes, protocol handler parses frames. |
| **OCP** | Extend via template parameters or compile-time config, not runtime inheritance. |
| **LSP** | Mock HAL must be substitutable for real HAL without behavioral differences (apart from actual I/O). |
| **ISP** | Keep HAL interfaces narrow. `DigitalOutput` needs only `set()`/`clear()` — don't bundle with ADC/PWM. |
| **DIP** | Application depends on HAL abstractions (template parameters), not register definitions. |

**Key constraint:** On MCUs with 16-64KB flash, over-abstraction costs more than the bugs it
prevents. Apply SOLID at module boundaries only. Three similar lines of code are better than a
premature abstraction.

---

## 4. Key Embedded Design Patterns

| Pattern | Implementation | Use Case |
|---|---|---|
| Strategy (templates) | Template param selects algorithm at compile time | Swap CRC, filter, or protocol implementation |
| Observer (callback) | `void(*cb)(void* ctx, Event e)` | ISR/event notification, driver callbacks |
| State Machine | Switch/case or table-driven; QP for complex FSMs | Protocol handling, UI, power management |
| Object Pool | Fixed-size array + free-list, RAII return via `unique_ptr` + pool deleter | Message buffers, sensor readings |
| RAII Guard | Constructor acquires, destructor releases | SPI chip select, mutex lock, interrupt disable |
| Singleton (Meyers') | `static T& instance()` with local static | Global hardware peripherals (use sparingly) |

### RAII Guard Example

```cpp
class InterruptLock {
public:
    InterruptLock()  { __disable_irq(); }
    ~InterruptLock() { __enable_irq(); }
    InterruptLock(const InterruptLock&) = delete;
    InterruptLock& operator=(const InterruptLock&) = delete;
};

void update_shared_counter() {
    InterruptLock lock;          // Interrupts disabled
    g_shared_counter++;
}                                // Interrupts re-enabled — even if early return
```

### Object Pool with RAII Return

```cpp
template <typename T, size_t N>
class Pool {
    std::array<T, N> storage_;
    std::array<bool, N> in_use_{};

    // Custom deleter — no heap, no std::function
    struct Deleter {
        Pool* pool;
        size_t index;
        void operator()(T*) { pool->in_use_[index] = false; }
    };

public:
    using Ptr = std::unique_ptr<T, Deleter>;

    Ptr acquire() {
        for (size_t i = 0; i < N; i++) {
            if (!in_use_[i]) {
                in_use_[i] = true;
                return Ptr(&storage_[i], Deleter{this, i});
            }
        }
        return Ptr(nullptr, Deleter{this, 0});
    }
};
```

**When is virtual dispatch OK?** User menus, configuration screens, logging backends — anything
at human interaction speeds where the vtable overhead is irrelevant.

---

## 5. Callback Patterns for C/C++ Interop

### Hourglass Pattern

Expose C++ classes through a thin C89 API. Three rules:

1. Classes accessible only as opaque `void*` handles.
2. Member functions exposed as `extern "C"` functions (no name mangling).
3. Any C or C++ compiler can link against the library.

```c
/* driver_api.h — C89-compatible */
typedef void* DriverHandle;
DriverHandle driver_create(uint32_t config);
int          driver_process(DriverHandle h, const uint8_t* data, size_t len);
void         driver_destroy(DriverHandle h);
```

### Callback Registration with Opaque Context

```c
typedef void (*event_callback_t)(void* context, uint32_t event_id);
void driver_register_callback(event_callback_t cb, void* context);
```

The `void* context` enables C++ member function callbacks by passing `this` as context and using
a static trampoline function. This is the standard pattern for integrating C++ with C ISR and
callback APIs.

### C++ Trampoline Pattern

```cpp
class SensorHandler {
public:
    void on_data(uint32_t event_id) { /* handle event */ }

    static void trampoline(void* ctx, uint32_t event_id) {
        static_cast<SensorHandler*>(ctx)->on_data(event_id);
    }
};

// Registration
SensorHandler handler;
driver_register_callback(SensorHandler::trampoline, &handler);
```

The trampoline is a `static` member — it has C++ linkage but no implicit `this` parameter,
making it compatible with C function pointer types. For strict C linkage, wrap it in
`extern "C"` as a free function.
