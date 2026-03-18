# Debugging ESP32 FreeRTOS Stack Overflow Crashes with WiFi + BLE

## Root Cause Analysis

Your 2048-byte uniform stack size is the problem. On ESP32, 2048 bytes is only appropriate for the simplest tasks (GPIO toggling, timer callbacks). WiFi and BLE stacks internally call deep function chains that consume far more stack than typical application code. When both are active simultaneously, the ESP-IDF event handling and protocol processing tasks compete for resources and push stack usage higher.

The "random task" crash pattern is characteristic of stack overflow: the overflowing task corrupts memory belonging to an adjacent task's stack or heap metadata, so the crash manifests in a *different* task from the one that actually overflowed.

## Step 1: Enable Stack Overflow Detection

In your `sdkconfig` (or via `idf.py menuconfig`), enable FreeRTOS stack overflow checking:

```
CONFIG_FREERTOS_CHECK_STACKOVERFLOW=y
CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y
```

Or if you are configuring `FreeRTOSConfig.h` directly:

```c
#define configCHECK_FOR_STACK_OVERFLOW  2   /* Method 2: canary pattern check */
```

Implement the overflow hook to identify *which* task is actually overflowing:

```c
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    // Print to UART before halting -- Serial.printf may itself need stack
    esp_rom_printf("STACK OVERFLOW in task: %s\n", pcTaskName);

    // Optionally store to RTC memory for post-mortem after watchdog reset
    // RTC_DATA_ATTR static char last_overflow_task[16];
    // strncpy(last_overflow_task, pcTaskName, sizeof(last_overflow_task));

    // Halt and let the watchdog reset
    for (;;);
}
```

This will tell you which task is the actual culprit, not which task happens to crash from the resulting corruption.

## Step 2: Measure Actual Stack Usage Per Task

Add a periodic monitoring task (or call this from an existing diagnostic task) to measure the high-water mark of every task:

```cpp
void log_all_stack_usage() {
    TaskStatus_t task_status[16];
    uint32_t total_runtime;
    UBaseType_t count = uxTaskGetSystemState(task_status, 16, &total_runtime);

    printf("\n--- Stack Usage Report ---\n");
    printf("%-20s %10s %10s\n", "Task", "Stack Left", "State");
    for (UBaseType_t i = 0; i < count; i++) {
        printf("%-20s %10u %10s\n",
               task_status[i].pcTaskName,
               task_status[i].usStackHighWaterMark * sizeof(StackType_t),
               task_status[i].eCurrentState == eRunning ? "Running" :
               task_status[i].eCurrentState == eBlocked ? "Blocked" : "Other");
    }
    printf("--------------------------\n");
}
```

For a quick check on individual tasks:

```cpp
UBaseType_t remaining = uxTaskGetStackHighWaterMark(NULL);  // current task
printf("Stack remaining: %u bytes\n", remaining * sizeof(StackType_t));
```

**What to look for:** Any task with a high-water mark below 200 bytes is dangerously close to overflow. Tasks that show 0 remaining have already overflowed.

## Step 3: Right-Size Each Task Stack

A uniform 2048-byte stack is inappropriate. ESP32 tasks have very different stack requirements depending on what they do. Here are recommended sizes based on the ESP-IDF internals:

| Task Type | Minimum Stack (bytes) | Recommended Stack (bytes) | Why |
|---|---|---|---|
| Simple GPIO / timer | 2048 | 2048 | Minimal call depth |
| Sensor reading (I2C/SPI) | 2048 | 3072 | Driver call chains |
| MQTT client task | 4096 | 6144 | `snprintf`, JSON formatting, TLS if used |
| WiFi event handler | 4096 | 4096 | ESP-IDF WiFi stack internals |
| BLE handler / GATT | 4096 | 8192 | BLE stack is deeply nested; GATT operations are heavy |
| TLS/SSL operations | 8192 | 16384 | mbedTLS uses ~3-4KB stack for handshake alone |
| Task using `printf`/`snprintf` | 4096 | 4096 | printf family consumes ~1KB of stack |
| Task using JSON parsing | 4096 | 8192 | Recursive parsers are stack-hungry |

Apply these to your task creation calls:

```cpp
// BEFORE (all uniform -- this is the bug):
xTaskCreate(mqtt_task,     "MQTT",     512, NULL, 5, &mqtt_handle);    // 512 words = 2048 bytes
xTaskCreate(ble_task,      "BLE",      512, NULL, 5, &ble_handle);     // 2048 bytes -- too small
xTaskCreate(sensor_task,   "Sensor",   512, NULL, 5, &sensor_handle);  // 2048 bytes

// AFTER (right-sized per task):
xTaskCreate(mqtt_task,     "MQTT",     1536, NULL, 5, &mqtt_handle);   // 6144 bytes
xTaskCreate(ble_task,      "BLE",      2048, NULL, 5, &ble_handle);    // 8192 bytes
xTaskCreate(sensor_task,   "Sensor",   768,  NULL, 5, &sensor_handle); // 3072 bytes
xTaskCreate(display_task,  "Display",  1024, NULL, 3, &disp_handle);   // 4096 bytes
xTaskCreate(logging_task,  "Log",      1024, NULL, 2, &log_handle);    // 4096 bytes
xTaskCreate(control_task,  "Ctrl",     768,  NULL, 6, &ctrl_handle);   // 3072 bytes
```

Note: `xTaskCreate` stack depth is in **words** (4 bytes each on ESP32), so 1536 words = 6144 bytes.

## Step 4: Understand Why WiFi + BLE Together Makes It Worse

When both WiFi and BLE are active on ESP32:

1. **ESP-IDF creates additional internal tasks** for WiFi and BLE that compete for DRAM. The WiFi task alone needs ~4KB stack, the BLE controller task needs ~4KB, and the BLE host (NimBLE or Bluedroid) needs 4-8KB more.

2. **Interrupt load increases.** WiFi and BLE share the radio via time-division, causing frequent context switches that push more interrupt frames onto stacks.

3. **Total DRAM pressure.** ESP32 has 320KB DRAM shared between all stacks, heap, and static data. WiFi alone claims ~50KB of heap. BLE (Bluedroid) claims another ~40-60KB. NimBLE is lighter at ~20-30KB. This leaves less room for everything else.

**Check your total memory budget:**

```cpp
void log_memory_budget() {
    printf("Free heap:          %u bytes\n", ESP.getFreeHeap());
    printf("Largest free block: %u bytes\n", ESP.getMaxAllocHeap());
    printf("Min free heap ever: %u bytes\n", ESP.getMinFreeHeap());

    // If these diverge significantly, heap is fragmenting
    if (ESP.getFreeHeap() > 50000 && ESP.getMaxAllocHeap() < 10000) {
        printf("WARNING: Heap is heavily fragmented!\n");
    }
}
```

If total free heap is below 20KB with WiFi + BLE active, you are running very tight and need to reduce allocations elsewhere.

## Step 5: Reduce Stack Consumption in Your Tasks

Beyond increasing stack sizes, reduce how much stack each function uses:

### Move large local buffers to static or global scope

```cpp
// BAD: 512 bytes on stack every time this function is called
void mqtt_publish_sensor_data() {
    char json_buffer[512];  // This is on the stack
    snprintf(json_buffer, sizeof(json_buffer), "{\"temp\":%.1f}", temp);
    mqtt_client.publish("data", json_buffer);
}

// GOOD: Static buffer -- zero stack cost, safe if only one task calls this
void mqtt_publish_sensor_data() {
    static char json_buffer[512];  // In .bss, not on stack
    snprintf(json_buffer, sizeof(json_buffer), "{\"temp\":%.1f}", temp);
    mqtt_client.publish("data", json_buffer);
}
```

### Avoid Arduino String in any task

```cpp
// BAD: Every concatenation allocates on heap AND uses stack for temporaries
String payload = "{\"temp\":" + String(temp) + ",\"hum\":" + String(hum) + "}";

// GOOD: Zero heap allocation, minimal stack usage
char payload[128];
snprintf(payload, sizeof(payload), "{\"temp\":%.1f,\"hum\":%.1f}", temp, hum);
```

### Avoid deep call chains and recursion

JSON parsing libraries (ArduinoJson, cJSON) can be recursive. If you are parsing complex nested JSON, this eats stack fast. Use flat JSON structures or streaming parsers for deeply nested data.

## Step 6: Consider Using NimBLE Instead of Bluedroid

If you are using the default Bluedroid BLE stack, switching to NimBLE saves significant memory:

| BLE Stack | Heap Usage | Task Stack Needs |
|---|---|---|
| Bluedroid (default) | ~40-60KB | Higher |
| NimBLE | ~20-30KB | Lower |

In `sdkconfig`:

```
CONFIG_BT_NIMBLE_ENABLED=y
CONFIG_BT_BLUEDROID_ENABLED=n
```

This alone can free 20-30KB of heap and reduce BLE task stack requirements.

## Step 7: Add Persistent Monitoring

Once you have right-sized stacks, add ongoing monitoring to catch regressions:

```cpp
// Call periodically (e.g., every 30 seconds) from a low-priority task
void monitor_system_health() {
    // Stack monitoring
    TaskStatus_t tasks[16];
    UBaseType_t count = uxTaskGetSystemState(tasks, 16, NULL);
    for (UBaseType_t i = 0; i < count; i++) {
        uint32_t remaining = tasks[i].usStackHighWaterMark * sizeof(StackType_t);
        if (remaining < 256) {
            printf("WARNING: Task '%s' has only %u bytes stack remaining!\n",
                   tasks[i].pcTaskName, remaining);
        }
    }

    // Heap monitoring
    uint32_t free_heap = ESP.getFreeHeap();
    uint32_t min_heap = ESP.getMinFreeHeap();
    if (min_heap < 10000) {
        printf("WARNING: Minimum free heap dropped to %u bytes\n", min_heap);
    }
}
```

## Summary: Action Checklist

1. **Enable `configCHECK_FOR_STACK_OVERFLOW = 2`** and implement the hook to identify the real culprit task.
2. **Measure stack high-water marks** for all tasks using `uxTaskGetStackHighWaterMark` or `uxTaskGetSystemState`.
3. **Right-size each task stack individually:** MQTT at 6144+, BLE handler at 8192+, simple tasks at 2048-3072. Never use a uniform size for all tasks.
4. **Move large local buffers to `static`** scope to reduce per-call stack usage.
5. **Replace Arduino `String`** with `char[]` + `snprintf` everywhere.
6. **Switch to NimBLE** if using Bluedroid, to free 20-30KB of heap.
7. **Monitor heap and stack continuously** in a periodic diagnostic task.
8. **Check total DRAM budget** -- with WiFi + BLE, ensure at least 20KB free heap remains after all task stacks and static allocations.

The root issue is that 2048 bytes is not enough for any task that touches WiFi, BLE, TLS, MQTT, or formatted string output on ESP32. The ESP-IDF protocol stacks have deep internal call chains that your application code does not control, and these are what blow through the 2KB limit.
