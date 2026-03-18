# Desktop C++ to STM32H7 Migration Guide

## Target Constraints

| Resource | Available | Practical Budget |
|---|---|---|
| Flash | 2 MB | ~1.8 MB (90% gate) |
| RAM | 1 MB total (128K DTCM + 512K AXI SRAM + 64K SRAM4 + others) | ~800 KB (80% gate) |
| Stack per task | Typically 1-8 KB per FreeRTOS task | Profile with `-fstack-usage` |
| Heap | Avoid entirely after init | Use pools, arenas, static allocation |

## Step 0: Compiler Flags -- Disable What You Cannot Afford

Before touching any code, set your compiler flags. These disable the two most expensive C++ runtime features:

```cmake
# CMakeLists.txt or in your arm-none-eabi toolchain file
target_compile_options(firmware PRIVATE
    -fno-exceptions      # Saves 10-30% flash; removes unwind tables
    -fno-rtti            # Removes runtime type info tables from ROM
    -fstack-usage        # Generates .su files for stack analysis
    -Wall -Wextra -Werror
)
target_link_options(firmware PRIVATE
    -Wl,--gc-sections    # Remove unused code/data sections
    -Wl,--print-memory-usage
)
```

With `-fno-exceptions` and `-fno-rtti`, **all six** of your desktop patterns need replacement. Here is each one, with concrete before/after code.

---

## Migration 1: `std::vector` --> Fixed-Capacity Containers

### The Problem

`std::vector` heap-allocates on every `push_back` that exceeds capacity. On a device with no MMU and 1 MB RAM, this produces fragmentation that crashes the system after hours of uptime. MISRA C++ Rule 21.6.1 bans dynamic memory after initialization for exactly this reason.

### Replacement: ETL `etl::vector<T, N>` or `std::array<T, N>`

**Option A: Drop-in replacement with ETL (recommended when size varies at runtime)**

```cpp
// BEFORE (desktop)
#include <vector>

std::vector<SensorReading> readings;

void collect() {
    readings.push_back(read_sensor());  // heap alloc on growth
    if (readings.size() > 100) {
        readings.erase(readings.begin());  // heap shuffle
    }
}

// AFTER (embedded) -- ETL fixed-capacity vector, zero heap
#include <etl/vector.h>

etl::vector<SensorReading, 100> readings;  // 100 elements max, stack/static

void collect() {
    if (readings.full()) {
        readings.erase(readings.begin());  // no heap, shifts in-place
    }
    readings.push_back(read_sensor());     // no allocation ever
}
```

ETL vectors have the same API as `std::vector` (iterators, `push_back`, `erase`, `operator[]`), but the capacity is fixed at compile time. No heap allocation, no fragmentation.

**Option B: `std::array` when size is fully known at compile time**

```cpp
// BEFORE
std::vector<uint8_t> tx_buffer(256);

// AFTER -- compile-time size, zero overhead
std::array<uint8_t, 256> tx_buffer{};
```

**Option C: Static object pool when elements are allocated/freed independently**

```cpp
// BEFORE
std::vector<Message*> active_messages;
// ... new Message() scattered throughout code ...

// AFTER -- object pool with O(1) alloc/free, no heap
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
        return nullptr;  // Pool exhausted -- handle at call site
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

// Usage
ObjectPool<Message, 32> message_pool;

Message* msg = message_pool.allocate(/* args */);
if (!msg) { /* handle pool exhaustion */ }
// ... use msg ...
message_pool.free(msg);
```

### Decision Table

| Desktop pattern | Elements fixed? | Elements allocated/freed? | Embedded replacement |
|---|---|---|---|
| `vector<T>` as fixed buffer | Yes | No | `std::array<T, N>` |
| `vector<T>` with dynamic size | Max known | No | `etl::vector<T, N>` |
| `vector<T*>` with `new`/`delete` | Max known | Yes | `ObjectPool<T, N>` |

---

## Migration 2: `std::string` --> Fixed-Capacity Strings

### The Problem

Every `std::string` operation (`+`, `+=`, `substr`, `c_str()` copy) can heap-allocate. In a loop running at any meaningful frequency, this fragments the heap rapidly.

### Replacement: `etl::string<N>` or `char[]` + `snprintf`

**Option A: ETL string (API-compatible with `std::string`)**

```cpp
// BEFORE
#include <string>

std::string build_response(int code, const std::string& body) {
    return "HTTP/1.1 " + std::to_string(code) + "\r\n\r\n" + body;
    // 4+ heap allocations in one line
}

// AFTER -- fixed buffer, zero heap
#include <etl/string.h>
#include <etl/to_string.h>

etl::string<256> build_response(int code, const etl::string_view& body) {
    etl::string<256> response;
    response = "HTTP/1.1 ";
    etl::to_string(code, response, true);  // append mode
    response += "\r\n\r\n";
    response += body;
    return response;  // no heap, 256 bytes on stack
}
```

**Option B: `char[]` + `snprintf` (most efficient, C-compatible)**

```cpp
// BEFORE
std::string format_json(float temp, float humidity) {
    return "{\"temp\":" + std::to_string(temp) +
           ",\"hum\":" + std::to_string(humidity) + "}";
}

// AFTER -- zero heap, deterministic
void format_json(float temp, float humidity, char* buf, size_t buf_len) {
    snprintf(buf, buf_len, "{\"temp\":%.1f,\"hum\":%.1f}", temp, humidity);
}

// Caller:
char json[128];
format_json(22.5f, 45.0f, json, sizeof(json));
```

**Option C: `std::string_view` for read-only string references (C++17, no allocation)**

```cpp
// BEFORE -- copies string on every call
void log_message(const std::string& msg);

// AFTER -- zero-copy view, no allocation
void log_message(std::string_view msg);

// Works with string literals, char arrays, etl::string, etc.
log_message("sensor timeout");           // string literal -- zero copy
log_message(std::string_view(buf, len)); // buffer -- zero copy
```

---

## Migration 3: `std::shared_ptr` --> `std::unique_ptr` with Pool Deleter or Raw Observing Pointers

### The Problem

`std::shared_ptr` allocates a control block on the heap (for the reference count) and uses atomic reference counting on every copy/destroy. On a single-core Cortex-M7, the atomics are unnecessary overhead, and the heap allocation violates determinism.

### Replacement Strategy

| Desktop pattern | Embedded replacement |
|---|---|
| `shared_ptr` for shared ownership | Redesign to single owner with `unique_ptr` |
| `shared_ptr` passed to multiple readers | `unique_ptr` owner + raw observing pointers |
| `shared_ptr` custom deleter | `unique_ptr` with pool deleter |
| `weak_ptr` for break cycles | Raw pointer with explicit lifetime management |

**Single owner + observers (most common case):**

```cpp
// BEFORE
class SensorHub {
    std::shared_ptr<Calibration> calibration_;
    // ... passed to multiple subsystems that read it
};

// AFTER -- one owner, others observe via raw pointer
class SensorHub {
    // Calibration lives in a static pool -- no heap
    static ObjectPool<Calibration, 4> cal_pool_;

    // unique_ptr with custom deleter returns to pool on destruction
    struct CalDeleter {
        void operator()(Calibration* p) { cal_pool_.free(p); }
    };
    using CalPtr = std::unique_ptr<Calibration, CalDeleter>;

    CalPtr calibration_;  // OWNS the calibration

public:
    // Observers get a raw pointer -- non-owning, no ref count
    Calibration* get_calibration() { return calibration_.get(); }
};

// Subsystems store a raw pointer (non-owning):
class TempSensor {
    Calibration* cal_;  // does NOT own; SensorHub manages lifetime
public:
    explicit TempSensor(Calibration* cal) : cal_(cal) {}
    float read() { return raw_read() * cal_->scale + cal_->offset; }
};
```

**Pool-backed `unique_ptr` with automatic return:**

```cpp
// Pool with RAII return -- object automatically returns to pool when
// unique_ptr goes out of scope
template <typename T, size_t N>
class Pool {
    std::array<T, N> storage_;
    std::array<bool, N> in_use_{};

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

// Usage:
Pool<DmaTransaction, 8> dma_pool;

void start_transfer() {
    auto txn = dma_pool.acquire();
    if (!txn) { /* pool exhausted */ return; }
    txn->setup(/* ... */);
    // txn automatically returned to pool when it goes out of scope
}
```

---

## Migration 4: Virtual Functions --> CRTP Static Polymorphism

### The Problem

Virtual functions have three costs: a vtable pointer in every object (4-8 bytes), an indirect call on every invocation (pipeline flush on simpler cores), and the compiler cannot inline through virtual dispatch. For hot paths (control loops, ISR callbacks, signal processing), this matters.

**However:** On Cortex-M7 (which the STM32H7 uses), virtual call overhead is modest due to the branch predictor. Reserve CRTP for hot paths; virtual dispatch is acceptable for init, configuration, and UI code.

### Replacement: CRTP (Curiously Recurring Template Pattern)

```cpp
// BEFORE -- virtual dispatch
class Sensor {
public:
    virtual ~Sensor() = default;
    virtual float read() = 0;
    virtual void calibrate() = 0;
};

class TemperatureSensor : public Sensor {
public:
    float read() override { return read_adc() * 0.0625f; }
    void calibrate() override { offset_ = read_reference(); }
private:
    float offset_ = 0.0f;
};

class PressureSensor : public Sensor {
public:
    float read() override { return read_baro() * 0.01f; }
    void calibrate() override { /* ... */ }
};

// Caller uses pointer-to-base -- vtable dispatch
void poll_sensor(Sensor& s) {
    float v = s.read();  // indirect call
}

// AFTER -- CRTP, zero overhead
template<typename Derived>
class SensorBase {
public:
    float read() {
        return static_cast<Derived*>(this)->read_impl();
    }
    void calibrate() {
        static_cast<Derived*>(this)->calibrate_impl();
    }
};

class TemperatureSensor : public SensorBase<TemperatureSensor> {
    friend class SensorBase<TemperatureSensor>;
    float read_impl() { return read_adc() * 0.0625f; }
    void calibrate_impl() { offset_ = read_reference(); }
    float offset_ = 0.0f;
};

class PressureSensor : public SensorBase<PressureSensor> {
    friend class SensorBase<PressureSensor>;
    float read_impl() { return read_baro() * 0.01f; }
    void calibrate_impl() { /* ... */ }
};

// Caller is templated -- compiler inlines everything
template<typename S>
void poll_sensor(S& sensor) {
    float v = sensor.read();  // direct call, fully inlined
}
```

**When you need heterogeneous collections** (storing different sensor types in one array), use a variant or type-erased approach instead of virtual:

```cpp
#include <variant>

using AnySensor = std::variant<TemperatureSensor, PressureSensor>;

std::array<AnySensor, 8> sensors;

void poll_all() {
    for (auto& s : sensors) {
        float v = std::visit([](auto& sensor) { return sensor.read(); }, s);
        process(v);
    }
}
```

`std::variant` stores the largest type inline (no heap) and uses a compile-time dispatch table.

### When Virtual Is Still OK

- Initialization and configuration code (runs once)
- User interface / menu systems (human-speed interaction)
- Logging backends (not in the critical path)
- Hierarchies with 2 levels or fewer and infrequent calls

---

## Migration 5: Exceptions --> Error Codes, `std::optional`, `std::expected`

### The Problem

With `-fno-exceptions` (which you must use), `throw` and `try/catch` are unavailable. Even if you enabled them, exceptions add 10-30% code size from unwind tables and have non-deterministic stack usage during unwinding.

### Replacement: Three-Tier Error Handling

**Tier 1: `std::optional<T>` -- "value or nothing"**

```cpp
// BEFORE
float read_temperature() {
    if (!sensor_ready()) throw SensorException("not ready");
    return raw_read() * scale_;
}

// Caller:
try {
    float t = read_temperature();
    display(t);
} catch (const SensorException& e) {
    show_error(e.what());
}

// AFTER -- std::optional (C++17, no heap, no exceptions)
[[nodiscard]] std::optional<float> read_temperature() {
    if (!sensor_ready()) return std::nullopt;
    return raw_read() * scale_;
}

// Caller is forced to handle the empty case:
if (auto t = read_temperature()) {
    display(*t);
} else {
    show_error(ErrorCode::SensorNotReady);
}
```

**Tier 2: `std::expected<T, E>` -- "value or error reason" (C++23 or polyfill)**

Use `tl::expected` or `etl::expected` as a header-only C++17 polyfill:

```cpp
// BEFORE
Config parse_config(const uint8_t* data, size_t len) {
    if (len < sizeof(ConfigHeader))
        throw ParseError("too short");
    if (!verify_crc(data, len))
        throw ParseError("CRC mismatch");
    return decode(data);
}

// AFTER -- expected with typed error
enum class ParseError : uint8_t { too_short, crc_fail, bad_version };

[[nodiscard]] std::expected<Config, ParseError>
parse_config(const uint8_t* data, size_t len) {
    if (len < sizeof(ConfigHeader))
        return std::unexpected(ParseError::too_short);
    if (!verify_crc(data, len))
        return std::unexpected(ParseError::crc_fail);
    return decode(data);
}

// Caller:
auto result = parse_config(buf, len);
if (result) {
    apply_config(*result);
} else {
    log_error("Config parse failed: %d", static_cast<int>(result.error()));
    use_default_config();
}
```

**Tier 3: `assert` / trap for programming errors (bugs, not runtime conditions)**

```cpp
void write_register(uint8_t reg, uint32_t value) {
    assert(reg < NUM_REGISTERS);  // Bug if violated -- trips in debug
    registers_[reg] = value;
}
```

### Migration Table

| Exception pattern | Embedded replacement |
|---|---|
| `throw` on invalid input | Return `std::expected<T, Error>` |
| `throw` on "not found" | Return `std::optional<T>` |
| `throw` on bug (null ptr, out-of-range) | `assert()` -- removed in release with NDEBUG |
| `throw` on hardware failure | Return error code; log to NVM; let watchdog reset |
| `catch (...)` for cleanup | RAII guards (destructors run without exceptions) |

---

## Migration 6: RTTI (`dynamic_cast`, `typeid`) --> Compile-Time Alternatives

### The Problem

RTTI stores type information tables in ROM for every polymorphic class. With `-fno-rtti`, `dynamic_cast` and `typeid` are unavailable. Even if available, they add ROM bloat proportional to the number of polymorphic types.

### Replacement: Explicit Type Tags or `std::variant`

**Option A: Enum type tag (simplest)**

```cpp
// BEFORE
void process(Base* obj) {
    if (auto* temp = dynamic_cast<TemperatureSensor*>(obj)) {
        handle_temp(temp);
    } else if (auto* pres = dynamic_cast<PressureSensor*>(obj)) {
        handle_pressure(pres);
    }
}

// AFTER -- explicit type tag, no RTTI
enum class SensorType : uint8_t { temperature, pressure, humidity };

struct SensorBase {
    const SensorType type;  // set in constructor, never changes
    explicit SensorBase(SensorType t) : type(t) {}
};

struct TemperatureSensor : SensorBase {
    TemperatureSensor() : SensorBase(SensorType::temperature) {}
    float temp_value;
};

struct PressureSensor : SensorBase {
    PressureSensor() : SensorBase(SensorType::pressure) {}
    float pressure_value;
};

void process(SensorBase* obj) {
    switch (obj->type) {
        case SensorType::temperature:
            handle_temp(static_cast<TemperatureSensor*>(obj));
            break;
        case SensorType::pressure:
            handle_pressure(static_cast<PressureSensor*>(obj));
            break;
        default:
            break;
    }
}
```

**Option B: `std::variant` (type-safe, compile-time checked)**

```cpp
// AFTER -- variant replaces inheritance hierarchy entirely
using SensorVariant = std::variant<TemperatureSensor, PressureSensor>;

void process(SensorVariant& sensor) {
    std::visit([](auto& s) {
        // Compiler generates a branch for each type -- no RTTI
        using T = std::decay_t<decltype(s)>;
        if constexpr (std::is_same_v<T, TemperatureSensor>) {
            handle_temp(s);
        } else if constexpr (std::is_same_v<T, PressureSensor>) {
            handle_pressure(s);
        }
    }, sensor);
}
```

`std::variant` stores the largest type inline (no heap), knows the active type via a small index, and provides compile-time exhaustive pattern matching.

---

## STM32H7-Specific Considerations

### Memory Layout Strategy

The STM32H7 has multiple RAM regions with different characteristics. Use them deliberately:

| Region | Address | Size | Best for |
|---|---|---|---|
| DTCM | 0x20000000 | 128 KB | Stack, frequently accessed data, real-time buffers |
| AXI SRAM | 0x24000000 | 512 KB | General application data, object pools |
| SRAM4 | 0x38000000 | 64 KB | DMA buffers (non-cached, no coherency issues) |
| ITCM | 0x00000000 | 64 KB | Time-critical ISR handlers, control loops |

```c
// Place DMA buffers in non-cached SRAM4 -- no cache maintenance needed
__attribute__((section(".dma_buf"), aligned(32)))
static uint8_t dma_rx_buf[256];

// Place time-critical code in ITCM for zero-wait-state execution
__attribute__((section(".itcm_text")))
void motor_control_isr(void) {
    // Runs from ITCM -- deterministic timing, no flash wait states
}
```

### Cache Coherency (Critical for STM32H7)

The Cortex-M7 in STM32H7 has a 32-byte D-cache. DMA buffers **must** either be in a non-cached region (SRAM4) or have explicit cache maintenance:

```cpp
// After DMA-to-memory completes:
void on_dma_rx_complete() {
    SCB_InvalidateDCache_by_Addr(
        reinterpret_cast<uint32_t*>(dma_rx_buf),
        sizeof(dma_rx_buf)
    );
    // Now safe to read dma_rx_buf
}

// Before memory-to-DMA:
void start_dma_tx(const uint8_t* data, size_t len) {
    memcpy(dma_tx_buf, data, len);
    SCB_CleanDCache_by_Addr(
        reinterpret_cast<uint32_t*>(dma_tx_buf),
        sizeof(dma_tx_buf)
    );
    HAL_UART_Transmit_DMA(&huart1, dma_tx_buf, len);
}
```

**DMA buffers must be 32-byte aligned and sized in 32-byte multiples** to avoid corrupting adjacent data during cache line operations.

### Linker Script for STM32H7

```ld
MEMORY {
    FLASH   (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
    ITCMRAM (xrw) : ORIGIN = 0x00000000, LENGTH = 64K
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    RAM     (xrw) : ORIGIN = 0x24000000, LENGTH = 512K
    SRAM4   (xrw) : ORIGIN = 0x38000000, LENGTH = 64K
}

.dma_buf (NOLOAD) : {
    . = ALIGN(32);
    *(.dma_buf)
    . = ALIGN(32);
} >SRAM4
```

---

## Migration Checklist

Work through this list in order. Each step can be tested independently.

| Step | Action | Verification |
|---|---|---|
| 1 | Add `-fno-exceptions -fno-rtti` to compiler flags | Build succeeds (fix all `throw`/`catch`/`typeid`/`dynamic_cast` first) |
| 2 | Replace all `std::string` with `etl::string<N>` or `char[]` + `snprintf` | `grep -rn "std::string" src/` returns no hits |
| 3 | Replace all `std::vector` with `etl::vector<T,N>` or `std::array` | `grep -rn "std::vector" src/` returns no hits |
| 4 | Replace all `std::shared_ptr` with `std::unique_ptr` + pool deleter or raw observing pointers | `grep -rn "shared_ptr" src/` returns no hits |
| 5 | Replace `throw`/`catch` with `std::optional`/`std::expected`/error codes | No remaining `throw` or `catch` keywords |
| 6 | Replace `dynamic_cast`/`typeid` with type tags or `std::variant` | No remaining RTTI usage |
| 7 | Replace virtual dispatch on hot paths with CRTP | Profile: measure call overhead on critical paths |
| 8 | Audit all remaining `new`/`delete`/`malloc`/`free` -- replace with pools or static allocation | `grep -rn "\bnew\b\|\bdelete\b\|\bmalloc\b\|\bfree\b" src/` reviewed |
| 9 | Place DMA buffers in SRAM4 or add cache maintenance | Check `.map` file for buffer addresses |
| 10 | Run `arm-none-eabi-size` -- verify flash < 1.8 MB, RAM < 800 KB | CI budget gate passes |
| 11 | Run `clang-tidy` + `cppcheck` on all source | Zero new warnings |
| 12 | Run business logic on host PC with `-fsanitize=address,undefined` | No ASan/UBSan errors |

## Summary of Replacements

| Desktop C++ Feature | Embedded Replacement | Heap? | Runtime Cost |
|---|---|---|---|
| `std::vector<T>` | `etl::vector<T, N>` / `std::array<T, N>` | No | Zero |
| `std::string` | `etl::string<N>` / `char[]` + `snprintf` / `std::string_view` | No | Zero |
| `std::shared_ptr<T>` | `std::unique_ptr<T, PoolDeleter>` + raw observers | No | Zero |
| Virtual functions | CRTP / templates / `std::variant` | No | Zero (inlined) |
| Exceptions (`throw`/`catch`) | `std::optional` / `std::expected` / error codes | No | Zero |
| RTTI (`dynamic_cast`/`typeid`) | Enum type tags / `std::variant` / `if constexpr` | No | Zero |

Every replacement eliminates heap allocation and produces deterministic, statically analyzable code suitable for long-running embedded systems.
