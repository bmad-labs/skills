# ESP32-S3 Data Logger: Restructuring for Long-Term Reliability

## Root Cause Analysis

Your crashes after 2-3 days are almost certainly **heap fragmentation**. Here is why:

- `std::vector::push_back` reallocates on the heap every time capacity is exceeded. At 100Hz x 3 sensors = 300 readings/second, accumulated over 10 seconds = 3,000 readings per flush cycle. Each flush creates and destroys a vector, fragmenting the heap.
- `std::string` for CSV formatting allocates on every concatenation. At one CSV line per reading, that is 300 heap alloc/free cycles per second -- over **25 million per day**.
- ESP32-S3 has ~320KB DRAM with no MMU. After 2-3 days of this churn, the heap becomes so fragmented that a routine allocation fails, and the system crashes.

This matches MISRA C Rule 21.3 and MISRA C++ Rule 21.6.1: no dynamic memory allocation in production paths. The reasoning is practical -- on a device with limited DRAM and no MMU, heap fragmentation from continuous allocation is a reliability defect.

## Architecture Overview

Replace dynamic allocation with three statically-sized structures:

1. **SPSC Ring Buffer** (in DRAM) -- ADC ISR/timer callback pushes readings; logger task pops them. Lock-free, zero allocation.
2. **Double-buffered flush array** -- Two fixed arrays, each holding 10 seconds of readings. One fills while the other writes to SD. Zero allocation.
3. **Fixed `char[]` with `snprintf`** -- CSV formatting into a static buffer. Zero allocation.

```
ADC Timer (100Hz)          Logger Task              SD Writer Task
      |                        |                        |
      v                        v                        v
 Read 3 ADC channels    Pop from ring buffer     Receive flush buffer ptr
      |                        |                   via task notification
      v                        v                        |
 Push SensorSample      Append to active          Format CSV with snprintf
 to SPSC ring buffer    flush buffer              into static char[] buffer
                               |                        |
                         When 1000 samples         Write to SD card
                         (10s worth):              via POSIX/FATFS
                         Swap buffers,                   |
                         notify SD task            Log heap health
```

## Complete Implementation

### sensor_types.h -- Shared Data Types

```cpp
#pragma once

#include <cstdint>

// One sample from all 3 ADC channels, timestamped
struct SensorSample {
    uint32_t timestamp_ms;    // esp_timer or xTaskGetTickCount
    uint16_t ch0;             // ADC channel 0 raw (12-bit)
    uint16_t ch1;             // ADC channel 1 raw
    uint16_t ch2;             // ADC channel 2 raw
    uint16_t _pad;            // Explicit padding for alignment (12 bytes total)
};

static_assert(sizeof(SensorSample) == 12, "SensorSample must be 12 bytes for predictable memory layout");
```

### spsc_ring_buffer.h -- Lock-Free Ring Buffer

This is the ISR-safe communication channel between the ADC sampling callback and the logger task. Power-of-2 capacity enables bitmask indexing (no expensive modulo). `std::atomic` with explicit memory ordering provides lock-free safety.

```cpp
#pragma once

#include <atomic>
#include <array>
#include <optional>
#include <cstddef>

template<typename T, size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "N must be a power of 2 for bitmask indexing");
    static constexpr size_t MASK = N - 1;

public:
    // Called by PRODUCER (timer ISR callback). Returns false if full.
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & MASK;
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;  // Full -- sample dropped
        }
        buf_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    // Called by CONSUMER (logger task). Returns nullopt if empty.
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

    size_t count() const {
        const size_t h = head_.load(std::memory_order_acquire);
        const size_t t = tail_.load(std::memory_order_acquire);
        return (h - t) & MASK;
    }

private:
    std::array<T, N> buf_{};
    std::atomic<size_t> head_{0};
    std::atomic<size_t> tail_{0};
};
```

**Memory ordering rationale:** On the ESP32-S3 (Xtensa LX7, single or dual core), `memory_order_relaxed` on the producer's own head read is safe because only the producer writes head. `memory_order_acquire` on the consumer's head read synchronizes with the producer's `release` store, ensuring the written data is visible. Same pattern mirrored for tail.

**Production alternative:** The [Embedded Template Library (ETL)](https://www.etlcpp.com) provides `etl::queue_spsc_atomic<T, N>` -- a production-ready ISR-safe SPSC queue with fixed capacity. Install in ESP-IDF by adding it as a component via `idf_component.yml`. Consider using it instead of rolling your own.

### data_logger.h -- Main Logger Module

```cpp
#pragma once

#include "sensor_types.h"
#include "spsc_ring_buffer.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_timer.h"
#include "esp_log.h"

#include <cstdio>
#include <cstring>
#include <atomic>

// ---- Configuration (all sizes known at compile time) ----

// Ring buffer: 2048 slots = ~6.8 seconds at 300 samples/sec.
// Power of 2 for bitmask indexing. Provides margin if SD write stalls briefly.
static constexpr size_t RING_BUF_CAPACITY = 2048;

// Flush buffer: 10 seconds * 100Hz * 3 channels = 1000 samples per flush.
// Two buffers for double-buffering (one fills while other writes to SD).
static constexpr size_t SAMPLES_PER_FLUSH = 1000;

// CSV line: "1234567890,4095,4095,4095\n" = max ~30 chars per line
// 1000 lines * 30 chars = 30KB per flush. Round up with margin.
static constexpr size_t CSV_BUF_SIZE = 32 * 1024;

// ---- Static storage -- zero heap allocation ----

// Ring buffer in DRAM (fast, ISR-safe)
static SpscRingBuffer<SensorSample, RING_BUF_CAPACITY> s_ring_buf;

// Double-buffered flush arrays -- one fills while the other is written to SD
static SensorSample s_flush_buf[2][SAMPLES_PER_FLUSH];
static size_t s_flush_count[2] = {0, 0};
static size_t s_active_buf = 0;  // Index of the buffer currently being filled

// CSV formatting buffer -- used only by the SD writer task
static char s_csv_buf[CSV_BUF_SIZE];

// Task handles
static TaskHandle_t s_logger_task_handle = nullptr;
static TaskHandle_t s_sd_writer_task_handle = nullptr;

// ESP-IDF timer handle for 100Hz ADC sampling
static esp_timer_handle_t s_adc_timer = nullptr;

// ADC handle (ESP-IDF 5.x oneshot driver)
static adc_oneshot_unit_handle_t s_adc_handle = nullptr;

// Dropped sample counter for diagnostics
static std::atomic<uint32_t> s_dropped_samples{0};

static const char* TAG = "data_logger";
```

### data_logger.cpp -- Implementation

```cpp
#include "data_logger.h"

#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/sdmmc_host.h"
#include "esp_heap_caps.h"

#include <cstdio>
#include <cinttypes>

// ---- ADC Sampling (Timer Callback @ 100Hz) ----
// This runs in ISR context on ESP-IDF. Keep it minimal:
// read ADC, push to ring buffer, done. No allocation, no blocking.

static void IRAM_ATTR adc_timer_callback(void* arg) {
    SensorSample sample;
    sample.timestamp_ms = (uint32_t)(esp_timer_get_time() / 1000);

    // ESP-IDF 5.x oneshot ADC read is safe from timer ISR context
    // because esp_timer callbacks run in a dedicated high-priority task,
    // not a true hardware ISR. If using raw ISR, use adc_continuous instead.
    int raw0 = 0, raw1 = 0, raw2 = 0;
    adc_oneshot_read(s_adc_handle, ADC_CHANNEL_0, &raw0);
    adc_oneshot_read(s_adc_handle, ADC_CHANNEL_3, &raw1);
    adc_oneshot_read(s_adc_handle, ADC_CHANNEL_6, &raw2);

    sample.ch0 = static_cast<uint16_t>(raw0);
    sample.ch1 = static_cast<uint16_t>(raw1);
    sample.ch2 = static_cast<uint16_t>(raw2);

    if (!s_ring_buf.push(sample)) {
        // Ring buffer full -- sample dropped. Increment counter for diagnostics.
        s_dropped_samples.fetch_add(1, std::memory_order_relaxed);
    }
}

// ---- Logger Task: Drains ring buffer into flush buffer ----
// Runs continuously, popping samples from the ring buffer into the active
// flush buffer. When SAMPLES_PER_FLUSH samples accumulate (10 seconds),
// swaps to the other buffer and notifies the SD writer task.

static void logger_task(void* param) {
    for (;;) {
        // Drain all available samples from the ring buffer
        while (auto sample = s_ring_buf.pop()) {
            size_t idx = s_active_buf;
            size_t count = s_flush_count[idx];

            if (count < SAMPLES_PER_FLUSH) {
                s_flush_buf[idx][count] = *sample;
                s_flush_count[idx] = count + 1;
            }

            // Check if flush buffer is full (10 seconds of data)
            if (s_flush_count[idx] >= SAMPLES_PER_FLUSH) {
                // Swap to the other buffer
                size_t completed_buf = idx;
                s_active_buf = 1 - idx;
                s_flush_count[s_active_buf] = 0;

                // Notify SD writer task, passing the completed buffer index
                xTaskNotify(s_sd_writer_task_handle,
                            completed_buf,
                            eSetValueWithOverwrite);
            }
        }

        // Sleep briefly to yield CPU. 5ms = ~1.5 samples at 300/sec.
        // Ring buffer has 2048 slots of margin, so this is safe.
        vTaskDelay(pdMS_TO_TICKS(5));
    }
}

// ---- SD Writer Task: Formats CSV and writes to SD card ----
// Blocks on task notification. When notified, formats the completed
// flush buffer into CSV using snprintf (zero heap allocation), then
// writes to the SD card file.

static void sd_writer_task(void* param) {
    // Open file once at startup. Append mode.
    // File rotation (by date or size) can be added here.
    FILE* f = nullptr;
    uint32_t file_index = 0;
    char filepath[64];

    auto open_new_file = [&]() {
        if (f) fclose(f);
        snprintf(filepath, sizeof(filepath),
                 "/sdcard/log_%05" PRIu32 ".csv", file_index++);
        f = fopen(filepath, "w");
        if (f) {
            // Write CSV header
            fprintf(f, "timestamp_ms,ch0,ch1,ch2\n");
        }
    };

    open_new_file();

    for (;;) {
        uint32_t buf_idx = 0;
        // Block until the logger task notifies us
        if (xTaskNotifyWait(0, ULONG_MAX, &buf_idx, portMAX_DELAY) != pdTRUE) {
            continue;
        }

        if (!f) {
            ESP_LOGE(TAG, "SD file not open, skipping flush");
            continue;
        }

        // Format the entire flush buffer into CSV using snprintf.
        // No std::string, no heap allocation.
        size_t csv_offset = 0;
        const size_t count = (buf_idx < 2) ? s_flush_count[buf_idx] : 0;

        // Safety: the logger task has already swapped to the other buffer,
        // so this buffer is not being written to.
        for (size_t i = 0; i < count && csv_offset < CSV_BUF_SIZE - 64; ++i) {
            const SensorSample& s = s_flush_buf[buf_idx][i];
            int written = snprintf(
                s_csv_buf + csv_offset,
                CSV_BUF_SIZE - csv_offset,
                "%" PRIu32 ",%u,%u,%u\n",
                s.timestamp_ms,
                (unsigned)s.ch0,
                (unsigned)s.ch1,
                (unsigned)s.ch2
            );
            if (written > 0) {
                csv_offset += static_cast<size_t>(written);
            }
        }

        // Single fwrite call for the entire batch -- minimizes SD card wear
        // and filesystem overhead vs writing line-by-line.
        if (csv_offset > 0) {
            size_t written = fwrite(s_csv_buf, 1, csv_offset, f);
            if (written != csv_offset) {
                ESP_LOGE(TAG, "SD write error: wrote %zu of %zu bytes",
                         written, csv_offset);
            }
            // Flush to SD periodically to avoid data loss on power failure
            fflush(f);
        }

        // Rotate file every ~1 million lines (~2.7 hours) to keep file sizes manageable
        static uint32_t total_lines = 0;
        total_lines += count;
        if (total_lines >= 1000000) {
            total_lines = 0;
            open_new_file();
        }

        // Log heap and system health every flush cycle (every 10 seconds)
        log_system_health();
    }
}

// ---- Heap Health Monitoring ----
// Critical for catching fragmentation before it causes a crash.
// If free heap is large but largest free block is small, the heap is fragmented.

static void log_system_health() {
    size_t free_heap = heap_caps_get_free_size(MALLOC_CAP_8BIT);
    size_t largest_block = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    size_t min_free_ever = heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);
    uint32_t dropped = s_dropped_samples.load(std::memory_order_relaxed);

    ESP_LOGI(TAG, "Heap: free=%zu largest_block=%zu min_ever=%zu dropped=%"
             PRIu32 " ring_fill=%zu",
             free_heap, largest_block, min_free_ever, dropped,
             s_ring_buf.count());

    // Key fragmentation indicator: lots of free memory but no large contiguous block
    if (free_heap > 50000 && largest_block < 10000) {
        ESP_LOGW(TAG, "HEAP FRAGMENTATION DETECTED! "
                 "free=%zu but largest_block=%zu", free_heap, largest_block);
    }

    // Monitor logger task stack high water mark
    if (s_logger_task_handle) {
        UBaseType_t remaining = uxTaskGetStackHighWaterMark(s_logger_task_handle);
        ESP_LOGI(TAG, "Logger task stack remaining: %u words", remaining);
    }
    if (s_sd_writer_task_handle) {
        UBaseType_t remaining = uxTaskGetStackHighWaterMark(s_sd_writer_task_handle);
        ESP_LOGI(TAG, "SD writer task stack remaining: %u words", remaining);
    }
}

// ---- ADC Initialization (ESP-IDF 5.x oneshot driver) ----

static esp_err_t init_adc() {
    adc_oneshot_unit_init_cfg_t unit_cfg = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_RETURN_ON_ERROR(adc_oneshot_new_unit(&unit_cfg, &s_adc_handle), TAG, "ADC unit init failed");

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,       // Full-scale ~3.3V
        .bitwidth = ADC_BITWIDTH_12,
    };
    ESP_RETURN_ON_ERROR(adc_oneshot_config_channel(s_adc_handle, ADC_CHANNEL_0, &chan_cfg), TAG, "CH0 config failed");
    ESP_RETURN_ON_ERROR(adc_oneshot_config_channel(s_adc_handle, ADC_CHANNEL_3, &chan_cfg), TAG, "CH3 config failed");
    ESP_RETURN_ON_ERROR(adc_oneshot_config_channel(s_adc_handle, ADC_CHANNEL_6, &chan_cfg), TAG, "CH6 config failed");

    return ESP_OK;
}

// ---- SD Card Initialization ----

static esp_err_t init_sd_card() {
    esp_vfs_fat_sdmmc_mount_config_t mount_cfg = {
        .format_if_mount_failed = false,
        .max_files = 2,
        .allocation_unit_size = 16 * 1024,  // Larger allocation unit = fewer FAT updates
    };

    sdmmc_card_t* card = nullptr;
    sdmmc_host_t host = SDMMC_HOST_DEFAULT();
    sdmmc_slot_config_t slot = SDMMC_SLOT_CONFIG_DEFAULT();

    // Use 1-line SD mode if wiring is limited
    slot.width = 1;

    ESP_RETURN_ON_ERROR(
        esp_vfs_fat_sdmmc_mount("/sdcard", &host, &slot, &mount_cfg, &card),
        TAG, "SD card mount failed"
    );

    sdmmc_card_print_info(stdout, card);
    return ESP_OK;
}

// ---- Public Entry Point ----

extern "C" void app_main(void) {
    ESP_LOGI(TAG, "Data logger starting");

    // Initialize peripherals
    ESP_ERROR_CHECK(init_adc());
    ESP_ERROR_CHECK(init_sd_card());

    // Create tasks with appropriate stack sizes.
    // SD writer uses snprintf extensively (~1KB stack per call) plus FATFS overhead.
    // Logger task is lightweight.
    xTaskCreatePinnedToCore(
        logger_task, "logger",
        4096,   // 4KB stack -- lightweight task
        nullptr, 5,  // Priority 5 (higher than SD writer)
        &s_logger_task_handle,
        1       // Pin to core 1 (core 0 handles WiFi if present)
    );

    xTaskCreatePinnedToCore(
        sd_writer_task, "sd_writer",
        8192,   // 8KB stack -- snprintf + FATFS needs headroom
        nullptr, 3,  // Priority 3 (lower than logger, higher than idle)
        &s_sd_writer_task_handle,
        1       // Pin to core 1
    );

    // Start 100Hz ADC sampling timer
    // esp_timer callbacks run in a dedicated high-priority task context,
    // not a hardware ISR. This makes adc_oneshot_read safe to call here.
    const esp_timer_create_args_t timer_args = {
        .callback = adc_timer_callback,
        .arg = nullptr,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "adc_sample",
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &s_adc_timer));
    ESP_ERROR_CHECK(esp_timer_start_periodic(s_adc_timer, 10000));  // 10ms = 100Hz

    ESP_LOGI(TAG, "Data logger running. Sampling at 100Hz, flushing every 10s.");
}
```

## Memory Budget

All storage is static. No `malloc`/`free`/`new`/`delete` in any periodic path.

| Buffer | Size | Location |
|--------|------|----------|
| SPSC ring buffer (2048 x 12B) | 24,576 B | DRAM (static) |
| Flush buffer A (1000 x 12B) | 12,000 B | DRAM (static) |
| Flush buffer B (1000 x 12B) | 12,000 B | DRAM (static) |
| CSV format buffer | 32,768 B | DRAM (static) |
| Logger task stack | 4,096 B | DRAM (FreeRTOS) |
| SD writer task stack | 8,192 B | DRAM (FreeRTOS) |
| **Total** | **~93 KB** | Fixed at compile time |

This leaves ~220KB+ of DRAM free for ESP-IDF system tasks (WiFi, BLE, etc.) and the heap -- which is now only used by ESP-IDF internals, not by your application code.

## Why This Eliminates Your Crashes

| Before (broken) | After (fixed) | Why it matters |
|---|---|---|
| `std::vector` accumulates readings | Static double-buffered `SensorSample[]` arrays | Zero heap allocation per flush cycle. No fragmentation. |
| `std::string` for CSV formatting | `snprintf` into static `char[]` buffer | Zero heap allocation per CSV line. `snprintf` uses only stack. |
| Unbounded growth until flush | Fixed 1000-sample flush buffers | Memory usage is constant and predictable forever. |
| No heap monitoring | `heap_caps_get_free_size` + `heap_caps_get_largest_free_block` every 10s | Detect fragmentation from ESP-IDF internals before it crashes. |
| Single task doing everything | Separate sampling, buffering, and SD write tasks | SD card stalls (50-200ms on wear leveling) don't cause sample drops. |

## Key Design Decisions Explained

**Why a ring buffer between sampling and logging?** SD card writes are non-deterministic -- a single `fwrite` can stall for 50-200ms during wear leveling or garbage collection. Without the ring buffer, any SD stall would cause missed ADC samples. The 2048-slot ring buffer provides ~6.8 seconds of margin, far exceeding any realistic SD stall.

**Why double-buffering for the flush?** While the SD writer formats and writes one buffer, the logger continues filling the other. This eliminates any gap in data collection during the SD write phase.

**Why `snprintf` instead of `std::string` or `std::stringstream`?** Both `std::string` and `std::stringstream` allocate on the heap with every operation. `snprintf` writes directly into a pre-allocated buffer using only stack space. Over weeks of operation, this is the difference between a stable system and a crashed one.

**Why `esp_timer` instead of a hardware timer ISR?** ESP-IDF's `esp_timer` callbacks run in a dedicated high-priority FreeRTOS task, not a true hardware ISR. This makes `adc_oneshot_read` safe to call (it would not be safe from a hardware ISR). The timing jitter is sub-millisecond, which is more than adequate for 100Hz sampling.

**Why pin tasks to core 1?** On dual-core ESP32-S3, core 0 handles WiFi/BLE protocol processing by default. Pinning your data path to core 1 prevents WiFi activity from causing timing jitter in your sampling and logging.

## Additional Reliability Measures

### Watchdog Configuration

For weeks-long unattended operation, configure the Task Watchdog Timer (TWDT) to catch hung tasks:

```cpp
#include "esp_task_wdt.h"

// In app_main, after creating tasks:
esp_task_wdt_config_t wdt_cfg = {
    .timeout_ms = 30000,   // 30 second timeout
    .idle_core_mask = 0,
    .trigger_panic = true, // Reset on timeout
};
esp_task_wdt_init(&wdt_cfg);
esp_task_wdt_add(s_logger_task_handle);
esp_task_wdt_add(s_sd_writer_task_handle);

// In each task's main loop, feed the watchdog:
esp_task_wdt_reset();
```

### ETL Alternative

If you prefer battle-tested library containers over hand-rolled ones, the [Embedded Template Library](https://www.etlcpp.com) provides drop-in replacements:

```cpp
#include <etl/queue_spsc_atomic.h>
#include <etl/vector.h>
#include <etl/string.h>

// Replace custom ring buffer:
etl::queue_spsc_atomic<SensorSample, 2048> adc_queue;

// Replace std::vector anywhere it still exists:
etl::vector<SensorSample, 1000> flush_buffer;

// Replace std::string anywhere it still exists:
etl::string<128> status_msg;
```

Install ETL in ESP-IDF by adding to your project's `idf_component.yml`:
```yaml
dependencies:
  etl:
    version: ">=20.38.0"
    git: https://github.com/ETLCPP/etl.git
```

### Compile Flags

Ensure your `CMakeLists.txt` includes:

```cmake
target_compile_options(${COMPONENT_LIB} PRIVATE
    -fno-exceptions    # No exception overhead (code size + stack)
    -fno-rtti          # No RTTI tables in ROM
    -fstack-usage      # Generate .su files for stack analysis
    -Wall -Wextra -Werror
)
```

This design runs indefinitely with constant, predictable memory usage. The heap monitoring will alert you if any ESP-IDF internal allocation (WiFi, TLS, etc.) is causing fragmentation -- but your application code itself will never touch the heap.
