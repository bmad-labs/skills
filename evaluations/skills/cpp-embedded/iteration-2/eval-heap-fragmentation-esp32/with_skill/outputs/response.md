# ESP32 Sensor Hub: Heap Fragmentation Crash After 6 Hours

## Root Cause: Heap Fragmentation from Repeated `new`/`delete` in a Tight Loop

Your firmware has two allocation hotspots that together guarantee heap fragmentation and eventual crash:

1. **`new SensorReading()`** -- called 4 times every 100ms = **40 allocations/second**
2. **`new String(json)`** -- called every MQTT publish = at least **10 allocations/second** (plus internal reallocations inside `String`)

Over 6 hours that is roughly **1,080,000 heap allocations and deallocations**. On the ESP32's heap (typically 160-300KB usable), each `new`/`delete` cycle leaves behind small gaps between other live objects. Eventually the heap has enough free bytes in total, but no single contiguous block large enough to satisfy the next `new`. `malloc` returns `nullptr`, the Arduino `new` either returns null or aborts, and the firmware crashes.

The steady decline in `ESP.getFreeHeap()` you are observing is the classic signature: total free bytes drift down because fragmented gaps cannot be coalesced.

### Why It Works at Startup

At boot the heap is one contiguous block. Early allocations are packed tightly. Fragmentation is a cumulative effect -- it takes hours of allocate/free churn before the holes become fatal.

---

## The Fix: Eliminate All Dynamic Allocation in the Sensor Read and MQTT Publish Paths

### Step 1: Replace `new SensorReading()` with a Static Object Pool

Pre-allocate a fixed number of `SensorReading` objects at startup. Acquire and release from the pool instead of the heap. This gives O(1) deterministic allocation with zero fragmentation.

```cpp
// SensorReading definition -- keep it a plain struct
struct SensorReading {
    float temperature;
    float humidity;
    float pressure;
    float light;
    uint32_t timestamp_ms;
};

// Static object pool -- lives in .bss, never touches the heap
template<typename T, size_t N>
class ObjectPool {
public:
    T* allocate() {
        for (size_t i = 0; i < N; i++) {
            if (!used_[i]) {
                used_[i] = true;
                return reinterpret_cast<T*>(&storage_[i]);
            }
        }
        return nullptr;  // Pool exhausted
    }

    void free(T* obj) {
        for (size_t i = 0; i < N; i++) {
            if (reinterpret_cast<T*>(&storage_[i]) == obj) {
                used_[i] = false;
                return;
            }
        }
    }

private:
    struct alignas(T) Slot {
        uint8_t data[sizeof(T)];
    };
    Slot storage_[N]{};
    bool used_[N]{};
};

// Pool of 8 readings -- enough for 4 sensors with double-buffering
static ObjectPool<SensorReading, 8> reading_pool;
```

Usage in the sensor read loop:

```cpp
void read_sensors() {
    for (int i = 0; i < 4; i++) {
        SensorReading* reading = reading_pool.allocate();
        if (!reading) {
            // Pool exhausted -- indicates a logic bug (readings not being freed)
            log_error("SensorReading pool exhausted");
            continue;
        }

        reading->timestamp_ms = millis();
        // ... fill in sensor data ...

        publish_reading(reading);
        reading_pool.free(reading);  // Return to pool immediately after publish
    }
}
```

**Even simpler approach** -- if readings are short-lived (read, publish, discard), skip the pool entirely and use a stack-local struct:

```cpp
void read_and_publish_sensors() {
    SensorReading reading;  // On the stack -- zero heap involvement

    for (int i = 0; i < 4; i++) {
        reading.timestamp_ms = millis();
        read_sensor(i, &reading);
        publish_reading(&reading);
    }
    // reading goes out of scope, stack reclaimed automatically
}
```

This is the preferred approach for your use case. Stack allocation is deterministic and instant. A `SensorReading` struct is small (20-24 bytes) -- well within safe stack limits.

### Step 2: Eliminate `new String(json)` from MQTT Publish

Arduino `String` is the single worst offender for heap fragmentation on ESP32. Every concatenation, every `new String()`, every implicit copy allocates and frees heap memory. Replace it entirely with a fixed-size `char` buffer.

**Before (heap-fragmenting):**
```cpp
void publish_reading(SensorReading* r) {
    String* json = new String("{\"temp\":");
    *json += String(r->temperature, 2);
    *json += ",\"hum\":";
    *json += String(r->humidity, 2);
    *json += "}";

    mqttClient.publish("sensors/data", json->c_str());
    delete json;  // Each delete leaves a hole in the heap
}
```

**After (zero heap allocation):**
```cpp
// Fixed buffer -- sized for the largest possible JSON payload
static char json_buf[256];

void publish_reading(const SensorReading& r) {
    int len = snprintf(json_buf, sizeof(json_buf),
        "{\"temp\":%.2f,\"hum\":%.2f,\"pres\":%.2f,\"lux\":%.2f,\"ts\":%lu}",
        r.temperature,
        r.humidity,
        r.pressure,
        r.light,
        (unsigned long)r.timestamp_ms
    );

    if (len > 0 && len < (int)sizeof(json_buf)) {
        mqttClient.publish("sensors/data", json_buf);
    } else {
        log_error("JSON buffer overflow: need %d bytes", len);
    }
}
```

Key points:
- `json_buf` is `static` -- allocated once in `.bss` at startup, never freed, never fragmented.
- `snprintf` is bounded -- it will never write past `sizeof(json_buf)`.
- No `String` objects anywhere in the publish path.

### Step 3: Audit and Eliminate All Remaining Arduino `String` Usage

Search your entire codebase for `String` (capital S). Every instance is a potential heap fragmentation source.

Common hidden allocations in Arduino ESP32 code:

| Pattern | Problem | Replacement |
|---------|---------|-------------|
| `String topic = "sensors/" + sensorId;` | Heap alloc on every call | `static char topic[64]; snprintf(topic, sizeof(topic), "sensors/%s", sensor_id);` |
| `WiFi.macAddress()` returns `String` | Heap allocation | Call once at startup, store in `static char mac[18];` |
| `mqttClient.publish(topic.c_str(), payload.c_str())` | Two String temps | Use `char[]` buffers for both |
| `Serial.println(String("Value: ") + val)` | Heap alloc for debug | `Serial.printf("Value: %d\n", val);` |
| `json["key"] = value` (ArduinoJson) | ArduinoJson `DynamicJsonDocument` uses heap | Use `StaticJsonDocument<N>` instead |

### Step 4: Add Runtime Heap Monitoring

Even after fixing the above, add monitoring to catch any remaining leaks or fragmentation:

```cpp
static uint32_t min_free_heap = UINT32_MAX;

void monitor_heap() {
    uint32_t free_heap = ESP.getFreeHeap();
    uint32_t largest_block = ESP.getMaxAllocHeap();  // Largest contiguous free block

    if (free_heap < min_free_heap) {
        min_free_heap = free_heap;
    }

    // Log periodically (every 60 seconds, not every 100ms)
    static uint32_t last_log = 0;
    if (millis() - last_log > 60000) {
        Serial.printf("Heap: free=%u, min=%u, largest_block=%u, frag=%.1f%%\n",
            free_heap, min_free_heap, largest_block,
            100.0f * (1.0f - (float)largest_block / (float)free_heap));
        last_log = millis();
    }

    // Alert if fragmentation is high (free heap OK but largest block is small)
    if (free_heap > 10000 && largest_block < 2000) {
        log_error("CRITICAL: Heap fragmentation detected!");
    }
}
```

The key metric is `ESP.getMaxAllocHeap()` -- the largest contiguous free block. If total free heap is 50KB but the largest block is 500 bytes, your heap is fatally fragmented even though "memory seems fine."

---

## Complete Refactored Sensor Loop

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

struct SensorReading {
    float temperature;
    float humidity;
    float pressure;
    float light;
    uint32_t timestamp_ms;
};

// All buffers are static -- zero heap allocation in the main loop
static char json_buf[256];
static char topic_buf[64];
static SensorReading reading;
static uint32_t min_free_heap = UINT32_MAX;

// Forward declarations
void read_sensor(int index, SensorReading* out);
bool is_sensor_online(int index);

void sensor_task_loop() {
    // Read all 4 sensors -- stack-local struct, no heap
    for (int i = 0; i < 4; i++) {
        if (!is_sensor_online(i)) continue;

        reading.timestamp_ms = millis();
        read_sensor(i, &reading);

        // Format JSON into static buffer
        int len = snprintf(json_buf, sizeof(json_buf),
            "{\"sensor\":%d,\"temp\":%.2f,\"hum\":%.2f,"
            "\"pres\":%.2f,\"lux\":%.2f,\"ts\":%lu}",
            i, reading.temperature, reading.humidity,
            reading.pressure, reading.light,
            (unsigned long)reading.timestamp_ms);

        if (len > 0 && len < (int)sizeof(json_buf)) {
            snprintf(topic_buf, sizeof(topic_buf), "sensors/%d/data", i);
            mqttClient.publish(topic_buf, json_buf);
        }
    }

    // Heap monitoring -- runs every iteration but only logs every 60s
    uint32_t free_heap = ESP.getFreeHeap();
    if (free_heap < min_free_heap) min_free_heap = free_heap;

    static uint32_t last_heap_log = 0;
    if (millis() - last_heap_log > 60000) {
        uint32_t largest = ESP.getMaxAllocHeap();
        Serial.printf("[HEAP] free=%u min=%u largest=%u frag=%.1f%%\n",
            free_heap, min_free_heap, largest,
            100.0f * (1.0f - (float)largest / (float)free_heap));
        last_heap_log = millis();
    }
}

void loop() {
    mqttClient.loop();
    sensor_task_loop();
    delay(100);  // 100ms sensor read interval
}
```

---

## Summary of Changes

| What | Before (broken) | After (fixed) |
|------|-----------------|---------------|
| Sensor readings | `new SensorReading()` on heap every 100ms | Stack-local or static struct -- zero allocations |
| JSON formatting | `new String(json)` with concatenation | `snprintf` into `static char[]` buffer |
| String usage | Arduino `String` throughout | `char[]` + `snprintf` everywhere |
| Heap monitoring | None | `ESP.getFreeHeap()` + `ESP.getMaxAllocHeap()` logged every 60s |
| Allocations per second | ~50+ (new/delete churn) | **0** in steady state |

After these changes, the heap state after 6 hours will be identical to the heap state at boot. No fragmentation, no drift, no crash.

## Additional Recommendations

1. **If using ArduinoJson**, switch from `DynamicJsonDocument` to `StaticJsonDocument<N>`. The dynamic variant calls `malloc` internally.

2. **If using WiFi reconnection logic**, audit it for `String` usage. `WiFi.SSID()`, `WiFi.localIP().toString()`, and similar return Arduino `String` objects.

3. **Consider adding a watchdog timer** (`esp_task_wdt_init()`) so that if the firmware does hang for any reason, it resets cleanly rather than staying in a crashed state.

4. **For I2C at 100ms intervals**, verify your I2C timeout handling. A stuck I2C bus (SDA held low by a misbehaving sensor) can block indefinitely. Use `Wire.setTimeOut(50)` on ESP32 Arduino to bound the worst case.
