# ESP32 Heap Fragmentation and Memory Leak Diagnosis

## Root Cause: Memory Leaks from Dynamic Allocation in a Tight Loop

Your firmware has two classic memory leaks that together drain the heap over hours of operation:

1. **`new SensorReading()` every 100ms** -- If you are not calling `delete` on every single `SensorReading` object after use, each allocation leaks memory. At 4 sensors x 10 reads/sec, that is 40 leaked objects per second, or **144,000 leaked objects per hour**.

2. **`new String(json)` for MQTT publish** -- Arduino `String` objects allocated with `new` on the heap must be explicitly `delete`d. Even if you do delete them, repeated small heap allocations of varying sizes cause **heap fragmentation** on the ESP32, where the allocator eventually cannot find a contiguous block large enough despite having "free" bytes scattered throughout memory.

Even if you are calling `delete` properly, the combination of frequent variable-size `String` allocations interleaved with fixed-size `SensorReading` allocations fragments the heap until allocation fails and the firmware crashes (typically a guru meditation error or watchdog reset).

## Why It Takes ~6 Hours

The ESP32 typically has around 300KB of usable heap. If each `SensorReading` is even 32 bytes and leaks:

- 40 objects/sec x 32 bytes = 1,280 bytes/sec leaked
- ~4.6 MB/hour leaked
- With fragmentation overhead, the effective usable heap shrinks much faster

Even with proper `delete` calls, fragmentation alone can exhaust usable memory over hours because freed blocks become too small and scattered to satisfy new allocations.

## The Fix: Eliminate Dynamic Allocation Entirely

### Step 1: Replace `new SensorReading()` with Static/Stack Allocation

**Before (leaking heap allocation):**
```cpp
void readSensors() {
    for (int i = 0; i < 4; i++) {
        SensorReading* reading = new SensorReading();
        reading->temperature = sensor[i].readTemp();
        reading->humidity = sensor[i].readHumidity();
        reading->timestamp = millis();
        processSensorData(reading);
        // 'reading' is never deleted -- leaked!
    }
}
```

**After (stack allocation, zero heap usage):**
```cpp
// Pre-allocated static buffer for sensor readings
static SensorReading readings[4];

void readSensors() {
    for (int i = 0; i < 4; i++) {
        readings[i].temperature = sensor[i].readTemp();
        readings[i].humidity = sensor[i].readHumidity();
        readings[i].timestamp = millis();
        processSensorData(&readings[i]);
    }
}
```

Or if you only need one at a time, use a local stack variable:
```cpp
void readSensors() {
    for (int i = 0; i < 4; i++) {
        SensorReading reading;  // Stack-allocated, automatically freed
        reading.temperature = sensor[i].readTemp();
        reading.humidity = sensor[i].readHumidity();
        reading.timestamp = millis();
        processSensorData(&reading);
    }
}
```

### Step 2: Replace `new String(json)` with a Static Buffer

**Before (heap-fragmenting String allocation):**
```cpp
void publishMqtt(SensorReading* reading) {
    String* json = new String("{\"temp\":");
    *json += reading->temperature;
    *json += ",\"hum\":";
    *json += reading->humidity;
    *json += "}";
    mqttClient.publish("sensors/data", json->c_str());
    delete json;  // Even with delete, this fragments the heap
}
```

**After (fixed static buffer, zero heap allocation):**
```cpp
// Pre-allocated buffer -- 256 bytes is typically plenty for sensor JSON
static char jsonBuffer[256];

void publishMqtt(const SensorReading* reading) {
    int len = snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"temp\":%.2f,\"hum\":%.2f,\"ts\":%lu}",
        reading->temperature,
        reading->humidity,
        reading->timestamp);

    if (len > 0 && len < (int)sizeof(jsonBuffer)) {
        mqttClient.publish("sensors/data", jsonBuffer);
    }
}
```

### Step 3: If You Need Arduino String, Use Stack Strings (Not `new`)

If you prefer the Arduino `String` API, at least avoid `new`:

```cpp
void publishMqtt(const SensorReading* reading) {
    // Stack-allocated String -- still causes fragmentation but no leak
    String json = "{\"temp\":";
    json += reading->temperature;
    json += ",\"hum\":";
    json += reading->humidity;
    json += "}";
    mqttClient.publish("sensors/data", json.c_str());
    // json is destroyed here automatically
}
```

**However, this still fragments the heap** because Arduino `String` internally calls `malloc`/`realloc` as it grows. The `snprintf` approach with a static buffer is strongly preferred on embedded targets.

### Step 4: Pre-size Strings If You Must Use Them

If you absolutely must use Arduino `String`, pre-reserve to minimize reallocations:

```cpp
void publishMqtt(const SensorReading* reading) {
    String json;
    json.reserve(128);  // Single allocation, no realloc fragmentation
    json = "{\"temp\":";
    json += reading->temperature;
    json += ",\"hum\":";
    json += reading->humidity;
    json += "}";
    mqttClient.publish("sensors/data", json.c_str());
}
```

## Complete Refactored Example

```cpp
#include <Arduino.h>
#include <Wire.h>
#include <PubSubClient.h>

// --- Static allocation: no heap usage in the hot path ---

struct SensorReading {
    float temperature;
    float humidity;
    uint32_t timestamp;
    uint8_t sensorId;
    bool valid;
};

static const int NUM_SENSORS = 4;
static const int READ_INTERVAL_MS = 100;
static const int PUBLISH_INTERVAL_MS = 100;

// Pre-allocated sensor readings -- never uses heap
static SensorReading readings[NUM_SENSORS];

// Pre-allocated JSON buffer
static char jsonBuffer[256];

// Pre-allocated MQTT topic buffer
static char topicBuffer[64];

// Timing
static uint32_t lastReadTime = 0;
static uint32_t lastPublishTime = 0;

// Heap monitoring
static uint32_t lastHeapReport = 0;
static const uint32_t HEAP_REPORT_INTERVAL_MS = 60000; // Every minute

void readAllSensors() {
    uint32_t now = millis();
    for (int i = 0; i < NUM_SENSORS; i++) {
        Wire.beginTransmission(sensorAddresses[i]);
        // ... your I2C read logic ...
        readings[i].temperature = /* read value */;
        readings[i].humidity = /* read value */;
        readings[i].timestamp = now;
        readings[i].sensorId = i;
        readings[i].valid = (Wire.endTransmission() == 0);
    }
}

void publishAllReadings() {
    for (int i = 0; i < NUM_SENSORS; i++) {
        if (!readings[i].valid) continue;

        // Build topic with no heap allocation
        snprintf(topicBuffer, sizeof(topicBuffer), "sensors/%d/data", i);

        // Build JSON with no heap allocation
        int len = snprintf(jsonBuffer, sizeof(jsonBuffer),
            "{\"id\":%d,\"temp\":%.2f,\"hum\":%.2f,\"ts\":%lu}",
            readings[i].sensorId,
            readings[i].temperature,
            readings[i].humidity,
            (unsigned long)readings[i].timestamp);

        if (len > 0 && len < (int)sizeof(jsonBuffer)) {
            mqttClient.publish(topicBuffer, jsonBuffer);
        }
    }
}

void reportHeapHealth() {
    uint32_t now = millis();
    if (now - lastHeapReport >= HEAP_REPORT_INTERVAL_MS) {
        lastHeapReport = now;
        Serial.printf("[HEAP] Free: %u bytes | Largest block: %u bytes | Min ever: %u bytes\n",
            ESP.getFreeHeap(),
            ESP.getMaxAllocHeap(),
            ESP.getMinFreeHeap());

        // Alert if heap is getting low
        if (ESP.getFreeHeap() < 20000) {
            Serial.println("[HEAP] WARNING: Free heap below 20KB!");
        }

        // Alert if fragmentation is high
        // (large gap between free heap and largest allocatable block)
        uint32_t freeHeap = ESP.getFreeHeap();
        uint32_t maxBlock = ESP.getMaxAllocHeap();
        if (freeHeap > 0) {
            uint32_t fragPercent = 100 - (maxBlock * 100 / freeHeap);
            Serial.printf("[HEAP] Fragmentation: %u%%\n", fragPercent);
        }
    }
}

void setup() {
    Serial.begin(115200);
    Wire.begin();
    // ... MQTT setup, WiFi setup ...

    // Zero-initialize static readings
    memset(readings, 0, sizeof(readings));

    Serial.printf("[BOOT] Free heap: %u bytes\n", ESP.getFreeHeap());
}

void loop() {
    uint32_t now = millis();

    // Maintain MQTT connection
    if (!mqttClient.connected()) {
        reconnectMqtt();
    }
    mqttClient.loop();

    // Read sensors at interval
    if (now - lastReadTime >= READ_INTERVAL_MS) {
        lastReadTime = now;
        readAllSensors();
    }

    // Publish at interval
    if (now - lastPublishTime >= PUBLISH_INTERVAL_MS) {
        lastPublishTime = now;
        publishAllReadings();
    }

    // Periodic heap health monitoring
    reportHeapHealth();
}
```

## Key Principles for Long-Running ESP32 Firmware

| Rule | Why |
|---|---|
| **Never use `new` or `malloc` in the main loop** | Every dynamic allocation risks fragmentation; leaks are fatal on devices with no swap |
| **Use static buffers and stack variables** | Deterministic memory usage; free heap stays constant forever |
| **Avoid Arduino `String` in repeated paths** | `String` concatenation triggers multiple `realloc` calls internally, fragmenting the heap |
| **Use `snprintf` with fixed buffers for serialization** | Single buffer, predictable size, no heap involvement |
| **Monitor heap with `ESP.getFreeHeap()`** | Log free heap periodically so you can detect leaks early during development |
| **Monitor fragmentation with `ESP.getMaxAllocHeap()`** | If max-allocatable-block is much smaller than free-heap, you have fragmentation |
| **Use `ESP.getMinFreeHeap()` to find the high-water mark** | Shows the lowest free heap since boot -- useful for sizing buffers |

## How to Verify the Fix

Add heap monitoring to your firmware (as shown above) and watch the serial output:

```
[HEAP] Free: 285012 bytes | Largest block: 114688 bytes | Min ever: 284500 bytes
[HEAP] Fragmentation: 59%
```

After applying the static-allocation fix, you should see:
- **Free heap stays constant** (within a few hundred bytes) over hours/days
- **Fragmentation stays low** (under 20%)
- **Min-ever-free stays close to current free** (no transient spikes)

If free heap still drops, use `heap_caps_dump()` or enable CONFIG_HEAP_TRACING in ESP-IDF menuconfig to trace remaining allocations to their source.

## Summary

The crash is caused by memory leaks (`new` without `delete`) and heap fragmentation (frequent small allocations of varying sizes). The fix is to eliminate all dynamic allocation from the hot path by using statically allocated structs and `snprintf` into fixed-size `char` buffers. This gives your firmware deterministic, constant memory usage and will run indefinitely.
