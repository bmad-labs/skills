# ESP32 Sensor Hub: Heap Fragmentation Crash After 6 Hours

## Diagnosis

Your firmware has a textbook **heap fragmentation and memory leak** problem. Here is exactly what is happening:

### The Two Culprits

1. **`new SensorReading()` on every read** -- With 4 sensors at 100ms intervals, that is **40 heap allocations per second**, or **864,000 allocations in 6 hours**. Each `new` grabs a small chunk from the heap. Even if you `delete` every one (and odds are you are missing some), the ESP32's heap allocator fragments over time. Small freed blocks become unusable for future allocations of slightly different sizes.

2. **`new String(json)` on every MQTT publish** -- Arduino `String` uses dynamic heap allocation internally. Every time you construct one, it calls `malloc`. When the String goes out of scope (or you forget to free it), that memory is either leaked or leaves a fragmentation hole. Arduino `String` is also notorious for reallocating internally when you concatenate, which accelerates fragmentation.

### Why It Works at Startup But Fails Later

The ESP32 typically has ~280KB of free heap at boot. Your leak/fragmentation rate is slow enough that it takes hours to exhaust it. The classic signature is: `ESP.getFreeHeap()` steadily decreases over time, then you get a crash when an allocation fails and returns `nullptr` (which you probably don't check), or when fragmentation prevents even a small allocation from succeeding despite "free" bytes remaining.

### The Fundamental Rule You Are Violating

**In embedded systems, avoid dynamic allocation (`new`/`malloc`) in production runtime paths.** Every `new` in a loop is a ticking time bomb. The ESP32's allocator does not compact memory -- once it fragments, it stays fragmented until reboot.

---

## The Fix: Zero-Heap Sensor Loop

The solution applies three embedded best practices:

1. **Static pre-allocation** -- All sensor reading storage is allocated once at startup, never during runtime.
2. **Object pool** -- Fixed number of `SensorReading` slots, allocated from static storage with O(1) alloc/free and zero fragmentation.
3. **Fixed-size char buffers** -- Replace all `String` usage with stack-local `char[]` buffers and `snprintf`.

---

## Refactored Code

### sensor_reading.h -- Plain data struct, no heap

```cpp
#pragma once

#include <cstdint>

struct SensorReading {
    uint8_t  sensor_id;
    float    value;
    uint32_t timestamp_ms;
    bool     valid;
};
```

### object_pool.h -- Static object pool (no heap, O(1) alloc/free)

```cpp
#pragma once

#include <cstddef>
#include <cstdint>
#include <new>
#include <type_traits>

/// Fixed-size object pool with zero heap involvement.
/// All storage is statically allocated. Alloc and free are O(1).
/// Thread-safety: NOT safe across ISR/task boundaries without external locking.
template<typename T, size_t N>
class ObjectPool {
public:
    ObjectPool() {
        // Build the free list at startup
        for (size_t i = 0; i < N; ++i) {
            slots_[i].used = false;
        }
    }

    /// Allocate one object, constructing it in-place with the given arguments.
    /// Returns nullptr if the pool is exhausted.
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

    /// Return an object to the pool. Calls destructor.
    void free(T* obj) {
        if (obj == nullptr) return;
        obj->~T();
        for (auto& slot : slots_) {
            if (reinterpret_cast<T*>(&slot.storage) == obj) {
                slot.used = false;
                return;
            }
        }
        // If we get here, obj was not from this pool -- programming error
    }

    /// Number of currently allocated objects.
    size_t in_use() const {
        size_t count = 0;
        for (const auto& slot : slots_) {
            if (slot.used) ++count;
        }
        return count;
    }

    static constexpr size_t capacity() { return N; }

private:
    struct Slot {
        alignas(T) uint8_t storage[sizeof(T)];
        bool used = false;
    };
    Slot slots_[N]{};
};
```

### mqtt_publisher.h -- Stack-based JSON formatting, no String

```cpp
#pragma once

#include <cstdio>
#include <cstdint>
#include <PubSubClient.h>  // MQTT library

/// Maximum JSON payload size. 4 sensors x ~60 chars each + overhead.
/// Sized for worst case; lives on the stack, not the heap.
static constexpr size_t kMaxJsonPayload = 512;

/// Maximum MQTT topic length.
static constexpr size_t kMaxTopicLen = 64;

class MqttPublisher {
public:
    explicit MqttPublisher(PubSubClient& client, const char* base_topic)
        : client_(client), base_topic_(base_topic) {}

    /// Publish a sensor reading as JSON. All formatting uses stack buffers.
    /// Returns true if publish succeeded.
    bool publish_reading(uint8_t sensor_id, float value, uint32_t timestamp_ms) {
        // Format JSON into a stack-local buffer -- zero heap allocation
        char payload[kMaxJsonPayload];
        int len = snprintf(payload, sizeof(payload),
            "{\"sensor_id\":%u,\"value\":%.2f,\"timestamp\":%lu}",
            static_cast<unsigned>(sensor_id),
            static_cast<double>(value),
            static_cast<unsigned long>(timestamp_ms));

        if (len < 0 || static_cast<size_t>(len) >= sizeof(payload)) {
            return false;  // Formatting error or truncation
        }

        // Format topic into a stack-local buffer
        char topic[kMaxTopicLen];
        snprintf(topic, sizeof(topic), "%s/sensor/%u",
                 base_topic_, static_cast<unsigned>(sensor_id));

        return client_.publish(topic, payload);
    }

    /// Publish a batch of readings as a JSON array.
    bool publish_batch(const SensorReading* readings, size_t count) {
        char payload[kMaxJsonPayload];
        size_t offset = 0;

        // Open JSON array
        offset += snprintf(payload + offset, sizeof(payload) - offset, "[");

        for (size_t i = 0; i < count; ++i) {
            if (!readings[i].valid) continue;

            if (offset > 1) {
                offset += snprintf(payload + offset, sizeof(payload) - offset, ",");
            }
            offset += snprintf(payload + offset, sizeof(payload) - offset,
                "{\"id\":%u,\"val\":%.2f,\"ts\":%lu}",
                static_cast<unsigned>(readings[i].sensor_id),
                static_cast<double>(readings[i].value),
                static_cast<unsigned long>(readings[i].timestamp_ms));

            if (offset >= sizeof(payload) - 2) {
                return false;  // Payload too large
            }
        }

        offset += snprintf(payload + offset, sizeof(payload) - offset, "]");

        char topic[kMaxTopicLen];
        snprintf(topic, sizeof(topic), "%s/batch", base_topic_);

        return client_.publish(topic, payload);
    }

private:
    PubSubClient& client_;
    const char*   base_topic_;
};
```

### main.cpp -- Complete refactored firmware

```cpp
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>

#include "sensor_reading.h"
#include "object_pool.h"
#include "mqtt_publisher.h"

// ============================================================
// Configuration -- all constexpr, computed at compile time
// ============================================================
static constexpr size_t   kNumSensors         = 4;
static constexpr uint32_t kReadIntervalMs      = 100;
static constexpr uint32_t kPublishIntervalMs   = 1000;   // Batch publish every 1s
static constexpr uint32_t kHeapCheckIntervalMs = 30000;  // Log heap every 30s
static constexpr size_t   kPoolSize            = 16;     // Max in-flight readings

// I2C sensor addresses
static constexpr uint8_t kSensorAddresses[kNumSensors] = {0x48, 0x49, 0x4A, 0x4B};

// WiFi and MQTT credentials
static const char* kWifiSsid     = "YOUR_SSID";
static const char* kWifiPassword = "YOUR_PASSWORD";
static const char* kMqttBroker   = "192.168.1.100";
static constexpr uint16_t kMqttPort = 1883;
static const char* kMqttTopic    = "sensors/hub1";

// ============================================================
// Static allocations -- everything allocated at startup, never freed
// ============================================================

// Object pool for sensor readings -- replaces `new SensorReading()`
static ObjectPool<SensorReading, kPoolSize> reading_pool;

// Latest reading per sensor -- static storage, reused every cycle
static SensorReading latest_readings[kNumSensors];

// Networking objects
static WiFiClient wifi_client;
static PubSubClient mqtt_client(wifi_client);
static MqttPublisher* publisher = nullptr;

// A single static MqttPublisher instance (placement new into static storage)
static alignas(MqttPublisher) uint8_t publisher_storage[sizeof(MqttPublisher)];

// Timing
static uint32_t last_read_time    = 0;
static uint32_t last_publish_time = 0;
static uint32_t last_heap_check   = 0;

// ============================================================
// Sensor reading -- returns data by value on stack, zero heap
// ============================================================

/// Read a single I2C sensor. Returns a SensorReading by value (stack).
/// No dynamic allocation involved.
static SensorReading read_i2c_sensor(uint8_t sensor_id, uint8_t address) {
    SensorReading reading{};
    reading.sensor_id    = sensor_id;
    reading.timestamp_ms = millis();
    reading.valid        = false;

    Wire.beginTransmission(address);
    Wire.write(0x00);  // Register address -- adjust for your sensor
    if (Wire.endTransmission(false) != 0) {
        return reading;  // I2C error -- return invalid reading
    }

    size_t received = Wire.requestFrom(address, static_cast<uint8_t>(2));
    if (received < 2) {
        return reading;  // Incomplete read
    }

    // Convert raw bytes to float -- adjust for your sensor's data format
    uint8_t msb = Wire.read();
    uint8_t lsb = Wire.read();
    int16_t raw = static_cast<int16_t>((msb << 8) | lsb);
    reading.value = raw * 0.0078125f;  // Example: TMP102 conversion factor
    reading.valid = true;

    return reading;
}

// ============================================================
// Heap monitoring -- detect problems before they cause crashes
// ============================================================

static void log_heap_status() {
    Serial.print("[HEAP] Free: ");
    Serial.print(ESP.getFreeHeap());
    Serial.print(" bytes | Min ever: ");
    Serial.print(ESP.getMinFreeHeap());
    Serial.print(" | Largest free block: ");
    Serial.print(ESP.getMaxAllocHeap());
    Serial.print(" | Pool in use: ");
    Serial.print(reading_pool.in_use());
    Serial.print("/");
    Serial.println(reading_pool.capacity());
}

// ============================================================
// WiFi and MQTT connection management
// ============================================================

static void ensure_wifi_connected() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.println("[WIFI] Reconnecting...");
    WiFi.begin(kWifiSsid, kWifiPassword);

    // Non-blocking: don't stall the sensor loop waiting for WiFi
    // Check status on next iteration
}

static void ensure_mqtt_connected() {
    if (mqtt_client.connected()) return;
    if (WiFi.status() != WL_CONNECTED) return;

    Serial.println("[MQTT] Reconnecting...");
    // Use a static client ID -- no String allocation
    if (mqtt_client.connect("sensor_hub_01")) {
        Serial.println("[MQTT] Connected.");
    }
}

// ============================================================
// Arduino setup and loop
// ============================================================

void setup() {
    Serial.begin(115200);
    Wire.begin();
    Wire.setClock(400000);  // 400kHz I2C fast mode

    // Initialize WiFi
    WiFi.mode(WIFI_STA);
    WiFi.begin(kWifiSsid, kWifiPassword);

    // Wait for initial connection (blocking OK at startup only)
    uint32_t wifi_start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - wifi_start < 10000) {
        delay(100);
    }

    // Initialize MQTT
    mqtt_client.setServer(kMqttBroker, kMqttPort);
    mqtt_client.setBufferSize(kMaxJsonPayload + 64);  // Ensure buffer fits our payloads

    // Construct the publisher using placement new into static storage.
    // This is the ONE place we use "new" -- and it's placement new, not heap new.
    publisher = new (publisher_storage) MqttPublisher(mqtt_client, kMqttTopic);

    // Initialize the latest_readings array
    for (size_t i = 0; i < kNumSensors; ++i) {
        latest_readings[i] = SensorReading{};
        latest_readings[i].sensor_id = static_cast<uint8_t>(i);
    }

    // Log initial heap state
    Serial.println("[BOOT] Sensor hub initialized.");
    log_heap_status();
}

void loop() {
    uint32_t now = millis();

    // ---- Sensor reading phase (every 100ms) ----
    if (now - last_read_time >= kReadIntervalMs) {
        last_read_time = now;

        for (size_t i = 0; i < kNumSensors; ++i) {
            // Read sensor directly into the static array -- zero allocation
            latest_readings[i] = read_i2c_sensor(
                static_cast<uint8_t>(i),
                kSensorAddresses[i]
            );
        }
    }

    // ---- MQTT publish phase (every 1s) ----
    if (now - last_publish_time >= kPublishIntervalMs) {
        last_publish_time = now;

        ensure_wifi_connected();
        ensure_mqtt_connected();

        if (mqtt_client.connected() && publisher != nullptr) {
            // Publish batch -- all JSON formatting happens on the stack
            publisher->publish_batch(latest_readings, kNumSensors);
        }
    }

    // ---- Heap monitoring (every 30s) ----
    if (now - last_heap_check >= kHeapCheckIntervalMs) {
        last_heap_check = now;
        log_heap_status();
    }

    // MQTT client maintenance (processes incoming packets, keepalive)
    mqtt_client.loop();
}
```

---

## What Changed and Why

### Change 1: Eliminated `new SensorReading()`

**Before (broken):**
```cpp
// Every 100ms, for each sensor -- 40 heap allocations/second
SensorReading* reading = new SensorReading();
reading->value = read_sensor(i);
process(reading);
// Maybe delete reading, maybe not -- leak either way or fragmentation
```

**After (fixed):**
```cpp
// Static array, written in place -- zero allocations ever
latest_readings[i] = read_i2c_sensor(i, kSensorAddresses[i]);
```

The `read_i2c_sensor` function returns `SensorReading` **by value**. The compiler places it directly into `latest_readings[i]` via copy elision (guaranteed in C++17). No heap touched.

### Change 2: Eliminated `new String(json)`

**Before (broken):**
```cpp
// Every publish -- heap alloc for String, internal reallocs during concat
String* json = new String("{\"sensor\":");
*json += sensorId;
*json += ",\"value\":";
*json += value;
*json += "}";
mqtt.publish("topic", json->c_str());
delete json;  // Even if you remember this, fragmentation accumulates
```

**After (fixed):**
```cpp
// Stack-local char array -- formatted with snprintf, zero heap
char payload[512];
snprintf(payload, sizeof(payload),
    "{\"sensor_id\":%u,\"value\":%.2f,\"timestamp\":%lu}",
    sensor_id, value, timestamp);
client_.publish(topic, payload);
// payload disappears when function returns -- stack, not heap
```

### Change 3: Added heap monitoring

The `log_heap_status()` function prints free heap, minimum free heap ever seen, and largest contiguous free block every 30 seconds. This lets you detect fragmentation before it crashes: if `ESP.getMaxAllocHeap()` drops while `ESP.getFreeHeap()` stays relatively stable, you have fragmentation (many small free blocks, but no large contiguous one).

### Change 4: Object pool available for advanced use cases

If your architecture requires passing readings between tasks or buffering them (e.g., store-and-forward when WiFi drops), the `ObjectPool` is included. It provides `allocate()`/`free()` with zero heap involvement. All storage is statically allocated at compile time.

Example use case -- buffering readings when MQTT is disconnected:

```cpp
static ObjectPool<SensorReading, 64> pending_pool;

// When MQTT is down, buffer readings:
SensorReading* buffered = pending_pool.allocate();
if (buffered) {
    *buffered = latest_readings[i];
}

// When MQTT reconnects, drain the pool:
// (iterate and publish, then free each)
```

---

## Quantifying the Improvement

| Metric | Before (broken) | After (fixed) |
|--------|-----------------|---------------|
| Heap allocations per second | ~40 (sensors) + ~10 (MQTT Strings) | **0** |
| Heap allocations over 6 hours | ~864,000+ | **0** |
| Free heap trend | Steadily decreasing | **Flat** |
| Fragmentation risk | Guaranteed over time | **None** |
| Maximum uptime | ~6 hours | **Indefinite** |
| RAM used for readings | Variable (heap) | **Fixed: 4 x sizeof(SensorReading) = ~48 bytes** |
| RAM used for JSON | Variable (String internals) | **Fixed: 512 bytes stack per publish call** |

---

## Additional Recommendations

1. **Audit all remaining `new`/`malloc`/`String` usage.** Search your entire codebase:
   ```bash
   grep -rn "new \|malloc\|String(" src/ --include="*.cpp" --include="*.h"
   ```
   Every hit in a loop or periodic function is a potential leak/fragmentation source.

2. **Set a heap allocation watchdog.** On ESP-IDF (underlying the Arduino framework), you can hook the allocator:
   ```cpp
   // In debug builds, log every heap allocation to find stragglers
   esp_err_t heap_caps_register_failed_alloc_callback(
       esp_alloc_failed_hook_t callback);
   ```

3. **Consider FreeRTOS tasks instead of `loop()`.** If your sensor reads and MQTT publishes have different timing requirements, separate them into FreeRTOS tasks with static stack allocation:
   ```cpp
   static StackType_t sensor_stack[2048];
   static StaticTask_t sensor_task_buf;
   xTaskCreateStatic(sensor_task, "Sensors", 2048, nullptr, 5,
                     sensor_stack, &sensor_task_buf);
   ```
   This gives you explicit control over each task's stack size with zero heap involvement.

4. **Never use Arduino `String` in embedded production code.** Replace every instance with `char[]` + `snprintf`. If you need string manipulation, use the [Embedded Template Library (ETL)](https://www.etlcpp.com) `etl::string<N>` which is fixed-size and heap-free.

5. **Enable stack high-water-mark checking** if using FreeRTOS tasks:
   ```cpp
   UBaseType_t high_water = uxTaskGetStackHighWaterMark(nullptr);
   Serial.printf("[STACK] High water mark: %u words free\n", high_water);
   ```
   This tells you how close you are to overflowing each task's stack.
