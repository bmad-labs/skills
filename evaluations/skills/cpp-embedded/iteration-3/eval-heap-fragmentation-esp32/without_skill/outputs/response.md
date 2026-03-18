# ESP32 Heap Fragmentation: Diagnosis and Fix

## What's Going On

You have a classic **heap fragmentation and memory leak** problem. The two culprits are clearly visible in your description:

1. **`new SensorReading()` every 100ms** -- 4 sensors x 10 reads/sec = **40 heap allocations per second**, or **864,000 allocations over 6 hours**.
2. **`new String(json)` per MQTT publish** -- Arduino `String` uses dynamic heap allocation internally, and every `new String(...)` is another heap allocation that must be explicitly freed.

### Why It Crashes After ~6 Hours (Not Immediately)

Even if you are calling `delete` on these objects (and you likely are not for all of them), the ESP32 has a relatively small heap (~300KB usable on most configurations). The real killer is **heap fragmentation**, not just leaks:

- Each `new` allocates a variably-sized block on the heap.
- Each `delete` frees that block, leaving a "hole."
- Over time, the heap becomes a swiss cheese of small free blocks. Even though `ESP.getFreeHeap()` might report 50KB free, no single contiguous block may be large enough for the next allocation.
- `ESP.getMaxAllocHeap()` (largest free block) drops faster than `ESP.getFreeHeap()` (total free) -- this is the fragmentation signature.
- Eventually an allocation fails, and the firmware crashes (often with a `LoadProhibited` or `Guru Meditation` error).

### The Arduino `String` Problem

Arduino `String` is particularly dangerous on ESP32 because:

- It internally calls `realloc()` as the string grows (e.g., during JSON construction via concatenation).
- Each realloc may move the string to a new, larger block, leaving the old block as a free hole.
- Temporary `String` objects created during expression evaluation are silently allocated and freed.
- `new String(json)` allocates the `String` object itself on the heap AND the internal character buffer on the heap -- double allocation.

## How to Fix It

### Fix 1: Eliminate Dynamic Allocation for Sensor Readings

Use a **static pool or stack allocation** instead of `new`:

```cpp
// BAD: heap allocation every 100ms
void readSensors() {
    SensorReading* reading = new SensorReading();
    reading->temperature = sensor.readTemp();
    // ... use reading ...
    publish(reading);
    delete reading; // even if you remember this, fragmentation still occurs
}

// GOOD: stack allocation (zero heap usage)
void readSensors() {
    SensorReading reading;  // allocated on stack, automatically freed
    reading.temperature = sensor.readTemp();
    // ... use reading ...
    publish(&reading);
    // automatically cleaned up when function returns
}
```

If you need to buffer readings (e.g., for batching before MQTT publish), use a **static ring buffer**:

```cpp
// Pre-allocate a fixed-size circular buffer
static const int BUFFER_SIZE = 16;
static SensorReading readingBuffer[BUFFER_SIZE];
static int bufferIndex = 0;

void readSensors() {
    SensorReading& reading = readingBuffer[bufferIndex];
    bufferIndex = (bufferIndex + 1) % BUFFER_SIZE;

    reading.temperature = sensor.readTemp();
    reading.humidity = sensor.readHumidity();
    // ...
}
```

### Fix 2: Eliminate Arduino `String` for JSON Construction

Use a **stack-allocated char buffer** with `snprintf`:

```cpp
// BAD: dynamic String allocation
void publishReading(const SensorReading* reading) {
    String* json = new String("{\"temp\":");
    *json += String(reading->temperature);
    *json += ",\"humidity\":";
    *json += String(reading->humidity);
    *json += "}";
    mqttClient.publish("sensors/data", json->c_str());
    delete json;
}

// GOOD: stack-allocated buffer, zero heap usage
void publishReading(const SensorReading* reading) {
    char json[256];  // fixed stack buffer -- size it for your max payload
    int len = snprintf(json, sizeof(json),
        "{\"temp\":%.2f,\"humidity\":%.2f,\"pressure\":%.2f,\"light\":%d}",
        reading->temperature,
        reading->humidity,
        reading->pressure,
        reading->light);

    if (len > 0 && len < (int)sizeof(json)) {
        mqttClient.publish("sensors/data", json);
    }
}
```

If you need more complex JSON, use **ArduinoJson** with a `StaticJsonDocument` (stack-allocated):

```cpp
#include <ArduinoJson.h>

void publishReading(const SensorReading* reading) {
    StaticJsonDocument<256> doc;  // stack-allocated, no heap usage
    doc["temp"] = reading->temperature;
    doc["humidity"] = reading->humidity;
    doc["pressure"] = reading->pressure;
    doc["light"] = reading->light;
    doc["uptime"] = millis();

    char json[256];
    serializeJson(doc, json, sizeof(json));
    mqttClient.publish("sensors/data", json);
}
```

**Important:** Use `StaticJsonDocument`, not `DynamicJsonDocument`. The latter uses heap allocation and causes the same fragmentation problem.

### Fix 3: Audit All Other Dynamic Allocations

Search your entire codebase for these patterns and eliminate them:

| Pattern | Replacement |
|---|---|
| `new SomeClass()` | Stack variable: `SomeClass obj;` or static pool |
| `new String(...)` | `char buf[N]; snprintf(buf, ...)` |
| `String str = ...` (local variable) | `char buf[N];` with C string functions |
| `String` concatenation (`+=`) | `snprintf` into a pre-sized buffer |
| `malloc()` / `calloc()` | Static arrays or stack buffers |
| `std::vector` / `std::string` | Fixed-size arrays, `char[]` buffers |

### Fix 4: Add Heap Monitoring

Add this to your main loop so you can track fragmentation over time:

```cpp
void printHeapStats() {
    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 30000) {  // every 30 seconds
        lastPrint = millis();
        Serial.printf("[HEAP] Free: %u bytes | Largest block: %u bytes | Min ever: %u bytes\n",
            ESP.getFreeHeap(),
            ESP.getMaxAllocHeap(),
            ESP.getMinFreeHeap());
    }
}

void loop() {
    readSensors();
    publishMQTT();
    printHeapStats();  // add this
}
```

**Key diagnostic indicators:**

- `getFreeHeap()` decreasing over time = **memory leak** (you are not freeing something).
- `getFreeHeap()` stable but `getMaxAllocHeap()` decreasing = **fragmentation** (free memory exists but is in scattered small blocks).
- `getMinFreeHeap()` very low = you are dangerously close to crashing.

### Fix 5: Avoid Heap Use in the MQTT and WiFi Stack

The ESP32 WiFi and MQTT libraries themselves use heap internally. You cannot avoid this, but you can minimize contention:

- Keep MQTT payloads small (under 1KB).
- Use QoS 0 for high-frequency sensor data (avoids MQTT buffering outgoing messages).
- Avoid reconnecting WiFi/MQTT frequently -- each reconnection cycle allocates and frees heap memory.
- If using PubSubClient, increase its buffer size once at startup rather than relying on dynamic resizing:

```cpp
mqttClient.setBufferSize(512);  // set once in setup()
```

## Complete Refactored Example

```cpp
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- Static structures, zero heap allocation ---
struct SensorReading {
    float temperature;
    float humidity;
    float pressure;
    int light;
    unsigned long timestamp;
};

// Pre-allocated reading (reused every cycle)
static SensorReading currentReading;

// Pre-allocated JSON buffer
static char jsonBuffer[256];

// Pre-allocated MQTT topic buffer
static const char* TOPIC = "sensors/data";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

void readSensors() {
    // Read directly into the static struct -- no allocation
    currentReading.temperature = readTempSensor();
    currentReading.humidity = readHumiditySensor();
    currentReading.pressure = readPressureSensor();
    currentReading.light = readLightSensor();
    currentReading.timestamp = millis();
}

void publishReading() {
    int len = snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"t\":%.2f,\"h\":%.2f,\"p\":%.2f,\"l\":%d,\"up\":%lu}",
        currentReading.temperature,
        currentReading.humidity,
        currentReading.pressure,
        currentReading.light,
        currentReading.timestamp);

    if (len > 0 && len < (int)sizeof(jsonBuffer)) {
        mqttClient.publish(TOPIC, jsonBuffer);
    }
}

void setup() {
    Serial.begin(115200);
    Wire.begin();
    Wire.setClock(400000);  // 400kHz I2C for faster reads

    connectWiFi();
    mqttClient.setServer(MQTT_BROKER, 1883);
    mqttClient.setBufferSize(512);  // set once, avoids dynamic resizing

    Serial.printf("[HEAP] Initial free: %u bytes\n", ESP.getFreeHeap());
}

void loop() {
    static unsigned long lastRead = 0;

    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();

    if (millis() - lastRead >= 100) {  // 100ms interval
        lastRead = millis();
        readSensors();
        publishReading();
    }

    // Heap monitoring (every 30s)
    static unsigned long lastHeapPrint = 0;
    if (millis() - lastHeapPrint > 30000) {
        lastHeapPrint = millis();
        Serial.printf("[HEAP] Free: %u | Max block: %u | Min ever: %u\n",
            ESP.getFreeHeap(), ESP.getMaxAllocHeap(), ESP.getMinFreeHeap());
    }
}
```

## Summary of Root Causes and Fixes

| Root Cause | Impact | Fix |
|---|---|---|
| `new SensorReading()` every 100ms | 40 allocs/sec, leak + fragmentation | Stack variable or static struct |
| `new String(json)` per publish | Heap alloc + internal reallocs | `snprintf` into `char[]` buffer |
| Arduino `String` concatenation | Hidden reallocs cause fragmentation | Avoid `String` entirely; use C strings |
| No heap monitoring | Crash is the first symptom | Log `getFreeHeap()` and `getMaxAllocHeap()` |

## The Golden Rule for Long-Running ESP32 Firmware

**After `setup()` completes, your firmware should perform zero heap allocations in steady state.** Every `new`, `malloc`, `String`, `std::vector`, or `DynamicJsonDocument` in your main loop is a ticking time bomb. Pre-allocate everything statically or on the stack, and your ESP32 will run indefinitely.
