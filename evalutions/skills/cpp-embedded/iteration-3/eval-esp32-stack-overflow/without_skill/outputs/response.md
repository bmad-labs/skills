# Debugging and Fixing ESP32 FreeRTOS Stack Overflow Crashes

## Root Cause Analysis

The core problem is that **2048 bytes is far too small** for most ESP32 tasks, especially those involving WiFi, BLE, or MQTT. Here's why:

- **ESP32 WiFi stack** internally requires significant stack space. WiFi event handlers and callbacks can consume 3-4 KB on their own.
- **BLE (NimBLE/Bluedroid)** is even more demanding. Bluedroid in particular can require 4-8 KB for its internal operations.
- **MQTT client** tasks involve TLS/SSL handshakes (if using secure MQTT), JSON parsing, and buffer handling, each of which can spike stack usage significantly.
- When **both WiFi and BLE are active**, the shared radio (the ESP32 has a single 2.4 GHz radio) requires coexistence arbitration, which adds additional stack pressure to callbacks and event handlers.

## Step 1: Enable Stack Overflow Detection

First, make sure FreeRTOS stack overflow checking is enabled in your `sdkconfig` (or via `menuconfig`):

```
CONFIG_FREERTOS_CHECK_STACKOVERFLOW=y
CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y
```

Or via `idf.py menuconfig`:
- Component config -> FreeRTOS -> Check for stack overflow -> Option 2 (canary)

**Option 2 (canary)** is preferred because it writes a known pattern to the end of the stack and checks it on every context switch. Option 1 only checks the stack pointer, which can miss overflows that happen mid-function and recover before the context switch.

You can also install a hook to get useful debug output:

```c
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName)
{
    printf("Stack overflow in task: %s\n", pcTaskName);
    // Optionally log to NVS or trigger a core dump
    esp_system_abort("Stack overflow");
}
```

## Step 2: Measure Actual Stack Usage (High Water Mark)

Before blindly increasing stack sizes, measure what each task actually needs. Use `uxTaskGetStackHighWaterMark()`:

```c
void monitor_task(void *pvParameters)
{
    while (1) {
        TaskStatus_t task_status[15];
        UBaseType_t task_count = uxTaskGetNumberOfTasks();

        if (task_count <= 15) {
            uxTaskGetSystemState(task_status, task_count, NULL);

            printf("\n--- Stack High Water Marks ---\n");
            for (int i = 0; i < task_count; i++) {
                printf("Task: %-20s | Free stack: %5u bytes | State: %d\n",
                       task_status[i].pcTaskName,
                       task_status[i].usStackHighWaterMark * sizeof(StackType_t),
                       task_status[i].eCurrentState);
            }
        }

        // Also print free heap
        printf("Free heap: %u bytes, min ever: %u bytes\n",
               esp_get_free_heap_size(),
               esp_get_minimum_free_heap_size());

        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}
```

You can also check individual tasks inline:

```c
UBaseType_t remaining = uxTaskGetStackHighWaterMark(NULL); // NULL = current task
ESP_LOGW(TAG, "Stack remaining: %u words (%u bytes)", remaining, remaining * 4);
```

**Important:** The high water mark shows the *minimum* free stack ever recorded. If it drops below ~200 bytes, you are at serious risk.

## Step 3: Set Appropriate Stack Sizes

Based on typical ESP32-IDF requirements, here are recommended **minimum** stack sizes:

| Task Type | Minimum Stack | Recommended |
|-----------|--------------|-------------|
| Simple GPIO/sensor polling | 2048 | 2560 |
| UART communication | 2048 | 3072 |
| MQTT (no TLS) | 4096 | 5120 |
| MQTT (with TLS) | 8192 | 10240 |
| WiFi event handler | 3584 | 4096 |
| BLE (NimBLE) | 4096 | 5120 |
| BLE (Bluedroid) | 6144 | 8192 |
| HTTP/HTTPS client | 6144 | 8192 |
| JSON parsing (large docs) | 4096+ | depends on doc size |
| Task doing printf/logging | 2048+ | 3072 |

Update your task creation calls:

```c
// Instead of 2048 for everything:
#define MQTT_TASK_STACK_SIZE    (8192)
#define BLE_HANDLER_STACK_SIZE  (5120)
#define WIFI_HANDLER_STACK_SIZE (4096)
#define SENSOR_TASK_STACK_SIZE  (3072)

xTaskCreate(mqtt_task, "mqtt_task", MQTT_TASK_STACK_SIZE, NULL, 5, &mqtt_handle);
xTaskCreate(ble_handler, "ble_handler", BLE_HANDLER_STACK_SIZE, NULL, 4, &ble_handle);
```

## Step 4: Reduce Stack Usage (If RAM Is Tight)

The ESP32 has limited RAM (~320 KB total, less with WiFi+BLE active). If you cannot afford large stacks for all tasks, reduce per-task stack consumption:

### Move large buffers off the stack

```c
// BAD: Large buffer on stack
void mqtt_callback(const char *topic, const char *data, int len)
{
    char buffer[1024];  // This eats 1 KB of stack!
    char json_buf[512]; // Another 512 bytes gone
    // ...
}

// GOOD: Use heap allocation or static buffers
void mqtt_callback(const char *topic, const char *data, int len)
{
    char *buffer = malloc(1024);
    if (buffer == NULL) {
        ESP_LOGE(TAG, "malloc failed");
        return;
    }
    // ... use buffer ...
    free(buffer);
}

// GOOD: Use a static buffer if only one instance runs at a time
void mqtt_callback(const char *topic, const char *data, int len)
{
    static char buffer[1024]; // Not on the stack, but NOT thread-safe
    // Use mutex if needed
}
```

### Avoid deep call chains and recursion

```c
// BAD: recursive JSON parsing on embedded
void parse_nested(cJSON *node, int depth) {
    if (node->child) parse_nested(node->child, depth + 1);
    // Each recursion level adds stack frame overhead
}

// GOOD: iterative approach
void parse_flat(cJSON *root) {
    cJSON *current = root->child;
    while (current) {
        // process current
        current = current->next;
    }
}
```

### Reduce logging in tight loops

`ESP_LOGI` / `printf` and friends use significant stack space (typically 200-400 bytes for formatting). Reduce or eliminate logging in stack-constrained tasks, or use simpler logging mechanisms.

## Step 5: Check ESP-IDF Internal Task Stacks

Some ESP-IDF components create their own internal tasks. You can configure their stack sizes through `menuconfig`:

```
# WiFi
CONFIG_ESP_WIFI_TASK_STACK_SIZE=4096

# MQTT (if using esp-mqtt)
# Set via esp_mqtt_client_config_t.task_stack

# BLE Controller
CONFIG_BT_CTRL_TASK_STACK_SIZE=4096

# BLE Host (NimBLE)
CONFIG_BT_NIMBLE_TASK_STACK_SIZE=5120
```

For the MQTT client specifically, set it at initialization:

```c
esp_mqtt_client_config_t mqtt_cfg = {
    .broker.address.uri = "mqtts://broker.example.com",
    .task.stack_size = 8192,  // Increase from default
    // ...
};
```

## Step 6: Monitor and Tune at Runtime

Create a lightweight monitoring system that logs high water marks periodically. Once your system is running stably, you can reduce stack sizes to save RAM but always maintain a safety margin of at least 15-20%.

```c
// Calculate optimal stack size
// optimal = (peak_usage) + (peak_usage * 0.20) for 20% safety margin
// where peak_usage = (allocated - high_water_mark)
uint32_t peak = stack_allocated - (high_water_mark * 4);
uint32_t optimal = peak + (peak / 5); // 20% margin
```

## Step 7: Use Core Dumps for Post-Mortem Analysis

Enable core dumps to flash or UART to capture the exact state at crash time:

```
CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH=y
CONFIG_ESP_COREDUMP_DATA_FORMAT_ELF=y
```

After a crash, retrieve and analyze:

```bash
# Extract core dump from flash
espcoredump.py info_corefile -t raw -c core.bin build/your_project.elf

# Or if configured to UART, it prints base64 on serial
espcoredump.py info_corefile -t b64 -c core_dump.b64 build/your_project.elf
```

The core dump will show you the exact call stack at the point of overflow, which tells you exactly which function chain consumed the most stack.

## Step 8: Consider Architecture Changes

If you are running out of total RAM with proper stack sizes, consider:

1. **Consolidate tasks**: Merge related tasks. Instead of 6 separate tasks, can some be combined into an event-driven loop?

2. **Use NimBLE instead of Bluedroid**: NimBLE uses significantly less RAM and stack space (~50% less) than Bluedroid.

3. **Time-slice WiFi and BLE**: If you don't need both simultaneously at all times, disable one while the other is active:
   ```c
   // Disable BLE during heavy WiFi usage
   esp_bt_controller_disable();
   // ... do WiFi work ...
   esp_bt_controller_enable(ESP_BT_MODE_BLE);
   ```

4. **Use PSRAM** (if your board has it) for heap allocations, leaving internal RAM for stacks:
   ```
   CONFIG_SPIRAM_USE_CAPS_ALLOC=y
   ```
   Note: FreeRTOS task stacks must be in internal RAM by default on ESP32, but you can place other allocations in PSRAM to free up internal RAM.

## Summary

| Action | Impact |
|--------|--------|
| Enable stack overflow detection (canary) | Catches overflows reliably |
| Measure high water marks | Understand actual usage |
| Increase MQTT stack to 8192+ | Fix MQTT crashes |
| Increase BLE handler stack to 5120+ | Fix BLE crashes |
| Move large buffers to heap | Reduce per-task stack needs |
| Enable core dumps | Post-mortem debugging |
| Switch to NimBLE if using Bluedroid | Reduce overall RAM pressure |

The immediate fix is to increase your task stack sizes from 2048 to appropriate values (4096-8192 depending on the task). Then use high water mark monitoring to fine-tune each stack to the smallest safe value for your specific workload.
