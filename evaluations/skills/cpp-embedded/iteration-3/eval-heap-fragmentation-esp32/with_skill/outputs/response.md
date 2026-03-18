# ESP32 Sensor Hub: Diagnosing and Fixing Heap Fragmentation Crash

## Root Cause: Heap Fragmentation from Continuous Dynamic Allocation

Your firmware is dying from **heap fragmentation**, not memory exhaustion. The two lines you identified are the smoking guns:

1. **`new SensorReading()`** -- called every 100ms for 4 sensors = 40 allocations/second = **3,456,000 alloc/free cycles per day**
2. **`new String(json)`** -- Arduino `String` heap-allocates on every construction, concatenation, and conversion = another 10+ alloc/free cycles per second

After 6 hours, that is over 860,000 allocation cycles. Each `new`/`delete` pair leaves the heap slightly more fragmented. Free heap may still report plenty of bytes available, but the largest contiguous free block shrinks until an allocation request (even a small one) fails. On the ESP32 with 320KB DRAM and no MMU, there is no virtual memory to hide behind -- fragmentation is a reliability defect.

### Why "Memory Seems Fine at Startup"

At startup, the heap is one large contiguous block. `ESP.getFreeHeap()` and the largest allocatable block are nearly identical. Over time, the interleaving of different-sized allocations and frees creates many small free chunks. Total free memory may still be 100KB+, but the largest single block might be under 4KB. The next WiFi/TLS operation or MQTT publish that needs a contiguous buffer fails, and the firmware crashes.

## Step 1: Confirm the Diagnosis

Add heap health monitoring to your main loop or a dedicated watchdog task:

```cpp
void log_heap_status() {
    Serial.printf("Free heap: %u bytes\n", ESP.getFreeHeap());
    Serial.printf("Largest free block: %u bytes\n", ESP.getMaxAllocHeap());
    Serial.printf("Min free heap ever: %u bytes\n", ESP.getMinFreeHeap());

    // THE KEY INDICATOR: large free heap but small max block = fragmented
    if (ESP.getFreeHeap() > 50000 && ESP.getMaxAllocHeap() < 10000) {
        Serial.println("WARNING: Heap is heavily fragmented!");
    }
}
```

Call this every 30-60 seconds. You will see `getFreeHeap()` staying relatively stable while `getMaxAllocHeap()` steadily decreases. When it drops below the size needed for an MQTT publish buffer or a WiFi/TLS internal allocation, the crash happens.

## Step 2: Eliminate `new SensorReading()` -- Use Static Storage

You know at compile time that you have exactly 4 sensors. There is no reason to dynamically allocate readings.

### Before (heap-allocating):
```cpp
void read_sensors() {
    for (int i = 0; i < 4; i++) {
        SensorReading* r = new SensorReading();
        r->temperature = sensors[i].readTemp();
        r->humidity = sensors[i].readHumidity();
        r->timestamp = millis();
        publish_reading(r);
        delete r;  // Fragments heap every 100ms
    }
}
```

### After (zero heap allocation):
```cpp
// Static array -- allocated once, reused forever, zero fragmentation
static SensorReading readings[4];

void read_sensors() {
    for (int i = 0; i < 4; i++) {
        readings[i].temperature = sensors[i].readTemp();
        readings[i].humidity = sensors[i].readHumidity();
        readings[i].timestamp = millis();
        publish_reading(&readings[i]);
    }
}
```

If you need to queue readings for asynchronous processing, use an object pool instead of `new`:

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
        alignas(T) uint8_t storage[sizeof(T)];
        bool used = false;
    };
    Slot slots_[N]{};
};

// Pre-allocate pool for 8 readings (double-buffer for 4 sensors)
static ObjectPool<SensorReading, 8> reading_pool;

void read_sensors() {
    for (int i = 0; i < 4; i++) {
        SensorReading* r = reading_pool.allocate();
        if (!r) {
            Serial.println("ERROR: Reading pool exhausted");
            continue;
        }
        r->temperature = sensors[i].readTemp();
        r->humidity = sensors[i].readHumidity();
        r->timestamp = millis();
        publish_reading(r);
        reading_pool.free(r);
    }
}
```

The pool uses placement `new` into pre-allocated static storage. O(1) alloc/free, zero heap involvement, zero fragmentation.

## Step 3: Eliminate Arduino `String` -- Use Fixed `char[]` Buffers

Arduino `String` is the single worst offender for heap fragmentation on ESP32. Every concatenation allocates a new buffer, copies the old content, and frees the old buffer. With 4 sensors at 10Hz, this alone generates millions of tiny heap holes per day.

### Before (Arduino String -- heap allocation on every operation):
```cpp
void publish_reading(SensorReading* r) {
    String json = "{\"temp\":" + String(r->temperature) +
                  ",\"hum\":" + String(r->humidity) +
                  ",\"ts\":" + String(r->timestamp) + "}";
    mqtt.publish("sensor/data", json.c_str());
    // 'json' destructor frees heap -- leaves fragmentation behind
}
```

This single function performs 6+ heap allocations per call (one per `String()` construction and one per `+` concatenation). At 40 calls/second, that is 240+ alloc/free cycles per second just for JSON formatting.

### After (fixed buffer -- zero heap allocation):
```cpp
void publish_reading(const SensorReading* r) {
    char json[128];  // Stack-allocated, fixed size
    snprintf(json, sizeof(json),
             "{\"temp\":%.1f,\"hum\":%.1f,\"ts\":%lu}",
             r->temperature, r->humidity, r->timestamp);
    mqtt.publish("sensor/data", json);
}
```

If you need to build more complex JSON payloads, or if `snprintf` becomes unwieldy, use `etl::string<N>` from the Embedded Template Library (ETL):

```cpp
#include <etl/string.h>

void publish_reading(const SensorReading* r) {
    etl::string<128> json;
    // etl::string has the same API as std::string but with zero heap allocation
    // Capacity is fixed at 128 chars, allocated inline
    json = "{\"temp\":";
    json.append(etl::to_string(r->temperature, json.capacity()));
    // ... or just use snprintf into json.data() for complex formatting

    char buf[128];
    snprintf(buf, sizeof(buf),
             "{\"temp\":%.1f,\"hum\":%.1f,\"ts\":%lu}",
             r->temperature, r->humidity, r->timestamp);
    mqtt.publish("sensor/data", buf);
}
```

Install ETL in PlatformIO by adding to `platformio.ini`:
```ini
lib_deps = ETLCPP/Embedded Template Library
```

## Step 4: Audit for Other Hidden Allocations

Beyond the two obvious sources, check for these common hidden allocation traps in Arduino/ESP32 code:

| Hidden Allocator | Where It Hides | Fix |
|---|---|---|
| `String` concatenation with `+` | JSON building, log messages | `snprintf` into `char[]` |
| `String(int)`, `String(float)` | Number-to-string conversion | `snprintf` or `dtostrf` |
| `std::string` | Library APIs, JSON libraries | `etl::string<N>` or `char[]` |
| `std::vector` | Accumulating readings | `std::array` or `etl::vector<T,N>` |
| `ArduinoJson` `DynamicJsonDocument` | JSON serialization | Use `StaticJsonDocument<N>` instead |
| `WiFiClient.readString()` | HTTP responses | Read into pre-allocated `char[]` |
| `mqtt.setBufferSize()` | PubSubClient internal buffer | Call once at startup, not per publish |

### ArduinoJson Specifically

If you use ArduinoJson, switch from `DynamicJsonDocument` to `StaticJsonDocument`:

```cpp
// BAD: DynamicJsonDocument allocates on heap
DynamicJsonDocument doc(256);

// GOOD: StaticJsonDocument uses stack/static storage
StaticJsonDocument<256> doc;
doc["temp"] = reading.temperature;
doc["hum"] = reading.humidity;
doc["ts"] = reading.timestamp;

char output[128];
serializeJson(doc, output, sizeof(output));
mqtt.publish("sensor/data", output);
```

## Step 5: Full Refactored Sensor Loop

Here is the complete corrected sensor reading and publishing loop with zero dynamic allocation in the periodic path:

```cpp
#include <Arduino.h>
#include <PubSubClient.h>

struct SensorReading {
    float temperature;
    float humidity;
    uint32_t timestamp;
    uint8_t sensor_id;
};

// Static storage -- allocated once at startup, never freed
static SensorReading readings[4];

// Pre-allocated JSON buffer
static char json_buf[256];

// Pre-allocated topic buffer
static char topic_buf[64];

void read_and_publish_sensors() {
    for (uint8_t i = 0; i < 4; i++) {
        // Read directly into static storage -- no allocation
        readings[i].sensor_id = i;
        readings[i].temperature = sensors[i].readTemp();
        readings[i].humidity = sensors[i].readHumidity();
        readings[i].timestamp = millis();

        // Format JSON with snprintf -- stack only, no heap
        snprintf(json_buf, sizeof(json_buf),
                 "{\"id\":%u,\"temp\":%.1f,\"hum\":%.1f,\"ts\":%lu}",
                 readings[i].sensor_id,
                 readings[i].temperature,
                 readings[i].humidity,
                 readings[i].timestamp);

        // Format topic -- no String concatenation
        snprintf(topic_buf, sizeof(topic_buf), "sensors/%u/data", i);

        mqtt.publish(topic_buf, json_buf);
    }
}

void setup() {
    Serial.begin(115200);
    // ... WiFi and MQTT setup ...

    // Log initial heap state
    Serial.printf("Startup - Free heap: %u, Max block: %u\n",
                  ESP.getFreeHeap(), ESP.getMaxAllocHeap());
}

void loop() {
    mqtt.loop();

    static uint32_t last_read = 0;
    static uint32_t last_heap_log = 0;
    uint32_t now = millis();

    // Sensor read at 10Hz (100ms interval)
    if (now - last_read >= 100) {
        last_read = now;
        read_and_publish_sensors();
    }

    // Heap health monitoring every 60 seconds
    if (now - last_heap_log >= 60000) {
        last_heap_log = now;
        Serial.printf("Heap - Free: %u, Max block: %u, Min ever: %u\n",
                      ESP.getFreeHeap(),
                      ESP.getMaxAllocHeap(),
                      ESP.getMinFreeHeap());
    }
}
```

## Step 6: Verify the Fix

After deploying the refactored firmware, monitor the heap metrics over 24+ hours. You should see:

- `getFreeHeap()` staying flat (no downward trend)
- `getMaxAllocHeap()` staying close to `getFreeHeap()` (no fragmentation gap)
- `getMinFreeHeap()` stabilizing after WiFi/MQTT initial setup

If `getMaxAllocHeap()` still drifts downward, a library is allocating internally. Use ESP-IDF's heap tracing to find the culprit:

```cpp
#include "esp_heap_trace.h"

// In setup(), before the suspect code path:
heap_trace_init_standalone(trace_records, NUM_RECORDS);
heap_trace_start(HEAP_TRACE_LEAKS);

// After the suspect code path:
heap_trace_stop();
heap_trace_dump();  // Prints all unfreed allocations with call stacks
```

## Task Stack Sizing Note

While you are fixing the allocation patterns, also verify your task stack sizes. `snprintf` uses approximately 1KB of stack. If your sensor read task was created with a small stack, the `snprintf` calls may push you close to overflow. Monitor with:

```cpp
UBaseType_t remaining = uxTaskGetStackHighWaterMark(NULL);
Serial.printf("Stack remaining: %u bytes\n", remaining * sizeof(StackType_t));
```

For an ESP32 task doing sensor reads + JSON formatting + MQTT publish, allocate at least 4096 bytes of stack. If TLS/SSL is involved (MQTT over TLS), use 8192-16384 bytes.

## Summary

| Problem | Fix | Allocations Eliminated |
|---|---|---|
| `new SensorReading()` every 100ms | Static `SensorReading readings[4]` | 40/second |
| `new String(json)` for MQTT payload | `char json[128]` + `snprintf` | 10+/second |
| String concatenation with `+` | `snprintf` formatting | 240+/second |
| `DynamicJsonDocument` (if used) | `StaticJsonDocument<N>` | varies |

**Total eliminated: 850,000+ alloc/free cycles per day, reducing fragmentation to zero in the periodic sensor path.**

The MISRA C++ Rule 21.6.1 rationale applies directly here: on a device with 320KB DRAM and no MMU, dynamic allocation in periodic production paths is a reliability defect. Reserve `new`/`malloc` for one-time initialization (WiFi, MQTT client setup), and use static storage, object pools, or stack allocation for everything in the main loop.
