# Optimizing ESP32 Deep Sleep Wake Cycle for Sub-2-Second Sensor Publish

Your 3-5 second wake time is almost entirely WiFi reconnection. The actual sensor read + MQTT publish takes ~100ms. Here is a systematic approach to get the full cycle under 2 seconds.

---

## Root Cause: WiFi Reconnection After Deep Sleep

When the ESP32 wakes from deep sleep, it performs a cold boot — `setup()` runs from scratch. The default `WiFi.begin()` does a full 802.11 scan across all channels to find your AP, which takes 3-5 seconds. This is the dominant bottleneck.

---

## Optimization 1: Cache WiFi Channel and BSSID in RTC Memory

RTC memory survives deep sleep. By storing the WiFi channel number and AP BSSID (MAC address), you skip the 802.11 scan entirely and connect directly to the known AP on the known channel. This alone drops reconnection from 3-5 seconds to ~300-500ms.

```cpp
#include <WiFi.h>
#include <esp_wifi.h>

// RTC_DATA_ATTR persists across deep sleep cycles
RTC_DATA_ATTR uint8_t saved_wifi_channel = 0;
RTC_DATA_ATTR uint8_t saved_bssid[6] = {0};
RTC_DATA_ATTR bool wifi_state_valid = false;

void fast_wifi_connect() {
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);  // Don't write credentials to flash every boot — saves ~50ms and flash wear

    if (wifi_state_valid) {
        // Fast reconnect: skip scan, connect directly to known AP on known channel
        WiFi.begin(SSID, PASSWORD, saved_wifi_channel, saved_bssid, true);
    } else {
        // First boot or after failure: full scan (slow path)
        WiFi.begin(SSID, PASSWORD);
    }

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
        delay(10);
    }

    if (WiFi.status() == WL_CONNECTED) {
        // Cache for next wake cycle
        saved_wifi_channel = WiFi.channel();
        memcpy(saved_bssid, WiFi.BSSID(), 6);
        wifi_state_valid = true;
    } else {
        // Force full scan next time — AP may have changed channel
        wifi_state_valid = false;
    }
}
```

**Why `WiFi.persistent(false)` matters:** By default, the Arduino WiFi library writes credentials to NVS flash on every `WiFi.begin()`. This costs ~50ms per boot and wears the flash. Since you already have credentials compiled in, disable it.

---

## Optimization 2: Use a Static IP Address

DHCP negotiation adds 1-2 seconds to every wake cycle. If your network allows it, assign a static IP and configure it before `WiFi.begin()`:

```cpp
IPAddress local_ip(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(192, 168, 1, 1);

void fast_wifi_connect() {
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.config(local_ip, gateway, subnet, dns);  // Must be BEFORE WiFi.begin()

    if (wifi_state_valid) {
        WiFi.begin(SSID, PASSWORD, saved_wifi_channel, saved_bssid, true);
    } else {
        WiFi.begin(SSID, PASSWORD);
    }
    // ... rest as above
}
```

---

## Optimization 3: Overlap Sensor Read with WiFi Connection

The BME280 read takes ~10-50ms depending on oversampling settings. Do it **before** or **in parallel with** the WiFi connection, not after:

```cpp
#include <Wire.h>
#include <Adafruit_BME280.h>  // or your preferred library
#include <PubSubClient.h>

// Sensor and MQTT globals
Adafruit_BME280 bme;
WiFiClient wifi_client;
PubSubClient mqtt(wifi_client);

// RTC memory for WiFi fast reconnect
RTC_DATA_ATTR uint8_t saved_wifi_channel = 0;
RTC_DATA_ATTR uint8_t saved_bssid[6] = {0};
RTC_DATA_ATTR bool wifi_state_valid = false;

// Static IP config
IPAddress local_ip(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(192, 168, 1, 1);

static constexpr const char* SSID = "your_ssid";
static constexpr const char* PASSWORD = "your_password";
static constexpr const char* MQTT_SERVER = "192.168.1.100";
static constexpr uint16_t MQTT_PORT = 1883;
static constexpr uint64_t SLEEP_US = 5ULL * 1000000ULL;  // 5 seconds in microseconds

void setup() {
    // STEP 1: Start I2C and read sensor FIRST (WiFi not needed yet)
    Wire.begin();
    bme.begin(0x76);  // or 0x77 depending on your board

    // Use forced mode: trigger one measurement, read it, sensor returns to standby
    bme.setSampling(
        Adafruit_BME280::MODE_FORCED,
        Adafruit_BME280::SAMPLING_X1,   // temperature
        Adafruit_BME280::SAMPLING_X1,   // pressure
        Adafruit_BME280::SAMPLING_X1,   // humidity
        Adafruit_BME280::FILTER_OFF,
        Adafruit_BME280::STANDBY_MS_0_5
    );
    bme.takeForcedMeasurement();

    float temp = bme.readTemperature();
    float hum = bme.readHumidity();
    float pres = bme.readPressure() / 100.0F;  // hPa

    // STEP 2: Format payload NOW, before WiFi (no heap allocation)
    char payload[128];
    snprintf(payload, sizeof(payload),
             "{\"temperature\":%.1f,\"humidity\":%.1f,\"pressure\":%.1f}",
             temp, hum, pres);

    // STEP 3: Connect WiFi (fast path)
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.config(local_ip, gateway, subnet, dns);

    if (wifi_state_valid) {
        WiFi.begin(SSID, PASSWORD, saved_wifi_channel, saved_bssid, true);
    } else {
        WiFi.begin(SSID, PASSWORD);
    }

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
        delay(10);
    }

    if (WiFi.status() != WL_CONNECTED) {
        // WiFi failed — invalidate cache and go back to sleep
        wifi_state_valid = false;
        go_to_sleep();
        return;
    }

    // Cache WiFi state for next wake
    saved_wifi_channel = WiFi.channel();
    memcpy(saved_bssid, WiFi.BSSID(), 6);
    wifi_state_valid = true;

    // STEP 4: MQTT connect and publish
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    if (mqtt.connect("esp32-sensor")) {
        mqtt.publish("sensor/data", payload);
        mqtt.disconnect();
    }

    // STEP 5: Disconnect WiFi and sleep
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);

    go_to_sleep();
}

void go_to_sleep() {
    esp_sleep_enable_timer_wakeup(SLEEP_US);
    esp_deep_sleep_start();
    // Execution never reaches here — wake restarts from setup()
}

void loop() {
    // Never reached — deep sleep restarts from setup()
}
```

---

## Optimization 4: BME280 Forced Mode

You are likely using the BME280 in normal (continuous) mode, where it continuously samples even when nobody reads it. In deep sleep applications, use **forced mode**:

- Trigger a single measurement on demand
- Sensor returns to standby (~0.1 uA) automatically after one conversion
- Avoids wasting power on measurements you never read

The code above already demonstrates this with `bme.setSampling()` using `MODE_FORCED` and `bme.takeForcedMeasurement()`.

---

## Optimization 5: Reduce WiFi TX Power (If Range Allows)

Lower TX power reduces the current spike during WiFi transmission, which helps battery life. It also reduces the time the radio is active:

```cpp
WiFi.setTxPower(WIFI_POWER_8_5dBm);  // Default is 19.5 dBm — reduce if AP is nearby
```

Only do this if your AP is within a few meters. Lower power means shorter range.

---

## Expected Wake Cycle Timeline

| Phase | Before Optimization | After Optimization |
|-------|--------------------|--------------------|
| Boot + I2C init | ~50ms | ~50ms |
| BME280 read (forced mode) | ~50ms | ~50ms |
| Format payload | ~1ms | ~1ms |
| WiFi reconnection | 3000-5000ms | 300-500ms |
| DHCP | 1000-2000ms | 0ms (static IP) |
| MQTT connect + publish | ~100ms | ~100ms |
| WiFi disconnect | ~10ms | ~10ms |
| **Total** | **4200-7200ms** | **~500-700ms** |

With all optimizations applied, the wake cycle should be well under 2 seconds — typically around 500-700ms.

---

## Handling Edge Cases

### AP Channel Change

If your access point changes channels (after a restart, or due to DFS), the fast reconnect will fail. The code above handles this by invalidating `wifi_state_valid` on connection failure, causing a full scan on the next wake. This costs one slow cycle but self-corrects.

### Counting Consecutive Failures

For robustness, track consecutive failures in RTC memory and implement a backoff:

```cpp
RTC_DATA_ATTR uint8_t consecutive_wifi_failures = 0;

// In connection failure path:
consecutive_wifi_failures++;
if (consecutive_wifi_failures > 5) {
    // Something is wrong — sleep longer to conserve battery
    esp_sleep_enable_timer_wakeup(60ULL * 1000000ULL);  // 60 seconds
} else {
    esp_sleep_enable_timer_wakeup(SLEEP_US);
}
wifi_state_valid = false;
esp_deep_sleep_start();

// On success:
consecutive_wifi_failures = 0;
```

### Avoiding Arduino String

Never use `String` for building the MQTT payload. Each concatenation heap-allocates. Use `snprintf` with a fixed `char[]` buffer as shown above. On an ESP32 doing 17,000+ wake cycles per day (every 5 seconds), Arduino `String` would cause millions of heap allocations per day, leading to fragmentation and eventual crashes.

---

## Power Budget Summary

| State | Current Draw | Duration |
|-------|-------------|----------|
| Deep sleep | ~10 uA | 5 seconds |
| Active (WiFi TX) | ~160-260 mA | ~600ms |
| BME280 forced measurement | ~0.35 mA | ~10ms |
| BME280 standby | ~0.1 uA | (during sleep) |

Average current at 5-second intervals: approximately 10 uA (sleep) + 160 mA * 0.6s / 5s = ~19 mA average. On a 1000 mAh battery, this gives roughly 50 hours of operation. For longer battery life, increase the sleep interval — at 30-second intervals, battery life extends to weeks; at 5-minute intervals, months.

---

## Summary of Changes

1. **Cache WiFi channel + BSSID in RTC memory** — biggest single improvement, cuts 2.5-4.5 seconds
2. **Use static IP** — eliminates DHCP, saves 1-2 seconds
3. **Read sensor before WiFi connect** — overlaps work, reduces total wall time
4. **Use BME280 forced mode** — saves power, sensor auto-sleeps
5. **Use `snprintf` instead of `String`** — prevents heap fragmentation over time
6. **Set `WiFi.persistent(false)`** — saves ~50ms and flash wear per boot
7. **Invalidate WiFi cache on failure** — self-corrects when AP changes channel
