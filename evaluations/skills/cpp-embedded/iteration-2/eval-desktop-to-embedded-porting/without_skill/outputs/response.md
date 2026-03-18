# Porting Desktop C++ to STM32H7: Concrete Migration Guide

## Target Constraints

| Resource | Available | Practical Budget |
|----------|-----------|-----------------|
| Flash    | 2 MB      | ~1.5 MB for application (reserve for bootloader/config) |
| RAM      | 1 MB      | ~768 KB usable (stack, heap, peripherals, DMA buffers) |
| RTTI     | Costs 10-30% extra Flash | Eliminate |
| Exceptions | Costs 20-50 KB+ Flash, unpredictable timing | Eliminate |
| Dynamic allocation | Causes fragmentation, non-deterministic | Minimize or eliminate |

## Compiler Flags Starting Point

```makefile
# In your Makefile / CMakeLists.txt
CXXFLAGS += -fno-exceptions -fno-rtti -fno-threadsafe-statics
CXXFLAGS += -Os -ffunction-sections -fdata-sections
LDFLAGS  += -Wl,--gc-sections -Wl,--print-memory-usage
```

These flags alone will reduce binary size significantly. The rest of this guide addresses the code changes needed to compile and run correctly with these flags.

---

## 1. Replacing `std::vector` with Static Containers

### Problem

`std::vector` allocates on the heap, reallocates as it grows, and fragments memory over time. On a 1 MB RAM system, a few fragmented allocations can make large contiguous blocks unavailable.

### Replacement: Fixed-Capacity Array Wrapper

```cpp
// static_vector.h
#pragma once
#include <cstddef>
#include <cstdint>
#include <new>       // placement new
#include <utility>   // std::move

// Drop-in replacement for std::vector with compile-time max capacity.
// Lives entirely in-place (stack, static, or inside another struct).
template <typename T, std::size_t Capacity>
class StaticVector {
public:
    using value_type = T;
    using iterator = T*;
    using const_iterator = const T*;

    StaticVector() = default;

    ~StaticVector() {
        clear();
    }

    // No copy (prevent accidental large copies); enable move.
    StaticVector(const StaticVector&) = delete;
    StaticVector& operator=(const StaticVector&) = delete;

    StaticVector(StaticVector&& other) noexcept {
        for (std::size_t i = 0; i < other.m_size; ++i) {
            new (&storage_at(i)) T(std::move(other.storage_at(i)));
        }
        m_size = other.m_size;
        other.clear();
    }

    bool push_back(const T& value) {
        if (m_size >= Capacity) return false; // caller checks
        new (&storage_at(m_size)) T(value);
        ++m_size;
        return true;
    }

    bool push_back(T&& value) {
        if (m_size >= Capacity) return false;
        new (&storage_at(m_size)) T(std::move(value));
        ++m_size;
        return true;
    }

    void pop_back() {
        if (m_size > 0) {
            --m_size;
            storage_at(m_size).~T();
        }
    }

    void clear() {
        for (std::size_t i = 0; i < m_size; ++i) {
            storage_at(i).~T();
        }
        m_size = 0;
    }

    T&       operator[](std::size_t i)       { return storage_at(i); }
    const T& operator[](std::size_t i) const { return storage_at(i); }

    std::size_t size()     const { return m_size; }
    std::size_t capacity() const { return Capacity; }
    bool        empty()    const { return m_size == 0; }
    bool        full()     const { return m_size == Capacity; }

    iterator       begin()       { return &storage_at(0); }
    iterator       end()         { return &storage_at(m_size); }
    const_iterator begin() const { return &storage_at(0); }
    const_iterator end()   const { return &storage_at(m_size); }

private:
    alignas(T) uint8_t m_storage[Capacity * sizeof(T)]{};
    std::size_t m_size = 0;

    T&       storage_at(std::size_t i)       { return *reinterpret_cast<T*>(&m_storage[i * sizeof(T)]); }
    const T& storage_at(std::size_t i) const { return *reinterpret_cast<const T*>(&m_storage[i * sizeof(T)]); }
};
```

### Migration Example

```cpp
// BEFORE (desktop)
std::vector<SensorReading> readings;
readings.push_back(new_reading);
for (auto& r : readings) { process(r); }

// AFTER (embedded)
StaticVector<SensorReading, 64> readings;  // Max 64 readings, no heap
if (!readings.push_back(new_reading)) {
    error_handler(Error::BufferFull);      // Explicit overflow handling
}
for (auto& r : readings) { process(r); }
```

### When You Truly Need Dynamic Sizes: Pool Allocator

If some vectors must vary in size at runtime but you know the maximum element count system-wide, use a memory pool:

```cpp
// pool_allocator.h
#pragma once
#include <cstddef>
#include <cstdint>

template <typename T, std::size_t PoolSize>
class PoolAllocator {
public:
    T* allocate() {
        for (std::size_t i = 0; i < PoolSize; ++i) {
            if (!m_used[i]) {
                m_used[i] = true;
                return reinterpret_cast<T*>(&m_pool[i * sizeof(T)]);
            }
        }
        return nullptr; // Pool exhausted
    }

    void deallocate(T* ptr) {
        auto offset = reinterpret_cast<uint8_t*>(ptr) - m_pool;
        std::size_t index = static_cast<std::size_t>(offset) / sizeof(T);
        if (index < PoolSize) {
            ptr->~T();
            m_used[index] = false;
        }
    }

    std::size_t available() const {
        std::size_t count = 0;
        for (std::size_t i = 0; i < PoolSize; ++i) {
            if (!m_used[i]) ++count;
        }
        return count;
    }

private:
    alignas(T) uint8_t m_pool[PoolSize * sizeof(T)]{};
    bool m_used[PoolSize]{};
};
```

---

## 2. Replacing `std::string` with Fixed Strings

### Problem

`std::string` does heap allocation (except for SSO which is implementation-defined and typically 15-22 chars). On embedded targets, you want zero heap usage for strings.

### Replacement: Fixed-Length String

```cpp
// fixed_string.h
#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>

template <std::size_t MaxLen>
class FixedString {
public:
    FixedString() { m_data[0] = '\0'; }

    FixedString(const char* src) {
        assign(src);
    }

    void assign(const char* src) {
        if (src == nullptr) {
            m_data[0] = '\0';
            m_length = 0;
            return;
        }
        m_length = std::strlen(src);
        if (m_length > MaxLen) {
            m_length = MaxLen; // Truncate, don't crash
        }
        std::memcpy(m_data, src, m_length);
        m_data[m_length] = '\0';
    }

    bool append(const char* src) {
        std::size_t src_len = std::strlen(src);
        if (m_length + src_len > MaxLen) return false;
        std::memcpy(m_data + m_length, src, src_len);
        m_length += src_len;
        m_data[m_length] = '\0';
        return true;
    }

    const char* c_str()  const { return m_data; }
    std::size_t length() const { return m_length; }
    std::size_t max_size() const { return MaxLen; }
    bool        empty()  const { return m_length == 0; }

    bool operator==(const FixedString& other) const {
        return m_length == other.m_length && std::memcmp(m_data, other.m_data, m_length) == 0;
    }

    bool operator==(const char* other) const {
        return std::strcmp(m_data, other) == 0;
    }

    char  operator[](std::size_t i) const { return m_data[i]; }
    char& operator[](std::size_t i)       { return m_data[i]; }

private:
    char m_data[MaxLen + 1]{};
    std::size_t m_length = 0;
};
```

### Migration Example

```cpp
// BEFORE (desktop)
std::string device_name = "Sensor_" + std::to_string(id);
log("Device: " + device_name);

// AFTER (embedded)
FixedString<32> device_name("Sensor_");
char id_buf[8];
snprintf(id_buf, sizeof(id_buf), "%u", id);
device_name.append(id_buf);
log(device_name.c_str()); // Pass const char* to logging
```

### String View for Zero-Copy References

For functions that only read strings, use `etl::string_view` or a minimal implementation:

```cpp
// string_view.h (minimal embedded-friendly version)
#pragma once
#include <cstddef>
#include <cstring>

class StringView {
public:
    constexpr StringView() = default;
    constexpr StringView(const char* str, std::size_t len) : m_ptr(str), m_len(len) {}
    StringView(const char* str) : m_ptr(str), m_len(std::strlen(str)) {}

    const char* data()   const { return m_ptr; }
    std::size_t size()   const { return m_len; }
    bool        empty()  const { return m_len == 0; }

    char operator[](std::size_t i) const { return m_ptr[i]; }

private:
    const char* m_ptr = nullptr;
    std::size_t m_len = 0;
};
```

---

## 3. Replacing `std::shared_ptr` with Static Ownership

### Problem

`std::shared_ptr` uses heap allocation (for the control block), atomic reference counting (expensive on Cortex-M7 even though it has atomics), and hides ownership semantics that should be explicit in embedded code.

### Strategy: Determine Actual Ownership Pattern

Most `shared_ptr` usage falls into one of these real patterns:

| Desktop Pattern | Actual Intent | Embedded Replacement |
|----------------|---------------|---------------------|
| `shared_ptr<T>` with one real owner | Single ownership | Raw pointer or reference to statically allocated object |
| `shared_ptr<T>` passed to callbacks | Keeping object alive | Static object + validity flag |
| `shared_ptr<T>` in a container | Polymorphic collection | Object pool + index handle |

### Pattern A: Single Owner with Observers

```cpp
// BEFORE (desktop)
class SensorManager {
    std::shared_ptr<Sensor> m_sensor;
public:
    std::shared_ptr<Sensor> get_sensor() { return m_sensor; }
};

class Display {
    std::shared_ptr<Sensor> m_sensor; // just reads from it
};

// AFTER (embedded) - Static allocation, non-owning references
class SensorManager {
    Sensor m_sensor;  // Owns the sensor, statically allocated
public:
    Sensor* get_sensor() { return &m_sensor; }
};

class Display {
    Sensor* m_sensor = nullptr;  // Non-owning observer pointer
public:
    void set_sensor(Sensor* s) { m_sensor = s; }
    void update() {
        if (m_sensor) {
            m_sensor->read_display_data();
        }
    }
};

// Wired up at init (deterministic lifetime)
static SensorManager g_sensor_mgr;
static Display g_display;

void system_init() {
    g_display.set_sensor(g_sensor_mgr.get_sensor());
}
```

### Pattern B: Handle-Based Ownership (replacing shared_ptr in containers)

```cpp
// handle.h - Type-safe index into a pool
#pragma once
#include <cstdint>

template <typename T>
struct Handle {
    uint16_t index      = 0xFFFF;
    uint16_t generation = 0;       // Detects use-after-free

    bool valid() const { return index != 0xFFFF; }
};

template <typename T, std::size_t Capacity>
class HandlePool {
public:
    Handle<T> create() {
        for (uint16_t i = 0; i < Capacity; ++i) {
            if (!m_active[i]) {
                m_active[i] = true;
                m_generation[i]++;
                new (&slot(i)) T();
                return { i, m_generation[i] };
            }
        }
        return {}; // Invalid handle
    }

    T* get(Handle<T> h) {
        if (h.index >= Capacity || !m_active[h.index]) return nullptr;
        if (m_generation[h.index] != h.generation) return nullptr; // stale
        return &slot(h.index);
    }

    void destroy(Handle<T> h) {
        if (h.index < Capacity && m_active[h.index] &&
            m_generation[h.index] == h.generation) {
            slot(h.index).~T();
            m_active[h.index] = false;
        }
    }

private:
    alignas(T) uint8_t m_storage[Capacity * sizeof(T)]{};
    bool     m_active[Capacity]{};
    uint16_t m_generation[Capacity]{};

    T& slot(uint16_t i) { return *reinterpret_cast<T*>(&m_storage[i * sizeof(T)]); }
};
```

```cpp
// BEFORE (desktop)
std::vector<std::shared_ptr<Connection>> connections;
auto conn = std::make_shared<Connection>(addr);
connections.push_back(conn);

// AFTER (embedded)
static HandlePool<Connection, 16> g_conn_pool;
static StaticVector<Handle<Connection>, 16> connections;

Handle<Connection> h = g_conn_pool.create();
Connection* conn = g_conn_pool.get(h);
if (conn) {
    conn->set_address(addr);
    connections.push_back(h);
}
```

---

## 4. Replacing Virtual Functions (Eliminating vtables)

### Problem

Virtual functions require vtable pointers (4 bytes per object on Cortex-M7), vtable lookups (indirect branches, bad for pipeline), and RTTI support for `dynamic_cast`. Each virtual class also stores a vtable in Flash.

### Replacement A: CRTP (Compile-Time Polymorphism)

Use when the set of types is known at compile time.

```cpp
// BEFORE (desktop)
class Sensor {
public:
    virtual ~Sensor() = default;
    virtual int32_t read() = 0;
    virtual void calibrate() = 0;
};

class Accelerometer : public Sensor {
public:
    int32_t read() override { /* ... */ return accel_value; }
    void calibrate() override { /* ... */ }
};

class Gyroscope : public Sensor {
public:
    int32_t read() override { /* ... */ return gyro_value; }
    void calibrate() override { /* ... */ }
};

void poll_sensor(Sensor& s) {
    auto val = s.read();  // virtual dispatch
}

// AFTER (embedded) - CRTP: zero-overhead, no vtable
template <typename Derived>
class SensorBase {
public:
    int32_t read() {
        return static_cast<Derived*>(this)->read_impl();
    }
    void calibrate() {
        static_cast<Derived*>(this)->calibrate_impl();
    }
};

class Accelerometer : public SensorBase<Accelerometer> {
public:
    int32_t read_impl() { /* ... */ return accel_value; }
    void calibrate_impl() { /* ... */ }
private:
    int32_t accel_value = 0;
};

class Gyroscope : public SensorBase<Gyroscope> {
public:
    int32_t read_impl() { /* ... */ return gyro_value; }
    void calibrate_impl() { /* ... */ }
private:
    int32_t gyro_value = 0;
};

// Templated function - resolved at compile time
template <typename S>
void poll_sensor(S& s) {
    auto val = s.read();  // Direct call, no vtable
}
```

### Replacement B: Variant-Based Dispatch (when you need a collection of mixed types)

```cpp
// tagged_variant.h - Manual variant for when you need runtime dispatch
// without vtables

#include <cstdint>
#include <new>

enum class SensorType : uint8_t {
    Accelerometer,
    Gyroscope,
    Temperature,
};

struct AccelData {
    int32_t read()      { /* HW register read */ return 0; }
    void    calibrate() { /* ... */ }
};

struct GyroData {
    int32_t read()      { /* HW register read */ return 0; }
    void    calibrate() { /* ... */ }
};

struct TempData {
    int32_t read()      { /* ADC read */ return 0; }
    void    calibrate() { /* ... */ }
};

class AnySensor {
public:
    SensorType type;

    // Construct in-place
    static AnySensor make_accel() {
        AnySensor s;
        s.type = SensorType::Accelerometer;
        new (&s.m_storage) AccelData();
        return s;
    }

    static AnySensor make_gyro() {
        AnySensor s;
        s.type = SensorType::Gyroscope;
        new (&s.m_storage) GyroData();
        return s;
    }

    int32_t read() {
        switch (type) {
            case SensorType::Accelerometer:
                return reinterpret_cast<AccelData*>(m_storage)->read();
            case SensorType::Gyroscope:
                return reinterpret_cast<GyroData*>(m_storage)->read();
            case SensorType::Temperature:
                return reinterpret_cast<TempData*>(m_storage)->read();
        }
        return 0;
    }

    void calibrate() {
        switch (type) {
            case SensorType::Accelerometer:
                reinterpret_cast<AccelData*>(m_storage)->calibrate(); break;
            case SensorType::Gyroscope:
                reinterpret_cast<GyroData*>(m_storage)->calibrate(); break;
            case SensorType::Temperature:
                reinterpret_cast<TempData*>(m_storage)->calibrate(); break;
        }
    }

private:
    // Storage large enough for the biggest sensor type
    static constexpr std::size_t kMaxSize = sizeof(GyroData); // pick the largest
    alignas(8) uint8_t m_storage[kMaxSize]{};
};
```

### Replacement C: Function Pointer Table (when you need runtime registration)

```cpp
// For truly dynamic dispatch (e.g., driver registration at startup)
struct SensorOps {
    int32_t (*read)(void* ctx);
    void    (*calibrate)(void* ctx);
};

struct SensorInstance {
    const SensorOps* ops;
    void*            ctx;  // Points to the concrete sensor's data

    int32_t read()      { return ops->read(ctx); }
    void    calibrate() { ops->calibrate(ctx); }
};

// Concrete implementations
static int32_t accel_read(void* ctx) {
    auto* data = static_cast<AccelHwData*>(ctx);
    return data->reg_value;
}

static void accel_calibrate(void* ctx) {
    auto* data = static_cast<AccelHwData*>(ctx);
    data->offset = measure_offset();
}

static const SensorOps accel_ops = { accel_read, accel_calibrate };

// Usage
static AccelHwData g_accel_hw;
static SensorInstance g_accel = { &accel_ops, &g_accel_hw };
```

---

## 5. Replacing Exceptions with Error Codes

### Problem

C++ exceptions use table-based unwinding (large Flash overhead) or setjmp/longjmp (RAM + CPU overhead). Timing is non-deterministic. With `-fno-exceptions`, any `throw` will call `std::abort()`.

### Replacement: Result Type

```cpp
// result.h
#pragma once
#include <cstdint>

enum class ErrorCode : uint8_t {
    Ok = 0,
    Timeout,
    InvalidParam,
    HardwareFault,
    BufferFull,
    NotReady,
    ChecksumMismatch,
    // Add domain-specific errors here
};

// Lightweight Result type - no exceptions, no heap
template <typename T>
class Result {
public:
    // Success case
    static Result ok(T value) {
        Result r;
        r.m_value = value;
        r.m_error = ErrorCode::Ok;
        r.m_has_value = true;
        return r;
    }

    // Error case
    static Result error(ErrorCode err) {
        Result r;
        r.m_error = err;
        r.m_has_value = false;
        return r;
    }

    bool      is_ok()    const { return m_has_value; }
    bool      is_error() const { return !m_has_value; }
    ErrorCode error()    const { return m_error; }

    // Access value - caller must check is_ok() first
    T&       value()       { return m_value; }
    const T& value() const { return m_value; }

    // Convenience: get value or a default
    T value_or(T fallback) const { return m_has_value ? m_value : fallback; }

private:
    T         m_value{};
    ErrorCode m_error = ErrorCode::Ok;
    bool      m_has_value = false;
};

// Specialization for void (no value, just success/failure)
template <>
class Result<void> {
public:
    static Result ok()               { Result r; r.m_error = ErrorCode::Ok; return r; }
    static Result error(ErrorCode e) { Result r; r.m_error = e; return r; }

    bool      is_ok()    const { return m_error == ErrorCode::Ok; }
    bool      is_error() const { return m_error != ErrorCode::Ok; }
    ErrorCode error()    const { return m_error; }

private:
    ErrorCode m_error = ErrorCode::Ok;
};
```

### Migration Example

```cpp
// BEFORE (desktop)
class SpiDriver {
public:
    std::vector<uint8_t> read(uint8_t reg, size_t len) {
        if (!is_initialized()) throw std::runtime_error("SPI not initialized");
        auto result = hw_read(reg, len);
        if (result.empty()) throw std::runtime_error("SPI read failed");
        return result;
    }
};

try {
    auto data = spi.read(0x42, 16);
    process(data);
} catch (const std::exception& e) {
    log_error(e.what());
}

// AFTER (embedded)
class SpiDriver {
public:
    struct ReadResult {
        uint8_t  data[256];
        uint16_t length;
    };

    Result<ReadResult> read(uint8_t reg, uint16_t len) {
        if (!is_initialized()) {
            return Result<ReadResult>::error(ErrorCode::NotReady);
        }
        if (len > sizeof(ReadResult::data)) {
            return Result<ReadResult>::error(ErrorCode::InvalidParam);
        }

        ReadResult result{};
        if (!hw_read(reg, result.data, len)) {
            return Result<ReadResult>::error(ErrorCode::HardwareFault);
        }
        result.length = len;
        return Result<ReadResult>::ok(result);
    }
};

// Usage - explicit error handling, no hidden control flow
auto result = spi.read(0x42, 16);
if (result.is_ok()) {
    process(result.value().data, result.value().length);
} else {
    log_error("SPI read failed", result.error());
    // Take specific recovery action based on error code
}
```

---

## 6. Replacing RTTI (`dynamic_cast`, `typeid`)

### Problem

RTTI stores type name strings and type hierarchy metadata in Flash. `-fno-rtti` disables it entirely, so `dynamic_cast` and `typeid` will not compile.

### Replacement: Manual Type Tags

```cpp
// BEFORE (desktop)
class Device { public: virtual ~Device() = default; };
class UartDevice : public Device { /* ... */ };
class SpiDevice  : public Device { /* ... */ };

void configure(Device* dev) {
    if (auto* uart = dynamic_cast<UartDevice*>(dev)) {
        uart->set_baud(115200);
    } else if (auto* spi = dynamic_cast<SpiDevice*>(dev)) {
        spi->set_clock(1000000);
    }
}

// AFTER (embedded) - Explicit type tag, no RTTI
enum class DeviceType : uint8_t {
    Uart,
    Spi,
    I2c,
};

struct DeviceBase {
    const DeviceType type;
    explicit DeviceBase(DeviceType t) : type(t) {}
};

struct UartDevice : DeviceBase {
    UartDevice() : DeviceBase(DeviceType::Uart) {}
    void set_baud(uint32_t baud) { /* ... */ }
};

struct SpiDevice : DeviceBase {
    SpiDevice() : DeviceBase(DeviceType::Spi) {}
    void set_clock(uint32_t hz) { /* ... */ }
};

// Type-safe cast helper
template <typename T>
T* device_cast(DeviceBase* dev);

template <>
UartDevice* device_cast<UartDevice>(DeviceBase* dev) {
    return (dev && dev->type == DeviceType::Uart) ? static_cast<UartDevice*>(dev) : nullptr;
}

template <>
SpiDevice* device_cast<SpiDevice>(DeviceBase* dev) {
    return (dev && dev->type == DeviceType::Spi) ? static_cast<SpiDevice*>(dev) : nullptr;
}

void configure(DeviceBase* dev) {
    if (auto* uart = device_cast<UartDevice>(dev)) {
        uart->set_baud(115200);
    } else if (auto* spi = device_cast<SpiDevice>(dev)) {
        spi->set_clock(1000000);
    }
}
```

---

## 7. Memory Layout and Linker Configuration

### STM32H7 Memory Map Considerations

The H7 has multiple RAM regions with different characteristics. Use them deliberately:

```ld
/* stm32h7_flash.ld - Key memory sections */
MEMORY
{
    FLASH  (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K   /* Fast, no cache needed */
    AXI_RAM (xrw) : ORIGIN = 0x24000000, LENGTH = 512K   /* Main RAM */
    SRAM1   (xrw) : ORIGIN = 0x30000000, LENGTH = 128K   /* DMA-accessible */
    SRAM2   (xrw) : ORIGIN = 0x30020000, LENGTH = 128K   /* DMA-accessible */
    SRAM4   (xrw) : ORIGIN = 0x38000000, LENGTH = 64K    /* Backup domain */
}

SECTIONS
{
    /* Place performance-critical data in DTCMRAM (zero wait states) */
    .dtcm_data :
    {
        *(.dtcm_data)
        *(.dtcm_data.*)
    } > DTCMRAM

    /* DMA buffers must be in SRAM1/SRAM2 (not DTCMRAM) */
    .dma_buffers (NOLOAD) :
    {
        *(.dma_buffers)
        *(.dma_buffers.*)
    } > SRAM1

    /* Main application data in AXI RAM */
    .bss :
    {
        *(.bss)
        *(.bss.*)
    } > AXI_RAM
}
```

### Placing Data in Specific Memory Regions

```cpp
// Use GCC section attributes to control placement

// DMA buffers - must be in D2 SRAM, cache-aligned
__attribute__((section(".dma_buffers"), aligned(32)))
static uint8_t uart_rx_buf[512];

__attribute__((section(".dma_buffers"), aligned(32)))
static uint8_t uart_tx_buf[512];

// Fast-access data in DTCM (tightly coupled, zero wait state)
__attribute__((section(".dtcm_data")))
static volatile uint32_t isr_flags;

__attribute__((section(".dtcm_data")))
static int32_t pid_state[4]; // Real-time control loop data
```

---

## 8. Phased Migration Plan

### Phase 1: Compile with Restrictions (Week 1)

1. Add `-fno-exceptions -fno-rtti` to the build.
2. Fix every compilation error -- this surfaces all exception and RTTI usage.
3. Replace `throw` with error returns. Replace `dynamic_cast` with type tags.
4. Do NOT optimize yet; just get it compiling.

```bash
# Track your Flash/RAM budget after each phase
arm-none-eabi-size -A build/firmware.elf
```

### Phase 2: Eliminate Heap (Week 2-3)

1. Override `operator new` to trap any accidental heap usage:

```cpp
// heap_trap.cpp - Include in debug builds
#include <cstdlib>

void* operator new(std::size_t) {
    // If this fires, you still have heap allocations to eliminate
    __asm volatile("bkpt #0");  // Hard breakpoint
    while (1) {}
}

void* operator new[](std::size_t) {
    __asm volatile("bkpt #0");
    while (1) {}
}

void operator delete(void*) noexcept {
    __asm volatile("bkpt #0");
    while (1) {}
}

void operator delete[](void*) noexcept {
    __asm volatile("bkpt #0");
    while (1) {}
}
```

2. Replace `std::vector` with `StaticVector`.
3. Replace `std::string` with `FixedString`.
4. Replace `std::shared_ptr` / `std::unique_ptr` with static allocation + raw pointers.
5. Replace `std::map` / `std::unordered_map` with sorted static arrays or perfect hashing.

### Phase 3: Devirtualize (Week 3-4)

1. Replace virtual interfaces with CRTP where callers know concrete types.
2. Replace virtual interfaces with variant dispatch where collections hold mixed types.
3. Replace virtual interfaces with function pointer tables where runtime registration is needed.

### Phase 4: Optimize and Validate (Week 4-5)

1. Run `arm-none-eabi-nm --size-sort build/firmware.elf` to find largest symbols.
2. Move performance-critical data to DTCM.
3. Place DMA buffers in SRAM1/SRAM2.
4. Profile with cycle counters (DWT->CYCCNT on Cortex-M7).
5. Verify stack usage with watermark patterns.

```cpp
// Stack watermark check
void check_stack_usage() {
    extern uint32_t _estack;   // From linker script
    extern uint32_t _sstack;
    uint32_t* p = &_sstack;
    uint32_t unused = 0;
    while (*p == 0xDEADBEEF && p < &_estack) { // Fill pattern set at startup
        ++unused;
        ++p;
    }
    uint32_t used_bytes = (&_estack - p) * 4;
    uint32_t total_bytes = (&_estack - &_sstack) * 4;
    // Log or assert: used_bytes should be well under total_bytes
}
```

---

## 9. Quick Reference: Desktop-to-Embedded Replacement Table

| Desktop C++ Feature | Embedded Replacement | Flash Savings |
|---------------------|---------------------|---------------|
| `std::vector<T>` | `StaticVector<T, N>` | Eliminates allocator code |
| `std::string` | `FixedString<N>` | Eliminates allocator + SSO machinery |
| `std::shared_ptr<T>` | Static allocation + raw pointer / Handle | Eliminates atomic refcount code |
| `std::unique_ptr<T>` | Static allocation, pool, or scoped variable | Eliminates `delete` call chains |
| `std::map<K,V>` | Sorted `StaticVector` with binary search | ~10-20 KB |
| `std::unordered_map` | Fixed hash table or perfect hash | ~10-20 KB |
| `std::function` | Function pointer + `void* ctx` | ~2-5 KB per use |
| `virtual` functions | CRTP / variant / function pointer table | 4 bytes/object + vtable |
| `throw` / `try` / `catch` | `Result<T>` error return type | 20-50 KB+ |
| `dynamic_cast` | Type tag enum + `static_cast` | Eliminates RTTI tables |
| `typeid` | Manual type enum | Eliminates RTTI strings |
| `std::iostream` | `snprintf` + UART write | 50-150 KB |
| `std::mutex` | CMSIS RTOS mutex or disable interrupts | Eliminates libpthread |

---

## 10. Recommended Libraries for STM32H7

If writing everything from scratch is too much, these embedded-friendly C++ libraries provide the patterns above in tested, production-quality form:

- **ETL (Embedded Template Library)** - Drop-in replacements for STL containers with fixed capacity. `etl::vector<T, N>`, `etl::string<N>`, `etl::map<K, V, N>`, etc. No heap, no exceptions, no RTTI. [https://github.com/ETLCPP/etl](https://github.com/ETLCPP/etl)
- **etl::expected / tl::expected** - Result type similar to the one above, standardized in C++23 as `std::expected`.

Install ETL via your build system:

```cmake
# CMakeLists.txt
include(FetchContent)
FetchContent_Declare(
    etl
    GIT_REPOSITORY https://github.com/ETLCPP/etl.git
    GIT_TAG        20.39.4
)
FetchContent_MakeAvailable(etl)
target_link_libraries(your_target PRIVATE etl::etl)
```

Then your migration becomes:

```cpp
// With ETL, the migration is often just a namespace + template parameter change:
#include <etl/vector.h>
#include <etl/string.h>

// std::vector<int> data;         -->  etl::vector<int, 128> data;
// std::string name;              -->  etl::string<64> name;
// std::map<int, float> lookup;   -->  etl::flat_map<int, float, 32> lookup;
```

---

## Summary

The core principles for porting desktop C++ to STM32H7:

1. **All memory is pre-allocated.** Every container has a compile-time capacity. No `new`, no `malloc` in steady state.
2. **All errors are explicit return values.** No exceptions, no hidden control flow.
3. **All dispatch is resolved at compile time when possible.** CRTP over virtual. Switch over `dynamic_cast`.
4. **Know your memory map.** DTCM for fast data, SRAM1/2 for DMA, AXI for bulk storage.
5. **Measure continuously.** `arm-none-eabi-size`, cycle counters, stack watermarks after every major change.
