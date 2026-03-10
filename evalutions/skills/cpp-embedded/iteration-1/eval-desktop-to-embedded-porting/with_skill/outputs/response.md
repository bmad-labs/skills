# Desktop C++ to STM32H7 Porting Guide

## Target Constraints

| Resource | Available | Practical Budget |
|----------|-----------|-----------------|
| Flash | 2 MB | ~1.5 MB for application (reserve for bootloader, config sectors) |
| RAM | 1 MB (split across DTCMRAM, AXI SRAM, SRAM1-4) | Budget per region; see linker section strategy below |
| D-Cache | 16 KB | Must manage coherency for DMA buffers |
| I-Cache | 16 KB | Place hot paths in ITCM for zero wait-state |

## Step 0: Compiler Flags -- The Foundation

Before touching any code, configure the build to disable the features that are incompatible with deterministic embedded execution.

```cmake
# CMakeLists.txt
target_compile_options(firmware PRIVATE
    -fno-exceptions          # Removes exception tables and unwind info (~10-20% code size reduction)
    -fno-rtti                # Removes typeinfo and vtable type data
    -fno-threadsafe-statics  # No hidden mutex for local static init (use explicit init sequence)
    -ffunction-sections      # Each function in own section for dead-code elimination
    -fdata-sections          # Each variable in own section
    -fstack-usage            # Generate .su files to audit stack depth per function
    -Wall -Wextra -Werror
)
target_link_options(firmware PRIVATE
    -Wl,--gc-sections        # Linker removes unreferenced sections
    -Wl,--print-memory-usage # Show flash/RAM usage at link time
)
```

This is non-negotiable. With `-fno-exceptions` and `-fno-rtti`, any code that uses `throw`, `try/catch`, `typeid`, or `dynamic_cast` will fail to compile -- which is exactly what you want. It forces you to find and replace every instance.

---

## Migration 1: `std::vector<T>` to Fixed-Capacity Containers

### Problem

`std::vector` calls `malloc`/`realloc` under the hood. On an MCU with 1 MB RAM, heap fragmentation after hours of operation leads to allocation failures or silent corruption.

### Desktop (before)

```cpp
#include <vector>
#include <string>

struct SensorReading {
    uint32_t timestamp;
    float value;
};

class DataLogger {
public:
    void add_reading(float value) {
        readings_.push_back({get_time(), value});
        if (readings_.size() > 1000) {
            readings_.erase(readings_.begin());  // O(n) shift
        }
    }

    float average() const {
        float sum = 0;
        for (const auto& r : readings_) {
            sum += r.value;
        }
        return sum / readings_.size();
    }

private:
    std::vector<SensorReading> readings_;
};
```

### STM32H7 (after) -- Using `etl::circular_buffer` or a manual ring buffer

**Option A: Embedded Template Library (ETL)**

ETL provides drop-in replacements for STL containers with fixed, compile-time capacities and zero heap allocation.

```cpp
#include <etl/circular_buffer.h>
#include <cstdint>

struct SensorReading {
    uint32_t timestamp;
    float value;
};

class DataLogger {
public:
    void add_reading(float value) {
        // circular_buffer automatically overwrites oldest when full
        readings_.push(SensorReading{get_time(), value});
    }

    float average() const {
        if (readings_.empty()) return 0.0f;
        float sum = 0.0f;
        for (const auto& r : readings_) {
            sum += r.value;
        }
        return sum / static_cast<float>(readings_.size());
    }

private:
    // Fixed 1000 entries, ~8 KB on stack/static -- no heap
    etl::circular_buffer<SensorReading, 1000> readings_;
};
```

**Option B: `etl::vector` for general-purpose dynamic-style usage**

```cpp
#include <etl/vector.h>

// Fixed capacity of 64 elements, stored inline, no heap
etl::vector<SensorReading, 64> buffered_readings;

void process() {
    buffered_readings.push_back({get_time(), read_adc()});
    if (buffered_readings.full()) {
        flush_to_flash(buffered_readings.data(), buffered_readings.size());
        buffered_readings.clear();
    }
}
```

**Option C: `std::array` when the size is truly fixed**

```cpp
#include <array>
#include <cstddef>

// When you always have exactly N readings (e.g., a filter window)
constexpr size_t kFilterWindowSize = 16;
std::array<float, kFilterWindowSize> filter_window{};
size_t filter_index = 0;

void add_sample(float sample) {
    filter_window[filter_index] = sample;
    filter_index = (filter_index + 1) % kFilterWindowSize;
}
```

### Conversion cheat sheet

| Desktop pattern | Embedded replacement | Notes |
|---|---|---|
| `std::vector<T>` (unbounded) | `etl::vector<T, N>` | Fixed max capacity, same API |
| `std::vector<T>` as ring | `etl::circular_buffer<T, N>` | Auto-overwrites oldest |
| `std::vector<T>` (fixed size) | `std::array<T, N>` | Compile-time size, zero overhead |
| `std::deque<T>` | `etl::deque<T, N>` | Fixed capacity deque |
| `std::map<K,V>` | `etl::flat_map<K, V, N>` | Sorted array, cache-friendly |
| `std::unordered_map<K,V>` | `etl::unordered_map<K, V, N>` | Fixed bucket count |

---

## Migration 2: `std::string` to Fixed-Size Strings

### Problem

`std::string` allocates on the heap for any string longer than the SSO (Small String Optimization) buffer (typically 15-22 bytes). String concatenation causes repeated allocations.

### Desktop (before)

```cpp
#include <string>
#include <sstream>

class Logger {
public:
    void log(const std::string& module, const std::string& message) {
        std::string entry = "[" + module + "] " + message + "\n";
        log_buffer_ += entry;
        if (log_buffer_.size() > 4096) {
            flush();
        }
    }

private:
    std::string log_buffer_;
    void flush();
};
```

### STM32H7 (after)

```cpp
#include <etl/string.h>
#include <etl/string_view.h>
#include <cstdio>
#include <cstring>

class Logger {
public:
    // Accept string_view -- zero-copy, works with literals and etl::string
    void log(etl::string_view module, etl::string_view message) {
        // snprintf into the fixed buffer -- bounded, no heap
        int written = snprintf(
            &log_buffer_[write_pos_],
            kLogBufSize - write_pos_,
            "[%.*s] %.*s\n",
            static_cast<int>(module.size()), module.data(),
            static_cast<int>(message.size()), message.data()
        );

        if (written > 0) {
            write_pos_ += static_cast<size_t>(written);
        }

        if (write_pos_ > kFlushThreshold) {
            flush();
        }
    }

private:
    static constexpr size_t kLogBufSize = 4096;
    static constexpr size_t kFlushThreshold = 3800;

    char log_buffer_[kLogBufSize]{};
    size_t write_pos_{0};

    void flush() {
        // Transmit log_buffer_ over UART/ITM/etc.
        uart_send(reinterpret_cast<const uint8_t*>(log_buffer_), write_pos_);
        write_pos_ = 0;
    }
};

// For general string manipulation:
etl::string<64> device_name{"STM32H7-SensorNode"};
etl::string<128> status_msg;
status_msg = "Temp: ";
status_msg.append("25.3C");  // No heap allocation, truncates if > 128 chars
```

### Conversion cheat sheet

| Desktop pattern | Embedded replacement |
|---|---|
| `std::string` | `etl::string<N>` (fixed capacity, same API) |
| `const std::string&` parameter | `etl::string_view` or `std::string_view` (zero-copy) |
| `std::string` literal | `std::string_view` or `const char*` |
| `std::stringstream` | `snprintf` into a `char[]` buffer |
| `std::to_string()` | `snprintf` or `etl::to_string` |

---

## Migration 3: `std::shared_ptr<T>` to `std::unique_ptr<T>` with Pool Deleter

### Problem

`std::shared_ptr` has three embedded-hostile properties:
1. Allocates a control block on the heap (for the reference count)
2. Reference count updates are atomic (overhead on every copy/destroy)
3. Non-deterministic destruction time (last owner triggers destructor)

### Desktop (before)

```cpp
#include <memory>
#include <vector>

class Packet {
public:
    uint8_t data[256];
    size_t length;
};

class PacketRouter {
public:
    void route(std::shared_ptr<Packet> pkt) {
        // Multiple subsystems hold references to the same packet
        logger_->log(pkt);
        filter_->process(pkt);
        transmitter_->enqueue(pkt);
        // Packet freed when last shared_ptr goes out of scope
    }

private:
    std::shared_ptr<Logger> logger_;
    std::shared_ptr<Filter> filter_;
    std::shared_ptr<Transmitter> transmitter_;
};
```

### STM32H7 (after) -- Ownership transfer with `unique_ptr` + Object Pool

First, ask: does the packet truly need shared ownership, or is it passed through a pipeline? In most embedded systems, data flows through stages sequentially, so `unique_ptr` with ownership transfer is the correct model.

```cpp
#include <memory>
#include <cstdint>
#include <cstddef>

struct Packet {
    uint8_t data[256];
    size_t length;
};

// Object pool: pre-allocated, zero-fragmentation, O(1) alloc/free
template<typename T, size_t N>
class ObjectPool {
public:
    template<typename... Args>
    [[nodiscard]] T* allocate(Args&&... args) {
        for (auto& slot : slots_) {
            if (!slot.used) {
                slot.used = true;
                return new (&slot.storage) T(std::forward<Args>(args)...);
            }
        }
        return nullptr;  // Pool exhausted
    }

    void free(T* obj) {
        if (!obj) return;
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

// Global packet pool -- 16 packets pre-allocated in static memory
static ObjectPool<Packet, 16> g_packet_pool;

// Custom deleter returns packet to pool instead of calling delete
auto packet_deleter = [](Packet* p) { g_packet_pool.free(p); };
using UniquePacket = std::unique_ptr<Packet, decltype(packet_deleter)>;

[[nodiscard]] UniquePacket acquire_packet() {
    return UniquePacket(g_packet_pool.allocate(), packet_deleter);
}

// Pipeline: ownership moves through stages, no reference counting
class PacketRouter {
public:
    void route(UniquePacket pkt) {
        // Each stage borrows via raw pointer (non-owning), then ownership moves on
        logger_.log(pkt.get());           // Borrow: logger reads, does not own
        filter_.process(pkt.get());       // Borrow: filter modifies in-place
        transmitter_.enqueue(std::move(pkt));  // Transfer: transmitter now owns
        // Packet returned to pool when transmitter is done (unique_ptr destructs)
    }

private:
    Logger logger_;
    Filter filter_;
    Transmitter transmitter_;
};
```

If you truly need multiple owners (rare), use an explicit reference count inside the object itself:

```cpp
struct RefCountedPacket {
    uint8_t data[256];
    size_t length;
    std::atomic<uint8_t> ref_count{0};  // Manual ref count, no heap control block

    void add_ref() { ref_count.fetch_add(1, std::memory_order_relaxed); }

    void release() {
        if (ref_count.fetch_sub(1, std::memory_order_acq_rel) == 1) {
            g_packet_pool.free(this);  // Return to pool when count hits zero
        }
    }
};
```

---

## Migration 4: Virtual Functions to CRTP (Static Polymorphism)

### Problem

Virtual dispatch costs:
- 4 bytes per object (vtable pointer)
- Indirect branch on every call (pipeline flush on Cortex-M7, ~10 cycle penalty)
- Prevents inlining (compiler cannot see through the indirection)
- Virtual destructors add more vtable entries

### Desktop (before)

```cpp
class Sensor {
public:
    virtual ~Sensor() = default;
    virtual float read() = 0;
    virtual bool calibrate() = 0;
    virtual const char* name() const = 0;
};

class TemperatureSensor : public Sensor {
public:
    float read() override { return read_temp_register(); }
    bool calibrate() override { /* ... */ return true; }
    const char* name() const override { return "Temperature"; }
};

class PressureSensor : public Sensor {
public:
    float read() override { return read_pressure_register(); }
    bool calibrate() override { /* ... */ return true; }
    const char* name() const override { return "Pressure"; }
};

// Runtime polymorphism: type resolved at runtime via vtable
void poll_sensor(Sensor& s) {
    float value = s.read();  // Indirect call through vtable
    log_value(s.name(), value);
}
```

### STM32H7 (after) -- CRTP

```cpp
// Base: parameterized on derived type
template<typename Derived>
class Sensor {
public:
    float read() {
        return static_cast<Derived*>(this)->read_impl();
    }

    bool calibrate() {
        return static_cast<Derived*>(this)->calibrate_impl();
    }

    const char* name() const {
        return static_cast<const Derived*>(this)->name_impl();
    }
};

class TemperatureSensor : public Sensor<TemperatureSensor> {
public:
    float read_impl() { return read_temp_register(); }
    bool calibrate_impl() { /* ... */ return true; }
    const char* name_impl() const { return "Temperature"; }
};

class PressureSensor : public Sensor<PressureSensor> {
public:
    float read_impl() { return read_pressure_register(); }
    bool calibrate_impl() { /* ... */ return true; }
    const char* name_impl() const { return "Pressure"; }
};

// Compile-time polymorphism: type resolved at compile time, calls are inlined
template<typename S>
void poll_sensor(S& sensor) {
    float value = sensor.read();  // Direct call, inlineable
    log_value(sensor.name(), value);
}

// Usage
TemperatureSensor temp_sensor;
PressureSensor press_sensor;

void poll_all() {
    poll_sensor(temp_sensor);   // Compiler generates specialized code for each
    poll_sensor(press_sensor);  // No vtable, no indirect branch
}
```

### When virtual is still acceptable

Virtual dispatch is fine for code paths that run at human interaction speeds:

- Menu systems, UI screens
- Configuration/setup (runs once at boot)
- Command parsers that execute infrequently

Keep virtual out of:
- Control loops (PID, motor control, signal processing)
- ISR callback chains
- Anything running at > 1 kHz

---

## Migration 5: Exceptions to Error Codes and `std::optional`

### Problem

C++ exceptions require:
- Unwind tables stored in flash (can add 10-20% to code size)
- Runtime stack unwinding (non-deterministic time)
- Hidden control flow that is hard to reason about in real-time systems

### Desktop (before)

```cpp
#include <stdexcept>
#include <string>

class SensorDriver {
public:
    float read_temperature() {
        if (!initialized_) {
            throw std::runtime_error("Sensor not initialized");
        }
        auto raw = i2c_read(addr_, TEMP_REG);
        if (raw == 0xFFFF) {
            throw std::runtime_error("I2C read failed");
        }
        return convert_temperature(raw);
    }

    void initialize() {
        if (i2c_write(addr_, CONFIG_REG, config_) != 0) {
            throw std::runtime_error("Failed to configure sensor");
        }
        initialized_ = true;
    }

private:
    uint8_t addr_;
    uint16_t config_;
    bool initialized_ = false;
};

// Caller wraps in try/catch
void main_loop() {
    try {
        float temp = sensor.read_temperature();
        process(temp);
    } catch (const std::exception& e) {
        log_error(e.what());
    }
}
```

### STM32H7 (after) -- `std::optional` and error codes

```cpp
#include <optional>
#include <cstdint>

// Explicit error codes for this module
enum class SensorError : uint8_t {
    kOk = 0,
    kNotInitialized,
    kI2cReadFailed,
    kI2cWriteFailed,
    kInvalidReading,
};

class SensorDriver {
public:
    // Returns nullopt on failure, valid reading on success
    [[nodiscard]] std::optional<float> read_temperature() const {
        if (!initialized_) return std::nullopt;

        const uint16_t raw = i2c_read(addr_, TEMP_REG);
        if (raw == 0xFFFF) return std::nullopt;

        return convert_temperature(raw);
    }

    // Returns error code for richer diagnostics
    [[nodiscard]] SensorError initialize() {
        if (i2c_write(addr_, CONFIG_REG, config_) != 0) {
            return SensorError::kI2cWriteFailed;
        }
        initialized_ = true;
        return SensorError::kOk;
    }

private:
    uint8_t addr_;
    uint16_t config_;
    bool initialized_ = false;
};

// Caller handles errors explicitly -- no hidden control flow
void main_loop() {
    if (auto temp = sensor.read_temperature()) {
        process(*temp);
    } else {
        log_warning("Sensor read failed");
        // Decide recovery: retry, use last known value, alert operator
    }
}
```

For functions that can fail in multiple distinct ways, combine an error code with an optional payload:

```cpp
struct ReadResult {
    SensorError error;
    float value;  // Only valid when error == kOk
};

[[nodiscard]] ReadResult read_temperature_detailed() const {
    if (!initialized_) return {SensorError::kNotInitialized, 0.0f};

    const uint16_t raw = i2c_read(addr_, TEMP_REG);
    if (raw == 0xFFFF) return {SensorError::kI2cReadFailed, 0.0f};

    const float temp = convert_temperature(raw);
    if (temp < -40.0f || temp > 125.0f) return {SensorError::kInvalidReading, temp};

    return {SensorError::kOk, temp};
}
```

---

## Migration 6: RTTI (`typeid`, `dynamic_cast`) to Compile-Time Type Resolution

### Problem

RTTI generates type information tables in flash and enables `dynamic_cast` which does a runtime type hierarchy walk. With `-fno-rtti`, these are unavailable.

### Desktop (before)

```cpp
#include <typeinfo>
#include <iostream>

class Device {
public:
    virtual ~Device() = default;
    virtual void process() = 0;
};

class UartDevice : public Device {
public:
    void process() override { /* UART logic */ }
    void set_baud(uint32_t baud) { baud_ = baud; }
private:
    uint32_t baud_ = 115200;
};

class SpiDevice : public Device {
public:
    void process() override { /* SPI logic */ }
    void set_clock(uint32_t freq) { freq_ = freq; }
private:
    uint32_t freq_ = 1000000;
};

void configure(Device* dev) {
    // RTTI: runtime type check
    if (auto* uart = dynamic_cast<UartDevice*>(dev)) {
        uart->set_baud(9600);
    } else if (auto* spi = dynamic_cast<SpiDevice*>(dev)) {
        spi->set_clock(4000000);
    }
    std::cout << "Device type: " << typeid(*dev).name() << "\n";
}
```

### STM32H7 (after) -- Explicit type tags or `std::variant`

**Option A: Type tag enum (most common in firmware)**

```cpp
#include <cstdint>

enum class DeviceType : uint8_t {
    kUart,
    kSpi,
};

struct UartConfig {
    uint32_t baud = 115200;
};

struct SpiConfig {
    uint32_t clock_hz = 1000000;
};

struct Device {
    DeviceType type;
    union {
        UartConfig uart;
        SpiConfig spi;
    } config;

    void process() {
        switch (type) {
            case DeviceType::kUart: process_uart(); break;
            case DeviceType::kSpi:  process_spi();  break;
        }
    }

private:
    void process_uart();
    void process_spi();
};

void configure(Device& dev) {
    switch (dev.type) {
        case DeviceType::kUart:
            dev.config.uart.baud = 9600;
            break;
        case DeviceType::kSpi:
            dev.config.spi.clock_hz = 4000000;
            break;
    }
}
```

**Option B: `etl::variant` (type-safe, no heap)**

```cpp
#include <etl/variant.h>

struct UartDevice {
    uint32_t baud = 115200;
    void process() { /* UART logic */ }
};

struct SpiDevice {
    uint32_t clock_hz = 1000000;
    void process() { /* SPI logic */ }
};

using Device = etl::variant<UartDevice, SpiDevice>;

void configure(Device& dev) {
    if (auto* uart = etl::get_if<UartDevice>(&dev)) {
        uart->baud = 9600;
    } else if (auto* spi = etl::get_if<SpiDevice>(&dev)) {
        spi->clock_hz = 4000000;
    }
}

void process(Device& dev) {
    etl::visit([](auto& d) { d.process(); }, dev);
}
```

---

## STM32H7-Specific Memory Layout Strategy

The STM32H7 has a complex memory map. Use it intentionally:

```
MEMORY REGION           SIZE     USE FOR
-------------------------------------------------------------------
ITCM (0x0000_0000)      64 KB   Hot functions (ISRs, control loops)
DTCM (0x2000_0000)     128 KB   Stacks, hot data, lookup tables
AXI SRAM (0x2400_0000) 512 KB   Main application data, large buffers
SRAM1 (0x3000_0000)    128 KB   General purpose
SRAM2 (0x3002_0000)    128 KB   General purpose
SRAM4 (0x3800_0000)     64 KB   DMA buffers (not cached by default)
FLASH (0x0800_0000)      2 MB   Code + const data
```

### Linker script strategy

```ld
MEMORY {
    FLASH   (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    AXIRAM  (xrw) : ORIGIN = 0x24000000, LENGTH = 512K
    SRAM1   (xrw) : ORIGIN = 0x30000000, LENGTH = 128K
    SRAM2   (xrw) : ORIGIN = 0x30020000, LENGTH = 128K
    SRAM4   (xrw) : ORIGIN = 0x38000000, LENGTH = 64K
    ITCMRAM (xrw) : ORIGIN = 0x00000000, LENGTH = 64K
}

/* DMA buffers in non-cached SRAM4 */
.dma_buf (NOLOAD) : {
    . = ALIGN(32);
    *(.dma_buf)
    . = ALIGN(32);
} >SRAM4

/* Hot code in ITCM */
.itcm_text : {
    *(.itcm_text)
    *(.itcm_text*)
} >ITCMRAM AT> FLASH

/* Fast data in DTCM */
.dtcm_data : {
    *(.dtcm_data)
    *(.dtcm_data*)
} >DTCMRAM AT> FLASH
```

### Placing buffers and hot code

```cpp
// DMA buffers: SRAM4, 32-byte aligned for cache line coherency
__attribute__((section(".dma_buf"), aligned(32)))
static uint8_t uart_rx_dma[512];

__attribute__((section(".dma_buf"), aligned(32)))
static uint8_t uart_tx_dma[512];

// Hot control loop in ITCM -- zero wait state
__attribute__((section(".itcm_text"), noinline))
void motor_control_isr() {
    // PID loop runs from ITCM: no flash wait states, no cache misses
}

// Lookup tables in DTCM for fast access
__attribute__((section(".dtcm_data")))
static const uint16_t sin_table[1024] = { /* ... */ };
```

---

## Migration Checklist

Work through the codebase in this order:

### Phase 1: Build infrastructure (Day 1)
- [ ] Set up cross-compilation toolchain (arm-none-eabi-gcc)
- [ ] Configure CMake with `-fno-exceptions -fno-rtti -ffunction-sections -fdata-sections`
- [ ] Add ETL as a dependency (`etl::etl` in CMake)
- [ ] Create linker script with STM32H7 memory regions
- [ ] Verify a minimal blinky builds and runs on target

### Phase 2: Eliminate exceptions (Days 2-3)
- [ ] Grep for `throw`, `try`, `catch` -- replace each with `std::optional` or error codes
- [ ] Replace `std::runtime_error`, `std::logic_error`, etc. with enum error codes
- [ ] Add `[[nodiscard]]` to every function that returns an error code or optional
- [ ] Verify build succeeds with `-fno-exceptions`

### Phase 3: Eliminate RTTI (Day 3)
- [ ] Grep for `typeid`, `dynamic_cast` -- replace with type tags or variant
- [ ] Verify build succeeds with `-fno-rtti`

### Phase 4: Replace heap-allocating containers (Days 4-7)
- [ ] `std::vector<T>` -> `etl::vector<T, N>` or `std::array<T, N>`
- [ ] `std::string` -> `etl::string<N>` or `std::string_view`
- [ ] `std::map` -> `etl::flat_map<K, V, N>`
- [ ] `std::unordered_map` -> `etl::unordered_map<K, V, N>`
- [ ] `std::list` -> `etl::list<T, N>`
- [ ] `std::function` -> function pointers or template parameters
- [ ] Determine the correct `N` for each container by analyzing max usage in the desktop version

### Phase 5: Replace smart pointers (Days 7-8)
- [ ] `std::shared_ptr<T>` -> `std::unique_ptr<T, Deleter>` with pool deleter where ownership transfers
- [ ] `std::shared_ptr<T>` -> raw observing pointer where shared observation is needed
- [ ] Create object pools for frequently allocated/freed types
- [ ] Audit every `new`/`delete` -- replace with pool allocation or static objects

### Phase 6: Replace virtual dispatch in hot paths (Days 8-9)
- [ ] Identify virtual calls in control loops, ISRs, and high-frequency paths
- [ ] Convert to CRTP where the set of types is known at compile time
- [ ] Keep virtual for UI/config code where it simplifies the design
- [ ] Audit vtable sizes with `arm-none-eabi-nm --size-sort firmware.elf`

### Phase 7: Memory validation (Day 10)
- [ ] Check `.su` files for stack depth per function (`-fstack-usage`)
- [ ] Verify total flash/RAM usage with `arm-none-eabi-size firmware.elf`
- [ ] Set stack sizes for each FreeRTOS task based on worst-case call depth
- [ ] Add stack overflow detection (FreeRTOS `configCHECK_FOR_STACK_OVERFLOW = 2`)
- [ ] Enable MPU to protect stack guard regions
- [ ] Run the application under load for 24+ hours watching for memory creep

---

## Quick Reference: Desktop-to-Embedded Substitution Table

| Desktop C++ | Embedded C++ (STM32H7) | Header |
|---|---|---|
| `std::vector<T>` | `etl::vector<T, N>` | `<etl/vector.h>` |
| `std::string` | `etl::string<N>` | `<etl/string.h>` |
| `const std::string&` | `std::string_view` | `<string_view>` |
| `std::map<K,V>` | `etl::flat_map<K, V, N>` | `<etl/flat_map.h>` |
| `std::unordered_map<K,V>` | `etl::unordered_map<K, V, N>` | `<etl/unordered_map.h>` |
| `std::list<T>` | `etl::list<T, N>` | `<etl/list.h>` |
| `std::shared_ptr<T>` | `std::unique_ptr<T, PoolDeleter>` | `<memory>` |
| `std::function<Sig>` | Template parameter or function pointer | -- |
| `virtual` dispatch | CRTP | -- |
| `throw` / `try` / `catch` | `std::optional`, error codes | `<optional>` |
| `dynamic_cast<T*>` | Type tag enum + `switch` | -- |
| `typeid(x).name()` | Explicit `name()` method or constexpr string | -- |
| `new T` | Placement new into pool/static storage | `<new>` |
| `delete p` | Pool `free()` via `unique_ptr` custom deleter | -- |
| `std::thread` | FreeRTOS `xTaskCreate` | `FreeRTOS.h` |
| `std::mutex` | FreeRTOS `xSemaphoreCreateMutex` | `semphr.h` |
| `malloc` / `free` | Object pool or arena allocator | -- |
