# Desktop C++ to STM32H7 Porting Guide

## Target Constraints

| Resource | Available | Practical Budget |
|----------|-----------|-----------------|
| Flash    | 2 MB      | ~1.5 MB for application (reserve for bootloader, config) |
| RAM      | 1 MB      | ~800 KB usable (stack, peripherals, DMA buffers) |
| Heap     | Avoid unbounded dynamic allocation entirely |
| Stack    | Typically 4-16 KB per task (RTOS) or single stack bare-metal |

## Compiler Settings Baseline

Before any code changes, configure your toolchain to minimize overhead:

```makefile
# GCC ARM flags for STM32H7
CXXFLAGS += -mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16 -mfloat-abi=hard
CXXFLAGS += -fno-exceptions      # Disable exception support
CXXFLAGS += -fno-rtti            # Disable RTTI
CXXFLAGS += -fno-threadsafe-statics  # No guard variables for static init
CXXFLAGS += -ffunction-sections -fdata-sections
CXXFLAGS += -Os                  # Optimize for size (or -O2 if you have flash headroom)

LDFLAGS += -Wl,--gc-sections     # Strip unused code
LDFLAGS += -specs=nano.specs     # Use newlib-nano (smaller libc)
LDFLAGS += -specs=nosys.specs    # No semihosting
```

These flags alone typically save 100-300 KB of flash by removing exception handling tables, RTTI type info, and unused library code.

---

## 1. Replacing `std::vector` — Fixed-Capacity Containers

### Problem

`std::vector` performs heap allocation, can reallocate and copy on growth, and its memory usage is unbounded. On an MCU, a single unexpected reallocation can fragment memory or exhaust the heap.

### Replacement: Static Vector (Fixed-Capacity, Stack/Static Storage)

```cpp
// ============================================================
// static_vector.h — Drop-in replacement for std::vector
// ============================================================
#pragma once
#include <cstddef>
#include <cstdint>
#include <new>
#include <type_traits>
#include <algorithm>

template <typename T, std::size_t Capacity>
class StaticVector {
public:
    using value_type = T;
    using size_type = std::size_t;
    using iterator = T*;
    using const_iterator = const T*;

    StaticVector() = default;

    ~StaticVector() {
        clear();
    }

    // No copy/move by default — opt in explicitly if needed
    StaticVector(const StaticVector&) = delete;
    StaticVector& operator=(const StaticVector&) = delete;

    bool push_back(const T& value) {
        if (size_ >= Capacity) {
            return false;  // Fail explicitly — no silent reallocation
        }
        new (&storage_[size_]) T(value);
        ++size_;
        return true;
    }

    void pop_back() {
        if (size_ > 0) {
            --size_;
            storage_[size_].~T();
        }
    }

    void clear() {
        for (size_t i = 0; i < size_; ++i) {
            storage_[i].~T();
        }
        size_ = 0;
    }

    T& operator[](size_type index)             { return storage_[index]; }
    const T& operator[](size_type index) const { return storage_[index]; }

    size_type size() const     { return size_; }
    size_type capacity() const { return Capacity; }
    bool empty() const         { return size_ == 0; }
    bool full() const          { return size_ == Capacity; }

    iterator begin()             { return &storage_[0]; }
    iterator end()               { return &storage_[size_]; }
    const_iterator begin() const { return &storage_[0]; }
    const_iterator end() const   { return &storage_[size_]; }

    T* data()             { return &storage_[0]; }
    const T* data() const { return &storage_[0]; }

private:
    T storage_[Capacity];
    size_type size_ = 0;
};
```

### Migration Examples

```cpp
// BEFORE (desktop)
std::vector<SensorReading> readings;
readings.push_back(new_reading);       // Unbounded growth
for (auto& r : readings) { process(r); }

// AFTER (embedded)
StaticVector<SensorReading, 64> readings;  // Max 64 readings, all in .bss
if (!readings.push_back(new_reading)) {
    error_handler(Error::BufferFull);      // Explicit failure path
}
for (auto& r : readings) { process(r); }
```

### When You Need a Ring Buffer Instead

If your `std::vector` was used as a FIFO queue (push to back, consume from front), replace it with a ring buffer:

```cpp
template <typename T, std::size_t Capacity>
class RingBuffer {
public:
    bool push(const T& item) {
        if (full()) return false;
        buffer_[head_] = item;
        head_ = (head_ + 1) % Capacity;
        ++count_;
        return true;
    }

    bool pop(T& item) {
        if (empty()) return false;
        item = buffer_[tail_];
        tail_ = (tail_ + 1) % Capacity;
        --count_;
        return true;
    }

    bool empty() const { return count_ == 0; }
    bool full() const  { return count_ == Capacity; }
    std::size_t size() const { return count_; }

private:
    T buffer_[Capacity];
    std::size_t head_ = 0;
    std::size_t tail_ = 0;
    std::size_t count_ = 0;
};
```

---

## 2. Replacing `std::string` — Fixed-Size Strings

### Problem

`std::string` heap-allocates on most implementations (SSO helps for very short strings but is not guaranteed, and SSO thresholds vary). String concatenation creates temporaries. On an MCU, each concatenation can fragment the heap.

### Replacement: Fixed-Capacity String

```cpp
// ============================================================
// fixed_string.h — Embedded-safe string replacement
// ============================================================
#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <cstdio>

template <std::size_t Capacity>
class FixedString {
public:
    FixedString() {
        buffer_[0] = '\0';
    }

    FixedString(const char* str) {
        assign(str);
    }

    void assign(const char* str) {
        std::strncpy(buffer_, str, Capacity);
        buffer_[Capacity] = '\0';  // Always null-terminate
        len_ = std::strlen(buffer_);
    }

    bool append(const char* str) {
        std::size_t add_len = std::strlen(str);
        if (len_ + add_len > Capacity) {
            return false;  // Would overflow
        }
        std::memcpy(buffer_ + len_, str, add_len + 1);
        len_ += add_len;
        return true;
    }

    bool append_int(int32_t value) {
        char temp[12];  // Enough for INT32_MIN
        int written = snprintf(temp, sizeof(temp), "%" PRId32, value);
        if (written < 0) return false;
        return append(temp);
    }

    // Formatted append (replaces std::ostringstream patterns)
    template <typename... Args>
    bool appendf(const char* fmt, Args... args) {
        std::size_t remaining = Capacity - len_;
        int written = snprintf(buffer_ + len_, remaining + 1, fmt, args...);
        if (written < 0 || static_cast<std::size_t>(written) > remaining) {
            buffer_[len_] = '\0';  // Restore null terminator
            return false;
        }
        len_ += written;
        return true;
    }

    void clear() {
        buffer_[0] = '\0';
        len_ = 0;
    }

    const char* c_str() const    { return buffer_; }
    std::size_t length() const   { return len_; }
    std::size_t capacity() const { return Capacity; }
    bool empty() const           { return len_ == 0; }

    bool operator==(const char* other) const {
        return std::strcmp(buffer_, other) == 0;
    }

    bool operator==(const FixedString& other) const {
        return std::strcmp(buffer_, other.buffer_) == 0;
    }

    char operator[](std::size_t i) const { return buffer_[i]; }
    char& operator[](std::size_t i)      { return buffer_[i]; }

private:
    char buffer_[Capacity + 1];  // +1 for null terminator
    std::size_t len_ = 0;
};
```

### Migration Examples

```cpp
// BEFORE (desktop)
std::string msg = "Sensor " + std::to_string(id) + ": " + std::to_string(value) + " mV";
logger.log(msg);

// AFTER (embedded)
FixedString<64> msg;
msg.appendf("Sensor %u: %d mV", id, value);
logger.log(msg.c_str());
```

### String View for Read-Only Access

When you only need to reference a string without owning it, use a lightweight string view (avoids copies entirely):

```cpp
struct StringView {
    const char* data;
    std::size_t length;

    StringView(const char* str) : data(str), length(std::strlen(str)) {}
    StringView(const char* str, std::size_t len) : data(str), length(len) {}

    bool equals(const char* other) const {
        return std::strncmp(data, other, length) == 0 && other[length] == '\0';
    }
};
```

---

## 3. Replacing `std::shared_ptr` — Static Ownership Patterns

### Problem

`std::shared_ptr` performs heap allocation (for the control block and potentially the object), uses atomic reference counting (expensive on Cortex-M even with hardware atomics), and makes object lifetime unpredictable. Destructor timing is non-deterministic.

### Strategy: Eliminate Shared Ownership

In embedded systems, every object should have exactly one owner. Shared ownership is almost always a design smell that can be refactored away.

### Pattern A: Object Pools (Pre-Allocated, Deterministic)

```cpp
// ============================================================
// object_pool.h — Fixed-size pool with handle-based access
// ============================================================
#pragma once
#include <cstddef>
#include <cstdint>
#include <new>

template <typename T, std::size_t PoolSize>
class ObjectPool {
public:
    struct Handle {
        uint16_t index;
        uint16_t generation;  // Detects use-after-free

        bool valid() const { return index != UINT16_MAX; }
        static Handle invalid() { return {UINT16_MAX, 0}; }
    };

    ObjectPool() {
        // Build free list
        for (std::size_t i = 0; i < PoolSize - 1; ++i) {
            slots_[i].next_free = i + 1;
        }
        slots_[PoolSize - 1].next_free = UINT16_MAX;
        free_head_ = 0;
    }

    template <typename... Args>
    Handle acquire(Args&&... args) {
        if (free_head_ == UINT16_MAX) {
            return Handle::invalid();  // Pool exhausted
        }

        uint16_t idx = free_head_;
        free_head_ = slots_[idx].next_free;

        // Construct in-place
        new (&slots_[idx].storage) T(static_cast<Args&&>(args)...);
        slots_[idx].active = true;
        ++active_count_;

        return Handle{idx, slots_[idx].generation};
    }

    void release(Handle handle) {
        if (!is_valid(handle)) return;

        uint16_t idx = handle.index;
        reinterpret_cast<T*>(&slots_[idx].storage)->~T();
        slots_[idx].active = false;
        slots_[idx].generation++;  // Invalidate old handles
        slots_[idx].next_free = free_head_;
        free_head_ = idx;
        --active_count_;
    }

    T* get(Handle handle) {
        if (!is_valid(handle)) return nullptr;
        return reinterpret_cast<T*>(&slots_[handle.index].storage);
    }

    const T* get(Handle handle) const {
        if (!is_valid(handle)) return nullptr;
        return reinterpret_cast<const T*>(&slots_[handle.index].storage);
    }

    bool is_valid(Handle handle) const {
        return handle.index < PoolSize &&
               slots_[handle.index].active &&
               slots_[handle.index].generation == handle.generation;
    }

    std::size_t active_count() const { return active_count_; }
    std::size_t available() const { return PoolSize - active_count_; }

private:
    struct Slot {
        typename std::aligned_storage<sizeof(T), alignof(T)>::type storage;
        uint16_t next_free = 0;
        uint16_t generation = 0;
        bool active = false;
    };

    Slot slots_[PoolSize];
    uint16_t free_head_ = 0;
    std::size_t active_count_ = 0;
};
```

### Migration Example

```cpp
// BEFORE (desktop)
std::shared_ptr<Connection> conn = std::make_shared<Connection>(address, port);
registry.add(conn);
handler.set_connection(conn);
// ... who owns it? When does it die? Nobody knows.

// AFTER (embedded)
static ObjectPool<Connection, 8> connection_pool;  // Max 8 connections

auto handle = connection_pool.acquire(address, port);
if (!handle.valid()) {
    error_handler(Error::PoolExhausted);
    return;
}

registry.add(handle);            // Store the handle, not a pointer
handler.set_connection(handle);  // Lightweight copy of handle (4 bytes)

// Explicit cleanup when done — clear, deterministic
connection_pool.release(handle);
```

### Pattern B: Single Owner + Borrowed References

```cpp
// Owner creates and destroys the object
class SensorManager {
    ADCSensor adc_sensor_;  // Owns by value — no heap, no pointer

public:
    // Lend a reference (non-owning pointer)
    ADCSensor* get_sensor() { return &adc_sensor_; }
};

// Borrower uses but does not own
class DataLogger {
    ADCSensor* sensor_ = nullptr;  // Non-owning, raw pointer is fine

public:
    void set_sensor(ADCSensor* s) { sensor_ = s; }
    void log_reading() {
        if (sensor_) {
            auto val = sensor_->read();
            store(val);
        }
    }
};
```

---

## 4. Replacing Virtual Functions — Compile-Time Polymorphism

### Problem

Virtual functions require:
- A vtable per class (stored in flash, but adds up)
- A vptr per object instance (4 bytes of RAM per object)
- Indirect function calls (pipeline stalls on Cortex-M7, defeats branch prediction)
- RTTI support if you use `dynamic_cast` (significant flash overhead)

### Pattern A: CRTP (Curiously Recurring Template Pattern)

This gives you polymorphic behavior resolved entirely at compile time — zero runtime overhead.

```cpp
// ============================================================
// CRTP-based static polymorphism
// ============================================================

// Base template — defines the interface
template <typename Derived>
class SensorBase {
public:
    int32_t read() {
        return static_cast<Derived*>(this)->read_impl();
    }

    bool calibrate(int32_t reference) {
        return static_cast<Derived*>(this)->calibrate_impl();
    }

    const char* name() const {
        return static_cast<const Derived*>(this)->name_impl();
    }
};

// Concrete implementation — no vtable, no vptr
class TemperatureSensor : public SensorBase<TemperatureSensor> {
    int32_t offset_ = 0;
    volatile uint32_t* adc_reg_;

public:
    explicit TemperatureSensor(volatile uint32_t* adc_reg)
        : adc_reg_(adc_reg) {}

    int32_t read_impl() {
        uint32_t raw = *adc_reg_;
        return static_cast<int32_t>((raw * 3300) / 4096) + offset_;
    }

    bool calibrate_impl(int32_t reference) {
        offset_ = reference - read_impl();
        return true;
    }

    const char* name_impl() const { return "Temperature"; }
};

class PressureSensor : public SensorBase<PressureSensor> {
    int32_t scale_ = 100;

public:
    int32_t read_impl() {
        // SPI read from pressure transducer
        return spi_read_pressure() * scale_ / 100;
    }

    bool calibrate_impl(int32_t reference) {
        int32_t raw = spi_read_pressure();
        if (raw == 0) return false;
        scale_ = (reference * 100) / raw;
        return true;
    }

    const char* name_impl() const { return "Pressure"; }
};

// Usage — template function works with any sensor type
template <typename Sensor>
void log_sensor(Sensor& sensor) {
    int32_t value = sensor.read();  // Direct call, fully inlined
    printf("%s: %" PRId32 "\n", sensor.name(), value);
}
```

### Pattern B: Function Pointer Tables (When Runtime Dispatch is Truly Needed)

Sometimes you genuinely need runtime polymorphism — e.g., iterating over a heterogeneous collection. Use explicit function pointer tables instead of virtual functions:

```cpp
// ============================================================
// Manual vtable — explicit, no RTTI overhead
// ============================================================

// Define the "interface" as a table of function pointers
struct SensorOps {
    int32_t (*read)(void* ctx);
    bool    (*calibrate)(void* ctx, int32_t reference);
    const char* (*name)(void* ctx);
};

// A "polymorphic" sensor reference (8 bytes: pointer + ops table)
struct SensorRef {
    void* context;
    const SensorOps* ops;

    int32_t read()                     { return ops->read(context); }
    bool calibrate(int32_t ref)        { return ops->calibrate(context, ref); }
    const char* name()                 { return ops->name(context); }
};

// Implementation for temperature sensor
static int32_t temp_read(void* ctx) {
    auto* self = static_cast<TempSensorData*>(ctx);
    return ((*self->adc_reg) * 3300 / 4096) + self->offset;
}

static bool temp_calibrate(void* ctx, int32_t ref) {
    auto* self = static_cast<TempSensorData*>(ctx);
    self->offset = ref - temp_read(ctx);
    return true;
}

static const char* temp_name(void* ctx) {
    (void)ctx;
    return "Temperature";
}

// Ops table — stored in flash (const)
static const SensorOps temp_ops = {
    .read = temp_read,
    .calibrate = temp_calibrate,
    .name = temp_name,
};

// Usage — iterate over heterogeneous sensors
SensorRef sensors[4];
sensors[0] = { &temp_data, &temp_ops };
sensors[1] = { &pressure_data, &pressure_ops };

for (auto& s : sensors) {
    if (s.ops) {
        int32_t val = s.read();
        log_value(s.name(), val);
    }
}
```

### Pattern C: `std::variant`-style Tagged Union (No Heap, No Virtual)

If you have a small, known set of types, use a tagged union:

```cpp
enum class SensorType : uint8_t {
    Temperature,
    Pressure,
    Humidity,
};

struct SensorVariant {
    SensorType type;
    union {
        TemperatureSensor temperature;
        PressureSensor pressure;
        HumiditySensor humidity;
    };

    int32_t read() {
        switch (type) {
            case SensorType::Temperature: return temperature.read();
            case SensorType::Pressure:    return pressure.read();
            case SensorType::Humidity:    return humidity.read();
        }
        return 0;  // Unreachable
    }
};
```

---

## 5. Replacing Exceptions — Error Codes and Result Types

### Problem

C++ exceptions on ARM add 10-30 KB of flash for unwinding tables, have unpredictable execution time (fatal for real-time systems), and are typically unsupported by embedded toolchains anyway. With `-fno-exceptions`, any `throw` calls `std::abort()`.

### Pattern A: Error Code Enum

```cpp
// ============================================================
// error.h — Centralized error definitions
// ============================================================
#pragma once
#include <cstdint>

enum class Error : uint8_t {
    Ok = 0,
    Timeout,
    BusError,
    InvalidParam,
    BufferFull,
    BufferEmpty,
    HardwareFailure,
    NotInitialized,
    PoolExhausted,
    ChecksumMismatch,
};

inline const char* error_to_string(Error e) {
    switch (e) {
        case Error::Ok:               return "OK";
        case Error::Timeout:          return "Timeout";
        case Error::BusError:         return "Bus Error";
        case Error::InvalidParam:     return "Invalid Parameter";
        case Error::BufferFull:       return "Buffer Full";
        case Error::BufferEmpty:      return "Buffer Empty";
        case Error::HardwareFailure:  return "Hardware Failure";
        case Error::NotInitialized:   return "Not Initialized";
        case Error::PoolExhausted:    return "Pool Exhausted";
        case Error::ChecksumMismatch: return "Checksum Mismatch";
    }
    return "Unknown";
}
```

### Pattern B: Result Type (Carries Value or Error)

```cpp
// ============================================================
// result.h — Rust-inspired Result<T, Error>
// ============================================================
#pragma once

template <typename T>
struct Result {
    T value;
    Error error;

    bool ok() const { return error == Error::Ok; }

    static Result success(T val) {
        return Result{val, Error::Ok};
    }

    static Result failure(Error err) {
        return Result{T{}, err};
    }
};

// Specialization for void return
template <>
struct Result<void> {
    Error error;

    bool ok() const { return error == Error::Ok; }

    static Result success() {
        return Result{Error::Ok};
    }

    static Result failure(Error err) {
        return Result{err};
    }
};
```

### Migration Examples

```cpp
// BEFORE (desktop)
try {
    auto data = sensor.read();          // throws on timeout
    auto parsed = parser.parse(data);   // throws on bad format
    database.store(parsed);             // throws on full
} catch (const TimeoutError& e) {
    log("Timeout: " + e.what());
} catch (const ParseError& e) {
    log("Parse failed: " + e.what());
} catch (const std::exception& e) {
    log("Error: " + e.what());
}

// AFTER (embedded)
auto data_result = sensor.read();
if (!data_result.ok()) {
    log_error("Sensor read", data_result.error);
    return data_result.error;
}

auto parse_result = parser.parse(data_result.value);
if (!parse_result.ok()) {
    log_error("Parse", parse_result.error);
    return parse_result.error;
}

auto store_result = storage.store(parse_result.value);
if (!store_result.ok()) {
    log_error("Storage", store_result.error);
    return store_result.error;
}
```

### Macro for Error Propagation (Reduces Boilerplate)

```cpp
#define TRY(result_expr)                     \
    do {                                     \
        auto _result = (result_expr);        \
        if (!_result.ok()) {                 \
            return Result::failure(_result.error); \
        }                                    \
    } while (0)

// Usage
Result<void> process_pipeline() {
    TRY(sensor.read());
    TRY(parser.parse(last_reading));
    TRY(storage.store(last_parsed));
    return Result<void>::success();
}
```

---

## 6. Replacing RTTI — Compile-Time Type Identification

### Problem

RTTI (`typeid`, `dynamic_cast`) adds type information strings and comparison infrastructure to flash. With `-fno-rtti`, these are unavailable.

### Replacement: Manual Type Tags

```cpp
// ============================================================
// Static type ID system — zero overhead
// ============================================================

using TypeId = uint8_t;

// Assign IDs at compile time via a template trick
template <typename T>
struct TypeTag {
    static TypeId id() {
        static const uint8_t tag = 0;
        return reinterpret_cast<TypeId>(&tag);
    }
};

// Or, simpler — explicit enum for known types
enum class ComponentType : uint8_t {
    Sensor,
    Actuator,
    Logger,
    CommLink,
};

struct Component {
    ComponentType type;

    // Safe "downcast" — replaces dynamic_cast
    template <typename T>
    T* as() {
        if (type == T::kType) {
            return static_cast<T*>(this);
        }
        return nullptr;
    }
};

struct SensorComponent : Component {
    static constexpr ComponentType kType = ComponentType::Sensor;
    int32_t last_reading;

    SensorComponent() { type = kType; }
};

// Usage (replaces dynamic_cast)
void process(Component* comp) {
    if (auto* sensor = comp->as<SensorComponent>()) {
        // Safe — type was verified
        use(sensor->last_reading);
    }
}
```

---

## 7. Memory Layout and Placement

### Linker Script Considerations

Ensure your linker script accounts for STM32H7's memory regions:

```ld
MEMORY
{
    FLASH  (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
    DTCMRAM (rwx) : ORIGIN = 0x20000000, LENGTH = 128K   /* Fast, tightly coupled */
    RAM_D1  (rwx) : ORIGIN = 0x24000000, LENGTH = 512K   /* Main SRAM */
    RAM_D2  (rwx) : ORIGIN = 0x30000000, LENGTH = 288K   /* Peripheral access */
    RAM_D3  (rwx) : ORIGIN = 0x38000000, LENGTH = 64K    /* Lowest power domain */
}
```

### Placement Attributes

```cpp
// Place DMA buffers in D2 RAM (accessible by DMA controllers)
__attribute__((section(".dma_buffer")))
static uint8_t uart_rx_buffer[256];

// Place hot data in DTCM for zero-wait-state access
__attribute__((section(".dtcm_data")))
static StaticVector<SensorReading, 128> sensor_readings;

// Place lookup tables in flash to save RAM
__attribute__((section(".rodata")))
static const uint16_t sin_table[256] = { /* ... */ };
```

---

## 8. Migration Checklist

### Phase 1: Mechanical Replacements (Week 1-2)

- [ ] Set compiler flags (`-fno-exceptions`, `-fno-rtti`, `--specs=nano.specs`)
- [ ] Replace all `std::vector<T>` with `StaticVector<T, N>` — audit each site for maximum N
- [ ] Replace all `std::string` with `FixedString<N>` or `const char*`
- [ ] Replace all `std::shared_ptr` with object pools or single-owner patterns
- [ ] Replace `std::map`/`std::unordered_map` with fixed-size lookup tables or sorted arrays
- [ ] Replace `std::function` with function pointers or CRTP callbacks

### Phase 2: Architectural Changes (Week 2-3)

- [ ] Replace exception-based error handling with Result types
- [ ] Replace virtual function hierarchies with CRTP or function pointer tables
- [ ] Replace `dynamic_cast`/RTTI with manual type tags
- [ ] Audit all `new`/`delete` — replace with pool allocation or stack allocation
- [ ] Replace `std::mutex` with RTOS mutexes or interrupt-safe primitives
- [ ] Replace `std::thread` with RTOS tasks

### Phase 3: Optimization and Verification (Week 3-4)

- [ ] Run `arm-none-eabi-size` to verify flash/RAM fit
- [ ] Profile stack usage (`-fstack-usage` flag) for each function
- [ ] Set up MPU regions for stack overflow detection
- [ ] Verify no heap usage: override `_sbrk` to trap
- [ ] Test under worst-case memory conditions (all pools full, all buffers at capacity)
- [ ] Run static analysis (MISRA C++ subset if applicable)

### Heap Usage Detection (Catch Accidental Allocations)

```cpp
// Override _sbrk to detect any heap usage at runtime
extern "C" void* _sbrk(ptrdiff_t incr) {
    (void)incr;
    // If we get here, something tried to use the heap
    __asm volatile("bkpt #0");  // Break into debugger
    while (1) {}                // Halt in release
}

// Also override new/delete
void* operator new(std::size_t)   { _sbrk(0); return nullptr; }
void* operator new[](std::size_t) { _sbrk(0); return nullptr; }
void  operator delete(void*)   noexcept {}
void  operator delete[](void*) noexcept {}
```

---

## 9. Quick Reference: Desktop to Embedded Translation Table

| Desktop C++                  | Embedded Replacement                     | RAM Cost   |
|------------------------------|------------------------------------------|------------|
| `std::vector<T>`             | `StaticVector<T, N>`                     | `N * sizeof(T)` fixed |
| `std::string`                | `FixedString<N>` or `const char*`        | `N+1` bytes fixed |
| `std::shared_ptr<T>`         | Object pool handle or single owner       | 4 bytes (handle) |
| `std::unique_ptr<T>`         | Stack allocation or pool                 | `sizeof(T)` |
| `std::map<K,V>`              | Sorted array + binary search             | Fixed |
| `std::unordered_map<K,V>`    | Fixed hash table or perfect hash         | Fixed |
| `std::function<Sig>`         | Function pointer + context, or CRTP      | 8 bytes |
| `virtual` methods            | CRTP or function pointer table           | 0 bytes |
| `dynamic_cast<T*>`           | Manual type tag + `static_cast`          | 1 byte per object |
| `throw`/`catch`              | `Result<T>` error codes                  | Size of Result |
| `std::mutex`                 | `osMutexId_t` (CMSIS-RTOS) or `taskENTER_CRITICAL()` | RTOS-managed |
| `std::thread`                | `osThreadNew()` or `xTaskCreate()`       | Stack per task |
| `std::cout`/`printf`         | `snprintf` to UART buffer                | Minimal |
| `new` / `delete`             | Object pool, stack, or placement new     | 0 heap |
| `std::list<T>`               | Intrusive linked list or static array    | Fixed |

---

## 10. Example: Complete Ported Module

### Before (Desktop)

```cpp
#include <vector>
#include <string>
#include <memory>
#include <stdexcept>

class SensorManager {
    std::vector<std::shared_ptr<Sensor>> sensors_;

public:
    void add_sensor(std::shared_ptr<Sensor> s) {
        sensors_.push_back(s);
    }

    std::string read_all() {
        std::string result;
        for (auto& s : sensors_) {
            try {
                int val = s->read();
                result += s->name() + ": " + std::to_string(val) + "\n";
            } catch (const std::exception& e) {
                result += s->name() + ": ERROR\n";
            }
        }
        return result;
    }
};
```

### After (STM32H7)

```cpp
#include "static_vector.h"
#include "fixed_string.h"
#include "error.h"
#include "result.h"

// Concrete sensor types — no inheritance needed
struct AnalogSensor {
    const char* name;
    volatile uint32_t* adc_reg;
    int32_t offset;

    Result<int32_t> read() const {
        if (adc_reg == nullptr) {
            return Result<int32_t>::failure(Error::NotInitialized);
        }
        uint32_t raw = *adc_reg;
        return Result<int32_t>::success(static_cast<int32_t>(raw) + offset);
    }
};

class SensorManager {
    StaticVector<AnalogSensor, 8> sensors_;  // Max 8 sensors, stack-allocated

public:
    Error add_sensor(const AnalogSensor& s) {
        if (!sensors_.push_back(s)) {
            return Error::PoolExhausted;
        }
        return Error::Ok;
    }

    Error read_all(FixedString<256>& output) {
        output.clear();
        for (auto& s : sensors_) {
            auto result = s.read();
            if (result.ok()) {
                output.appendf("%s: %" PRId32 "\n", s.name, result.value);
            } else {
                output.appendf("%s: ERROR (%s)\n", s.name,
                              error_to_string(result.error));
            }
        }
        return Error::Ok;
    }
};
```

This ported version uses zero heap memory, has deterministic execution time, handles errors explicitly, and fits comfortably within STM32H7 constraints.
