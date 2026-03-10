# Optimizing ESP32 Deep Sleep Wake Cycle for BME280 + MQTT

## Problem Analysis

The 3-5 second WiFi reconnection after deep sleep is the dominant bottleneck. During deep sleep, the ESP32 powers down the WiFi radio and loses its association with the access point. On wake, the default Arduino WiFi reconnection performs a full scan of all channels, DHCP negotiation, and (if using WPA2) a full 4-way handshake. Each of these steps adds latency.

Your target of under 2 seconds for the full wake cycle is achievable with the techniques below.

---

## 1. Preserve WiFi State Across Deep Sleep Using RTC Memory

The single biggest optimization: save the WiFi channel and BSSID (access point MAC address) before sleeping, then provide them on reconnection to skip the channel scan.

```cpp
#include <WiFi.h>
#include <esp_wifi.h>

// RTC memory survives deep sleep
RTC_DATA_ATTR int savedChannel = 0;
RTC_DATA_ATTR uint8_t savedBSSID[6] = {0};
RTC_DATA_ATTR bool hasWiFiState = false;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false); // Don't write credentials to flash every boot

  if (hasWiFiState) {
    // Fast reconnect: skip channel scan by providing channel + BSSID
    WiFi.begin(WIFI_SSID, WIFI_PASS, savedChannel, savedBSSID, true);
  } else {
    // First boot or after failure: full connect
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 3000) {
      // Fast reconnect failed, fall back to full scan
      WiFi.disconnect();
      delay(10);
      hasWiFiState = false;
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      start = millis();
      while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > 8000) {
          // Total failure — go back to sleep and try next cycle
          esp_deep_sleep_start();
        }
        delay(10);
      }
      break;
    }
    delay(10);
  }

  // Save state for next wake
  savedChannel = WiFi.channel();
  memcpy(savedBSSID, WiFi.BSSID(), 6);
  hasWiFiState = true;
}
```

This alone typically brings WiFi reconnection from 3-5 seconds down to **300-800ms**.

---

## 2. Use a Static IP Address (Skip DHCP)

DHCP negotiation adds 500ms-2s. Assign a static IP to eliminate this entirely.

```cpp
IPAddress localIP(192, 168, 1, 100);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(192, 168, 1, 1);

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.config(localIP, gateway, subnet, dns);

  if (hasWiFiState) {
    WiFi.begin(WIFI_SSID, WIFI_PASS, savedChannel, savedBSSID, true);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }
  // ... same timeout logic as above
}
```

With static IP + saved channel/BSSID, WiFi connection typically completes in **200-500ms**.

---

## 3. Optimize the BME280 Read Timing

Start the sensor read in parallel with WiFi connection. The BME280 needs time after power-on to take a measurement (especially if powered from a GPIO to save sleep current).

```cpp
#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
float temperature, humidity, pressure;

void setup() {
  // Start WiFi connection (non-blocking initiation)
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.config(localIP, gateway, subnet, dns);

  if (hasWiFiState) {
    WiFi.begin(WIFI_SSID, WIFI_PASS, savedChannel, savedBSSID, true);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  // While WiFi is connecting, initialize and read the sensor
  Wire.begin(SDA_PIN, SCL_PIN);
  if (bme.begin(0x76)) {
    // Use forced mode for single-shot reading — lower power
    bme.setSampling(
      Adafruit_BME280::MODE_FORCED,
      Adafruit_BME280::SAMPLING_X1,   // temp
      Adafruit_BME280::SAMPLING_X1,   // pressure
      Adafruit_BME280::SAMPLING_X1,   // humidity
      Adafruit_BME280::FILTER_OFF,
      Adafruit_BME280::STANDBY_MS_0_5
    );
    bme.takeForcedMeasurement();
    temperature = bme.readTemperature();
    humidity = bme.readHumidity();
    pressure = bme.readPressure() / 100.0F;
  }

  // Now wait for WiFi to finish connecting
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 3000) {
    delay(10);
  }

  if (WiFi.status() == WL_CONNECTED) {
    savedChannel = WiFi.channel();
    memcpy(savedBSSID, WiFi.BSSID(), 6);
    hasWiFiState = true;

    publishMQTT();
  } else {
    hasWiFiState = false;
    // Optionally retry or just go to sleep
  }

  // Go back to deep sleep
  esp_sleep_enable_timer_wakeup(5 * 1000000ULL); // 5 seconds
  esp_deep_sleep_start();
}

void loop() {
  // Never reached — deep sleep resets to setup()
}
```

---

## 4. Optimize MQTT Connection

Use QoS 0 (fire-and-forget) to avoid the round-trip ACK wait. Keep the MQTT payload small. Connect with `cleanSession = false` if your broker supports session resumption.

```cpp
#include <PubSubClient.h>

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void publishMQTT() {
  mqtt.setServer(MQTT_BROKER, 1883);
  mqtt.setSocketTimeout(2); // 2-second timeout

  // Use a unique but deterministic client ID
  String clientId = "esp32-sensor-" + String(ESP.getEfuseMac(), HEX);

  if (mqtt.connect(clientId.c_str())) {
    // Build a compact payload
    char payload[128];
    snprintf(payload, sizeof(payload),
      "{\"t\":%.1f,\"h\":%.1f,\"p\":%.1f}",
      temperature, humidity, pressure);

    mqtt.publish("sensors/bme280", payload, false); // QoS 0, no retain
    mqtt.disconnect();
  }
}
```

If you need reliability, consider QoS 1 but accept the ~100ms overhead for the PUBACK round trip.

---

## 5. Reduce Boot Time

### Disable serial output in production
Serial initialization and `Serial.print()` calls add measurable overhead. Wrap them in a debug flag:

```cpp
#define DEBUG 0

#if DEBUG
  #define DBG(x) Serial.println(x)
#else
  #define DBG(x)
#endif
```

### Increase CPU frequency during wake
The ESP32 boots at 160MHz by default in Arduino. Bump to 240MHz for faster execution during the brief wake period — the extra power draw is negligible given the short active time:

```cpp
setCpuFrequencyMhz(240);
```

### Disable Bluetooth
If not using BLE, ensure it is off to avoid its initialization overhead:

```cpp
#include "esp_bt.h"
esp_bt_controller_disable();
```

Or in `platformio.ini` / board config, build with `-D CONFIG_BT_ENABLED=0`.

---

## 6. Complete Optimized Timing Budget

| Phase | Unoptimized | Optimized |
|-------|------------|-----------|
| Boot + init | ~200ms | ~150ms |
| WiFi connect | 3000-5000ms | 200-500ms |
| BME280 read | 50-100ms | 50ms (parallel with WiFi) |
| MQTT connect + publish | 200-500ms | 100-200ms |
| **Total** | **3.5-5.8s** | **450-850ms** |

---

## 7. Additional Power Optimization Tips

### Sleep current reduction
- Use `esp_sleep_pd_config()` to power down RTC peripherals you do not need:
  ```cpp
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_OFF);
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_SLOW_MEM, ESP_PD_OPTION_ON); // Keep RTC memory for saved state
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_FAST_MEM, ESP_PD_OPTION_OFF);
  ```

### Power the BME280 from a GPIO
If you drive the BME280's VCC from a GPIO pin (through a MOSFET or directly if current draw is under 12mA), it draws zero current during deep sleep:

```cpp
#define SENSOR_POWER_PIN 27

pinMode(SENSOR_POWER_PIN, OUTPUT);
digitalWrite(SENSOR_POWER_PIN, HIGH);
delay(5); // BME280 needs ~2ms to start up
// ... read sensor ...
digitalWrite(SENSOR_POWER_PIN, LOW); // Power off before sleep
```

### Use esp_wifi_set_ps() for light sleep between publishes
If you ever switch to light sleep instead of deep sleep (for faster wake), you can use WiFi modem sleep:

```cpp
esp_wifi_set_ps(WIFI_PS_MAX_MODEM);
```

---

## 8. Handling WiFi Reconnection Failures Gracefully

Track consecutive failures in RTC memory and implement exponential backoff:

```cpp
RTC_DATA_ATTR int failCount = 0;

void goToSleep() {
  uint64_t sleepTime;
  if (failCount == 0) {
    sleepTime = 5 * 1000000ULL; // Normal: 5 seconds
  } else {
    // Exponential backoff: 10s, 20s, 40s, max 5 minutes
    sleepTime = min((uint64_t)(10 * (1 << (failCount - 1))), (uint64_t)300) * 1000000ULL;
  }
  esp_sleep_enable_timer_wakeup(sleepTime);
  esp_deep_sleep_start();
}
```

Reset `failCount = 0` after a successful publish.

---

## Summary of Key Optimizations

1. **Save WiFi channel + BSSID in RTC memory** — eliminates channel scan (~2-4s saved)
2. **Use static IP** — eliminates DHCP (~0.5-2s saved)
3. **Read BME280 in parallel** with WiFi connection — overlaps ~50ms of sensor I/O
4. **Use MQTT QoS 0** — eliminates ACK wait (~100ms saved)
5. **Disable serial, Bluetooth, bump CPU to 240MHz** — shaves boot/init time
6. **Fallback logic** — if fast reconnect fails, do full scan; if that fails, sleep and retry

With all optimizations applied, your full wake-read-publish-sleep cycle should consistently complete in **well under 2 seconds**, typically around **500-900ms**.
