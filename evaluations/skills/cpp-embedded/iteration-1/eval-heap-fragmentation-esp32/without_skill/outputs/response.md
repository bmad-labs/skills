# ESP32 Heap Fragmentation and Memory Leak Diagnosis

## What's Going On

Your ESP32 is suffering from **two compounding problems**: a classic memory leak and heap fragmentation. Let's break down each.

### Problem 1: Memory Leaks from `new` Without `delete`

Every 100ms you call `new SensorReading()` (4 times) and `new String(json)`. That's **40 allocations of `SensorReading`** and **10 allocations of `String`** per second. Over 6 hours:

- `SensorReading`: 40/s x 3600s x 6h = **864,000 leaked objects**
- `String`: 10/s x 3600s x 6h = **216,000 leaked strings**

If each `SensorReading` is even 20 bytes and each `String` averages 80 bytes (with its internal buffer), that's ~17 MB of leaked memory on a chip with ~320 KB of usable heap. The ESP32 will crash long before 6 hours -- the reason it lasts that long is likely that some of these are being deleted *somewhere*, but not consistently, or the objects are small. Either way, every `new` without a corresponding `delete` is a leak.

### Problem 2: Heap Fragmentation

Even if you *were* deleting the objects, the repeated pattern of allocate-small-object, allocate-variable-size-string, delete-in-different-order causes **heap fragmentation**. The ESP32 uses a simple heap allocator. Over time, free memory becomes scattered into small non-contiguous chunks. You might have 50 KB free total, but no single contiguous block larger than 200 bytes -- so the next `new String()` that needs 256 bytes fails, and you crash.

The Arduino `String` class is especially dangerous here because:
- It internally calls `realloc()` as the string grows (e.g., during concatenation)
- Each `realloc` can leave a "hole" in the heap
- Temporary `String` objects created during JSON building cause rapid alloc/free cycles

### Problem 3: Arduino `String` Class on ESP32

The Arduino `String` class uses dynamic heap allocation for every operation -- concatenation, substring, even assignment. On a memory-constrained MCU, this is a ticking time bomb. Each `+` operator on a `String` can trigger a `malloc`, `memcpy`, and `free` internally.

## The Fix

The solution involves three strategies:

1. **Eliminate dynamic allocation** -- use stack-allocated, fixed-size buffers
2. **Reuse objects** -- pre-allocate once at startup, reuse forever
3. **Use `snprintf`** instead of Arduino `String` for JSON building

### Refactored Code

Below is a complete, working refactored firmware:

```cpp
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>

// =============================================================================
// Configuration
// =============================================================================

static const char* WIFI_SSID      = "YourSSID";
static const char* WIFI_PASSWORD  = "YourPassword";
static const char* MQTT_BROKER    = "192.168.1.100";
static const uint16_t MQTT_PORT   = 1883;
static const char* MQTT_TOPIC     = "sensors/hub";
static const char* MQTT_CLIENT_ID = "esp32-sensor-hub";

static const uint32_t SENSOR_READ_INTERVAL_MS = 100;
static const uint32_t MQTT_PUBLISH_INTERVAL_MS = 1000; // Publish every 1s, not every 100ms
static const uint32_t HEAP_REPORT_INTERVAL_MS  = 60000; // Log heap stats every 60s

// I2C sensor addresses (example values -- adjust to your hardware)
static const uint8_t SENSOR_ADDRESSES[] = {0x48, 0x49, 0x4A, 0x4B};
static const uint8_t NUM_SENSORS = 4;

// =============================================================================
// Fixed-size SensorReading -- NO dynamic allocation
// =============================================================================

struct SensorReading {
    float    temperature;
    float    humidity;
    float    pressure;
    uint32_t timestamp;
    uint8_t  sensorId;
    bool     valid;

    void clear() {
        temperature = 0.0f;
        humidity    = 0.0f;
        pressure    = 0.0f;
        timestamp   = 0;
        sensorId    = 0;
        valid       = false;
    }
};

// =============================================================================
// Pre-allocated global buffers -- allocated once, reused forever
// =============================================================================

// Latest readings for each sensor (reused every cycle)
static SensorReading g_readings[NUM_SENSORS];

// Fixed JSON buffer -- sized for worst-case payload
// Avoids ALL dynamic string allocation
static const size_t JSON_BUFFER_SIZE = 512;
static char g_jsonBuffer[JSON_BUFFER_SIZE];

// I2C read buffer (reused)
static uint8_t g_i2cBuffer[8];

// Timing (non-blocking, no delay())
static uint32_t g_lastSensorReadMs  = 0;
static uint32_t g_lastMqttPublishMs = 0;
static uint32_t g_lastHeapReportMs  = 0;

// Network objects (created once)
static WiFiClient   g_wifiClient;
static PubSubClient g_mqttClient(g_wifiClient);

// =============================================================================
// Sensor Reading -- uses pre-allocated buffer, zero heap allocation
// =============================================================================

bool readSensor(uint8_t sensorIndex, SensorReading& reading) {
    if (sensorIndex >= NUM_SENSORS) {
        reading.valid = false;
        return false;
    }

    uint8_t addr = SENSOR_ADDRESSES[sensorIndex];

    Wire.beginTransmission(addr);
    Wire.write(0x00); // Register to read (adjust per your sensor)
    if (Wire.endTransmission(false) != 0) {
        reading.valid = false;
        return false;
    }

    uint8_t bytesReceived = Wire.requestFrom(addr, (uint8_t)6);
    if (bytesReceived < 6) {
        reading.valid = false;
        return false;
    }

    // Read into stack/pre-allocated buffer
    for (uint8_t i = 0; i < 6 && Wire.available(); i++) {
        g_i2cBuffer[i] = Wire.read();
    }

    // Parse raw bytes into reading (adjust parsing to match your sensor protocol)
    int16_t rawTemp     = (g_i2cBuffer[0] << 8) | g_i2cBuffer[1];
    int16_t rawHumidity = (g_i2cBuffer[2] << 8) | g_i2cBuffer[3];
    int16_t rawPressure = (g_i2cBuffer[4] << 8) | g_i2cBuffer[5];

    reading.temperature = rawTemp / 100.0f;
    reading.humidity    = rawHumidity / 100.0f;
    reading.pressure    = rawPressure / 10.0f;
    reading.timestamp   = millis();
    reading.sensorId    = sensorIndex;
    reading.valid       = true;

    return true;
}

// =============================================================================
// JSON Serialization -- snprintf into fixed buffer, ZERO heap allocation
// =============================================================================

size_t buildJsonPayload(const SensorReading readings[], uint8_t count, char* buffer, size_t bufferSize) {
    // Start JSON object
    int offset = snprintf(buffer, bufferSize,
        "{\"uptime\":%lu,\"freeHeap\":%u,\"sensors\":[",
        (unsigned long)millis(),
        (unsigned)ESP.getFreeHeap());

    if (offset < 0 || (size_t)offset >= bufferSize) return 0;

    for (uint8_t i = 0; i < count; i++) {
        if (!readings[i].valid) continue;

        int written = snprintf(buffer + offset, bufferSize - offset,
            "%s{\"id\":%u,\"t\":%.2f,\"h\":%.2f,\"p\":%.1f}",
            (i > 0 && offset > 0 && buffer[offset - 1] == '}') ? "," : "",
            readings[i].sensorId,
            readings[i].temperature,
            readings[i].humidity,
            readings[i].pressure);

        if (written < 0 || (size_t)(offset + written) >= bufferSize) {
            // Truncation -- close what we have
            break;
        }
        offset += written;
    }

    // Close JSON
    int closing = snprintf(buffer + offset, bufferSize - offset, "]}");
    if (closing > 0) offset += closing;

    return (size_t)offset;
}

// =============================================================================
// MQTT Publishing -- uses pre-allocated buffer, no String objects
// =============================================================================

void ensureMqttConnected() {
    if (g_mqttClient.connected()) return;

    Serial.println("[MQTT] Reconnecting...");

    // Attempt connection with a short timeout -- don't block the sensor loop
    if (g_mqttClient.connect(MQTT_CLIENT_ID)) {
        Serial.println("[MQTT] Connected.");
    } else {
        Serial.print("[MQTT] Failed, rc=");
        Serial.println(g_mqttClient.state());
        // Don't retry immediately -- let the main loop come back around
    }
}

void publishReadings() {
    if (!g_mqttClient.connected()) {
        ensureMqttConnected();
        if (!g_mqttClient.connected()) return; // Skip this cycle
    }

    size_t len = buildJsonPayload(g_readings, NUM_SENSORS, g_jsonBuffer, JSON_BUFFER_SIZE);
    if (len == 0) return;

    // publish() takes a const char* -- no String needed
    bool success = g_mqttClient.publish(MQTT_TOPIC, g_jsonBuffer, len);
    if (!success) {
        Serial.println("[MQTT] Publish failed.");
    }
}

// =============================================================================
// WiFi Connection
// =============================================================================

void ensureWifiConnected() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("[WiFi] Connecting to ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Wait up to 10 seconds, but yield to avoid WDT
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < 10000) {
        delay(100);
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[WiFi] Connected, IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("[WiFi] Connection failed, will retry.");
    }
}

// =============================================================================
// Heap Monitoring -- track fragmentation over time
// =============================================================================

void reportHeapStats() {
    Serial.println("---- Heap Stats ----");
    Serial.print("  Free heap:          ");
    Serial.println(ESP.getFreeHeap());
    Serial.print("  Min free heap ever: ");
    Serial.println(ESP.getMinFreeHeap());
    Serial.print("  Max alloc block:    ");
    Serial.println(ESP.getMaxAllocHeap());
    Serial.print("  Fragmentation:      ");

    uint32_t freeHeap     = ESP.getFreeHeap();
    uint32_t maxAllocHeap = ESP.getMaxAllocHeap();
    if (freeHeap > 0) {
        // Fragmentation % = how much free memory is unusable due to fragmentation
        float fragPct = 100.0f * (1.0f - ((float)maxAllocHeap / (float)freeHeap));
        Serial.print(fragPct, 1);
        Serial.println("%");
    } else {
        Serial.println("N/A");
    }
    Serial.println("--------------------");
}

// =============================================================================
// setup() and loop()
// =============================================================================

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n[Boot] ESP32 Sensor Hub Starting...");

    // Initialize I2C
    Wire.begin(21, 22); // SDA=21, SCL=22 (default ESP32 pins)
    Wire.setClock(400000); // 400kHz fast mode

    // Clear all readings (stack memory, no allocation)
    for (uint8_t i = 0; i < NUM_SENSORS; i++) {
        g_readings[i].clear();
    }

    // Zero out JSON buffer
    memset(g_jsonBuffer, 0, JSON_BUFFER_SIZE);

    // Connect WiFi
    ensureWifiConnected();

    // Configure MQTT
    g_mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    g_mqttClient.setBufferSize(JSON_BUFFER_SIZE); // Match our buffer size

    // Initial heap report
    reportHeapStats();

    Serial.println("[Boot] Setup complete. Entering main loop.");
}

void loop() {
    uint32_t now = millis();

    // --- Sensor reads at 100ms intervals (non-blocking) ---
    if (now - g_lastSensorReadMs >= SENSOR_READ_INTERVAL_MS) {
        g_lastSensorReadMs = now;

        for (uint8_t i = 0; i < NUM_SENSORS; i++) {
            // Writes into pre-allocated g_readings[i] -- zero heap allocation
            readSensor(i, g_readings[i]);
        }
    }

    // --- MQTT publish at 1s intervals (don't flood the broker) ---
    if (now - g_lastMqttPublishMs >= MQTT_PUBLISH_INTERVAL_MS) {
        g_lastMqttPublishMs = now;

        ensureWifiConnected();
        publishReadings();
    }

    // --- Periodic heap monitoring ---
    if (now - g_lastHeapReportMs >= HEAP_REPORT_INTERVAL_MS) {
        g_lastHeapReportMs = now;
        reportHeapStats();
    }

    // Keep MQTT alive
    g_mqttClient.loop();

    // Small yield to prevent WDT reset and allow background tasks
    yield();
}
```

## Key Changes Explained

### 1. `SensorReading` is now a plain struct, not heap-allocated

**Before (broken):**
```cpp
// Every 100ms, for each sensor:
SensorReading* reading = new SensorReading();  // LEAK!
// ... use reading ...
// forgot delete, or delete happens inconsistently
```

**After (fixed):**
```cpp
// Pre-allocated at global scope, reused every cycle:
static SensorReading g_readings[NUM_SENSORS];

// In the read function -- writes directly into the pre-allocated struct:
readSensor(i, g_readings[i]);  // Zero allocation
```

The `SensorReading` struct is 22 bytes. Four of them consume 88 bytes total, allocated once in `.bss`, never freed, never re-allocated. This is the correct pattern for embedded systems.

### 2. JSON built with `snprintf` into a fixed buffer

**Before (broken):**
```cpp
String* json = new String("{\"temp\":");  // heap alloc #1
*json += String(reading->temperature);     // heap alloc #2 (temp String), realloc of json
*json += ",\"humidity\":";                 // realloc of json
*json += String(reading->humidity);        // heap alloc #3 (temp String), realloc of json
// ... more concatenations, each one allocating and reallocating ...
mqttClient.publish(topic, json->c_str());
// delete json;  <-- maybe? maybe not? still fragments the heap either way
```

Each `String` concatenation internally does: `malloc` new buffer -> `memcpy` old content -> `free` old buffer. With 4 sensors and multiple fields, a single publish cycle could cause 20+ malloc/free cycles, shredding the heap into fragments.

**After (fixed):**
```cpp
static char g_jsonBuffer[512];  // One buffer, allocated once in .bss

// Single snprintf call -- no heap allocation at all:
snprintf(buffer, bufferSize,
    "{\"id\":%u,\"t\":%.2f,\"h\":%.2f,\"p\":%.1f}",
    reading.sensorId, reading.temperature,
    reading.humidity, reading.pressure);

mqttClient.publish(topic, g_jsonBuffer, len);  // Publishes from the fixed buffer
```

`snprintf` writes directly into the pre-allocated buffer. Zero heap allocations. Zero fragmentation. Predictable memory usage.

### 3. Publish rate decoupled from sensor read rate

Reading sensors at 100ms (10 Hz) is fine, but publishing to MQTT at 10 Hz is wasteful and stresses both the network stack and the heap (TCP buffers). The refactored code reads at 100ms but publishes at 1s intervals, sending the latest readings. This reduces network overhead by 10x.

### 4. Heap monitoring built in

The `reportHeapStats()` function logs:
- **Free heap**: Total free bytes
- **Min free heap ever**: The lowest free heap has been since boot (high-water mark)
- **Max alloc block**: The largest contiguous block available (fragmentation indicator)
- **Fragmentation %**: Calculated as `1 - (maxAllocBlock / freeHeap)`. If this creeps above 20-30%, you have a fragmentation problem.

Monitor this over serial. In the fixed code, you should see all four values remain stable indefinitely.

## General Rules for ESP32 / Embedded C++ Memory Management

| Rule | Why |
|------|-----|
| Never use `new` in a loop | Each call fragments the heap; forgetting `delete` leaks memory |
| Never use Arduino `String` | Every operation allocates/reallocates on the heap |
| Use `snprintf` for string building | Writes into a fixed buffer with bounds checking |
| Pre-allocate all buffers at startup | Deterministic memory usage, zero runtime fragmentation |
| Use stack variables or globals for data | Stack is fast and automatically reclaimed; globals live in `.bss` |
| Monitor `ESP.getMaxAllocHeap()` | If this drops while `getFreeHeap()` stays constant, you have fragmentation |
| Decouple read rate from publish rate | Reduces transient memory pressure from network stack |

## If You Must Use Dynamic Allocation

In some cases (e.g., third-party libraries that return `new`-allocated objects), you cannot avoid dynamic allocation. In those cases:

1. **Use smart pointers** (C++11, supported by ESP32 Arduino):
   ```cpp
   #include <memory>
   auto reading = std::make_unique<SensorReading>();
   // Automatically deleted when it goes out of scope
   ```

2. **Use a memory pool** (pre-allocate a fixed number of objects):
   ```cpp
   // Pool of 8 SensorReading objects -- no heap fragmentation
   static SensorReading pool[8];
   static uint8_t poolIndex = 0;

   SensorReading& allocateReading() {
       SensorReading& r = pool[poolIndex];
       poolIndex = (poolIndex + 1) % 8;  // Circular reuse
       r.clear();
       return r;
   }
   ```

3. **Call `ESP.getMaxAllocHeap()`** periodically and trigger a controlled restart if fragmentation becomes critical:
   ```cpp
   if (ESP.getMaxAllocHeap() < 4096) {
       Serial.println("[WARN] Heap critically fragmented, restarting...");
       ESP.restart();
   }
   ```
   This is a last-resort safety net, not a fix. Fix the allocations first.
