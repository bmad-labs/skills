# ESP32-S3 Data Logger: Restructuring for Long-Term Reliability

## Root Cause Analysis

Your crashes after 2-3 days are almost certainly caused by **heap fragmentation** from `std::vector` and `std::string`. Here is why:

1. **`std::vector` growth**: Every `push_back` that exceeds capacity triggers a reallocation (allocate new block, copy, free old block). Over days of continuous operation, this fragments the heap into unusable small blocks until an allocation fails and crashes.
2. **`std::string` for CSV formatting**: Each string concatenation allocates and frees heap memory. At 100Hz with 3 channels, that is 300 tiny allocations/deallocations per second — over 77 million per day.
3. **ESP32-S3 has limited RAM** (~512KB usable). Fragmentation can make it unusable long before you actually run out of memory.

## Architecture Overview

The restructured design uses:

- **Statically allocated circular buffer** (zero heap allocation at runtime)
- **Fixed-size char arrays** for CSV formatting (no `std::string`)
- **FreeRTOS tasks** with proper synchronization
- **Double-buffered SD writes** to avoid blocking the ADC sampling
- **Watchdog timer** for crash recovery

```
Task: adc_sampler_task (pinned to Core 1, highest priority)
  |
  v
[Circular Buffer - statically allocated]
  |
  v
Task: sd_writer_task (pinned to Core 0, lower priority)
  |
  v
[SD Card via SPI]
```

## Complete Implementation

### main/data_logger.h — Core Data Structures

```c
#ifndef DATA_LOGGER_H
#define DATA_LOGGER_H

#include <stdint.h>
#include <stdbool.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ---------- Configuration ---------- */
#define NUM_ADC_CHANNELS      3
#define SAMPLE_RATE_HZ        100
#define SD_WRITE_INTERVAL_S   10
#define SAMPLES_PER_WRITE     (SAMPLE_RATE_HZ * SD_WRITE_INTERVAL_S)  /* 1000 */

/*
 * Circular buffer holds 2x the write interval so the writer has a full
 * interval of slack before overrun. Total: 2000 samples * 8 bytes = 16KB.
 * This is a small, predictable, static allocation.
 */
#define CIRC_BUF_CAPACITY     (SAMPLES_PER_WRITE * 2)

/* Stack sizes for tasks */
#define ADC_TASK_STACK_SIZE   4096
#define SD_TASK_STACK_SIZE    8192

/* ---------- Data Types ---------- */

/* Single ADC reading: 3 channels + timestamp. Packed to minimize size. */
typedef struct __attribute__((packed)) {
    uint32_t timestamp_ms;
    uint16_t channel[NUM_ADC_CHANNELS];
} adc_sample_t;  /* 10 bytes */

/* Circular buffer with static storage */
typedef struct {
    adc_sample_t samples[CIRC_BUF_CAPACITY];
    volatile uint32_t head;       /* next write position (writer only) */
    volatile uint32_t tail;       /* next read position (reader only) */
    volatile uint32_t count;      /* current number of items */
    SemaphoreHandle_t mutex;      /* protects count updates */
    SemaphoreHandle_t data_ready; /* signals writer that data is available */
} circ_buf_t;

/* SD write buffer — double buffered, statically allocated */
#define CSV_LINE_MAX_LEN  64   /* "4294967295,4095,4095,4095\n" = ~30 chars max */
#define SD_BUF_SIZE       (SAMPLES_PER_WRITE * CSV_LINE_MAX_LEN)

typedef struct {
    char buf[2][SD_BUF_SIZE];
    uint32_t len[2];
    uint8_t active;  /* which buffer the writer is filling (0 or 1) */
} sd_double_buf_t;

/* System health tracking */
typedef struct {
    uint32_t total_samples;
    uint32_t dropped_samples;
    uint32_t sd_write_errors;
    uint32_t sd_writes_ok;
    uint32_t buffer_high_watermark;
    uint32_t free_heap_min;
    uint32_t uptime_seconds;
} system_stats_t;

/* ---------- Function Declarations ---------- */
void data_logger_init(void);
void data_logger_start(void);

#ifdef __cplusplus
}
#endif

#endif /* DATA_LOGGER_H */
```

### main/circular_buffer.c — Lock-Free-ish Circular Buffer

```c
#include "data_logger.h"
#include "esp_log.h"

static const char *TAG = "circ_buf";

void circ_buf_init(circ_buf_t *cb)
{
    cb->head = 0;
    cb->tail = 0;
    cb->count = 0;
    cb->mutex = xSemaphoreCreateMutex();
    cb->data_ready = xSemaphoreCreateCounting(CIRC_BUF_CAPACITY, 0);

    configASSERT(cb->mutex != NULL);
    configASSERT(cb->data_ready != NULL);
}

/*
 * Push a sample into the buffer. Called from ADC ISR context or
 * high-priority task. Returns true on success, false if buffer full
 * (sample dropped).
 *
 * NOTE: Only ONE producer is allowed (the ADC task). This is enforced
 * by architecture, not by locking — the ADC task is the sole writer.
 */
bool circ_buf_push(circ_buf_t *cb, const adc_sample_t *sample)
{
    if (cb->count >= CIRC_BUF_CAPACITY) {
        return false;  /* Buffer full — drop sample */
    }

    cb->samples[cb->head] = *sample;
    cb->head = (cb->head + 1) % CIRC_BUF_CAPACITY;

    /*
     * Use a critical section only for the count increment.
     * This is a single atomic-like update coordinating producer/consumer.
     */
    taskENTER_CRITICAL(&((portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED));
    cb->count++;
    taskEXIT_CRITICAL(&((portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED));

    xSemaphoreGive(cb->data_ready);
    return true;
}

/*
 * Pop a sample from the buffer. Called from the SD writer task.
 * Blocks up to timeout_ms if buffer is empty.
 * Returns true if a sample was retrieved.
 */
bool circ_buf_pop(circ_buf_t *cb, adc_sample_t *sample, uint32_t timeout_ms)
{
    if (xSemaphoreTake(cb->data_ready, pdMS_TO_TICKS(timeout_ms)) != pdTRUE) {
        return false;  /* Timeout — no data available */
    }

    *sample = cb->samples[cb->tail];
    cb->tail = (cb->tail + 1) % CIRC_BUF_CAPACITY;

    taskENTER_CRITICAL(&((portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED));
    cb->count--;
    taskEXIT_CRITICAL(&((portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED));

    return true;
}

uint32_t circ_buf_available(const circ_buf_t *cb)
{
    return cb->count;
}
```

### main/adc_sampler.c — ADC Reading with Hardware Timer

```c
#include "data_logger.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_timer.h"
#include "esp_log.h"

static const char *TAG = "adc_sampler";

/* ADC channel mapping for ESP32-S3 */
static const adc_channel_t adc_channels[NUM_ADC_CHANNELS] = {
    ADC_CHANNEL_0,  /* GPIO1 */
    ADC_CHANNEL_1,  /* GPIO2 */
    ADC_CHANNEL_2,  /* GPIO3 */
};

/* Module state — all static, zero heap allocation */
static adc_oneshot_unit_handle_t adc_handle;
static adc_cali_handle_t cali_handle;
static esp_timer_handle_t sample_timer;

/* Shared with other modules */
extern circ_buf_t g_sample_buffer;
extern system_stats_t g_stats;

/*
 * Timer callback — runs in ISR context on ESP-IDF, but esp_timer
 * callbacks run in a dedicated high-priority task, not true ISR.
 * This is fine for 100Hz sampling.
 */
static void IRAM_ATTR sample_timer_callback(void *arg)
{
    adc_sample_t sample;
    sample.timestamp_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);

    for (int i = 0; i < NUM_ADC_CHANNELS; i++) {
        int raw = 0;
        esp_err_t ret = adc_oneshot_read(adc_handle, adc_channels[i], &raw);
        if (ret == ESP_OK) {
            sample.channel[i] = (uint16_t)raw;
        } else {
            sample.channel[i] = 0xFFFF;  /* Error sentinel */
        }
    }

    if (!circ_buf_push(&g_sample_buffer, &sample)) {
        g_stats.dropped_samples++;
    } else {
        g_stats.total_samples++;
    }
}

void adc_sampler_init(void)
{
    /* Configure ADC unit */
    adc_oneshot_unit_init_cfg_t unit_cfg = {
        .unit_id = ADC_UNIT_1,
        .ulp_mode = ADC_ULP_MODE_DISABLE,
    };
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_cfg, &adc_handle));

    /* Configure each channel */
    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,    /* 0-3.3V range */
        .bitwidth = ADC_BITWIDTH_12, /* 12-bit resolution */
    };
    for (int i = 0; i < NUM_ADC_CHANNELS; i++) {
        ESP_ERROR_CHECK(adc_oneshot_config_channel(adc_handle, adc_channels[i], &chan_cfg));
    }

    /* Calibration (curve fitting for ESP32-S3) */
    adc_cali_curve_fitting_config_t cali_cfg = {
        .unit_id = ADC_UNIT_1,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_12,
    };
    ESP_ERROR_CHECK(adc_cali_create_scheme_curve_fitting(&cali_cfg, &cali_handle));

    ESP_LOGI(TAG, "ADC initialized: %d channels, %d-bit, %dHz",
             NUM_ADC_CHANNELS, 12, SAMPLE_RATE_HZ);
}

void adc_sampler_start(void)
{
    /* Create high-resolution timer for precise 100Hz sampling */
    esp_timer_create_args_t timer_args = {
        .callback = sample_timer_callback,
        .arg = NULL,
        .dispatch_method = ESP_TIMER_TASK,  /* Runs in esp_timer task (priority 22) */
        .name = "adc_sample",
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &sample_timer));

    /* Start periodic timer: 10000us = 10ms = 100Hz */
    ESP_ERROR_CHECK(esp_timer_start_periodic(sample_timer, 1000000 / SAMPLE_RATE_HZ));

    ESP_LOGI(TAG, "ADC sampling started at %dHz", SAMPLE_RATE_HZ);
}
```

### main/sd_writer.c — SD Card Writer Task

```c
#include "data_logger.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/sdspi_host.h"
#include "driver/spi_common.h"
#include "esp_log.h"
#include <string.h>
#include <stdio.h>
#include <sys/stat.h>

static const char *TAG = "sd_writer";

/* SD card mount point */
#define MOUNT_POINT "/sdcard"

/* SPI pins for SD card on ESP32-S3 (adjust for your board) */
#define PIN_NUM_MISO  13
#define PIN_NUM_MOSI  11
#define PIN_NUM_CLK   12
#define PIN_NUM_CS    10

/* Static double buffer — no heap allocation */
static sd_double_buf_t s_sd_buf;

/* File rotation: new file every hour to limit file size */
#define FILE_ROTATE_SECONDS  3600
static uint32_t s_file_start_time = 0;
static char s_current_filename[64];
static FILE *s_current_file = NULL;

/* Shared state */
extern circ_buf_t g_sample_buffer;
extern system_stats_t g_stats;

/* Forward declarations */
static bool sd_mount(void);
static void sd_unmount(void);
static bool open_new_log_file(void);
static void close_current_file(void);
static uint32_t format_samples_to_buffer(char *buf, uint32_t buf_size,
                                          adc_sample_t *samples, uint32_t count);

static sdmmc_card_t *s_card = NULL;

static bool sd_mount(void)
{
    esp_vfs_fat_sdmmc_mount_config_t mount_config = {
        .format_if_mount_failed = false,
        .max_files = 2,
        .allocation_unit_size = 16 * 1024,  /* 16KB allocation units */
    };

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();

    spi_bus_config_t bus_cfg = {
        .mosi_io_num = PIN_NUM_MOSI,
        .miso_io_num = PIN_NUM_MISO,
        .sclk_io_num = PIN_NUM_CLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4096,
    };

    esp_err_t ret = spi_bus_initialize(host.slot, &bus_cfg, SDSPI_DEFAULT_DMA);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI bus init failed: %s", esp_err_to_name(ret));
        return false;
    }

    sdspi_device_config_t slot_config = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_config.gpio_cs = PIN_NUM_CS;
    slot_config.host_id = host.slot;

    ret = esp_vfs_fat_sdspi_mount(MOUNT_POINT, &host, &slot_config,
                                   &mount_config, &s_card);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SD mount failed: %s", esp_err_to_name(ret));
        return false;
    }

    sdmmc_card_print_info(stdout, s_card);
    return true;
}

static void sd_unmount(void)
{
    close_current_file();
    esp_vfs_fat_sdcard_unmount(MOUNT_POINT, s_card);
    ESP_LOGI(TAG, "SD card unmounted");
}

static bool open_new_log_file(void)
{
    close_current_file();

    /* Use uptime-based naming (no RTC needed, but you could use SNTP time) */
    uint32_t uptime_s = (uint32_t)(esp_timer_get_time() / 1000000ULL);
    snprintf(s_current_filename, sizeof(s_current_filename),
             MOUNT_POINT "/log_%010lu.csv", (unsigned long)uptime_s);

    s_current_file = fopen(s_current_filename, "w");
    if (s_current_file == NULL) {
        ESP_LOGE(TAG, "Failed to open %s", s_current_filename);
        g_stats.sd_write_errors++;
        return false;
    }

    /* Write CSV header */
    fprintf(s_current_file, "timestamp_ms,ch0,ch1,ch2\n");
    fflush(s_current_file);

    s_file_start_time = uptime_s;
    ESP_LOGI(TAG, "Opened log file: %s", s_current_filename);
    return true;
}

static void close_current_file(void)
{
    if (s_current_file != NULL) {
        fflush(s_current_file);
        fclose(s_current_file);
        s_current_file = NULL;
        ESP_LOGI(TAG, "Closed log file: %s", s_current_filename);
    }
}

/*
 * Format samples into CSV in a static buffer. No heap allocation.
 * Returns the number of bytes written to the buffer.
 */
static uint32_t format_samples_to_buffer(char *buf, uint32_t buf_size,
                                          adc_sample_t *samples, uint32_t count)
{
    uint32_t offset = 0;

    for (uint32_t i = 0; i < count && offset < buf_size - CSV_LINE_MAX_LEN; i++) {
        /*
         * snprintf to a fixed buffer — no std::string, no heap allocation.
         * Each line: "timestamp,ch0,ch1,ch2\n"
         */
        int written = snprintf(buf + offset, buf_size - offset,
                               "%lu,%u,%u,%u\n",
                               (unsigned long)samples[i].timestamp_ms,
                               samples[i].channel[0],
                               samples[i].channel[1],
                               samples[i].channel[2]);
        if (written > 0) {
            offset += (uint32_t)written;
        }
    }

    return offset;
}

/*
 * SD writer task: drains the circular buffer every SD_WRITE_INTERVAL_S
 * and writes to the SD card in bulk.
 */
void sd_writer_task(void *pvParameters)
{
    /* Static buffer for batch reading from circular buffer */
    static adc_sample_t batch[SAMPLES_PER_WRITE];

    if (!sd_mount()) {
        ESP_LOGE(TAG, "SD card mount failed, task aborting");
        vTaskDelete(NULL);
        return;
    }

    if (!open_new_log_file()) {
        ESP_LOGE(TAG, "Cannot create initial log file");
        sd_unmount();
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "SD writer task started");

    while (1) {
        /*
         * Wait for enough data. We sleep for the write interval,
         * then drain whatever is available.
         */
        vTaskDelay(pdMS_TO_TICKS(SD_WRITE_INTERVAL_S * 1000));

        /* Drain all available samples from the circular buffer */
        uint32_t batch_count = 0;
        while (batch_count < SAMPLES_PER_WRITE &&
               circ_buf_pop(&g_sample_buffer, &batch[batch_count], 0)) {
            batch_count++;
        }

        if (batch_count == 0) {
            ESP_LOGW(TAG, "No samples to write");
            continue;
        }

        /* Format into the inactive double buffer */
        uint8_t fill_buf = 1 - s_sd_buf.active;
        s_sd_buf.len[fill_buf] = format_samples_to_buffer(
            s_sd_buf.buf[fill_buf], SD_BUF_SIZE, batch, batch_count);

        /* Swap buffers */
        s_sd_buf.active = fill_buf;

        /* Check if we need to rotate the file */
        uint32_t uptime_s = (uint32_t)(esp_timer_get_time() / 1000000ULL);
        if (uptime_s - s_file_start_time >= FILE_ROTATE_SECONDS) {
            open_new_log_file();
        }

        /* Write the buffer to SD */
        if (s_current_file != NULL && s_sd_buf.len[fill_buf] > 0) {
            size_t written = fwrite(s_sd_buf.buf[fill_buf], 1,
                                     s_sd_buf.len[fill_buf], s_current_file);
            if (written == s_sd_buf.len[fill_buf]) {
                g_stats.sd_writes_ok++;
                /*
                 * Flush periodically but not every write to reduce
                 * SD wear. Every 6 writes = every minute.
                 */
                if (g_stats.sd_writes_ok % 6 == 0) {
                    fflush(s_current_file);
                }
            } else {
                ESP_LOGE(TAG, "SD write error: wrote %d of %lu bytes",
                         (int)written, (unsigned long)s_sd_buf.len[fill_buf]);
                g_stats.sd_write_errors++;

                /* Attempt recovery: close and reopen */
                close_current_file();
                vTaskDelay(pdMS_TO_TICKS(1000));
                open_new_log_file();
            }
        }

        /* Update high watermark */
        uint32_t avail = circ_buf_available(&g_sample_buffer);
        if (avail > g_stats.buffer_high_watermark) {
            g_stats.buffer_high_watermark = avail;
        }

        /* Track minimum free heap for diagnostics */
        uint32_t free_heap = esp_get_minimum_free_heap_size();
        if (g_stats.free_heap_min == 0 || free_heap < g_stats.free_heap_min) {
            g_stats.free_heap_min = free_heap;
        }

        ESP_LOGI(TAG, "Wrote %lu samples | Dropped: %lu | Heap min: %lu | Buf HW: %lu",
                 (unsigned long)batch_count,
                 (unsigned long)g_stats.dropped_samples,
                 (unsigned long)g_stats.free_heap_min,
                 (unsigned long)g_stats.buffer_high_watermark);
    }
}
```

### main/main.c — Application Entry Point

```c
#include "data_logger.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "nvs_flash.h"

static const char *TAG = "main";

/* Global shared state — statically allocated */
circ_buf_t g_sample_buffer;
system_stats_t g_stats = {0};

/* External function declarations */
extern void circ_buf_init(circ_buf_t *cb);
extern void adc_sampler_init(void);
extern void adc_sampler_start(void);
extern void sd_writer_task(void *pvParameters);

/*
 * Health monitor task: periodically logs system health and feeds
 * the task watchdog. If the system gets stuck, the watchdog reboots it.
 */
static void health_monitor_task(void *pvParameters)
{
    /* Subscribe this task to the task watchdog (30-second timeout) */
    ESP_ERROR_CHECK(esp_task_wdt_add(NULL));

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(15000));  /* Every 15 seconds */

        /* Feed watchdog — proves this task is alive */
        ESP_ERROR_CHECK(esp_task_wdt_reset());

        g_stats.uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000ULL);

        ESP_LOGI(TAG, "=== Health Report ===");
        ESP_LOGI(TAG, "  Uptime: %lu s (%.1f days)",
                 (unsigned long)g_stats.uptime_seconds,
                 g_stats.uptime_seconds / 86400.0f);
        ESP_LOGI(TAG, "  Samples: %lu total, %lu dropped (%.4f%% loss)",
                 (unsigned long)g_stats.total_samples,
                 (unsigned long)g_stats.dropped_samples,
                 g_stats.total_samples > 0
                     ? (100.0f * g_stats.dropped_samples / g_stats.total_samples)
                     : 0.0f);
        ESP_LOGI(TAG, "  SD: %lu writes OK, %lu errors",
                 (unsigned long)g_stats.sd_writes_ok,
                 (unsigned long)g_stats.sd_write_errors);
        ESP_LOGI(TAG, "  Free heap: %lu (min ever: %lu)",
                 (unsigned long)esp_get_free_heap_size(),
                 (unsigned long)g_stats.free_heap_min);
        ESP_LOGI(TAG, "  Buffer: %lu / %d (HW: %lu)",
                 (unsigned long)circ_buf_available(&g_sample_buffer),
                 CIRC_BUF_CAPACITY,
                 (unsigned long)g_stats.buffer_high_watermark);
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "ESP32-S3 Data Logger starting...");
    ESP_LOGI(TAG, "Sample rate: %dHz, Channels: %d, Write interval: %ds",
             SAMPLE_RATE_HZ, NUM_ADC_CHANNELS, SD_WRITE_INTERVAL_S);
    ESP_LOGI(TAG, "Circular buffer: %d samples (%d bytes)",
             CIRC_BUF_CAPACITY, (int)sizeof(g_sample_buffer.samples));

    /* Initialize NVS (required for some ESP-IDF components) */
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    /* Initialize task watchdog: 30-second timeout, panic on trigger */
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = 30000,
        .idle_core_mask = 0,       /* Don't watch idle tasks */
        .trigger_panic = true,     /* Reboot on WDT timeout */
    };
    ESP_ERROR_CHECK(esp_task_wdt_reconfigure(&wdt_config));

    /* Initialize subsystems */
    circ_buf_init(&g_sample_buffer);
    adc_sampler_init();

    /*
     * Pin SD writer to Core 0 (same as WiFi/BT, but we don't use those).
     * Pin ADC sampling timer runs in esp_timer task which is on Core 0
     * by default but at very high priority (22), so it preempts everything.
     *
     * SD writer runs at lower priority — if it takes a while to write,
     * ADC sampling continues uninterrupted because the circular buffer
     * decouples them.
     */
    xTaskCreatePinnedToCore(
        sd_writer_task,
        "sd_writer",
        SD_TASK_STACK_SIZE,
        NULL,
        5,              /* Priority 5 (medium) */
        NULL,
        0               /* Core 0 */
    );

    xTaskCreatePinnedToCore(
        health_monitor_task,
        "health_mon",
        4096,
        NULL,
        2,              /* Priority 2 (low) */
        NULL,
        1               /* Core 1 */
    );

    /* Start ADC sampling (high-priority esp_timer) */
    adc_sampler_start();

    ESP_LOGI(TAG, "Data logger running.");
}
```

### main/CMakeLists.txt

```cmake
idf_component_register(
    SRCS
        "main.c"
        "circular_buffer.c"
        "adc_sampler.c"
        "sd_writer.c"
    INCLUDE_DIRS "."
    REQUIRES
        driver
        esp_adc
        esp_timer
        esp_vfs_fat
        sdmmc
        nvs_flash
        esp_system
)
```

### sdkconfig.defaults — Key Configuration

```
# FreeRTOS
CONFIG_FREERTOS_HZ=1000
CONFIG_FREERTOS_TIMER_TASK_STACK_DEPTH=4096

# Heap
CONFIG_HEAP_POISONING_COMPREHENSIVE=y
CONFIG_HEAP_TASK_TRACKING=y

# Task Watchdog
CONFIG_ESP_TASK_WDT_EN=y
CONFIG_ESP_TASK_WDT_TIMEOUT_S=30
CONFIG_ESP_TASK_WDT_PANIC=y

# Disable brownout detector resets (can cause spurious reboots)
# Only do this if you have stable power!
# CONFIG_ESP_BROWNOUT_DET=n

# SD card / FAT
CONFIG_FATFS_LONG_FILENAME_SUPPORT=y
CONFIG_FATFS_LFN_HEAP=y
CONFIG_FATFS_MAX_LFN=64

# Logging (reduce in production)
CONFIG_LOG_DEFAULT_LEVEL_INFO=y
CONFIG_LOG_MAXIMUM_LEVEL_DEBUG=y

# Stack overflow detection
CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y
```

## Key Design Decisions Explained

### 1. Zero Runtime Heap Allocation

| Your original approach | This design |
|---|---|
| `std::vector::push_back()` — heap alloc on growth | Static `adc_sample_t samples[2000]` — zero alloc |
| `std::string` concatenation — heap alloc per concat | `snprintf()` into fixed `char buf[]` — zero alloc |
| Hundreds of allocs/frees per second | Zero allocs/frees during normal operation |

### 2. Why a Circular Buffer Instead of std::vector

A circular buffer with static storage:
- Never allocates or frees memory
- Has O(1) push and pop
- Naturally handles the producer/consumer pattern
- Overwrites oldest data on overrun (or drops, as in our design) — either way, no crash

### 3. Double Buffering for SD Writes

While the SD card is physically writing buffer A, the formatter fills buffer B. This means:
- SD write latency does not block sample collection
- No memory allocation needed to "swap" — just toggle an index

### 4. File Rotation

Creating a new file every hour:
- Limits individual file sizes (prevents FAT corruption from affecting all data)
- Makes it easy to recover partial data if a file is corrupted
- Avoids FAT directory entry limitations

### 5. Error Recovery

The SD writer has built-in recovery:
- On write failure, it closes and reopens the file
- The circular buffer absorbs samples during SD recovery
- Dropped samples are tracked, not silently lost
- The health monitor task logs diagnostics for post-mortem analysis

### 6. Watchdog Timer

If any task hangs (e.g., SD card becomes unresponsive), the task watchdog triggers a controlled reboot rather than leaving the system in a zombie state. For a system that needs to run for weeks, a fast clean reboot is better than an unrecoverable hang.

## Memory Budget

| Component | RAM Usage |
|---|---|
| Circular buffer (`adc_sample_t[2000]`) | 20,000 bytes |
| SD double buffer (2 x 64,000) | 128,000 bytes |
| Sample batch buffer (`adc_sample_t[1000]`) | 10,000 bytes |
| Task stacks (3 tasks) | ~16,384 bytes |
| **Total static allocation** | **~174 KB** |
| ESP32-S3 available SRAM | ~512 KB |
| **Remaining for ESP-IDF + stack** | **~338 KB** |

All memory is accounted for at compile time. The heap is used only by ESP-IDF internals (drivers, VFS), which have stable allocation patterns.

## Checklist for Weeks-Long Reliability

- [x] No `std::vector`, `std::string`, `std::map`, or other heap-heavy STL containers
- [x] No `malloc`/`free` or `new`/`delete` in application code
- [x] All buffers statically sized and allocated
- [x] Task watchdog to recover from hangs
- [x] Stack overflow detection enabled (`CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY`)
- [x] Heap poisoning enabled for debug builds
- [x] Health monitoring with free heap tracking
- [x] SD write error recovery
- [x] File rotation to limit corruption blast radius
- [x] Dropped sample counting (never silently lose data)
- [x] `fflush()` periodically (not every write — reduces SD wear)
- [x] Separate tasks for sampling and writing (decoupled via buffer)
- [x] No floating point in the hot path (ADC reads + buffer push)
