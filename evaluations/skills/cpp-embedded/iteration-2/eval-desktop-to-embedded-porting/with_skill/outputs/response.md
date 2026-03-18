# Desktop C++ to STM32H7 Migration Guide

## Target Constraints

| Resource | Available | Budget Rule |
|----------|-----------|-------------|
| Flash | 2 MB | Keep below 90% (1.8 MB usable) |
| RAM | 1 MB total (DTCMRAM 128K, AXI SRAM 512K, SRAM1-3 ~288K, SRAM4 64K) | Keep below 80% per region |
| Stack per task | 1--8 KB typical | Profile with `-fstack-usage`, verify with `uxTaskGetStackHighWaterMark()` |
| Heap | Avoid entirely in production paths | MISRA C++ Rule 21.6.1 bans dynamic memory after init |

**Mandatory compiler flags** -- add these immediately:

```cmake
target_compile_options(firmware PRIVATE
    -fno-exceptions          # Disables C++ exception machinery
    -fno-rtti                # Disables runtime type information
    -fno-threadsafe-statics  # No hidden mutex for local statics
    -ffunction-sections      # Enable dead-code removal
    -fdata-sections
)
target_link_options(firmware PRIVATE
    -Wl,--gc-sections        # Strip unused functions/data
)
```

These flags are not optional. `-fno-exceptions` alone can save 20--60 KB of flash. `-fno-rtti` eliminates type info tables. `-Wl,--gc-sections` with `-ffunction-sections` strips every unused function.

---

## Migration Pattern 1: `std::vector` to Fixed-Size Containers

### Problem

`std::vector` calls `malloc`/`realloc` on every growth. On an MCU, this causes heap fragmentation, non-deterministic timing, and eventual allocation failure after hours of uptime.

### Solution A: `std::array` (size known at compile time)

```cpp
// DESKTOP -- dynamic, heap-allocated
std::vector<SensorReading> readings;
readings.push_back(reading);  // may allocate

// STM32H7 -- fixed at compile time, zero heap
#include <array>
static constexpr size_t kMaxReadings = 64;
std::array<SensorReading, kMaxReadings> readings{};
size_t reading_count = 0;

void add_reading(const SensorReading& r) {
    if (reading_count < kMaxReadings) {
        readings[reading_count++] = r;
    }
    // else: handle overflow -- log, discard oldest, or assert
}
```

### Solution B: ETL fixed-capacity vector (need push_back/pop_back semantics)

The [Embedded Template Library (ETL)](https://www.etlcpp.com) provides `etl::vector<T, N>` -- same API as `std::vector` but backed by internal fixed storage. No heap allocation ever.

```cpp
// DESKTOP
#include <vector>
std::vector<SensorReading> readings;
readings.push_back(reading);

// STM32H7 -- drop-in replacement with fixed capacity
#include <etl/vector.h>
etl::vector<SensorReading, 64> readings;
readings.push_back(reading);  // no heap; asserts if capacity exceeded

// ETL also provides: etl::list<T,N>, etl::deque<T,N>, etl::map<K,V,N>,
// etl::unordered_map<K,V,N>, etl::set<T,N> -- all fixed-capacity, zero-heap
```

### Solution C: Object pool (dynamically allocated objects with known maximum count)

When you need dynamic allocation/deallocation semantics but know the upper bound:

```cpp
// DESKTOP
std::vector<Message*> message_queue;
message_queue.push_back(new Message{...});  // heap alloc

// STM32H7 -- object pool with O(1) alloc/free, no fragmentation
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
        return nullptr;  // Pool exhausted
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

// Usage:
static ObjectPool<Message, 32> message_pool;

void enqueue_message(uint8_t id, const uint8_t* data, size_t len) {
    Message* msg = message_pool.allocate(id, data, len);
    if (msg) {
        process(msg);
        message_pool.free(msg);
    }
}
```

---

## Migration Pattern 2: `std::string` to Fixed-Size Strings

### Problem

Every `std::string` operation (`+=`, `substr`, `c_str()` copy) can trigger heap allocation. A single `std::string` concatenation in a loop will fragment the heap within hours.

### Solution A: `etl::string<N>` (drop-in for most uses)

```cpp
// DESKTOP
std::string build_response(int code, const std::string& body) {
    return "HTTP/1.1 " + std::to_string(code) + " OK\r\n" + body;
}

// STM32H7 -- fixed-capacity string, no heap
#include <etl/string.h>
#include <etl/to_string.h>

etl::string<256> build_response(int code, const etl::string_view body) {
    etl::string<256> response;
    response = "HTTP/1.1 ";
    etl::to_string(code, response, true);  // append
    response += " OK\r\n";
    response += body;
    return response;
}
```

### Solution B: `std::string_view` (for read-only string references)

```cpp
// DESKTOP -- copies the string
void log_message(const std::string& msg) {
    write_to_uart(msg.c_str(), msg.length());
}

// STM32H7 -- zero-copy, no allocation, works with string literals and buffers
#include <string_view>

void log_message(std::string_view msg) {
    write_to_uart(msg.data(), msg.size());
}

// Works with:
log_message("sensor timeout");           // string literal -- no copy
log_message(etl::string_view(buf, len)); // buffer -- no copy
```

### Solution C: `snprintf` to static buffer (C-style, maximum control)

```cpp
// For formatted output where you need precise control:
static char log_buf[128];

void log_event(uint32_t timestamp, int sensor_id, float value) {
    int n = snprintf(log_buf, sizeof(log_buf),
                     "[%lu] sensor_%d: %.2f", timestamp, sensor_id, value);
    if (n > 0 && n < static_cast<int>(sizeof(log_buf))) {
        uart_send(reinterpret_cast<const uint8_t*>(log_buf), n);
    }
}
```

---

## Migration Pattern 3: `std::shared_ptr` to Deterministic Ownership

### Problem

`std::shared_ptr` allocates a control block on the heap (16--24 bytes per instance), uses atomic reference counting (expensive on Cortex-M -- bus-locked read-modify-write), and makes object lifetime non-deterministic.

### Solution A: `std::unique_ptr` (single owner -- the common case)

Most uses of `shared_ptr` in desktop code are actually single-owner. Refactor to `unique_ptr`:

```cpp
// DESKTOP -- shared ownership (often unnecessary)
class System {
    std::shared_ptr<Logger> logger_;
    std::shared_ptr<SensorDriver> sensor_;
};

// STM32H7 -- single owner, zero overhead
class System {
    std::unique_ptr<Logger> logger_;      // System owns Logger
    SensorDriver* sensor_;                 // non-owning reference (sensor lives elsewhere)
};

// Transfer ownership explicitly:
auto logger = std::make_unique<Logger>(uart_handle);
system.set_logger(std::move(logger));
```

### Solution B: `unique_ptr` with pool deleter (pool-allocated objects)

When objects come from a pool instead of the heap, use a custom deleter to return them automatically:

```cpp
// Pool-backed unique_ptr -- RAII returns object to pool on scope exit
static ObjectPool<SensorData, 8> sensor_pool;

auto deleter = [](SensorData* p) { sensor_pool.free(p); };
using PooledSensor = std::unique_ptr<SensorData, decltype(deleter)>;

PooledSensor acquire_sensor() {
    return PooledSensor(sensor_pool.allocate(), deleter);
}

void process() {
    auto data = acquire_sensor();
    if (data) {
        data->temperature = read_temp();
        send_telemetry(*data);
    }
}  // data automatically returned to pool here
```

### Solution C: Static objects with non-owning references

For objects that live for the entire program lifetime (most embedded objects), just make them static:

```cpp
// DESKTOP
auto config = std::make_shared<Config>();
auto sensor = std::make_shared<Sensor>(config);
auto logger = std::make_shared<Logger>(config);

// STM32H7 -- static storage, non-owning pointers where references are needed
static Config g_config;
static Sensor g_sensor{&g_config};   // borrows g_config
static Logger g_logger{&g_config};   // borrows g_config

// Ownership is clear: main() owns everything, components borrow via raw pointer
```

---

## Migration Pattern 4: Virtual Functions to CRTP Static Polymorphism

### Problem

Each class with virtual functions has a vtable in flash (ROM). Each instance carries a vtable pointer (4 bytes on Cortex-M). Virtual calls are indirect -- they flush the pipeline on Cortex-M0/M3 and prevent inlining. Deep hierarchies (3+ levels) multiply these costs.

### When to keep virtual dispatch

Virtual functions are acceptable for code that runs at human-interaction speed: configuration screens, CLI command parsers, log backends. Do not use virtual functions in control loops, ISR callback chains, or signal processing paths.

### Solution: CRTP (Curiously Recurring Template Pattern)

```cpp
// DESKTOP -- virtual dispatch
class Sensor {
public:
    virtual ~Sensor() = default;
    virtual float read() = 0;
    virtual bool calibrate() = 0;
};

class TemperatureSensor : public Sensor {
public:
    float read() override { return read_adc() * 0.01f; }
    bool calibrate() override { /* ... */ return true; }
};

class PressureSensor : public Sensor {
public:
    float read() override { return read_i2c() * 100.0f; }
    bool calibrate() override { /* ... */ return true; }
};

// Caller uses base pointer -- vtable lookup on every call
void poll_sensor(Sensor& s) {
    float val = s.read();  // indirect call
}

// STM32H7 -- CRTP, zero overhead, compiler inlines everything
template<typename Derived>
class Sensor {
public:
    float read() {
        return static_cast<Derived*>(this)->read_impl();
    }
    bool calibrate() {
        return static_cast<Derived*>(this)->calibrate_impl();
    }
};

class TemperatureSensor : public Sensor<TemperatureSensor> {
public:
    float read_impl() { return read_adc() * 0.01f; }
    bool calibrate_impl() { /* ... */ return true; }
};

class PressureSensor : public Sensor<PressureSensor> {
public:
    float read_impl() { return read_i2c() * 100.0f; }
    bool calibrate_impl() { /* ... */ return true; }
};

// Caller is templated -- no vtable, direct call, inlineable
template<typename S>
void poll_sensor(S& sensor) {
    float val = sensor.read();  // direct call, zero overhead
}
```

### Solution for heterogeneous collections (where you stored different types in a `vector<Sensor*>`)

If you previously stored mixed types in a container and iterated over them with virtual dispatch, use a variant or type-tagged union:

```cpp
#include <variant>

using AnySensor = std::variant<TemperatureSensor, PressureSensor>;
std::array<AnySensor, 8> sensors;

void poll_all() {
    for (auto& s : sensors) {
        float val = std::visit([](auto& sensor) {
            return sensor.read();
        }, s);
        log_value(val);
    }
}
```

`std::variant` uses no heap, stores the largest type inline, and the compiler generates a jump table or if-chain instead of a vtable.

---

## Migration Pattern 5: Exceptions to Error Codes / `std::optional` / `std::expected`

### Problem

Exceptions require stack unwinding tables stored in flash (20--60 KB overhead), non-deterministic execution time during unwind, and heap allocation for exception objects. The `-fno-exceptions` flag completely removes this machinery.

### Solution A: `std::optional` (simple "value or nothing")

```cpp
// DESKTOP -- exceptions for error signaling
float read_temperature() {
    if (!sensor_ready()) throw std::runtime_error("sensor not ready");
    auto raw = read_raw();
    if (!verify_crc(raw)) throw std::runtime_error("CRC failed");
    return convert(raw);
}

try {
    float temp = read_temperature();
    display(temp);
} catch (const std::exception& e) {
    log_error(e.what());
}

// STM32H7 -- std::optional, no heap, deterministic
#include <optional>

[[nodiscard]] std::optional<float> read_temperature() {
    if (!sensor_ready()) return std::nullopt;
    auto raw = read_raw();
    if (!verify_crc(raw)) return std::nullopt;
    return convert(raw);
}

if (auto temp = read_temperature()) {
    display(*temp);
} else {
    log_error("sensor read failed");
}
```

### Solution B: `std::expected` (value or typed error -- C++23 or ETL polyfill)

When you need to communicate *why* something failed:

```cpp
#include <expected>  // C++23, or use etl::expected

enum class SensorError : uint8_t {
    not_ready,
    crc_fail,
    timeout,
    bus_error
};

[[nodiscard]] std::expected<float, SensorError> read_temperature() {
    if (!sensor_ready()) return std::unexpected(SensorError::not_ready);
    auto raw = read_raw();
    if (!verify_crc(raw)) return std::unexpected(SensorError::crc_fail);
    return convert(raw);
}

auto result = read_temperature();
if (result) {
    display(*result);
} else {
    switch (result.error()) {
        case SensorError::not_ready: retry_later(); break;
        case SensorError::crc_fail: reset_sensor(); break;
        case SensorError::timeout:  escalate();     break;
        case SensorError::bus_error: halt();         break;
    }
}
```

### Solution C: Error code return (C-compatible, simplest)

```cpp
enum class Status : uint8_t { ok, error, timeout, busy };

[[nodiscard]] Status read_temperature(float* out_temp) {
    if (!sensor_ready()) return Status::timeout;
    uint16_t raw;
    Status s = read_raw(&raw);
    if (s != Status::ok) return s;
    *out_temp = convert(raw);
    return Status::ok;
}
```

Mark all fallible functions `[[nodiscard]]` so the compiler warns if the caller ignores the result.

---

## Migration Pattern 6: RTTI (`typeid` / `dynamic_cast`) to Compile-Time Alternatives

### Problem

RTTI stores type name strings and type hierarchy information in flash. `dynamic_cast` walks the inheritance hierarchy at runtime. Both are eliminated by `-fno-rtti`.

### Solution A: Explicit type tags

```cpp
// DESKTOP -- RTTI
void handle_event(Event* e) {
    if (auto* te = dynamic_cast<TemperatureEvent*>(e)) {
        process_temp(te->value);
    } else if (auto* pe = dynamic_cast<PressureEvent*>(e)) {
        process_pressure(pe->value);
    }
}

// STM32H7 -- compile-time type tag, no RTTI
enum class EventType : uint8_t { temperature, pressure, humidity };

struct Event {
    EventType type;
};

struct TemperatureEvent : Event {
    float value;
    TemperatureEvent(float v) : Event{EventType::temperature}, value(v) {}
};

struct PressureEvent : Event {
    float value;
    PressureEvent(float v) : Event{EventType::pressure}, value(v) {}
};

void handle_event(const Event& e) {
    switch (e.type) {
        case EventType::temperature:
            process_temp(static_cast<const TemperatureEvent&>(e).value);
            break;
        case EventType::pressure:
            process_pressure(static_cast<const PressureEvent&>(e).value);
            break;
        default:
            break;
    }
}
```

### Solution B: `std::variant` (type-safe, no tag needed)

```cpp
#include <variant>

using Event = std::variant<TemperatureEvent, PressureEvent, HumidityEvent>;

void handle_event(const Event& e) {
    std::visit([](const auto& ev) {
        using T = std::decay_t<decltype(ev)>;
        if constexpr (std::is_same_v<T, TemperatureEvent>) {
            process_temp(ev.value);
        } else if constexpr (std::is_same_v<T, PressureEvent>) {
            process_pressure(ev.value);
        }
    }, e);
}
```

`std::variant` is fully type-safe, has no heap allocation, and the compiler resolves dispatch at compile time.

---

## STM32H7-Specific Concerns

### Memory Map Strategy

The H7 has multiple RAM regions. Use them deliberately:

| Region | Size | Best Use |
|--------|------|----------|
| DTCMRAM (0x2000_0000) | 128 KB | Stack, frequently accessed variables, lookup tables |
| AXI SRAM (0x2400_0000) | 512 KB | Main application data, RTOS heaps, large buffers |
| SRAM1/2/3 | ~288 KB | Secondary data, frame buffers |
| SRAM4 (0x3800_0000) | 64 KB | DMA buffers (not cached by default) |

Place DMA buffers in SRAM4 to avoid cache coherency issues entirely:

```c
// Linker section for DMA buffers
__attribute__((section(".dma_buf"))) alignas(32) uint8_t uart_rx_buf[256];
__attribute__((section(".dma_buf"))) alignas(32) uint8_t uart_tx_buf[256];
```

```ld
/* In linker script */
.dma_buf (NOLOAD) :
{
    . = ALIGN(32);
    *(.dma_buf)
    . = ALIGN(32);
} >SRAM4
```

### Cache Coherency

If DMA buffers are in cached RAM (AXI SRAM), you must maintain cache manually:

```cpp
// Before DMA TX: flush CPU writes to memory
SCB_CleanDCache_by_Addr(reinterpret_cast<uint32_t*>(tx_buf), sizeof(tx_buf));
HAL_UART_Transmit_DMA(&huart1, tx_buf, len);

// After DMA RX complete: invalidate stale cache
void HAL_UART_RxCpltCallback(UART_HandleTypeDef* huart) {
    SCB_InvalidateDCache_by_Addr(reinterpret_cast<uint32_t*>(rx_buf), sizeof(rx_buf));
    // Now safe to read rx_buf
}
```

Buffers must be 32-byte aligned and sized to a 32-byte multiple to avoid corrupting adjacent data.

---

## Migration Checklist

Work through this sequentially. Each step can be compiled and tested independently.

### Phase 1: Compiler flags and build system (Day 1)

- [ ] Add `-fno-exceptions -fno-rtti -fno-threadsafe-statics` to CMake
- [ ] Add `-ffunction-sections -fdata-sections` and `-Wl,--gc-sections`
- [ ] Add `-fstack-usage` to generate `.su` files for stack analysis
- [ ] Fix all compilation errors from disabled exceptions/RTTI
- [ ] Verify binary size with `arm-none-eabi-size firmware.elf`

### Phase 2: Replace exceptions (Days 2--3)

- [ ] Replace all `throw` with `std::optional` or `std::expected` returns
- [ ] Replace all `try/catch` with `if (auto result = ...)` checks
- [ ] Mark all fallible functions `[[nodiscard]]`
- [ ] Add error handling for every call site (compiler warnings guide you)

### Phase 3: Replace RTTI (Day 3)

- [ ] Replace `dynamic_cast` with explicit type tags or `std::variant`
- [ ] Replace `typeid` with enum-based type identification
- [ ] Verify no remaining RTTI usage: `grep -rn "dynamic_cast\|typeid" src/`

### Phase 4: Replace heap-allocating containers (Days 4--7)

- [ ] Audit every `std::vector` -- determine maximum size, replace with `std::array` or `etl::vector<T,N>`
- [ ] Audit every `std::string` -- replace with `etl::string<N>`, `std::string_view`, or `snprintf`
- [ ] Audit every `std::map`/`std::unordered_map` -- replace with `etl::map<K,V,N>` or `etl::flat_map`
- [ ] Search for hidden allocations: `std::function`, `std::any`, `std::regex`
- [ ] Replace `std::function` with function pointers + `void* context` or template callables

### Phase 5: Replace `shared_ptr` and fix ownership (Days 7--9)

- [ ] Identify true ownership for every `shared_ptr`
- [ ] Convert to `std::unique_ptr` where single owner exists (most cases)
- [ ] Convert to static objects + raw non-owning pointers for program-lifetime objects
- [ ] Use pool-backed `unique_ptr` with custom deleter for dynamically managed objects

### Phase 6: Replace virtual dispatch in hot paths (Days 9--10)

- [ ] Profile to identify hot paths (control loops, signal processing, ISR chains)
- [ ] Replace virtual dispatch in hot paths with CRTP
- [ ] Keep virtual dispatch for cold paths (config, UI, logging) if it simplifies the code
- [ ] Replace heterogeneous containers (`vector<Base*>`) with `std::variant`

### Phase 7: STM32H7 hardware integration (Days 10--14)

- [ ] Configure linker script memory regions (DTCMRAM, AXI SRAM, SRAM4)
- [ ] Place DMA buffers in SRAM4 or configure MPU non-cacheable regions
- [ ] Add cache maintenance calls for any DMA buffers in cached RAM
- [ ] Configure stack sizes for each RTOS task; verify with high-water-mark checks
- [ ] Add binary size budget gate to CI (90% flash, 80% RAM)
- [ ] Run `arm-none-eabi-size` and verify totals fit within budget

### Phase 8: Validation

- [ ] Build with `-Wall -Wextra -Werror` -- zero warnings
- [ ] Confirm no heap usage: override `_sbrk` to trap, or link with `--wrap=malloc` to detect calls
- [ ] Run unit tests on host PC with AddressSanitizer (`-fsanitize=address`)
- [ ] Run on target; monitor stack high-water marks under load
- [ ] Soak test for 48+ hours to confirm no memory leaks or fragmentation

---

## Detecting Hidden Heap Usage

After migration, confirm zero heap usage in production paths:

```cpp
// Override _sbrk to trap any heap allocation attempt
extern "C" caddr_t _sbrk(int incr) {
    (void)incr;
    // If we get here, something is allocating from the heap
    __BKPT(0);  // Breakpoint trap -- halts in debugger
    while (1) {}
}
```

Or use the linker `--wrap` mechanism:

```cmake
target_link_options(firmware PRIVATE
    -Wl,--wrap=malloc
    -Wl,--wrap=free
    -Wl,--wrap=calloc
    -Wl,--wrap=realloc
)
```

```cpp
extern "C" {
void* __wrap_malloc(size_t size) {
    (void)size;
    __BKPT(0);  // Trap: who is allocating?
    return nullptr;
}
void __wrap_free(void* ptr) {
    (void)ptr;
    __BKPT(0);  // Trap: who allocated this?
}
}
```

This catches any STL container, `std::string`, or library function that secretly calls `malloc`.

---

## Summary: Desktop to Embedded Translation Table

| Desktop C++ | STM32H7 Replacement | Heap-Free | Header |
|-------------|---------------------|-----------|--------|
| `std::vector<T>` | `std::array<T,N>` or `etl::vector<T,N>` | Yes | `<array>` / `<etl/vector.h>` |
| `std::string` | `etl::string<N>` or `std::string_view` | Yes | `<etl/string.h>` / `<string_view>` |
| `std::map<K,V>` | `etl::map<K,V,N>` or `etl::flat_map<K,V,N>` | Yes | `<etl/map.h>` |
| `std::shared_ptr<T>` | `std::unique_ptr<T>` or static + raw ptr | Yes | `<memory>` |
| `std::function<F>` | Function ptr + `void* ctx`, or template | Yes | N/A |
| `virtual` dispatch | CRTP or `std::variant` | Yes | `<variant>` |
| `throw` / `try` / `catch` | `std::optional` / `std::expected` / error codes | Yes | `<optional>` / `<expected>` |
| `dynamic_cast` | Type tag + `static_cast` or `std::variant` | Yes | `<variant>` |
| `typeid` | Enum type tag | Yes | N/A |
| `new` / `delete` | Object pool + placement new | Yes | `<new>` |
| `std::thread` | FreeRTOS `xTaskCreate` | Yes | `FreeRTOS.h` |
| `std::mutex` | FreeRTOS `xSemaphoreCreateMutex` | Yes | `semphr.h` |
