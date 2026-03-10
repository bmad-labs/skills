# Memory Patterns Reference — Embedded C++

## Table of Contents
1. [Arena / Bump Allocator](#1-arena--bump-allocator)
2. [CRTP for Static Polymorphism](#2-crtp-for-static-polymorphism)
3. [Lock-Free Ring Buffer (SPSC)](#3-lock-free-ring-buffer-spsc)
4. [DMA Buffer: Alignment and Cache Coherency](#4-dma-buffer-alignment-and-cache-coherency)
5. [Singleton Resource Manager](#5-singleton-resource-manager)
6. [std::optional for Error Handling](#6-stdoptional-for-error-handling)
7. [Zero-Initialization Guarantee](#7-zero-initialization-guarantee)
8. [Linker Section Placement](#8-linker-section-placement)
9. [ESP32 Memory Patterns and Heap Fragmentation](#9-esp32-memory-patterns-and-heap-fragmentation)

---

## 1. Arena / Bump Allocator

An arena allocator hands out memory from a contiguous block by bumping a pointer. Allocation is O(1)
and deterministic. The key trade-off: you can only free the entire arena at once, not individual objects.
This is perfect for per-request or per-frame scratch memory.

```cpp
#include <cstddef>
#include <cstdint>
#include <new>
#include <type_traits>

template<size_t CapacityBytes>
class Arena {
public:
    Arena() = default;

    // Allocate count objects of type T with correct alignment
    template<typename T>
    T* allocate(size_t count = 1) {
        // Align current offset up to T's alignment requirement
        size_t aligned = (offset_ + alignof(T) - 1) & ~(alignof(T) - 1);
        size_t required = aligned + sizeof(T) * count;
        if (required > CapacityBytes) return nullptr;

        T* ptr = reinterpret_cast<T*>(&storage_[aligned]);
        offset_ = required;
        return ptr;
    }

    // Placement-construct a single object
    template<typename T, typename... Args>
    T* construct(Args&&... args) {
        T* mem = allocate<T>();
        if (!mem) return nullptr;
        return new (mem) T(std::forward<Args>(args)...);
    }

    // Free all allocations. Objects are NOT destructed — caller is responsible
    // if T has a non-trivial destructor.
    void reset() { offset_ = 0; }

    size_t used() const { return offset_; }
    size_t capacity() const { return CapacityBytes; }

private:
    alignas(std::max_align_t) std::byte storage_[CapacityBytes]{};
    size_t offset_{0};
};

// Usage:
Arena<4096> frame_arena;

void process_frame() {
    // All allocations are valid until end of frame
    auto* pts = frame_arena.allocate<Point3D>(64);   // 64 points
    auto* hdr = frame_arena.construct<FrameHeader>(); // in-place construct

    // ... use pts and hdr ...

    frame_arena.reset();  // Reclaim entire arena at end of frame
}
```

**Destructor caveat:** `reset()` does not call destructors. For trivially destructible types (plain
structs, POD), this is fine. For types with non-trivial destructors, call the destructor explicitly
before `reset()` or use a tracked arena that stores destructor callbacks.

---

## 2. CRTP for Static Polymorphism

Virtual dispatch has real costs on small MCUs: vtable pointer per object (4–8 bytes), indirect
function call (pipeline flush on Cortex-M0), and prevents inlining. CRTP eliminates all of this.

### With virtual (avoid in tight embedded loops)

```cpp
struct Sensor {
    virtual float read() = 0;
    virtual ~Sensor() = default;
};

struct TemperatureSensor : Sensor {
    float read() override { return read_temp_reg(); }
};

// Caller needs a pointer/reference to base — vtable dispatch on every call
void poll(Sensor& s) {
    float v = s.read();  // indirect call through vtable
}
```

### With CRTP (prefer in embedded)

```cpp
// Base class parameterized on the derived type
template<typename Derived>
struct Sensor {
    float read() {
        // Calls Derived::read_impl() directly — inlined by compiler
        return static_cast<Derived*>(this)->read_impl();
    }
};

struct TemperatureSensor : Sensor<TemperatureSensor> {
    float read_impl() { return read_temp_reg(); }
};

struct PressureSensor : Sensor<PressureSensor> {
    float read_impl() { return read_pressure_reg(); }
};

// Caller is templated — no vtable, no indirect call, compiler can inline
template<typename S>
void poll(S& sensor) {
    float v = sensor.read();  // direct call, inlineable
}
```

**When virtual is OK:** User menus, configuration screens, or any code path that runs at human
interaction speeds. Use CRTP for anything in a control loop, ISR callback chain, or signal processing.

---

## 3. Lock-Free Ring Buffer (SPSC)

Single-Producer Single-Consumer (SPSC) ring buffers are the canonical pattern for passing data
from an ISR to a task without disabling interrupts. The key constraints: power-of-2 capacity
(for cheap modulo via bitmask), `std::atomic` head and tail with appropriate memory ordering.

```cpp
#include <atomic>
#include <array>
#include <optional>
#include <cstdint>

template<typename T, size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "N must be a power of 2");
    static constexpr size_t MASK = N - 1;

public:
    // Called by PRODUCER (e.g., ISR). Returns false if full.
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & MASK;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;  // Full
        }
        buf_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    // Called by CONSUMER (task). Returns nullopt if empty.
    std::optional<T> pop() {
        const size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) {
            return std::nullopt;  // Empty
        }
        T item = buf_[tail];
        tail_.store((tail + 1) & MASK, std::memory_order_release);
        return item;
    }

    bool empty() const {
        return head_.load(std::memory_order_acquire) ==
               tail_.load(std::memory_order_acquire);
    }

private:
    std::array<T, N> buf_{};
    std::atomic<size_t> head_{0};
    std::atomic<size_t> tail_{0};
};

// Example: ADC ISR → processing task
SpscRingBuffer<uint16_t, 64> adc_queue;

// In ISR:
void ADC_IRQHandler() {
    uint16_t sample = ADC1->DR;
    adc_queue.push(sample);  // Non-blocking, ISR-safe
}

// In task:
void adc_processing_task() {
    while (true) {
        if (auto sample = adc_queue.pop()) {
            process_adc(*sample);
        }
        vTaskDelay(1);
    }
}
```

**Production alternative:** The Embedded Template Library provides `etl::queue_spsc_isr<T, N>` —
a production-ready ISR-safe SPSC queue with fixed capacity, specifically designed for interrupt
contexts. Consider using it instead of rolling your own if ETL is available in your project.

**Memory ordering rationale:**
- `relaxed` on producer's head read (only producer writes head)
- `acquire` on consumer's head read (synchronizes with producer's `release` store)
- `release` on producer's head write (makes the written data visible to consumer)
- Same pattern mirrored for tail

**Performance optimization:** Cache local copies of head/tail to reduce atomic load frequency.
The producer caches the last-known tail value and only re-reads it when the buffer appears full.
The consumer does the same for head. This eliminates one atomic load per push/pop in the common
(non-empty, non-full) case.

**Cache line padding (Cortex-M7):** On cores with D-cache, head and tail should be separated
by at least 32 bytes to avoid false sharing. On cacheless Cortex-M0/M3/M4 this is unnecessary.

---

## 4. DMA Buffer: Alignment and Cache Coherency

On Cortex-M7 (STM32H7, STM32F7) with D-cache enabled, a DMA transfer that writes to a cached
memory region will not be visible to the CPU until the cache is invalidated. Forgetting this causes
silent data corruption that only appears under specific cache eviction patterns.

**Alignment depends on MCU family — not all Cortex-M cores have D-cache:**

| MCU Core | D-Cache | DMA Alignment | Cache Maintenance |
|---|---|---|---|
| Cortex-M0/M0+/M3 | None | Word-aligned (4 bytes) | Not needed |
| Cortex-M4 (STM32F4) | None | Word-aligned (4 bytes) | Not needed |
| Cortex-M7 (STM32F7/H7) | 32-byte lines | 32-byte aligned + 32-byte size multiple | Required |

```cpp
// Cortex-M4 (STM32F4): no D-cache, word alignment is sufficient
alignas(4) uint8_t dma_buf_m4[256];

// Cortex-M7 (STM32F7/H7): must align to 32-byte cache line
alignas(32) uint8_t dma_buf_m7[256];
// Size must also be a 32-byte multiple to avoid sharing cache lines
```

The examples below show the full M7 workflow (worst case). For M4 and below, skip the
cache maintenance calls and use `alignas(4)` instead of `alignas(32)`.

```cpp
#include <cstdint>
#include <cstring>

// 32-byte alignment matches the Cortex-M7 cache line size.
// Place in a non-cached region (e.g., SRAM4 on H7) or manually manage cache.
alignas(32) uint8_t dma_rx_buf[256];
alignas(32) uint8_t dma_tx_buf[256];

// After DMA-to-memory transfer completes (called from DMA complete callback):
void on_dma_rx_complete() {
    // Invalidate the cache lines covering the DMA buffer so the CPU sees
    // what the DMA wrote, not the stale cached values.
    SCB_InvalidateDCache_by_Addr(
        reinterpret_cast<uint32_t*>(dma_rx_buf),
        sizeof(dma_rx_buf)
    );
    // Now safe to read dma_rx_buf
    process_received_data(dma_rx_buf, sizeof(dma_rx_buf));
}

// Before memory-to-DMA transfer (flush CPU writes to memory before DMA reads):
void start_dma_tx(const uint8_t* data, size_t len) {
    memcpy(dma_tx_buf, data, len);
    // Clean (flush) the cache so DMA sees the CPU's writes
    SCB_CleanDCache_by_Addr(
        reinterpret_cast<uint32_t*>(dma_tx_buf),
        sizeof(dma_tx_buf)
    );
    HAL_UART_Transmit_DMA(&huart1, dma_tx_buf, len);
}
```

**Simpler alternative:** Place DMA buffers in a non-cached SRAM region using the linker script:

```c
// In C or C++ source:
__attribute__((section(".dma_buf"))) uint8_t dma_rx_buf[256];
```

```ld
/* In linker script (.ld file): */
.dma_buf (NOLOAD) :
{
    *(.dma_buf)
} >SRAM4   /* SRAM4 on STM32H7 is not cached by default */
```

This eliminates all cache management code at the cost of being in slower SRAM.

---

## 5. Singleton Resource Manager

The Meyers singleton (local static) is the idiomatic C++ way to create a lazily-initialized
singleton. It is thread-safe at initialization in C++11 and later (guaranteed by the standard).
In embedded, be aware that "thread safety" at init time means safe between FreeRTOS tasks, but
initialization must complete before any task calls `instance()`.

```cpp
class UartManager {
public:
    static UartManager& instance() {
        static UartManager inst;  // Initialized once, on first call
        return inst;
    }

    // Delete copy and move — there must be exactly one
    UartManager(const UartManager&) = delete;
    UartManager& operator=(const UartManager&) = delete;
    UartManager(UartManager&&) = delete;
    UartManager& operator=(UartManager&&) = delete;

    bool send(const uint8_t* data, size_t len) {
        return HAL_UART_Transmit(&huart1, data, len, HAL_MAX_DELAY) == HAL_OK;
    }

private:
    UartManager() {
        // Hardware init — called once
        MX_USART1_UART_Init();
    }
    ~UartManager() = default;
};

// Usage — no global variable needed:
UartManager::instance().send(buf, len);
```

**Embedded startup note:** Local statics initialize the first time control reaches their declaration.
If `instance()` is called from a global constructor or before `main()`, be careful about initialization
order. Prefer calling `instance()` for the first time explicitly during your initialization sequence,
not from within constructors of other globals.

---

## 6. std::optional for Error Handling

`std::optional<T>` replaces sentinel values (`-1`, `nullptr`, `UINT32_MAX`) and eliminates the need
for out-parameters, making error handling at the call site explicit and compiler-checked.

```cpp
#include <optional>
#include <cstdint>

struct SensorReading {
    float temperature_c;
    float humidity_pct;
    uint32_t timestamp_ms;
};

// Returns nullopt if sensor is not ready or read fails
std::optional<SensorReading> read_htu21() {
    if (!htu21_is_ready()) return std::nullopt;

    uint16_t raw_t = htu21_read_temperature_raw();
    uint16_t raw_h = htu21_read_humidity_raw();

    if (raw_t == 0xFFFF || raw_h == 0xFFFF) return std::nullopt;  // CRC error

    return SensorReading{
        .temperature_c = -46.85f + 175.72f * (raw_t / 65536.0f),
        .humidity_pct  = -6.0f  + 125.0f  * (raw_h / 65536.0f),
        .timestamp_ms  = HAL_GetTick(),
    };
}

// Caller is forced to handle the "no value" case:
void update_display() {
    if (auto reading = read_htu21()) {
        display_set_temp(reading->temperature_c);
        display_set_humidity(reading->humidity_pct);
    } else {
        display_show_error(ErrorCode::SensorNotReady);
    }
}
```

`std::optional<T>` has zero heap allocation — it stores T inline with a bool flag. On small MCUs
with 32-bit alignment, the overhead is typically just one word of padding.

---

## 7. Zero-Initialization Guarantee

The C++ standard guarantees that objects with static storage duration (global variables, function-local
statics, variables in `.bss`) are zero-initialized before any other initialization runs. This happens
before `main()` in the startup code (typically in `startup_stm32xxx.s` or equivalent).

This is a reliable embedded pattern — you can depend on it:

```cpp
// These are all zero-initialized before main():
static uint32_t packet_count;          // = 0
static bool initialized;               // = false
static uint8_t rx_buffer[256];         // all zeros

// Function-local static — zero-initialized on first call
void log_event(Event e) {
    static uint32_t event_count;  // reliably 0 before first call
    ++event_count;
    // ...
}
```

**Do not** rely on this for stack-allocated (auto) variables — those are uninitialized:

```cpp
void bad() {
    uint32_t counter;   // Uninitialized — could be anything
    counter++;          // Undefined behavior
}

void good() {
    uint32_t counter = 0;   // Explicit initialization — always correct
    counter++;
}
```

---

## 8. Linker Section Placement

The linker script controls where each variable or function lives in memory. You can override the
default placement using GCC attributes. Common use cases: putting time-critical code in fast TCM
RAM, placing large buffers in external SDRAM, or putting DMA buffers in non-cached SRAM.

```c
// Place in Core-Coupled Memory RAM (CCMRAM) on STM32F4 — fast, no D-cache
__attribute__((section(".ccmram")))
static uint8_t fast_buffer[1024];

// Place function in ITCM (Instruction Tightly Coupled Memory) on STM32H7
__attribute__((section(".itcmram")))
void __attribute__((noinline)) critical_isr_handler() {
    // This function runs from TCM — zero wait state, no cache miss penalty
}

// DMA buffer in non-cached SRAM region
__attribute__((section(".dma_buf"), aligned(32)))
static uint8_t dma_rx[512];
```

**Corresponding linker script entries (STM32-style):**

```ld
MEMORY {
    FLASH   (rx)  : ORIGIN = 0x08000000, LENGTH = 1024K
    DTCMRAM (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    RAM     (xrw) : ORIGIN = 0x24000000, LENGTH = 512K
    ITCMRAM (xrw) : ORIGIN = 0x00000000, LENGTH = 64K
    SRAM4   (xrw) : ORIGIN = 0x38000000, LENGTH = 64K
}

.ccmram :
{
    *(.ccmram)
    *(.ccmram*)
} >DTCMRAM AT> FLASH

.dma_buf (NOLOAD) :
{
    . = ALIGN(32);
    *(.dma_buf)
    . = ALIGN(32);
} >SRAM4
```

Always add `static_assert(sizeof(fast_buffer) <= CCMRAM_SIZE, "Buffer too large for CCMRAM");`
or a linker symbol check to catch overflow at build time rather than at runtime.

---

## 9. ESP32 Memory Patterns and Heap Fragmentation

The ESP32 (Xtensa LX6/LX7 and RISC-V) has a more complex memory map than a typical Cortex-M:
multiple non-contiguous heaps (DRAM, IRAM, PSRAM), and the Arduino/ESP-IDF frameworks make
heavy use of dynamic allocation under the hood. This makes heap fragmentation a primary
failure mode for long-running ESP32 firmware.

### Diagnosing Heap Fragmentation on ESP32

When an ESP32 application crashes after hours/days of uptime, the first suspect is heap
fragmentation from repeated `new`/`delete` or `malloc`/`free` cycles. Monitor with:

```cpp
// ESP-IDF / Arduino: print heap health periodically
void log_heap_status() {
    Serial.printf("Free heap: %u bytes\n", ESP.getFreeHeap());
    Serial.printf("Largest free block: %u bytes\n", ESP.getMaxAllocHeap());
    Serial.printf("Min free heap ever: %u bytes\n", ESP.getMinFreeHeap());

    // Key indicator: if free heap is large but max alloc block is small,
    // the heap is fragmented — many small free chunks, no large contiguous block
    if (ESP.getFreeHeap() > 50000 && ESP.getMaxAllocHeap() < 10000) {
        Serial.println("WARNING: Heap is heavily fragmented!");
    }
}
```

### Common ESP32 Allocation Traps

**Arduino `String` class:** Every concatenation, substring, or conversion allocates on the heap.
In a loop running at 10Hz with 4 sensors, that's 40+ alloc/free cycles per second — over 3.4
million per day. Replace with fixed-size `char[]` buffers and `snprintf`:

```cpp
// BAD: Arduino String — heap allocation on every operation
String json = "{\"temp\":" + String(temp) + ",\"hum\":" + String(hum) + "}";
mqtt.publish("sensor/data", json.c_str());

// GOOD: Fixed buffer — zero heap allocation
char json[128];
snprintf(json, sizeof(json), "{\"temp\":%.1f,\"hum\":%.1f}", temp, hum);
mqtt.publish("sensor/data", json);
```

**`new SensorReading()` in a loop:** Replace with a static array or object pool:

```cpp
// BAD: new/delete every 100ms
SensorReading* r = new SensorReading();
process(r);
delete r;  // Fragments heap over time

// GOOD: Static ring buffer of readings — no heap
static SensorReading readings[4];  // One per sensor
static uint8_t idx = 0;
SensorReading& r = readings[idx++ % 4];
r = read_sensor();
process(&r);
```

### ETL for ESP32 Projects

The [Embedded Template Library (ETL)](https://www.etlcpp.com) provides fixed-capacity,
heap-free alternatives to STL containers. ETL works on ESP32 with Arduino or ESP-IDF:

```cpp
#include <etl/string.h>
#include <etl/vector.h>
#include <etl/queue_spsc_atomic.h>

// Fixed-capacity string — no heap, 127 chars max
etl::string<128> device_name("sensor-hub-01");

// Fixed-capacity vector — no heap, 16 readings max
etl::vector<SensorReading, 16> readings;
readings.push_back(read_sensor());  // No reallocation ever

// ISR-safe SPSC queue — no heap, no locks, perfect for ISR→task comms
etl::queue_spsc_atomic<uint16_t, 64> adc_queue;
```

Install ETL in PlatformIO: `lib_deps = ETLCPP/Embedded Template Library`
Install ETL in ESP-IDF: add as a component via `idf_component.yml`

### MISRA Relevance for ESP32

Even outside safety-critical contexts, MISRA C Rule 21.3 (no `malloc`/`calloc`/`realloc`/`free`
in production paths) and MISRA C++ Rule 21.6.1 (no dynamic memory after init) are directly
applicable to ESP32 firmware. The reasoning is practical, not bureaucratic: on a device with
320KB DRAM and no MMU, heap fragmentation from continuous allocation is a reliability defect,
not a style issue. Cite these rules when justifying the refactoring effort to eliminate dynamic
allocation from periodic task paths.

### ESP32-Specific Memory Architecture

| Region | Size (ESP32) | Use for | Notes |
|--------|-------------|---------|-------|
| DRAM | 320KB | General data, heap | Shared between stacks, heap, static |
| IRAM | 200KB | ISR handlers, hot code | Faster than flash; limited |
| PSRAM | 4-8MB (optional) | Large buffers, non-realtime data | Slow (~10x DRAM latency); don't use for ISR data |
| RTC FAST | 8KB | Data surviving deep sleep | Accessible only by PRO_CPU |
| RTC SLOW | 8KB | ULP coprocessor data | Very limited |

**PSRAM for large buffers:** `ps_malloc()` and `heap_caps_malloc(size, MALLOC_CAP_SPIRAM)` allocate
from PSRAM. This memory is ~10× slower than DRAM (~100ns vs ~10ns access latency) but has 4-8MB
capacity. Use PSRAM for:
- SD card write buffers and CSV formatting buffers (not latency-sensitive)
- MQTT payloads, JSON serialization buffers, HTTP response buffers
- Display framebuffers, image processing scratch space
- Any buffer >4KB that isn't accessed from ISRs or tight control loops

For data loggers specifically: keep the ring buffer (ISR-to-task) in DRAM for speed, but consider
placing the CSV format buffer and SD write buffer in PSRAM to free DRAM for real-time use.

```cpp
// Static DRAM ring buffer (fast, ISR-safe)
static SpscRingBuffer<SensorSample, 2048> s_ring;  // ~24KB in DRAM

// Large format buffer in PSRAM (slow, but only used by logger task)
static char* s_csv_buf = nullptr;  // Allocated from PSRAM during init
void init_buffers() {
    s_csv_buf = (char*)heap_caps_malloc(48000, MALLOC_CAP_SPIRAM);
    assert(s_csv_buf);  // Init-time allocation is OK
}
```

Never use PSRAM in ISRs or tight control loops. If the ESP32 variant lacks PSRAM, all buffers
must fit in DRAM — document the memory budget explicitly.

### ESP32 Task Stack Sizing

ESP-IDF/FreeRTOS defaults are often too small for complex tasks. Monitor with:

```cpp
// Check remaining stack for current task
UBaseType_t remaining = uxTaskGetStackHighWaterMark(NULL);
Serial.printf("Stack remaining: %u words (%u bytes)\n",
              remaining, remaining * sizeof(StackType_t));
```

Typical stack sizes for ESP32:
- Simple task (GPIO, timer): 2048 bytes
- MQTT/WiFi task: 4096-8192 bytes
- Task using `snprintf` or JSON: 4096+ bytes (printf family uses ~1KB stack)
- Task with TLS/SSL: 8192-16384 bytes
