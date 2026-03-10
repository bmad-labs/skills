# ESP32-S3 Data Logger: Restructured for Long-Term Reliability

## Root Cause Analysis

Your crashes after 2-3 days are almost certainly caused by **heap fragmentation** from repeated `std::vector` growth/reallocation and `std::string` construction during CSV formatting. Here's what's happening:

1. **`std::vector::push_back()`** — triggers reallocation (allocate new, copy, free old), leaving holes in the heap
2. **`std::string` for CSV formatting** — creates temporary heap allocations every time you format a line
3. **Over days**, the heap becomes so fragmented that a perfectly reasonable allocation fails despite having "enough" total free memory

The fix: **eliminate all dynamic allocation from the runtime path**. Use statically-sized circular buffers, fixed-size char arrays for formatting, and pre-allocated everything at boot.

## Architecture Overview

```
Task: adc_reader_task (Core 1, highest priority)
  - Hardware timer triggers ADC reads at exactly 100Hz
  - Writes into statically-allocated circular buffer
  - Zero heap allocation

Task: sd_writer_task (Core 0, lower priority)
  - Wakes every 10 seconds
  - Reads from circular buffer
  - Formats CSV into a pre-allocated char buffer
  - Writes to SD card
  - Zero heap allocation

Synchronization: FreeRTOS stream buffer (lock-free, single-producer/single-consumer)
```

## Complete Implementation

### main/data_logger.h

```c
/**
 * ESP32-S3 Data Logger - Long-term reliable design
 *
 * Design principles:
 *   - Zero dynamic allocation after init
 *   - All buffers statically sized
 *   - Lock-free producer/consumer via FreeRTOS StreamBuffer
 *   - Watchdog on both tasks
 *   - Graceful SD card error recovery
 */

#ifndef DATA_LOGGER_H
#define DATA_LOGGER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---------- Tunable constants ---------- */

/** Number of analog channels */
#define ADC_CHANNEL_COUNT       3

/** Sampling rate in Hz */
#define ADC_SAMPLE_RATE_HZ      100

/** SD card flush interval in seconds */
#define SD_FLUSH_INTERVAL_SEC   10

/**
 * Circular buffer size in samples.
 * Must hold at least SD_FLUSH_INTERVAL_SEC * ADC_SAMPLE_RATE_HZ samples
 * with headroom for SD write latency spikes.
 * 2x headroom: 10s * 100Hz * 2 = 2000 samples
 */
#define RING_BUFFER_SAMPLES     2000

/**
 * Maximum CSV line length:
 * timestamp(10) + 3 * (comma + value(6)) + newline + null = ~40 chars
 * Padded to 64 for safety.
 */
#define CSV_LINE_MAX_LEN        64

/**
 * SD write buffer size in bytes.
 * Must hold SD_FLUSH_INTERVAL_SEC * ADC_SAMPLE_RATE_HZ lines.
 * 1000 lines * 64 bytes = 64KB. We allocate 80KB for headroom.
 */
#define SD_WRITE_BUF_SIZE       (80 * 1024)

/** Stack sizes for tasks */
#define ADC_TASK_STACK_SIZE     4096
#define SD_TASK_STACK_SIZE      8192

/** Task priorities (higher number = higher priority on ESP-IDF) */
#define ADC_TASK_PRIORITY       10
#define SD_TASK_PRIORITY        5

/** Watchdog timeout in seconds */
#define WDT_TIMEOUT_SEC         30

/* ---------- Data types ---------- */

/** Single ADC reading with timestamp */
typedef struct __attribute__((packed)) {
    uint32_t timestamp_ms;
    int16_t  channels[ADC_CHANNEL_COUNT];
} adc_sample_t;

_Static_assert(sizeof(adc_sample_t) == 10,
    "adc_sample_t size changed — update stream buffer math");

/* ---------- Public API ---------- */

/**
 * Initialize and start the data logger.
 * Call once from app_main(). All memory is allocated here.
 * Returns ESP_OK on success.
 */
esp_err_t data_logger_init(void);

/**
 * Get runtime statistics (for diagnostics endpoint).
 */
typedef struct {
    uint32_t samples_captured;
    uint32_t samples_written;
    uint32_t samples_dropped;
    uint32_t sd_write_errors;
    uint32_t sd_reopen_count;
    uint32_t min_free_heap;
    uint32_t uptime_seconds;
} logger_stats_t;

esp_err_t data_logger_get_stats(logger_stats_t *out);

#ifdef __cplusplus
}
#endif

#endif /* DATA_LOGGER_H */
```

### main/data_logger.c

```c
#include "data_logger.h"

#include <string.h>
#include <stdio.h>
#include <sys/stat.h>
#include <sys/unistd.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/stream_buffer.h"
#include "freertos/semphr.h"

#include "driver/gptimer.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "driver/sdmmc_host.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_task_wdt.h"
#include "esp_system.h"

static const char *TAG = "data_logger";

/* ================================================================
 *  Static storage — zero heap allocation after init
 * ================================================================ */

/**
 * Stream buffer for lock-free producer/consumer.
 * Sized to hold RING_BUFFER_SAMPLES worth of adc_sample_t.
 * StaticStreamBuffer requires a backing array + struct.
 */
static uint8_t s_stream_buf_storage[RING_BUFFER_SAMPLES * sizeof(adc_sample_t) + 1];
static StaticStreamBuffer_t s_stream_buf_struct;
static StreamBufferHandle_t s_stream_buf;

/** SD card write buffer — pre-allocated, never freed */
static char s_sd_write_buf[SD_WRITE_BUF_SIZE];

/** Task handles */
static TaskHandle_t s_adc_task_handle;
static TaskHandle_t s_sd_task_handle;

/** Task stacks — statically allocated */
static StackType_t s_adc_task_stack[ADC_TASK_STACK_SIZE / sizeof(StackType_t)];
static StaticTask_t s_adc_task_tcb;
static StackType_t s_sd_task_stack[SD_TASK_STACK_SIZE / sizeof(StackType_t)];
static StaticTask_t s_sd_task_tcb;

/** ADC handles */
static adc_oneshot_unit_handle_t s_adc_handle;
static adc_cali_handle_t s_adc_cali_handle;

/** Statistics — updated atomically or from owning task only */
static volatile logger_stats_t s_stats;

/** SD card mount point */
#define SD_MOUNT_POINT "/sdcard"
#define SD_LOG_DIR     SD_MOUNT_POINT "/logs"
static sdmmc_card_t *s_sd_card;
static FILE *s_log_file;

/**
 * ADC channels — configure for your specific wiring.
 * ESP32-S3 ADC1 channels (GPIO1-GPIO10 map to ADC1_CH0-CH9).
 */
static const adc_channel_t s_adc_channels[ADC_CHANNEL_COUNT] = {
    ADC_CHANNEL_0,  /* GPIO1 - Sensor 1 */
    ADC_CHANNEL_1,  /* GPIO2 - Sensor 2 */
    ADC_CHANNEL_2,  /* GPIO3 - Sensor 3 */
};

/* ================================================================
 *  ADC Initialization
 * ================================================================ */

static esp_err_t adc_init(void)
{
    /* ADC1 unit config */
    adc_oneshot_unit_init_cfg_t unit_cfg = {
        .unit_id = ADC_UNIT_1,
    };
    ESP_RETURN_ON_ERROR(adc_oneshot_new_unit(&unit_cfg, &s_adc_handle),
                        TAG, "ADC unit init failed");

    /* Channel config — 12-bit, 11dB attenuation for ~0-3.1V range */
    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_11,
        .bitwidth = ADC_BITWIDTH_12,
    };

    for (int i = 0; i < ADC_CHANNEL_COUNT; i++) {
        ESP_RETURN_ON_ERROR(
            adc_oneshot_config_channel(s_adc_handle, s_adc_channels[i], &chan_cfg),
            TAG, "ADC channel %d config failed", i);
    }

    /* Calibration — ESP32-S3 supports curve fitting */
    adc_cali_curve_fitting_config_t cali_cfg = {
        .unit_id = ADC_UNIT_1,
        .atten = ADC_ATTEN_DB_11,
        .bitwidth = ADC_BITWIDTH_12,
    };
    ESP_RETURN_ON_ERROR(
        adc_cali_create_scheme_curve_fitting(&cali_cfg, &s_adc_cali_handle),
        TAG, "ADC calibration init failed");

    return ESP_OK;
}

/* ================================================================
 *  SD Card Management
 * ================================================================ */

static esp_err_t sd_card_init(void)
{
    esp_vfs_fat_sdmmc_mount_config_t mount_cfg = {
        .format_if_mount_failed = false,
        .max_files = 2,
        .allocation_unit_size = 16 * 1024,
    };

    sdmmc_host_t host = SDMMC_HOST_DEFAULT();
    host.max_freq_khz = SDMMC_FREQ_HIGHSPEED;

    /*
     * ESP32-S3 SDMMC slot 1 — adjust GPIOs to your board.
     * Common dev board pinout shown below.
     */
    sdmmc_slot_config_t slot_cfg = SDMMC_SLOT_CONFIG_DEFAULT();
    slot_cfg.width = 1; /* 1-bit mode for reliability */

    ESP_RETURN_ON_ERROR(
        esp_vfs_fat_sdmmc_mount(SD_MOUNT_POINT, &host, &slot_cfg,
                                &mount_cfg, &s_sd_card),
        TAG, "SD card mount failed");

    /* Create log directory if it doesn't exist */
    struct stat st;
    if (stat(SD_LOG_DIR, &st) != 0) {
        mkdir(SD_LOG_DIR, 0755);
    }

    return ESP_OK;
}

/**
 * Open a new log file with timestamp-based name.
 * Called at init and after file rotation.
 */
static esp_err_t open_log_file(void)
{
    if (s_log_file != NULL) {
        fclose(s_log_file);
        s_log_file = NULL;
    }

    /* Generate filename from uptime to avoid RTC dependency */
    char filepath[64];
    uint32_t uptime_sec = (uint32_t)(esp_timer_get_time() / 1000000ULL);
    snprintf(filepath, sizeof(filepath), SD_LOG_DIR "/log_%010lu.csv",
             (unsigned long)uptime_sec);

    s_log_file = fopen(filepath, "w");
    if (s_log_file == NULL) {
        ESP_LOGE(TAG, "Failed to open %s", filepath);
        return ESP_FAIL;
    }

    /* Write CSV header */
    fprintf(s_log_file, "timestamp_ms,ch0_mv,ch1_mv,ch2_mv\n");
    fflush(s_log_file);

    ESP_LOGI(TAG, "Logging to: %s", filepath);
    return ESP_OK;
}

/**
 * Rotate log file when it exceeds ~10MB.
 * Keeps files manageable and limits data loss on corruption.
 */
#define MAX_LOG_FILE_SIZE (10 * 1024 * 1024)

static esp_err_t rotate_log_if_needed(void)
{
    if (s_log_file == NULL) {
        return open_log_file();
    }

    long pos = ftell(s_log_file);
    if (pos >= MAX_LOG_FILE_SIZE) {
        ESP_LOGI(TAG, "Rotating log file at %ld bytes", pos);
        return open_log_file();
    }
    return ESP_OK;
}

/* ================================================================
 *  ADC Reader Task — runs on Core 1, highest priority
 * ================================================================ */

/**
 * Precise timing using esp_timer (hardware timer).
 * This avoids vTaskDelay drift — critical for consistent 100Hz.
 */
static void IRAM_ATTR adc_timer_callback(void *arg)
{
    /* Signal the ADC task to take a reading */
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    vTaskNotifyGiveFromISR(s_adc_task_handle, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

static void adc_reader_task(void *arg)
{
    ESP_LOGI(TAG, "ADC reader task started on core %d", xPortGetCoreID());

    /* Register with task watchdog */
    ESP_ERROR_CHECK(esp_task_wdt_add(NULL));

    /* Local sample — on stack, no heap */
    adc_sample_t sample;

    /* Create a periodic hardware timer for precise 100Hz */
    const esp_timer_create_args_t timer_args = {
        .callback = adc_timer_callback,
        .name = "adc_timer",
        .dispatch_method = ESP_TIMER_ISR,  /* ISR dispatch for lowest latency */
    };
    esp_timer_handle_t adc_timer;
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &adc_timer));
    ESP_ERROR_CHECK(esp_timer_start_periodic(adc_timer,
                    1000000 / ADC_SAMPLE_RATE_HZ)); /* 10000us = 10ms */

    while (true) {
        /* Wait for timer notification — blocks without spinning */
        ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));

        /* Timestamp */
        sample.timestamp_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);

        /* Read all 3 channels */
        for (int i = 0; i < ADC_CHANNEL_COUNT; i++) {
            int raw = 0;
            esp_err_t err = adc_oneshot_read(s_adc_handle, s_adc_channels[i], &raw);
            if (err == ESP_OK) {
                int voltage_mv = 0;
                adc_cali_raw_to_voltage(s_adc_cali_handle, raw, &voltage_mv);
                sample.channels[i] = (int16_t)voltage_mv;
            } else {
                sample.channels[i] = -1; /* Error sentinel */
            }
        }

        /* Write to stream buffer — non-blocking */
        size_t sent = xStreamBufferSend(s_stream_buf, &sample, sizeof(sample), 0);
        if (sent != sizeof(sample)) {
            /* Buffer full — SD writer can't keep up */
            s_stats.samples_dropped++;
            if ((s_stats.samples_dropped % 1000) == 1) {
                ESP_LOGW(TAG, "Buffer overflow! Dropped: %lu",
                         (unsigned long)s_stats.samples_dropped);
            }
        } else {
            s_stats.samples_captured++;
        }

        /* Feed watchdog */
        esp_task_wdt_reset();
    }
}

/* ================================================================
 *  SD Writer Task — runs on Core 0, lower priority
 * ================================================================ */

static void sd_writer_task(void *arg)
{
    ESP_LOGI(TAG, "SD writer task started on core %d", xPortGetCoreID());

    /* Register with task watchdog */
    ESP_ERROR_CHECK(esp_task_wdt_add(NULL));

    /* Open initial log file */
    while (open_log_file() != ESP_OK) {
        ESP_LOGE(TAG, "Waiting for SD card...");
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_task_wdt_reset();
    }

    adc_sample_t sample;
    uint32_t consecutive_errors = 0;

    while (true) {
        /* Wait for flush interval */
        vTaskDelay(pdMS_TO_TICKS(SD_FLUSH_INTERVAL_SEC * 1000));
        esp_task_wdt_reset();

        /* Track minimum free heap for diagnostics */
        uint32_t free_heap = esp_get_minimum_free_heap_size();
        if (s_stats.min_free_heap == 0 || free_heap < s_stats.min_free_heap) {
            s_stats.min_free_heap = free_heap;
        }
        s_stats.uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000ULL);

        /* Drain stream buffer into SD write buffer */
        size_t buf_offset = 0;
        uint32_t samples_in_batch = 0;

        while (true) {
            size_t received = xStreamBufferReceive(s_stream_buf, &sample,
                                                    sizeof(sample), 0);
            if (received != sizeof(sample)) {
                break; /* Buffer empty */
            }

            /* Format CSV line directly into pre-allocated buffer.
             * snprintf with bounded output — no heap allocation. */
            int written = snprintf(
                s_sd_write_buf + buf_offset,
                SD_WRITE_BUF_SIZE - buf_offset,
                "%lu,%d,%d,%d\n",
                (unsigned long)sample.timestamp_ms,
                (int)sample.channels[0],
                (int)sample.channels[1],
                (int)sample.channels[2]
            );

            if (written <= 0 || (buf_offset + (size_t)written) >= SD_WRITE_BUF_SIZE) {
                ESP_LOGW(TAG, "SD write buffer full, flushing partial batch");
                break;
            }

            buf_offset += (size_t)written;
            samples_in_batch++;
        }

        if (samples_in_batch == 0) {
            continue;
        }

        /* Check for file rotation */
        rotate_log_if_needed();

        /* Write entire batch to SD in one fwrite call.
         * Single large write is much more efficient than many small ones
         * and reduces SD card wear. */
        if (s_log_file != NULL) {
            size_t written = fwrite(s_sd_write_buf, 1, buf_offset, s_log_file);
            if (written == buf_offset) {
                fflush(s_log_file);
                s_stats.samples_written += samples_in_batch;
                consecutive_errors = 0;

                ESP_LOGD(TAG, "Wrote %lu samples (%lu bytes)",
                         (unsigned long)samples_in_batch,
                         (unsigned long)buf_offset);
            } else {
                s_stats.sd_write_errors++;
                consecutive_errors++;
                ESP_LOGE(TAG, "SD write error: wrote %u of %u bytes (error #%lu)",
                         (unsigned)written, (unsigned)buf_offset,
                         (unsigned long)consecutive_errors);

                /* Recovery strategy: close and reopen file */
                if (s_log_file) {
                    fclose(s_log_file);
                    s_log_file = NULL;
                }

                if (consecutive_errors >= 3) {
                    /* SD card may be failing — try remount */
                    ESP_LOGW(TAG, "Multiple SD errors, attempting remount...");
                    esp_vfs_fat_sdcard_unmount(SD_MOUNT_POINT, s_sd_card);
                    vTaskDelay(pdMS_TO_TICKS(1000));

                    if (sd_card_init() == ESP_OK && open_log_file() == ESP_OK) {
                        ESP_LOGI(TAG, "SD card remounted successfully");
                        s_stats.sd_reopen_count++;
                        consecutive_errors = 0;
                    } else {
                        ESP_LOGE(TAG, "SD remount failed, will retry next cycle");
                    }
                } else {
                    /* Just reopen the file */
                    if (open_log_file() == ESP_OK) {
                        s_stats.sd_reopen_count++;
                    }
                }
            }
        } else {
            /* File not open — try to open */
            if (open_log_file() != ESP_OK) {
                ESP_LOGE(TAG, "Cannot open log file, data lost for this batch");
            }
        }

        /* Periodic health log every 5 minutes */
        if ((s_stats.uptime_seconds % 300) < SD_FLUSH_INTERVAL_SEC) {
            ESP_LOGI(TAG, "Health: up=%lus captured=%lu written=%lu "
                     "dropped=%lu errors=%lu heap_min=%lu",
                     (unsigned long)s_stats.uptime_seconds,
                     (unsigned long)s_stats.samples_captured,
                     (unsigned long)s_stats.samples_written,
                     (unsigned long)s_stats.samples_dropped,
                     (unsigned long)s_stats.sd_write_errors,
                     (unsigned long)s_stats.min_free_heap);
        }

        esp_task_wdt_reset();
    }
}

/* ================================================================
 *  Public API
 * ================================================================ */

esp_err_t data_logger_init(void)
{
    ESP_LOGI(TAG, "Initializing data logger...");
    ESP_LOGI(TAG, "Sample size: %u bytes, ring buffer: %u samples (%u KB)",
             (unsigned)sizeof(adc_sample_t),
             RING_BUFFER_SAMPLES,
             (unsigned)(sizeof(s_stream_buf_storage) / 1024));
    ESP_LOGI(TAG, "SD write buffer: %u KB", SD_WRITE_BUF_SIZE / 1024);
    ESP_LOGI(TAG, "Free heap at init: %lu bytes",
             (unsigned long)esp_get_free_heap_size());

    /* Initialize stream buffer — statically allocated */
    s_stream_buf = xStreamBufferCreateStatic(
        sizeof(s_stream_buf_storage),
        sizeof(adc_sample_t),           /* trigger level: 1 sample */
        s_stream_buf_storage,
        &s_stream_buf_struct
    );
    if (s_stream_buf == NULL) {
        ESP_LOGE(TAG, "Stream buffer creation failed");
        return ESP_FAIL;
    }

    /* Initialize ADC */
    ESP_RETURN_ON_ERROR(adc_init(), TAG, "ADC init failed");

    /* Initialize SD card */
    ESP_RETURN_ON_ERROR(sd_card_init(), TAG, "SD card init failed");

    /* Initialize task watchdog */
    esp_task_wdt_config_t wdt_cfg = {
        .timeout_ms = WDT_TIMEOUT_SEC * 1000,
        .idle_core_mask = 0,    /* Don't watch idle tasks */
        .trigger_panic = true,  /* Reboot on WDT timeout */
    };
    ESP_RETURN_ON_ERROR(esp_task_wdt_reconfigure(&wdt_cfg),
                        TAG, "WDT config failed");

    /* Create ADC task on Core 1 — statically allocated */
    s_adc_task_handle = xTaskCreateStaticPinnedToCore(
        adc_reader_task,
        "adc_reader",
        ADC_TASK_STACK_SIZE / sizeof(StackType_t),
        NULL,
        ADC_TASK_PRIORITY,
        s_adc_task_stack,
        &s_adc_task_tcb,
        1  /* Core 1 */
    );
    if (s_adc_task_handle == NULL) {
        ESP_LOGE(TAG, "ADC task creation failed");
        return ESP_FAIL;
    }

    /* Create SD writer task on Core 0 — statically allocated */
    s_sd_task_handle = xTaskCreateStaticPinnedToCore(
        sd_writer_task,
        "sd_writer",
        SD_TASK_STACK_SIZE / sizeof(StackType_t),
        NULL,
        SD_TASK_PRIORITY,
        s_sd_task_stack,
        &s_sd_task_tcb,
        0  /* Core 0 */
    );
    if (s_sd_task_handle == NULL) {
        ESP_LOGE(TAG, "SD writer task creation failed");
        return ESP_FAIL;
    }

    memset((void *)&s_stats, 0, sizeof(s_stats));

    ESP_LOGI(TAG, "Data logger initialized. Free heap: %lu bytes",
             (unsigned long)esp_get_free_heap_size());

    return ESP_OK;
}

esp_err_t data_logger_get_stats(logger_stats_t *out)
{
    if (out == NULL) return ESP_ERR_INVALID_ARG;
    memcpy(out, (const void *)&s_stats, sizeof(logger_stats_t));
    return ESP_OK;
}
```

### main/main.c

```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "data_logger.h"

static const char *TAG = "main";

void app_main(void)
{
    /* Initialize NVS — required by some ESP-IDF drivers */
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    /* Start the data logger — all allocation happens here */
    ESP_ERROR_CHECK(data_logger_init());

    ESP_LOGI(TAG, "System running. Free heap: %lu",
             (unsigned long)esp_get_free_heap_size());

    /* app_main can return — FreeRTOS scheduler keeps running.
     * The idle task reclaims this stack memory. */
}
```

### sdkconfig.defaults (key settings)

```ini
# FreeRTOS
CONFIG_FREERTOS_HZ=1000
CONFIG_FREERTOS_ENABLE_STATIC_TASK_CLEAN_UP=y

# Heap — use multi-heap for better fragmentation resistance
CONFIG_HEAP_POISONING_COMPREHENSIVE=y
CONFIG_HEAP_TRACING_STANDALONE=y

# Task watchdog
CONFIG_ESP_TASK_WDT_EN=y
CONFIG_ESP_TASK_WDT_TIMEOUT_S=30
CONFIG_ESP_TASK_WDT_PANIC=y

# SD card
CONFIG_FATFS_LFN_HEAP=y
CONFIG_FATFS_MAX_LFN=63

# ESP Timer — use hardware timer for accurate periodic callbacks
CONFIG_ESP_TIMER_SUPPORTS_ISR_DISPATCH_METHOD=y

# Optimization
CONFIG_COMPILER_OPTIMIZATION_PERF=y

# Stack overflow detection
CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y

# Panic handler — print and reboot
CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT=y

# Log level — WARN for production to reduce UART overhead
CONFIG_LOG_DEFAULT_LEVEL_WARN=y
```

## Why Each Design Decision Matters

### 1. Zero Dynamic Allocation at Runtime

| Original (broken)         | Fixed                          |
|---------------------------|--------------------------------|
| `std::vector::push_back()`| Static `StreamBuffer`          |
| `std::string` for CSV     | `snprintf()` into `char[]`     |
| `new`/`delete` per cycle  | All buffers sized at compile time |

The ESP32-S3 has ~512KB of usable RAM. With `std::vector` growing and shrinking, after millions of cycles the heap fragments. Even if you have 100KB free total, you can't allocate a contiguous 1KB block.

### 2. FreeRTOS StreamBuffer (not Queue or Mutex)

- **Lock-free** for single-producer, single-consumer (your exact case)
- No mutex contention between ADC reader and SD writer
- Better than a ring buffer you'd implement yourself because it handles wrap-around and memory barriers correctly

### 3. Hardware Timer for Precise 100Hz

Using `vTaskDelay(pdMS_TO_TICKS(10))` drifts because:
- FreeRTOS tick is 1ms resolution, your period is 10ms
- Task scheduling adds jitter
- Any higher-priority task delays you

The `esp_timer` with ISR dispatch gives microsecond-accurate periodic triggers.

### 4. Pinned Tasks to Separate Cores

- **Core 1**: ADC reader (time-critical, must not be delayed)
- **Core 0**: SD writer (can tolerate latency, SD writes can block for 10-100ms)

This prevents SD card write stalls from causing missed ADC samples.

### 5. Batch SD Writes

Writing 1000 lines in one `fwrite()` call instead of 1000 individual writes:
- Reduces SD card wear (fewer erase cycles)
- Reduces filesystem overhead
- One `fflush()` per batch, not per sample

### 6. SD Card Error Recovery

SD cards can have transient errors (contact issues, voltage dips, card-level timeouts). The code handles:
- Single write failure: close and reopen file
- Multiple failures: unmount and remount the card
- Data in the stream buffer is preserved during recovery

### 7. Watchdog on Both Tasks

If either task hangs (e.g., SD card blocks indefinitely), the task watchdog triggers a controlled reboot rather than silently hanging.

### 8. Static Task Allocation

`xTaskCreateStatic()` instead of `xTaskCreate()` — the task stacks and TCBs come from static arrays, not the heap. This eliminates another source of fragmentation.

## Memory Budget

| Component                  | Size       |
|----------------------------|------------|
| Stream buffer              | ~20 KB     |
| SD write buffer            | 80 KB      |
| ADC task stack             | 4 KB       |
| SD writer task stack       | 8 KB       |
| **Total static**           | **~112 KB** |
| Remaining for ESP-IDF/WiFi | ~400 KB    |

## Diagnostic Checklist for Production

After deploying, monitor these via the `logger_stats_t`:

1. **`samples_dropped > 0`** — Stream buffer overflowed. Increase `RING_BUFFER_SAMPLES` or investigate SD write latency.
2. **`sd_write_errors > 0`** — SD card issues. Check physical connection, card quality.
3. **`min_free_heap` declining over time** — Heap leak somewhere (shouldn't happen with this design, but useful to verify).
4. **`samples_captured - samples_written - samples_dropped != 0`** — Accounting bug; investigate.

This design should run indefinitely without heap fragmentation crashes. The key insight is that every byte of RAM used at runtime is allocated once at boot and never freed.
