# Desktop C++ to STM32H7 Porting Guide

## Target Constraints

| Resource | Available | Practical Budget |
|----------|-----------|-----------------|
| Flash    | 2 MB      | ~1.5 MB for application (reserve for bootloader/config) |
| RAM      | 1 MB      | ~800 KB usable (stack, heap, peripherals, DMA buffers) |
| CPU      | Cortex-M7, up to 480 MHz | No OS or lightweight RTOS |

## Overview of Replacements

| Desktop Feature       | Embedded Replacement                        | Why |
|-----------------------|---------------------------------------------|-----|
| `std::vector`         | Fixed-capacity container or static arrays   | Eliminates heap fragmentation |
| `std::string`         | Fixed-buffer string or `std::string_view`   | Predictable memory, no allocations |
| `std::shared_ptr`     | Owning raw pointers, `std::unique_ptr`, or object pools | Removes ref-count overhead and hidden allocations |
| Virtual functions     | CRTP static polymorphism or function pointers | Eliminates vtable RAM/Flash cost and indirection penalty |
| Exceptions            | Return codes, `std::expected`/`Result` types | Exceptions add 10-30% Flash overhead on ARM |
| RTTI (`typeid`/`dynamic_cast`) | Compile-time type tags or enum discriminants | RTTI adds significant Flash cost |

## Compiler Flags First

Before changing any code, set the right compiler flags for your STM32H7 toolchain (GCC arm-none-eabi):

```makefile
# In your Makefile / CMakeLists.txt
CXXFLAGS += -mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16 -mfloat-abi=hard
CXXFLAGS += -fno-exceptions        # Disable exception support
CXXFLAGS += -fno-rtti              # Disable RTTI
CXXFLAGS += -fno-threadsafe-statics # No guard variables for static init
CXXFLAGS += -ffunction-sections -fdata-sections  # Dead code elimination
LDFLAGS  += -Wl,--gc-sections      # Remove unused sections
CXXFLAGS += -Os                    # Optimize for size (or -O2 if speed matters more)
```

This alone can save 50-150 KB of Flash compared to default settings.

---

## 1. Replacing `std::vector` with Fixed-Capacity Containers

### Problem

`std::vector` calls `malloc`/`realloc` at runtime. On a microcontroller this leads to heap fragmentation, non-deterministic timing, and eventual memory exhaustion.

### Desktop Code (Before)

```cpp
#include <vector>
#include <algorithm>

class SensorManager {
    std::vector<float> readings;
    std::vector<Sensor*> sensors;

public:
    void addReading(float value) {
        readings.push_back(value);
    }

    float getAverage() const {
        if (readings.empty()) return 0.0f;
        float sum = 0.0f;
        for (auto r : readings) sum += r;
        return sum / readings.size();
    }

    void addSensor(Sensor* s) {
        sensors.push_back(s);
    }

    void pollAll() {
        for (auto* s : sensors) {
            addReading(s->read());
        }
    }
};
```

### Embedded Replacement (After)

```cpp
#include <cstddef>
#include <cstdint>
#include <algorithm>

// Generic fixed-capacity vector - lives entirely on stack or in static storage
template <typename T, std::size_t Capacity>
class FixedVector {
    T data_[Capacity];
    std::size_t size_ = 0;

public:
    bool push_back(const T& value) {
        if (size_ >= Capacity) return false;  // Fail gracefully, no exception
        data_[size_++] = value;
        return true;
    }

    void clear() { size_ = 0; }

    T& operator[](std::size_t i) { return data_[i]; }
    const T& operator[](std::size_t i) const { return data_[i]; }

    std::size_t size() const { return size_; }
    std::size_t capacity() const { return Capacity; }
    bool empty() const { return size_ == 0; }
    bool full() const { return size_ >= Capacity; }

    T* begin() { return data_; }
    T* end() { return data_ + size_; }
    const T* begin() const { return data_; }
    const T* end() const { return data_ + size_; }
};

// Usage: All memory is known at compile time
class SensorManager {
    static constexpr std::size_t MAX_READINGS = 256;
    static constexpr std::size_t MAX_SENSORS  = 16;

    FixedVector<float, MAX_READINGS> readings;
    FixedVector<Sensor*, MAX_SENSORS> sensors;

public:
    bool addReading(float value) {
        if (readings.full()) {
            // Strategy: overwrite oldest (circular) or discard
            readings.clear();  // Simple reset; or implement ring buffer
        }
        return readings.push_back(value);
    }

    float getAverage() const {
        if (readings.empty()) return 0.0f;
        float sum = 0.0f;
        for (auto r : readings) sum += r;
        return sum / static_cast<float>(readings.size());
    }

    bool addSensor(Sensor* s) {
        return sensors.push_back(s);  // Returns false if full
    }

    void pollAll() {
        for (auto* s : sensors) {
            addReading(s->read());
        }
    }
};
```

### Ring Buffer Variant (for streaming data)

```cpp
template <typename T, std::size_t Capacity>
class RingBuffer {
    T data_[Capacity];
    std::size_t head_ = 0;
    std::size_t count_ = 0;

public:
    void push(const T& value) {
        data_[(head_ + count_) % Capacity] = value;
        if (count_ < Capacity) {
            ++count_;
        } else {
            head_ = (head_ + 1) % Capacity;  // Overwrite oldest
        }
    }

    bool pop(T& out) {
        if (count_ == 0) return false;
        out = data_[head_];
        head_ = (head_ + 1) % Capacity;
        --count_;
        return true;
    }

    std::size_t size() const { return count_; }
    bool empty() const { return count_ == 0; }
    bool full() const { return count_ == Capacity; }

    // Access element by index (0 = oldest)
    const T& operator[](std::size_t i) const {
        return data_[(head_ + i) % Capacity];
    }
};

// Example: DMA-friendly ADC sample buffer
static RingBuffer<uint16_t, 1024> adcSamples;
```

---

## 2. Replacing `std::string` with Fixed-Buffer Strings

### Problem

`std::string` allocates on the heap. Even small-string optimization (SSO) is unreliable across toolchains, and concatenation can trigger reallocation at any time.

### Desktop Code (Before)

```cpp
#include <string>
#include <sstream>

class Logger {
public:
    void log(const std::string& module, const std::string& message) {
        std::string entry = "[" + module + "] " + message + "\n";
        uart_send(entry.c_str(), entry.size());
    }

    std::string formatSensorData(int id, float value) {
        std::ostringstream oss;
        oss << "Sensor " << id << ": " << value << " C";
        return oss.str();
    }
};

class DeviceConfig {
    std::string deviceName;
    std::string firmwareVersion;

public:
    void setName(const std::string& name) { deviceName = name; }
    const std::string& getName() const { return deviceName; }
};
```

### Embedded Replacement (After)

```cpp
#include <cstdio>
#include <cstring>
#include <cstddef>
#include <string_view>   // C++17, zero-cost on embedded

// Fixed-capacity string with snprintf-based formatting
template <std::size_t Capacity>
class FixedString {
    char data_[Capacity];
    std::size_t len_ = 0;

public:
    FixedString() { data_[0] = '\0'; }

    FixedString(const char* str) {
        len_ = std::min(std::strlen(str), Capacity - 1);
        std::memcpy(data_, str, len_);
        data_[len_] = '\0';
    }

    // printf-style formatting
    template <typename... Args>
    static FixedString format(const char* fmt, Args... args) {
        FixedString s;
        int written = snprintf(s.data_, Capacity, fmt, args...);
        s.len_ = (written > 0) ? std::min(static_cast<std::size_t>(written), Capacity - 1) : 0;
        return s;
    }

    bool append(const char* str) {
        std::size_t addLen = std::strlen(str);
        if (len_ + addLen >= Capacity) return false;
        std::memcpy(data_ + len_, str, addLen);
        len_ += addLen;
        data_[len_] = '\0';
        return true;
    }

    bool append(char c) {
        if (len_ + 1 >= Capacity) return false;
        data_[len_++] = c;
        data_[len_] = '\0';
        return true;
    }

    const char* c_str() const { return data_; }
    std::size_t size() const { return len_; }
    std::size_t capacity() const { return Capacity; }
    bool empty() const { return len_ == 0; }

    // Implicit conversion to string_view for zero-copy passing
    operator std::string_view() const { return {data_, len_}; }
};

// Ported logger
class Logger {
public:
    void log(std::string_view module, std::string_view message) {
        // Format directly into a stack buffer - no heap allocation
        char buf[128];
        int n = snprintf(buf, sizeof(buf), "[%.*s] %.*s\n",
                         static_cast<int>(module.size()), module.data(),
                         static_cast<int>(message.size()), message.data());
        if (n > 0) {
            uart_send(buf, static_cast<std::size_t>(n));
        }
    }

    FixedString<64> formatSensorData(int id, float value) {
        return FixedString<64>::format("Sensor %d: %.2f C", id, value);
    }
};

// Ported config
class DeviceConfig {
    FixedString<32> deviceName;
    FixedString<16> firmwareVersion;

public:
    void setName(std::string_view name) { deviceName = FixedString<32>(name.data()); }
    std::string_view getName() const { return deviceName; }
};
```

### Key Rules for String Migration

- Use `std::string_view` for all function parameters that only read strings (zero cost).
- Use `FixedString<N>` for stored data where you need mutation.
- Use stack-local `char buf[N]` + `snprintf` for temporary formatting.
- Never use `std::ostringstream` -- it pulls in enormous amounts of code and heap allocates.

---

## 3. Replacing `std::shared_ptr` with Deterministic Ownership

### Problem

`std::shared_ptr` has a control block (16-24 bytes overhead per object), uses atomic reference counting (expensive on Cortex-M7 without lock-free atomics in all cases), and hides ownership semantics.

### Desktop Code (Before)

```cpp
#include <memory>
#include <vector>

class Packet {
public:
    uint8_t data[256];
    std::size_t length;
};

class PacketRouter {
    std::vector<std::shared_ptr<Packet>> pending;

public:
    void enqueue(std::shared_ptr<Packet> pkt) {
        pending.push_back(pkt);
    }

    std::shared_ptr<Packet> dequeue() {
        if (pending.empty()) return nullptr;
        auto pkt = pending.front();
        pending.erase(pending.begin());
        return pkt;
    }
};

class Connection {
    std::shared_ptr<Packet> lastPacket;
public:
    void receive(std::shared_ptr<Packet> pkt) {
        lastPacket = pkt;
    }
};
```

### Embedded Replacement (After) -- Object Pool Pattern

```cpp
#include <cstddef>
#include <cstdint>
#include <cstring>

// Static object pool: pre-allocated, zero fragmentation
template <typename T, std::size_t PoolSize>
class ObjectPool {
    struct Slot {
        T object;
        bool inUse = false;
    };
    Slot slots_[PoolSize];

public:
    // "Allocate" an object from the pool
    T* acquire() {
        for (auto& slot : slots_) {
            if (!slot.inUse) {
                slot.inUse = true;
                slot.object = T{};  // Reset to default state
                return &slot.object;
            }
        }
        return nullptr;  // Pool exhausted
    }

    // Return an object to the pool
    void release(T* obj) {
        for (auto& slot : slots_) {
            if (&slot.object == obj) {
                slot.inUse = false;
                return;
            }
        }
        // Error: object not from this pool -- assert in debug
    }

    std::size_t available() const {
        std::size_t count = 0;
        for (const auto& slot : slots_) {
            if (!slot.inUse) ++count;
        }
        return count;
    }
};

struct Packet {
    uint8_t data[256];
    std::size_t length = 0;
};

// Global pool -- sized at compile time, memory budget is explicit
static ObjectPool<Packet, 32> packetPool;  // 32 * ~260 bytes = ~8.3 KB

class PacketRouter {
    static constexpr std::size_t MAX_PENDING = 32;
    Packet* pending[MAX_PENDING] = {};
    std::size_t pendingCount = 0;

public:
    bool enqueue(Packet* pkt) {
        if (pendingCount >= MAX_PENDING) return false;
        pending[pendingCount++] = pkt;
        return true;
    }

    Packet* dequeue() {
        if (pendingCount == 0) return nullptr;
        Packet* pkt = pending[0];
        // Shift remaining (or use ring buffer for O(1))
        for (std::size_t i = 1; i < pendingCount; ++i) {
            pending[i - 1] = pending[i];
        }
        --pendingCount;
        return pkt;
    }
};

class Connection {
    Packet* lastPacket = nullptr;  // Non-owning pointer; pool owns the memory

public:
    void receive(Packet* pkt) {
        lastPacket = pkt;
    }

    void done() {
        if (lastPacket) {
            packetPool.release(lastPacket);  // Explicit lifetime management
            lastPacket = nullptr;
        }
    }
};

// Usage:
// Packet* pkt = packetPool.acquire();
// if (pkt) { /* fill pkt->data */ router.enqueue(pkt); }
// ...
// Packet* p = router.dequeue();
// connection.receive(p);
// connection.done();  // Returns to pool
```

### When `unique_ptr` Is Acceptable

If your embedded toolchain supports it and you have a controlled heap region (e.g., a dedicated memory pool with a custom allocator), `std::unique_ptr` with a custom deleter can work:

```cpp
// Custom deleter that returns to a pool instead of calling free()
struct PoolDeleter {
    void operator()(Packet* p) const {
        packetPool.release(p);
    }
};

using PacketPtr = std::unique_ptr<Packet, PoolDeleter>;

PacketPtr acquirePacket() {
    Packet* raw = packetPool.acquire();
    return PacketPtr(raw);  // Automatically released when out of scope
}
```

---

## 4. Replacing Virtual Functions with CRTP (Static Polymorphism)

### Problem

Each class with virtual functions carries a vtable pointer (4 bytes per object on ARM). The vtable itself resides in Flash. Virtual dispatch also causes pipeline stalls on Cortex-M7 due to indirect branches. For deeply nested hierarchies, this adds up in both RAM and performance cost.

### Desktop Code (Before)

```cpp
#include <vector>
#include <memory>

class Sensor {
public:
    virtual ~Sensor() = default;
    virtual float read() = 0;
    virtual const char* name() = 0;
    virtual void calibrate(float offset) = 0;
};

class TemperatureSensor : public Sensor {
    float offset_ = 0.0f;
public:
    float read() override {
        return readADC(0) * 0.1f + offset_;
    }
    const char* name() override { return "Temperature"; }
    void calibrate(float offset) override { offset_ = offset; }
};

class PressureSensor : public Sensor {
    float offset_ = 0.0f;
public:
    float read() override {
        return readADC(1) * 0.05f + offset_;
    }
    const char* name() override { return "Pressure"; }
    void calibrate(float offset) override { offset_ = offset; }
};

// Virtual dispatch at runtime
void pollSensors(std::vector<Sensor*>& sensors) {
    for (auto* s : sensors) {
        float val = s->read();  // Indirect call through vtable
        log(s->name(), val);
    }
}
```

### Embedded Replacement (After) -- CRTP

```cpp
// CRTP base -- no vtable, no virtual functions
template <typename Derived>
class SensorBase {
public:
    float read() {
        return static_cast<Derived*>(this)->readImpl();
    }

    const char* name() {
        return static_cast<Derived*>(this)->nameImpl();
    }

    void calibrate(float offset) {
        static_cast<Derived*>(this)->calibrateImpl(offset);
    }
};

class TemperatureSensor : public SensorBase<TemperatureSensor> {
    float offset_ = 0.0f;
public:
    float readImpl() {
        return readADC(0) * 0.1f + offset_;
    }
    const char* nameImpl() { return "Temperature"; }
    void calibrateImpl(float offset) { offset_ = offset; }
};

class PressureSensor : public SensorBase<PressureSensor> {
    float offset_ = 0.0f;
public:
    float readImpl() {
        return readADC(1) * 0.05f + offset_;
    }
    const char* nameImpl() { return "Pressure"; }
    void calibrateImpl(float offset) { offset_ = offset; }
};

// Compile-time dispatch -- zero overhead, fully inlined
template <typename SensorType>
void pollSensor(SensorType& sensor) {
    float val = sensor.read();  // Direct call, no vtable
    log(sensor.name(), val);
}

// If you need a heterogeneous collection, use std::variant (C++17)
#include <variant>

using AnySensor = std::variant<TemperatureSensor, PressureSensor>;

void pollAll(AnySensor* sensors, std::size_t count) {
    for (std::size_t i = 0; i < count; ++i) {
        std::visit([](auto& sensor) {
            float val = sensor.read();
            log(sensor.name(), val);
        }, sensors[i]);
    }
}

// Static heterogeneous collection
static TemperatureSensor tempSensor;
static PressureSensor    presSensor;

static AnySensor allSensors[] = {
    tempSensor,
    presSensor,
};

void systemPoll() {
    pollAll(allSensors, 2);
}
```

### When Virtual Functions Are Acceptable

Virtual functions are fine when:
- The hierarchy is small (2-3 classes) and objects are few.
- You need runtime plugin-like extensibility that cannot be known at compile time.
- The vtable cost is negligible compared to the object's own data.

In those cases, keep virtual functions but still disable RTTI:

```cpp
// Lean virtual interface -- no RTTI, no exceptions
class HalInterface {
public:
    virtual ~HalInterface() = default;  // Still need virtual dtor for correct cleanup
    virtual void init() = 0;
    virtual void write(const uint8_t* data, std::size_t len) = 0;
    virtual std::size_t read(uint8_t* buf, std::size_t maxLen) = 0;
};
```

---

## 5. Replacing Exceptions with Result Types

### Problem

Compiling with `-fexceptions` on ARM adds 10-30% Flash overhead for unwinding tables. Exception throwing is extremely slow (milliseconds). This is unacceptable for real-time embedded systems.

### Desktop Code (Before)

```cpp
#include <stdexcept>
#include <string>

class FlashStorage {
public:
    void write(uint32_t address, const uint8_t* data, std::size_t len) {
        if (address >= FLASH_SIZE) {
            throw std::out_of_range("Address beyond flash boundary");
        }
        if (len == 0) {
            throw std::invalid_argument("Zero-length write");
        }
        if (!hal_flash_write(address, data, len)) {
            throw std::runtime_error("Flash write failed");
        }
    }

    std::vector<uint8_t> read(uint32_t address, std::size_t len) {
        if (address + len > FLASH_SIZE) {
            throw std::out_of_range("Read beyond flash boundary");
        }
        std::vector<uint8_t> buffer(len);
        if (!hal_flash_read(address, buffer.data(), len)) {
            throw std::runtime_error("Flash read failed");
        }
        return buffer;
    }
};

// Caller
void saveConfig(FlashStorage& flash, const Config& cfg) {
    try {
        flash.write(CONFIG_ADDR, reinterpret_cast<const uint8_t*>(&cfg), sizeof(cfg));
    } catch (const std::exception& e) {
        logError(e.what());
    }
}
```

### Embedded Replacement (After) -- Error Codes and Result Types

```cpp
#include <cstdint>
#include <cstddef>

// Lightweight result type -- no heap, no exceptions
enum class Error : uint8_t {
    None = 0,
    InvalidAddress,
    InvalidArgument,
    HardwareFault,
    Timeout,
    BufferFull,
};

// Generic Result<T> -- like Rust's Result
template <typename T>
struct Result {
    T value;
    Error error;

    bool ok() const { return error == Error::None; }

    static Result success(const T& val) { return {val, Error::None}; }
    static Result fail(Error err) { return {T{}, err}; }
};

// Specialization for void-returning functions
template <>
struct Result<void> {
    Error error;

    bool ok() const { return error == Error::None; }

    static Result success() { return {Error::None}; }
    static Result fail(Error err) { return {err}; }
};

// Convenience alias
using Status = Result<void>;

class FlashStorage {
public:
    Status write(uint32_t address, const uint8_t* data, std::size_t len) {
        if (address >= FLASH_SIZE) {
            return Status::fail(Error::InvalidAddress);
        }
        if (len == 0) {
            return Status::fail(Error::InvalidArgument);
        }
        if (!hal_flash_write(address, data, len)) {
            return Status::fail(Error::HardwareFault);
        }
        return Status::success();
    }

    // Out-parameter instead of returning a vector
    Status read(uint32_t address, uint8_t* buf, std::size_t len) {
        if (address + len > FLASH_SIZE) {
            return Status::fail(Error::InvalidAddress);
        }
        if (!hal_flash_read(address, buf, len)) {
            return Status::fail(Error::HardwareFault);
        }
        return Status::success();
    }
};

// Caller -- explicit error handling, no hidden control flow
void saveConfig(FlashStorage& flash, const Config& cfg) {
    Status result = flash.write(CONFIG_ADDR,
                                reinterpret_cast<const uint8_t*>(&cfg),
                                sizeof(cfg));
    if (!result.ok()) {
        logError("Config write failed", result.error);
        // Handle: retry, fallback address, assert, etc.
    }
}

// Error to string (for debug logging)
const char* errorToString(Error e) {
    switch (e) {
        case Error::None:           return "OK";
        case Error::InvalidAddress: return "Invalid address";
        case Error::InvalidArgument:return "Invalid argument";
        case Error::HardwareFault:  return "Hardware fault";
        case Error::Timeout:        return "Timeout";
        case Error::BufferFull:     return "Buffer full";
        default:                    return "Unknown";
    }
}
```

---

## 6. Replacing RTTI with Compile-Time Type Tags

### Problem

RTTI (`dynamic_cast`, `typeid`) generates type information strings and comparison tables in Flash. With `-fno-rtti`, these are stripped. You need an alternative for type identification.

### Desktop Code (Before)

```cpp
#include <typeinfo>

class Message {
public:
    virtual ~Message() = default;
};

class CommandMessage : public Message {
public:
    uint8_t commandId;
    uint8_t payload[64];
};

class DataMessage : public Message {
public:
    float values[16];
    std::size_t count;
};

// RTTI-based dispatch
void handleMessage(Message* msg) {
    if (auto* cmd = dynamic_cast<CommandMessage*>(msg)) {
        processCommand(cmd->commandId, cmd->payload);
    } else if (auto* data = dynamic_cast<DataMessage*>(msg)) {
        processData(data->values, data->count);
    } else {
        logError("Unknown message type: " + std::string(typeid(*msg).name()));
    }
}
```

### Embedded Replacement (After) -- Enum Tag Dispatch

```cpp
#include <cstdint>
#include <cstddef>

// Type tag enum -- known at compile time, costs 1 byte
enum class MessageType : uint8_t {
    Command,
    Data,
    Status,
    // Add new types here
};

// Base with explicit tag -- no vtable needed, no RTTI
struct Message {
    MessageType type;

    // Protected constructor forces derived types to set the tag
protected:
    explicit Message(MessageType t) : type(t) {}
};

struct CommandMessage : Message {
    uint8_t commandId;
    uint8_t payload[64];

    CommandMessage() : Message(MessageType::Command), commandId(0) {}
};

struct DataMessage : Message {
    float values[16];
    std::size_t count;

    DataMessage() : Message(MessageType::Data), count(0) {}
};

// Safe downcast -- replaces dynamic_cast
template <typename T>
T* message_cast(Message* msg);

template <>
CommandMessage* message_cast<CommandMessage>(Message* msg) {
    return (msg && msg->type == MessageType::Command)
           ? static_cast<CommandMessage*>(msg)
           : nullptr;
}

template <>
DataMessage* message_cast<DataMessage>(Message* msg) {
    return (msg && msg->type == MessageType::Data)
           ? static_cast<DataMessage*>(msg)
           : nullptr;
}

// Tag-based dispatch -- zero overhead, no RTTI
void handleMessage(Message* msg) {
    switch (msg->type) {
        case MessageType::Command: {
            auto* cmd = static_cast<CommandMessage*>(msg);
            processCommand(cmd->commandId, cmd->payload);
            break;
        }
        case MessageType::Data: {
            auto* data = static_cast<DataMessage*>(msg);
            processData(data->values, data->count);
            break;
        }
        default:
            logError("Unknown message type");
            break;
    }
}
```

### Alternative: `std::variant` (C++17)

```cpp
#include <variant>

struct CommandMessage {
    uint8_t commandId;
    uint8_t payload[64];
};

struct DataMessage {
    float values[16];
    std::size_t count;
};

using Message = std::variant<CommandMessage, DataMessage>;

void handleMessage(Message& msg) {
    std::visit([](auto& m) {
        using T = std::decay_t<decltype(m)>;
        if constexpr (std::is_same_v<T, CommandMessage>) {
            processCommand(m.commandId, m.payload);
        } else if constexpr (std::is_same_v<T, DataMessage>) {
            processData(m.values, m.count);
        }
    }, msg);
}
```

---

## 7. Memory Layout and Linker Script Awareness

On STM32H7, you have multiple RAM regions. Use them intentionally:

| Region | Address | Size | Best For |
|--------|---------|------|----------|
| DTCM   | 0x20000000 | 128 KB | Stack, critical data, DMA-incompatible fast access |
| AXI SRAM | 0x24000000 | 512 KB | Main heap, large buffers |
| SRAM1  | 0x30000000 | 128 KB | DMA buffers |
| SRAM2  | 0x30020000 | 128 KB | DMA buffers |
| SRAM4  | 0x38000000 | 64 KB  | Backup / battery-backed data |

### Placing Objects in Specific RAM Regions

```cpp
// Place performance-critical data in DTCM (tightly coupled, fastest access)
__attribute__((section(".dtcm_data")))
static RingBuffer<uint16_t, 2048> fastAdcBuffer;

// Place DMA buffers in SRAM1 (DMA-accessible region)
__attribute__((section(".sram1"), aligned(32)))  // 32-byte align for cache
static uint8_t dmaRxBuffer[4096];

__attribute__((section(".sram1"), aligned(32)))
static uint8_t dmaTxBuffer[4096];

// Place large but less critical data in AXI SRAM
__attribute__((section(".axi_data")))
static ObjectPool<Packet, 64> mainPacketPool;
```

### Corresponding Linker Script Additions

```ld
/* Add to STM32H7 linker script (.ld file) */
MEMORY
{
    FLASH  (rx)  : ORIGIN = 0x08000000, LENGTH = 2M
    DTCM   (rw)  : ORIGIN = 0x20000000, LENGTH = 128K
    AXI    (rw)  : ORIGIN = 0x24000000, LENGTH = 512K
    SRAM1  (rw)  : ORIGIN = 0x30000000, LENGTH = 128K
    SRAM2  (rw)  : ORIGIN = 0x30020000, LENGTH = 128K
    SRAM4  (rw)  : ORIGIN = 0x38000000, LENGTH = 64K
}

SECTIONS
{
    .dtcm_data (NOLOAD) :
    {
        . = ALIGN(4);
        *(.dtcm_data)
        . = ALIGN(4);
    } > DTCM

    .sram1 (NOLOAD) :
    {
        . = ALIGN(32);
        *(.sram1)
        . = ALIGN(32);
    } > SRAM1

    .axi_data (NOLOAD) :
    {
        . = ALIGN(4);
        *(.axi_data)
        . = ALIGN(4);
    } > AXI
}
```

---

## 8. Migration Checklist

Follow this order when porting:

### Phase 1: Build System (Day 1)
- [ ] Set up cross-compilation with arm-none-eabi-g++ (C++17)
- [ ] Add `-fno-exceptions -fno-rtti -ffunction-sections -fdata-sections`
- [ ] Add `-Wl,--gc-sections` to linker flags
- [ ] Attempt to compile -- collect all errors

### Phase 2: Remove Heap Dependencies (Days 2-5)
- [ ] Replace every `std::vector` with `FixedVector<T, N>` or static arrays
- [ ] Replace every `std::string` with `FixedString<N>` or `std::string_view`
- [ ] Replace every `std::map`/`std::unordered_map` with sorted arrays or static hash tables
- [ ] Replace `std::shared_ptr` with object pools + raw/unique pointers
- [ ] Search for all `new`/`delete` -- replace with pool allocation or static objects
- [ ] Optionally override global `operator new` to trap accidental heap use:

```cpp
// Place in a source file to catch any accidental heap allocation
void* operator new(std::size_t) {
    // Trap: halt in debugger, assert, or blink error LED
    __asm volatile("bkpt #0");
    while (1) {}  // Never returns
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

### Phase 3: Remove Exceptions and RTTI (Days 3-5, overlapping)
- [ ] Replace all `throw` with return codes / `Result<T>`
- [ ] Replace all `try`/`catch` with `if (!result.ok())` checks
- [ ] Replace all `dynamic_cast` with tag-based dispatch or `std::variant`
- [ ] Replace all `typeid` usage with enum type tags
- [ ] Verify build succeeds with `-fno-exceptions -fno-rtti`

### Phase 4: Reduce Virtual Function Overhead (Days 5-7)
- [ ] Audit all `virtual` -- decide per-class: keep, CRTP, or `std::variant`
- [ ] Convert hot-path polymorphism to CRTP or templates
- [ ] Keep `virtual` only where runtime flexibility is genuinely needed
- [ ] Measure vtable Flash cost with `arm-none-eabi-nm --size-sort`

### Phase 5: Memory Layout and Testing (Days 7-10)
- [ ] Map large objects to appropriate RAM regions via linker sections
- [ ] Place DMA buffers in DMA-accessible SRAM with cache-line alignment
- [ ] Run `arm-none-eabi-size` to verify Flash/RAM usage
- [ ] Stress-test with worst-case buffer fills to confirm no overflow
- [ ] Run static analysis (cppcheck, clang-tidy) with embedded-specific checks

---

## 9. Quick Reference: Size Impact

Typical Flash savings on STM32H7 (arm-none-eabi-g++ -Os):

| Change | Flash Saved | RAM Saved |
|--------|-------------|-----------|
| `-fno-exceptions` | 40-100 KB | 0-2 KB |
| `-fno-rtti` | 5-20 KB | 0 |
| `-Wl,--gc-sections` | 10-50 KB | Variable |
| Remove `std::string` | 10-30 KB | Per-instance heap |
| Remove `std::vector` | 5-10 KB | Per-instance heap |
| Remove `iostream`/`sstream` | 50-150 KB | 5-10 KB |
| Remove `std::shared_ptr` | 2-5 KB | 16-24 bytes/instance |

**Total potential savings: 120-365 KB Flash**, plus deterministic RAM usage with zero fragmentation.

---

## 10. Final Architecture Example

Putting it all together -- a complete embedded module:

```cpp
// embedded_sensor_system.h
#pragma once
#include <cstdint>
#include <cstddef>
#include <cstdio>
#include <string_view>
#include <variant>

// === Error handling ===
enum class Error : uint8_t {
    None = 0, InvalidParam, HwFault, Timeout, BufferFull
};

struct Status {
    Error error;
    bool ok() const { return error == Error::None; }
    static Status success() { return {Error::None}; }
    static Status fail(Error e) { return {e}; }
};

// === Fixed containers ===
template <typename T, std::size_t N>
class FixedVector { /* ... as defined above ... */ };

template <std::size_t N>
class FixedString { /* ... as defined above ... */ };

template <typename T, std::size_t N>
class RingBuffer { /* ... as defined above ... */ };

template <typename T, std::size_t N>
class ObjectPool { /* ... as defined above ... */ };

// === Sensors via CRTP ===
template <typename Derived>
class SensorBase {
public:
    float read() { return static_cast<Derived*>(this)->readImpl(); }
    const char* name() { return static_cast<Derived*>(this)->nameImpl(); }
};

class TempSensor : public SensorBase<TempSensor> {
public:
    float readImpl();
    const char* nameImpl() { return "Temp"; }
};

class PressSensor : public SensorBase<PressSensor> {
public:
    float readImpl();
    const char* nameImpl() { return "Press"; }
};

using AnySensor = std::variant<TempSensor, PressSensor>;

// === System ===
class SensorSystem {
    static constexpr std::size_t MAX_SENSORS = 8;
    static constexpr std::size_t LOG_SIZE = 512;

    FixedVector<AnySensor, MAX_SENSORS> sensors_;
    RingBuffer<float, LOG_SIZE> history_;

public:
    Status addSensor(AnySensor sensor) {
        if (sensors_.full()) return Status::fail(Error::BufferFull);
        sensors_.push_back(sensor);
        return Status::success();
    }

    void poll() {
        for (std::size_t i = 0; i < sensors_.size(); ++i) {
            std::visit([this](auto& s) {
                float val = s.read();
                history_.push(val);
                char buf[48];
                snprintf(buf, sizeof(buf), "[%s] %.2f", s.name(), val);
                uart_send(buf, strlen(buf));
            }, sensors_[i]);
        }
    }

    // Total RAM for this object:
    //   sensors_: MAX_SENSORS * sizeof(AnySensor) + 8
    //   history_: LOG_SIZE * 4 + 8
    //   Total: ~2.1 KB  (fully deterministic, compile-time known)
};
```

This architecture uses zero heap allocation, compiles with `-fno-exceptions -fno-rtti`, and gives you full control over every byte of memory on the STM32H7.
