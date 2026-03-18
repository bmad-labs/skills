# ESP32-S3 Data Logger: Reliable Architecture for Weeks of Uptime

## Root Cause Analysis

Your crashes after 2-3 days are almost certainly **heap fragmentation**. Here is why:

- `std::vector::push_back` reallocates when capacity is exceeded -- every reallocation fragments the heap.
- `std::string` for CSV formatting allocates on every concatenation, append, and temporary.
- At 100Hz x 3 sensors = 300 samples/second, with a 10-second flush cycle, you are doing thousands of heap alloc/free cycles per minute. Over 2-3 days that is **tens of millions** of fragmentation-inducing operations on a heap with only ~320KB of DRAM.

The ESP32 has no MMU, so fragmented memory is permanent until reboot. Eventually `malloc` returns NULL (or a too-small block), and the system crashes.

**The fix:** eliminate all dynamic allocation from periodic code paths. Use fixed-size buffers, a statically-allocated ring buffer, and `snprintf` into pre-allocated char arrays. This follows MISRA C Rule 21.3 and MISRA C++ Rule 21.6.1 -- no dynamic memory after initialization.

---

## Architecture Overview

```
 ADC Timer ISR (100Hz)                  Logger Task (FreeRTOS)
 +-----------------------+              +---------------------------+
 | Read 3 ADC channels   |              | Wait on task notification |
 | Pack into SensorSample|   SPSC Ring  | Drain ring buffer         |
 | Push to ring buffer   |------------->| Format CSV with snprintf  |
 | Every 1000 samples:   |   (DRAM)     | Write to SD card          |
 |   notify logger task  |              | (format buf in PSRAM)     |
 +-----------------------+              +---------------------------+
                                               |
                                        SD Card (SPI/SDMMC)
```

Three key design decisions:

1. **SPSC ring buffer in DRAM** -- lock-free, ISR-safe, zero allocation, power-of-2 bitmask indexing.
2. **CSV format buffer in PSRAM** -- large buffer (tens of KB) placed in PSRAM to free DRAM for real-time use. PSRAM is ~10x slower but CSV formatting is not latency-sensitive.
3. **No `std::vector`, no `std::string`, no `new`/`delete`** anywhere in periodic paths.

---

## Complete Implementation

### Sensor Sample Structure

```cpp
// sensor_sample.h
#pragma once
#include <cstdint>

struct SensorSample {
    uint32_t timestamp_ms;       // esp_timer_get_time() / 1000
    uint16_t adc_raw[3];         // 3 analog channels
};
// sizeof(SensorSample) = 12 bytes (4 + 2*3 + 2 padding)
```

### Lock-Free SPSC Ring Buffer (DRAM)

This is the core ISR-to-task communication mechanism. Power-of-2 capacity with bitmask indexing eliminates modulo operations. `std::atomic` with explicit memory ordering makes it safe without disabling interrupts.

```cpp
// spsc_ring_buffer.h
#pragma once
#include <atomic>
#include <array>
#include <cstddef>
#include <optional>

template<typename T, size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "N must be a power of 2");
    static_assert(N > 0, "N must be > 0");
    static constexpr size_t MASK = N - 1;

public:
    // Called by PRODUCER (ISR). Returns false if full.
    bool IRAM_ATTR push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & MASK;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;  // Full -- caller should count overruns
        }
        buf_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    // Called by CONSUMER (task). Returns nullopt if empty.
    std::optional<T> pop() {
        const size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) {
            return std::nullopt;
        }
        T item = buf_[tail];
        tail_.store((tail + 1) & MASK, std::memory_order_release);
        return item;
    }

    // Drain up to max_count items into output array. Returns count drained.
    size_t drain(T* out, size_t max_count) {
        size_t count = 0;
        while (count < max_count) {
            const size_t tail = tail_.load(std::memory_order_relaxed);
            if (tail == head_.load(std::memory_order_acquire)) {
                break;
            }
            out[count++] = buf_[tail];
            tail_.store((tail + 1) & MASK, std::memory_order_release);
        }
        return count;
    }

    [[nodiscard]] size_t count() const {
        const size_t h = head_.load(std::memory_order_acquire);
        const size_t t = tail_.load(std::memory_order_acquire);
        return (h - t) & MASK;
    }

    [[nodiscard]] bool empty() const {
        return head_.load(std::memory_order_acquire) ==
               tail_.load(std::memory_order_acquire);
    }

private:
    std::array<T, N> buf_{};
    std::atomic<size_t> head_{0};
    std::atomic<size_t> tail_{0};
};
```

> **Production alternative:** The Embedded Template Library (ETL) provides `etl::queue_spsc_atomic<T, N>` -- a production-tested ISR-safe SPSC queue. Consider using it if ETL is already in your project. Install in ESP-IDF via `idf_component.yml`.

### Main Application

```cpp
// main.cpp
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gptimer.h"
#include "driver/adc.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "esp_log.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"

#include "sensor_sample.h"
#include "spsc_ring_buffer.h"

#include <cstdio>
#include <cstring>
#include <atomic>

static const char* TAG = "datalogger";

// ============================================================
// Configuration -- all sizes known at compile time
// ============================================================
static constexpr size_t kAdcChannelCount     = 3;
static constexpr size_t kSampleRateHz        = 100;
static constexpr size_t kFlushIntervalSec    = 10;
static constexpr size_t kSamplesPerFlush     = kSampleRateHz * kFlushIntervalSec;  // 1000

// Ring buffer: 2048 slots (power of 2) > 1000 samples per flush.
// Gives ~10 seconds of headroom if the logger task stalls momentarily.
static constexpr size_t kRingCapacity        = 2048;

// CSV line: "1234567890,1234,1234,1234\n" = ~30 chars max per sample
static constexpr size_t kCsvLineMaxLen       = 32;
static constexpr size_t kCsvBufSize          = kSamplesPerFlush * kCsvLineMaxLen;  // ~32KB

// Stack sizes
static constexpr size_t kLoggerTaskStack     = 8192;  // snprintf + SD card I/O
static constexpr size_t kMonitorTaskStack    = 4096;

// ============================================================
// Statically allocated ring buffer -- lives in DRAM (fast, ISR-safe)
// ============================================================
static SpscRingBuffer<SensorSample, kRingCapacity> s_ring;

// Overrun counter -- atomic so ISR and monitor task can both access
static std::atomic<uint32_t> s_overrun_count{0};

// Logger task handle for direct-to-task notification from ISR
static TaskHandle_t s_logger_task = nullptr;

// Drain buffer -- static DRAM allocation, reused every flush
static SensorSample s_drain_buf[kSamplesPerFlush];

// CSV format buffer -- allocated from PSRAM at init time
// PSRAM is ~10x slower than DRAM but has 4-8MB capacity.
// CSV formatting is not latency-sensitive, so this is the right tradeoff.
static char* s_csv_buf = nullptr;

// ADC handle
static adc_oneshot_unit_handle_t s_adc_handle = nullptr;

// ADC channels for the 3 sensors
static constexpr adc_channel_t kAdcChannels[kAdcChannelCount] = {
    ADC_CHANNEL_0,
    ADC_CHANNEL_1,
    ADC_CHANNEL_2,
};

// SD card mount point
static constexpr const char* kMountPoint = "/sdcard";

// Sample counter for flush notification
static std::atomic<uint32_t> s_sample_count{0};

// ============================================================
// ADC Timer ISR -- runs at 100Hz, reads 3 channels, pushes to ring
// ============================================================
static bool IRAM_ATTR adc_timer_isr_callback(
    gptimer_handle_t timer,
    const gptimer_alarm_event_data_t* edata,
    void* user_ctx)
{
    SensorSample sample;
    sample.timestamp_ms = static_cast<uint32_t>(esp_timer_get_time() / 1000);

    // Read ADC channels -- oneshot reads are fast enough for 100Hz
    // Note: adc_oneshot_read is NOT ISR-safe on ESP-IDF.
    // For true ISR-based sampling, use continuous mode (adc_continuous).
    // Here we use a high-priority timer task approach instead -- see note below.
    for (size_t i = 0; i < kAdcChannelCount; ++i) {
        int raw = 0;
        adc_oneshot_read(s_adc_handle, kAdcChannels[i], &raw);
        sample.adc_raw[i] = static_cast<uint16_t>(raw);
    }

    if (!s_ring.push(sample)) {
        s_overrun_count.fetch_add(1, std::memory_order_relaxed);
    }

    // Notify logger task every kSamplesPerFlush samples
    uint32_t count = s_sample_count.fetch_add(1, std::memory_order_relaxed) + 1;
    if (count >= kSamplesPerFlush) {
        s_sample_count.store(0, std::memory_order_relaxed);
        BaseType_t xHigherPriorityTaskWoken = pdFALSE;
        vTaskNotifyGiveFromISR(s_logger_task, &xHigherPriorityTaskWoken);
        portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
    }

    return false;  // No need to reload alarm (auto-reload is configured)
}
```

> **Important note on ADC in ISR context:** `adc_oneshot_read()` is not truly ISR-safe on ESP-IDF -- it uses a mutex internally. For a production system, use one of these approaches instead:
>
> 1. **ESP-IDF ADC Continuous Mode** (`adc_continuous_start`) with DMA -- the hardware samples at your rate and fills a DMA buffer automatically. This is the preferred approach for 100Hz+ sampling.
> 2. **High-priority timer task** -- use `esp_timer_create()` with `dispatch_method = ESP_TIMER_TASK`, which runs your callback in a high-priority FreeRTOS task context (not a true ISR), making `adc_oneshot_read()` safe.
>
> The ring buffer architecture remains identical in either case. Below is the `esp_timer` approach, which is simpler and sufficient for 100Hz:

```cpp
// ============================================================
// Alternative: High-priority timer task (recommended for oneshot ADC)
// ============================================================
static esp_timer_handle_t s_sample_timer = nullptr;

static void sample_timer_callback(void* arg) {
    SensorSample sample;
    sample.timestamp_ms = static_cast<uint32_t>(esp_timer_get_time() / 1000);

    for (size_t i = 0; i < kAdcChannelCount; ++i) {
        int raw = 0;
        adc_oneshot_read(s_adc_handle, kAdcChannels[i], &raw);
        sample.adc_raw[i] = static_cast<uint16_t>(raw);
    }

    if (!s_ring.push(sample)) {
        s_overrun_count.fetch_add(1, std::memory_order_relaxed);
    }

    uint32_t count = s_sample_count.fetch_add(1, std::memory_order_relaxed) + 1;
    if (count >= kSamplesPerFlush) {
        s_sample_count.store(0, std::memory_order_relaxed);
        xTaskNotifyGive(s_logger_task);  // Not FromISR -- we're in task context
    }
}

static void init_sample_timer() {
    const esp_timer_create_args_t timer_args = {
        .callback = sample_timer_callback,
        .arg = nullptr,
        .dispatch_method = ESP_TIMER_TASK,  // Runs in esp_timer task (priority 22)
        .name = "adc_sample",
        .skip_unhandled_events = true,
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &s_sample_timer));
    // 10ms period = 100Hz
    ESP_ERROR_CHECK(esp_timer_start_periodic(s_sample_timer, 10000));
}
```

### Logger Task -- Drain, Format, Write to SD

```cpp
// ============================================================
// CSV formatting -- snprintf into pre-allocated PSRAM buffer
// ============================================================
static size_t format_csv(const SensorSample* samples, size_t count,
                         char* buf, size_t buf_size) {
    size_t offset = 0;
    for (size_t i = 0; i < count && offset < buf_size - kCsvLineMaxLen; ++i) {
        int written = snprintf(
            buf + offset,
            buf_size - offset,
            "%lu,%u,%u,%u\n",
            (unsigned long)samples[i].timestamp_ms,
            samples[i].adc_raw[0],
            samples[i].adc_raw[1],
            samples[i].adc_raw[2]
        );
        if (written > 0) {
            offset += static_cast<size_t>(written);
        }
    }
    return offset;
}

// ============================================================
// SD card write -- single fwrite call for the entire batch
// ============================================================
static bool write_to_sd(const char* data, size_t len) {
    // Generate filename based on boot count or date if RTC is available
    // For simplicity, append to a single file. In production, rotate files
    // daily or by size to avoid FAT32 cluster chain fragmentation.
    FILE* f = fopen("/sdcard/datalog.csv", "a");
    if (!f) {
        ESP_LOGE(TAG, "Failed to open log file");
        return false;
    }

    size_t written = fwrite(data, 1, len, f);
    fclose(f);

    if (written != len) {
        ESP_LOGE(TAG, "Short write: %u of %u bytes", (unsigned)written, (unsigned)len);
        return false;
    }
    return true;
}

// ============================================================
// Logger task -- waits for notification, drains ring, formats, writes
// ============================================================
static void logger_task(void* arg) {
    // Write CSV header on first run
    write_to_sd("timestamp_ms,adc0,adc1,adc2\n", 29);

    while (true) {
        // Block until the sampling timer notifies us (every 10 seconds)
        // Timeout at 15 seconds as a safety net
        ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(15000));

        // Drain all available samples from ring buffer into static drain buffer
        size_t count = s_ring.drain(s_drain_buf, kSamplesPerFlush);
        if (count == 0) {
            continue;
        }

        // Format CSV into PSRAM buffer -- no heap allocation
        size_t csv_len = format_csv(s_drain_buf, count, s_csv_buf, kCsvBufSize);

        // Write to SD card -- single large write is faster and reduces
        // SD card wear compared to many small writes
        if (!write_to_sd(s_csv_buf, csv_len)) {
            ESP_LOGE(TAG, "SD write failed, %u samples may be lost", (unsigned)count);
            // In production: buffer to a secondary ring or retry queue
        }

        ESP_LOGI(TAG, "Wrote %u samples (%u bytes)", (unsigned)count, (unsigned)csv_len);
    }
}
```

### Heap Health Monitor Task

```cpp
// ============================================================
// Monitor task -- logs heap health and overrun count periodically
// ============================================================
static void monitor_task(void* arg) {
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(60000));  // Every 60 seconds

        size_t free_heap      = heap_caps_get_free_size(MALLOC_CAP_8BIT);
        size_t largest_block  = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
        size_t min_free_ever  = heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);
        size_t free_psram     = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
        uint32_t overruns     = s_overrun_count.load(std::memory_order_relaxed);

        ESP_LOGI(TAG, "HEAP: free=%u largest_blk=%u min_ever=%u psram_free=%u overruns=%lu",
                 (unsigned)free_heap, (unsigned)largest_block,
                 (unsigned)min_free_ever, (unsigned)free_psram,
                 (unsigned long)overruns);

        // Fragmentation alarm: lots of free memory but no large contiguous block
        if (free_heap > 50000 && largest_block < 10000) {
            ESP_LOGW(TAG, "HEAP FRAGMENTED: free=%u but largest_blk=%u",
                     (unsigned)free_heap, (unsigned)largest_block);
        }

        // Log stack high water marks
        if (s_logger_task) {
            UBaseType_t logger_hwm = uxTaskGetStackHighWaterMark(s_logger_task);
            ESP_LOGI(TAG, "Logger stack HWM: %u words", (unsigned)logger_hwm);
        }
    }
}
```

### Initialization -- All Allocations Happen Here

```cpp
// ============================================================
// ADC initialization
// ============================================================
static void init_adc() {
    adc_oneshot_unit_init_cfg_t unit_cfg = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_cfg, &s_adc_handle));

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,     // 0-3.3V range on ESP32-S3
        .bitwidth = ADC_BITWIDTH_12,
    };
    for (size_t i = 0; i < kAdcChannelCount; ++i) {
        ESP_ERROR_CHECK(adc_oneshot_config_channel(s_adc_handle, kAdcChannels[i], &chan_cfg));
    }
}

// ============================================================
// SD card initialization (SDMMC or SPI depending on wiring)
// ============================================================
static void init_sd_card() {
    esp_vfs_fat_sdmmc_mount_config_t mount_cfg = {
        .format_if_mount_failed = false,
        .max_files = 2,
        .allocation_unit_size = 16 * 1024,  // Larger clusters = fewer FAT updates
    };

    sdmmc_card_t* card = nullptr;
    sdmmc_host_t host = SDMMC_HOST_DEFAULT();

    sdmmc_slot_config_t slot_cfg = SDMMC_SLOT_CONFIG_DEFAULT();
    slot_cfg.width = 1;  // 1-line SD mode; use 4 for faster writes

    ESP_ERROR_CHECK(esp_vfs_fat_sdmmc_mount(kMountPoint, &host, &slot_cfg,
                                            &mount_cfg, &card));
    sdmmc_card_print_info(stdout, card);
}

// ============================================================
// app_main -- all dynamic allocation happens during init, then never again
// ============================================================
extern "C" void app_main(void) {
    ESP_LOGI(TAG, "=== ESP32-S3 Data Logger ===");

    // 1. Allocate CSV format buffer from PSRAM (init-time allocation is OK)
    //    This is the ONLY dynamic allocation in the entire application.
    s_csv_buf = static_cast<char*>(
        heap_caps_malloc(kCsvBufSize, MALLOC_CAP_SPIRAM)
    );
    if (!s_csv_buf) {
        // Fallback to DRAM if no PSRAM -- log a warning about memory pressure
        ESP_LOGW(TAG, "No PSRAM available, allocating CSV buffer from DRAM");
        s_csv_buf = static_cast<char*>(malloc(kCsvBufSize));
    }
    assert(s_csv_buf != nullptr);  // Fatal if we can't even get init-time memory

    // 2. Initialize peripherals
    init_adc();
    init_sd_card();

    // 3. Create logger task BEFORE starting the timer
    xTaskCreatePinnedToCore(
        logger_task,
        "logger",
        kLoggerTaskStack,
        nullptr,
        5,                  // Priority 5 -- above default, below WiFi
        &s_logger_task,
        1                   // Pin to core 1 (core 0 runs WiFi/BT if used)
    );

    // 4. Create monitor task
    xTaskCreate(
        monitor_task,
        "monitor",
        kMonitorTaskStack,
        nullptr,
        1,                  // Low priority -- just diagnostics
        nullptr
    );

    // 5. Start sampling timer -- from this point, no more allocations
    init_sample_timer();

    ESP_LOGI(TAG, "Data logger started: %uHz, %u channels, flush every %us",
             (unsigned)kSampleRateHz, (unsigned)kAdcChannelCount,
             (unsigned)kFlushIntervalSec);

    // Log initial memory state
    ESP_LOGI(TAG, "DRAM free: %u, PSRAM free: %u",
             (unsigned)heap_caps_get_free_size(MALLOC_CAP_8BIT),
             (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
}
```

---

## Memory Budget

| Buffer | Location | Size | Justification |
|--------|----------|------|---------------|
| `s_ring` (SpscRingBuffer) | DRAM (static) | 2048 x 12 = ~24KB | ISR-to-task path, must be fast |
| `s_drain_buf` | DRAM (static) | 1000 x 12 = ~12KB | Temporary drain target, reused every flush |
| `s_csv_buf` | PSRAM (init-time malloc) | ~32KB | CSV formatting, not latency-sensitive |
| Logger task stack | DRAM (FreeRTOS) | 8KB | snprintf uses ~1KB stack; SD I/O needs headroom |
| Monitor task stack | DRAM (FreeRTOS) | 4KB | Lightweight diagnostics |
| **Total DRAM** | | **~48KB** | Well within ESP32-S3's ~320KB DRAM |
| **Total PSRAM** | | **~32KB** | Trivial for 2-8MB PSRAM |

### After init, the allocation count is zero

No `malloc`, `new`, `std::vector::push_back`, or `std::string` operation runs after `app_main` returns. The heap state is frozen. This is why the system will run for weeks.

---

## Why Your Original Design Crashes

| Your pattern | Problem | This design's fix |
|---|---|---|
| `std::vector<SensorSample>` to accumulate | `push_back` reallocates when capacity exceeded; old memory freed but leaves fragmentation holes | Static `SpscRingBuffer` with fixed 2048 slots -- zero allocation ever |
| `std::string` for CSV | Every `+=`, `+`, `std::to_string()` call heap-allocates; temporaries compound the issue | `snprintf` into pre-allocated `char[]` in PSRAM -- zero allocation |
| Implicit `new`/`delete` in STL | Hidden in `vector::resize`, `string::operator+`, `string::c_str()` copies | No STL containers in periodic paths |
| No memory monitoring | Fragmentation builds invisibly until crash | Monitor task logs `free_heap`, `largest_block`, `min_free_ever` every 60s |

---

## Additional Reliability Recommendations

1. **Watchdog timer.** Enable the ESP-IDF task watchdog (`esp_task_wdt_add`) on the logger task. If SD card I/O hangs, the watchdog resets the system rather than silently stopping data collection.

2. **File rotation.** Appending to a single file forever creates FAT32 cluster chain fragmentation on the SD card. Rotate files daily or at a size threshold (e.g., 10MB). Use filenames like `log_20260311_001.csv`.

3. **SD card write buffering.** A single `fwrite` of 32KB is much more efficient than 1000 small writes. The batched architecture above inherently provides this.

4. **Brown-out detection.** Enable `CONFIG_ESP_BROWNOUT_DET` in menuconfig. If VCC drops during an SD write, the file system can corrupt. Consider calling `fflush()` + `fsync()` after each batch write.

5. **ETL as a production alternative.** If you need more container-like APIs without heap allocation, the [Embedded Template Library (ETL)](https://www.etlcpp.com) provides `etl::vector<T, N>`, `etl::string<N>`, and `etl::queue_spsc_atomic<T, N>` as drop-in fixed-capacity replacements. Install in ESP-IDF by adding it as a managed component in `idf_component.yml`:

   ```yaml
   dependencies:
     etlcpp/etl: "~20.38"
   ```

6. **ADC calibration.** Use `esp_adc_cal` to convert raw ADC readings to millivolts. Raw 12-bit values vary unit-to-unit due to reference voltage variation on the ESP32-S3.

7. **Core pinning.** Pin the logger task to core 1 if WiFi/BT runs on core 0. This prevents WiFi stack bursts from delaying SD writes and causing ring buffer overruns.
