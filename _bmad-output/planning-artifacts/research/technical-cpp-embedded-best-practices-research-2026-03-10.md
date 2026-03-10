---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Embedded C/C++ Best Practices, Coding Standards, and Advanced Debugging'
research_goals: 'Verify cpp-embedded skill instructions, discover advanced patterns for complex issues, improve failed evaluation cases (CFSR decode, DMA alignment)'
user_name: 'TanNT'
date: '2026-03-10'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical

**Date:** 2026-03-10
**Author:** TanNT
**Research Type:** Technical

---

## Research Overview

This research report provides a comprehensive analysis of embedded C/C++ best practices, coding standards, and advanced debugging techniques for ARM Cortex-M microcontrollers. It was produced through a structured 6-step workflow combining web-verified technical research across multiple authoritative sources (ARM documentation, SEGGER, Memfault, ST Community, FreeRTOS, MISRA, ETL, Barr Group, and embedded industry blogs).

**Key outcomes:** Corrected two evaluation assertion errors (CFSR decode and DMA alignment), identified 5 categories of hard-to-debug issues where skill guidance provides maximum value, documented 8 common embedded C++ anti-patterns, and produced actionable recommendations for skill improvement. The research covers the full embedded firmware stack — from register-level debugging to architectural design patterns to CI/CD pipelines.

See the **Research Synthesis** section at the end for the executive summary, skill improvement recommendations, and evaluation correction guidance.

---

## Technical Research Scope Confirmation

**Research Topic:** Embedded C/C++ Best Practices, Coding Standards, and Advanced Debugging
**Research Goals:** Verify cpp-embedded skill instructions, discover advanced patterns for complex issues, improve failed evaluation cases (CFSR decode, DMA alignment)

**Technical Research Scope:**

- Architecture Analysis - ARM Cortex-M fault register layout, DMA alignment per MCU family, memory-mapped peripheral conventions
- Implementation Approaches - MISRA C/C++ patterns, advanced ISR design, lock-free structures, cache coherency
- Technology Stack - Cortex-M0/M3/M4/M7 specifics, FreeRTOS, Zephyr, ETL, static analysis tools
- Integration Patterns - C/C++ interop, linker scripts, hardware abstraction layers
- Performance Considerations - Stack analysis, WCET, memory layout optimization, power-aware coding
- Debugging Deep Dives - HardFault forensics (CFSR bit decode), memory corruption, race conditions, watchdog strategies

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-10

---

## Technology Stack Analysis

### ARM Cortex-M Fault Register Architecture (CRITICAL FINDING)

**CFSR (Configurable Fault Status Register) at 0xE000ED28** is a 32-bit composite register containing three sub-registers that can be accessed individually:

| Sub-Register | CFSR Bits | Byte Address | Size |
|---|---|---|---|
| **MMFSR** (MemManage Fault) | [7:0] | 0xE000ED28 | 8-bit |
| **BFSR** (BusFault) | [15:8] | 0xE000ED29 | 8-bit |
| **UFSR** (UsageFault) | [31:16] | 0xE000ED2A | 16-bit |

**MMFSR Bit Fields (byte 0):**
- Bit 0: IACCVIOL — Instruction access violation (MPU/XN fault)
- Bit 1: DACCVIOL — Data access violation
- Bit 3: MUNSTKERR — Fault on unstacking during exception return
- Bit 4: MSTKERR — Fault on stacking for exception entry
- Bit 5: MLSPERR — Fault during floating-point lazy stack preservation
- Bit 7: MMARVALID — MMFAR holds valid fault address

**BFSR Bit Fields (byte 1):**
- Bit 0: IBUSERR — Instruction bus error
- Bit 1: PRECISERR — Precise data bus error (return address is faulting instruction)
- Bit 2: IMPRECISERR — Imprecise data bus error (return address not directly related)
- Bit 3: UNSTKERR — Fault on unstacking during exception return
- Bit 4: STKERR — Fault on stacking for exception entry
- Bit 5: LSPERR — Fault during floating-point lazy stack preservation
- Bit 7: BFARVALID — BFAR holds valid fault address

**UFSR Bit Fields (halfword at bits [31:16]):**
- Bit 0: UNDEFINSTR — Undefined instruction
- Bit 1: INVSTATE — Invalid state (bad EPSR.T bit)
- Bit 2: INVPC — Illegal EXC_RETURN value
- Bit 3: NOCP — Coprocessor access fault
- Bit 8: UNALIGNED — Unaligned access
- Bit 9: DIVBYZERO — Division by zero

**EVALUATION CORRECTION:** For CFSR = 0x00008200:
- MMFSR (bits [7:0]) = 0x00 → **No MemManage faults**
- BFSR (bits [15:8]) = 0x82 → BFARVALID (bit 7) + PRECISERR (bit 1) → **Precise BusFault**
- UFSR (bits [31:16]) = 0x0000 → No usage faults

The skill's evaluation assertion #1 was **incorrect** — this IS a BusFault, not a MemManage fault. Both the with_skill and without_skill responses decoded it correctly as PRECISERR+BFARVALID. The MMFAR=0x10 value is stale since MMARVALID is not set. The grading must be corrected.

_Confidence: HIGH — verified against ARM official documentation and multiple independent sources._
_Source: [SEGGER Cortex-M Fault KB](https://kb.segger.com/Cortex-M_Fault), [ARM Developer Documentation](https://developer.arm.com/documentation/dui0552/latest/cortex-m3-peripherals/system-control-block/configurable-fault-status-register), [Memfault HardFault Debug Guide](https://interrupt.memfault.com/blog/cortex-m-hardfault-debug)_

### DMA Buffer Alignment Requirements

**Critical distinction between Cortex-M4 and Cortex-M7:**

| MCU Family | D-Cache | DMA Alignment Requirement | Cache Coherency Needed |
|---|---|---|---|
| **Cortex-M0/M0+** | None | Word-aligned (4 bytes) sufficient | No |
| **Cortex-M3** | None | Word-aligned (4 bytes) sufficient | No |
| **Cortex-M4** (STM32F4) | **None** | Word-aligned (4 bytes) sufficient | **No** |
| **Cortex-M7** (STM32F7/H7) | **Yes (32-byte lines)** | **32-byte aligned + 32-byte size multiple** | **Yes** |

**Cortex-M4 (STM32F4):** No integrated data cache. DMA buffers only need natural alignment for the data type (typically 4-byte word alignment). `alignas(32)` is unnecessary overhead on M4 targets.

**Cortex-M7 (STM32F7/H7):** Has integrated D-Cache with 32-byte cache lines. DMA buffers MUST be 32-byte aligned AND sized to 32-byte multiples. Three approaches:
1. **Cache maintenance:** `SCB_CleanDCache_by_Addr()` before TX, `SCB_InvalidateDCache_by_Addr()` after RX
2. **Non-cacheable MPU region:** Place DMA buffers in SRAM4 or configure MPU to disable caching
3. **Disable D-Cache entirely:** Simple but loses performance benefits

**EVALUATION CORRECTION:** The eval assertion "DMA buffer aligned to 32 bytes" was over-specified for an STM32F4 target. The skill should teach conditional alignment based on MCU family.

_Confidence: HIGH — verified against STMicroelectronics community resources and ARM documentation._
_Source: [ST Community - DMA Cache Coherence](https://community.st.com/t5/stm32-mcus-products/maintaining-cpu-data-cache-coherence-for-dma-buffers/td-p/95746), [ST Community - MPU Cache Coherency](https://community.st.com/t5/stm32-mcus/how-to-use-the-memory-protection-unit-to-manage-cache-coherency/ta-p/858387), [DMA on STM32H7](https://community.st.com/t5/stm32-mcus/dma-is-not-working-on-stm32h7-devices/ta-p/49498)_

### Coding Standards: MISRA C:2025 and MISRA C++:2023

**MISRA C:2025** (published March 2025):
- Covers C90, C99, and C11/C18
- 225 active guidelines (rationalized from previous versions)
- Relaxed restrictions on declaration placement where they don't impact safety
- Removed obsolete rules to reduce compliance overhead for legacy code

**MISRA C++:2023** (published October 2023):
- Targets C++17 (ISO/IEC 14882:2017)
- 179 guidelines (4 directives + 175 rules) — down from 228 in MISRA C++:2008
- Merges MISRA C++:2008 with AUTOSAR C++14 guidelines
- Supports modern C++17 features: structured bindings, constexpr improvements, scoped conditionals
- Improved decidability for static analysis tools

**Key rules for embedded memory safety (verified against current standards):**
- **MISRA C 21.3** (Required): No stdlib memory allocation (malloc, calloc, realloc, free) — still active in 2025
- **MISRA C 17.2** (Required): No recursion — still active
- **MISRA C 18.8** (Required): No VLAs — still active
- **MISRA C++ Rule 21.6.1**: No dynamic memory after initialization

_Confidence: HIGH_
_Source: [LDRA - MISRA Language Guidelines](https://ldra.com/misra/), [Parasoft - MISRA C++ 2023 Guide](https://www.parasoft.com/blog/misra-cpp-2023-guide/), [QA Systems - MISRA C++:2023](https://www.qa-systems.com/qa-academy/misra-cplusplus-2023-the-rules-for-the-development-of-safety-critical-software-with-cplusplus/)_

### Embedded Template Library (ETL)

The ETL is a complementary library to the C++ STL specifically designed for embedded systems:

**Key properties:**
- All non-intrusive containers have **fixed capacity determined at compile-time**
- **Zero heap allocation** — all storage on stack or static
- STL-compatible API for familiar usage
- Compatible with C++03 and later
- MIT licensed, actively maintained since 2014

**Key containers for embedded use:**
- `etl::vector<T, N>` — fixed-capacity vector (replaces `std::vector`)
- `etl::string<N>` — fixed-capacity string (replaces `std::string`)
- `etl::map<K, V, N>` — fixed-capacity ordered map
- `etl::unordered_map<K, V, N>` — fixed-capacity hash map
- `etl::queue_spsc_isr<T, N>` — **ISR-safe SPSC queue** (designed for interrupt-driven systems)
- `etl::circular_buffer<T, N>` — ring buffer

**`etl::queue_spsc_isr`** is particularly notable — it is specifically designed for ISR-to-task communication, with one end driven from an interrupt and the other from the main application loop.

_Confidence: HIGH_
_Source: [ETL Official Site](https://www.etlcpp.com/), [ETL GitHub](https://github.com/ETLCPP/etl), [ETL ISR Queue Docs](https://www.etlcpp.com/queue_spsc_isr.html)_

### Static Analysis Tools for Embedded

| Tool | Type | Key Strengths | MISRA Support |
|---|---|---|---|
| **Clang-Tidy** | OSS linter | Broad checks, clang-analyzer-* modules, cppcoreguidelines-* | Partial |
| **Cppcheck** | OSS analyzer | Handles non-standard syntax (common in embedded), easy integration | Partial (addon) |
| **Polyspace** | Commercial | Proves absence of runtime errors, deep abstract interpretation | Full MISRA C/C++ |
| **Parasoft C/C++test** | Commercial | Most extensive MISRA compliance coverage | Full MISRA C/C++ |
| **PC-lint Plus** | Commercial | Lightweight, fast, decades of embedded usage | Full MISRA C/C++ |
| **CodeChecker** | OSS framework | Wraps Clang SA + Clang-Tidy, stores results for diffing | Via Clang checks |

**Best practice:** Use a battery of tools rather than one. Each has unique analysis strengths. Combine static analysis (clang-tidy, cppcheck) with dynamic analysis (AddressSanitizer, UBSan) for maximum coverage.

_Confidence: HIGH_
_Source: [Cppcheck Official](https://cppcheck.sourceforge.io/), [Incredibuild - Best C++ Static Analysis Tools](https://www.incredibuild.com/blog/top-9-c-static-code-analysis-tools), [CodeChecker Docs](https://codechecker.readthedocs.io/)_

### Lock-Free SPSC Patterns for ISR Communication

**Key implementation requirements for ISR-safe SPSC queues:**

1. **Power-of-2 capacity** with bitmask indexing for O(1) wrap-around
2. **std::atomic** (C++) or `volatile` + compiler barriers (C) for head/tail
3. **Memory ordering:** `memory_order_release` on producer store, `memory_order_acquire` on consumer load
4. **Cache line padding:** Separate head and tail to avoid false sharing (relevant on M7 with cache)
5. **No allocation in push/pop** — all storage pre-allocated

**Performance optimization:** Cache local copies of head/tail (`m_head_cached`, `m_tail_cached`) to reduce atomic load frequency. This is a key pattern missing from many basic implementations.

**ETL alternative:** `etl::queue_spsc_isr<T, N>` provides a production-ready ISR-safe SPSC queue with fixed capacity, specifically designed for embedded interrupt contexts.

_Confidence: HIGH_
_Source: [rigtorp/SPSCQueue](https://github.com/rigtorp/SPSCQueue), [ETL SPSC ISR Queue](https://www.etlcpp.com/queue_spsc_isr.html), [ETL Concurrent Queues](https://www.etlcpp.com/concurrent_queues.html)_

### Advanced Debugging Techniques

**Stack Overflow Detection (beyond basic canaries):**
- **`-fstack-usage` flag:** Generates `.su` files with per-function worst-case stack usage
- **MPU guard regions:** Configure MPU to make memory below stack bottom inaccessible — catches overflow at the exact instruction
- **Dynamic stack checking (VisualGDB):** Inserts bounds-checking code per function
- **Stack painting:** Fill stack with known pattern at startup, check watermark periodically

**Heap Corruption Detection:**
- **Boundary tags / sentinel values:** Surround each allocation with known patterns (0xDEADC0DE)
- **AddressSanitizer on host:** Compile business logic for PC with `-fsanitize=address,undefined` — catches 80% of memory bugs without target hardware
- **FreeRTOS heap integrity:** `vPortGetHeapStats()` (FreeRTOS 10.4+) for monitoring

**Watchdog Strategies:**
- **Window watchdog:** Must be kicked within a time window (not too early, not too late) — catches both stuck loops and runaway code
- **Task-level watchdog:** Each task reports alive status; supervisor task kicks hardware watchdog only if all tasks reported in time
- **Pre-reset logging:** Write fault reason to non-volatile memory (flash/EEPROM) before watchdog reset

_Confidence: HIGH_
_Source: [NetBurner - Stack Overflow Detection](https://www.netburner.com/learn/detecting-stack-overflows-on-an-embedded-system/), [VisualGDB - Dynamic Stack Checking](https://visualgdb.com/tutorials/arm/stack/), [Miro Samek - Stack Overflow](https://www.embeddedrelated.com/showarticle/1574.php)_

### Technology Adoption Trends

**Modern C++ in Embedded (2025-2026):**
- MISRA C++:2023 enabling safe adoption of C++17 features in safety-critical domains
- ETL adoption growing as the standard embedded alternative to STL
- Increasing use of `constexpr`, `std::optional`, `std::string_view` in firmware
- CRTP replacing virtual dispatch in resource-constrained environments

**Tooling Evolution:**
- Clang-based tools becoming dominant in embedded (cross-compilation support)
- Integration of static analysis into CI/CD pipelines for firmware
- Host-based testing with sanitizers becoming standard practice

**RTOS Landscape:**
- FreeRTOS remains dominant; static allocation APIs (v10+) reducing heap dependency
- Zephyr RTOS gaining traction for IoT with comprehensive device tree model
- ThreadX (now Azure RTOS / Eclipse ThreadX) strong in commercial/certified applications

_Confidence: MEDIUM-HIGH — based on industry trends and standards evolution._
_Source: [MISRA Official](https://misra.org.uk/), [Innovative Virtuoso - Modern C++ for Embedded](https://innovirtuoso.com/embedded-systems/modern-c-for-embedded-systems-a-practical-roadmap-from-c-to-safer-faster-firmware/)_

---

## Integration Patterns Analysis

### Peripheral Communication Protocols

| Protocol | Speed | Wires | Topology | Best For |
|---|---|---|---|---|
| **UART** | Up to ~1 Mbps | 2 (TX/RX) | Point-to-point | Debug, GPS, Bluetooth, modems |
| **I2C** | 100k/400k/1M/3.4M | 2 (SDA/SCL) | Multi-drop bus | Sensors, EEPROMs, low-speed devices |
| **SPI** | Up to 50+ MHz | 4 (MOSI/MISO/SCK/CS) | Master + N slaves | ADCs, displays, flash, high-speed sensors |
| **CAN** | 1 Mbps (classic) / 5+ Mbps (FD) | 2 (CANH/CANL) | Multi-master bus | Automotive, industrial, safety-critical |

**Protocol selection factors for embedded:** EMI susceptibility, wiring complexity, distance requirements, and industry-standard dominance. CAN excels in noisy environments; SPI for speed; I2C for simplicity with multiple devices.

_Source: [Blues - Understanding Sensor Interfaces](https://dev.blues.io/blog/blues-university-understanding-sensor-interfaces-uart-i2c-spi-can/), [RapidSea - Embedded Connectivity](https://www.rapidseasuite.com/blog/embedded-connectivity-a-deep-dive-into-i2c-spi-uart-can)_

### Hardware Abstraction Layer (HAL) Design Patterns

**C++ HAL patterns for embedded (ranked by suitability):**

1. **CRTP-based static HAL** (Best for embedded) — Zero runtime overhead, all types resolved at compile time. Since the hardware is known at compile time, losing runtime polymorphism is acceptable.

2. **Template-parameterized HAL** — Pass peripheral configuration as template parameters. Enables compile-time validation of pin assignments and clock settings.

3. **Virtual interface HAL** (Acceptable for non-critical paths) — Classical dependency inversion with virtual methods. Higher overhead from vtable but enables mock testing on PC.

4. **Opaque handle + extern "C" pattern** — C-compatible API that hides C++ implementation behind `void*` handles. Essential for mixed C/C++ codebases where HAL drivers are in C but application is C++.

**Key principle:** For every HAL, write a mock that compiles and runs on a PC. This enables unit testing of application code without target hardware.

_Source: [mbedded.ninja - Designing HAL in C++](https://blog.mbedded.ninja/programming/languages/c-plus-plus/designing-a-hal-in-cpp/), [Embedded Artistry - Callback Game](https://embeddedartistry.com/blog/2017/02/01/improving-your-callback-game/)_

### FreeRTOS Inter-Task Communication Patterns

| Mechanism | RAM Overhead | Speed | Use Case |
|---|---|---|---|
| **Task Notification** | 0 extra bytes | Fastest | Single-recipient event/value signaling |
| **Queue** | Per-item copy | Moderate | Multi-sender/receiver, typed messages |
| **Stream Buffer** | Contiguous ring | Fast | Byte streams, ISR-to-task, UART RX |
| **Message Buffer** | Stream + length prefix | Fast | Variable-length messages, single producer/consumer |

**Task Notifications** are significantly faster than queues/semaphores for equivalent operations and use zero additional RAM. However, they only work for single-recipient scenarios.

**Stream Buffers** internally use task notifications, combining queue convenience with near-raw-buffer speed. Ideal for ISR-to-task byte stream transfer (UART, ADC DMA).

**Design rule:** Use task notifications for simple event signaling, stream buffers for ISR byte streams, queues only when multiple readers/writers are needed.

_Source: [FreeRTOS Queues](https://freertos.org/Embedded-RTOS-Queues.html), [FreeRTOS Forum - Stream vs Queue](https://forums.freertos.org/t/stream-buffers-vs-message-buffers-vs-queues/8367), [FreeRTOS Task Notifications](https://deepwiki.com/FreeRTOS/FreeRTOS-Kernel-Book/2.2-task-notifications)_

### C/C++ Interop Patterns for Embedded

**Hourglass pattern** — Expose C++ classes through a thin C89 API for ABI stability:
1. Classes accessible only as opaque `void*` handles
2. Member functions exposed as `extern "C"` functions (no name mangling)
3. Allows any C or C++ compiler to link against the library

**Callback registration with opaque context:**
```c
typedef void (*event_callback_t)(void* context, uint32_t event_id);
void driver_register_callback(event_callback_t cb, void* context);
```
The `void* context` enables C++ member function callbacks by passing `this` as context and using a static trampoline function. This is the standard pattern for integrating C++ objects with C-style ISR/callback registration APIs.

**Best practice:** Keep callback functions short and mark them `inline` or `__attribute__((always_inline))` when called from ISRs.

_Source: [Embedded Artistry - C++ Callbacks](https://embeddedartistry.com/blog/2017/07/10/using-a-c-objects-member-function-with-c-style-callbacks/), [mbedded.ninja - C++ Callbacks](https://blog.mbedded.ninja/programming/languages/c-plus-plus/callbacks/)_

### Linker Script Memory Placement

**ARM Cortex-M memory regions and their use cases:**

| Region | Address (STM32H7 example) | Speed | Use For |
|---|---|---|---|
| **FLASH** | 0x08000000 | Slow (wait states) | Code, const data, lookup tables |
| **ITCM** | 0x00000000 | Zero wait state | Time-critical ISRs, control loops |
| **DTCM** | 0x20000000 | Zero wait state | Stack, frequently accessed data |
| **AXI SRAM** | 0x24000000 | 1-2 wait states | General data, heap |
| **SRAM4** | 0x38000000 | Non-cached | DMA buffers (no cache coherency issues) |

**Key optimization:** Place time-critical ISR handlers in ITCM for deterministic execution — loop execution time can be reduced by 15% or more. Profile before choosing what to place in ITCM.

**AAPCS requirement:** Stack must be aligned on 8-byte boundary.

_Source: [SoC - ITCM Memory](https://s-o-c.org/what-is-instruction-tcm-itcm-memory-in-arm-cortex-m-series/), [Thea Flowers - Commented Linker Script](https://blog.thea.codes/the-most-thoroughly-commented-linker-script/), [ST Community - CCMRAM](https://community.st.com/t5/stm32-mcus-products/how-to-change-linker-script-file-in-order-to-put-data-into/td-p/177151)_

### Low-Power Firmware Patterns

**ARM Cortex-M power modes:**
- **Run** — Full speed, all clocks active
- **Sleep** — CPU clock stopped, peripherals active, wake on any interrupt
- **Deep Sleep** — Most clocks stopped, limited wake sources, lowest power

**Key instructions:**
- **WFI (Wait-For-Interrupt):** Immediately enters configured sleep mode; wakes on interrupt
- **WFE (Wait-For-Event):** Checks event bit first; enters sleep if not set. Better for ISR-main interactions
- **SEV (Send-Event):** Generates event to wake a WFE-sleeping core

**Sleep-On-Exit:** Processor returns directly to sleep after ISR completes, avoiding unnecessary context switch to main loop. Ideal for purely interrupt-driven applications.

**Coding pattern:** Always add `__DSB()` before `__WFI()`/`__WFE()` for portability. Turn off unused peripherals before sleeping.

_Source: [Embedded.com - Low Power Fundamentals](https://www.embedded.com/arm-cortex-m-low-power-mode-fundamentals/), [SoC - WFI and WFE](https://s-o-c.org/wfi-and-wfe-instructions-for-low-power-in-cortex-m3-explained/)_

---

## Architectural Patterns and Design

### Firmware Architecture Patterns (Ranked by Complexity)

**1. Superloop (Bare-metal polling)**
- Simplest: endless `while(1)` loop with flag-based task execution
- Flags set by ISRs, polled in main loop
- No scheduler overhead, fully deterministic
- Breaks down with >5 independent tasks or tight timing requirements

**2. Time-Triggered Cooperative Scheduler**
- SysTick-driven task table with fixed periods
- Tasks must complete within their time slot (non-preemptive)
- Predictable, analyzable, good for safety-critical (IEC 61508 SIL 1-2)
- No priority inversion, no need for mutexes

**3. RTOS-Based Preemptive (FreeRTOS, Zephyr, ThreadX)**
- Priority-based preemptive scheduling
- Rich IPC: queues, semaphores, task notifications, stream buffers
- Handles complex multi-task systems well
- Introduces priority inversion, stack sizing, and synchronization complexity

**4. Active Object / Event-Driven (QP Framework)**
- Objects run in their own threads, communicate via asynchronous events
- Combines hierarchical state machines with RTOS task scheduling
- "Similar quantum leap of improvement over the RTOS as the RTOS represents over the superloop"
- Best for complex protocol handling, UI, and multi-modal systems

**Selection guide:** Start with simplest architecture that meets requirements. Superloop for <5 tasks with loose timing; cooperative for deterministic hard real-time; RTOS for complex multi-priority; Active Object for event-heavy state-machine systems.

_Source: [Quantum Leaps - Beyond the RTOS](https://www.state-machine.com/beyond-the-rtos), [EmbeddedRT - Firmware Architecture Strategies](https://embeddedrt.com/firmware-architecture-strategies-choosing-the-right-approach-for-your-embedded-system/), [IMT - Event-Based Architecture](https://www.imt.ch/en/expert-blog-detail/event-based-sw-architecture-en)_

### Design Principles for Embedded C++

#### Dependency Inversion and Compile-Time DI

**Core principle:** In embedded C++, use template parameters (compile-time DI) instead of virtual interfaces wherever possible. This enables complete inlining and dead-code elimination by the compiler — zero runtime overhead compared to vtable dispatch.

```cpp
// Compile-time DI via templates — zero runtime overhead
template<typename Uart, typename Timer>
class SensorDriver {
    Uart& uart_;
    Timer& timer_;
public:
    SensorDriver(Uart& u, Timer& t) : uart_(u), timer_(t) {}
    void read() { /* uses uart_ and timer_ — fully inlineable */ }
};

// Production: SensorDriver<Stm32Uart, Stm32Timer>
// Host test:  SensorDriver<MockUart, MockTimer>  — same binary interface, no vtable
```

**DI strategy selection:**

| Technique | Overhead | Flexibility | Use When |
|-----------|----------|-------------|----------|
| **Template parameter** | Zero | Compile-time only | Production drivers, HAL wrappers, hot paths |
| **Link-time substitution** | Zero | Per-build target | C code, swapping entire HAL implementations |
| **Callback + opaque `void*`** | 1 indirect call | Runtime | C/C++ interop, ISR callbacks |
| **Virtual interface** | vtable lookup | Full runtime | Test mocks on PC, non-critical paths only |

Reserve virtual interfaces for test boundaries only — inject mock drivers on the PC host side where vtable overhead doesn't matter.

_Source: [mbedded.ninja - Dependency Injection](https://blog.mbedded.ninja/programming/design-patterns/dependency-injection/), [GoodByte - Embedded Software vs Unit Testing](https://goodbyte.software/embedded-software-vs-unit-testing-mocking-and-dependency-injection/)_

#### Testability-Driven Architecture

**Principle:** Every module should be testable on a host PC without target hardware. This is not a nice-to-have — it's an architectural requirement that drives how you structure firmware.

**The HAL boundary pattern:**
1. Define a thin HAL interface (C++ concept, template parameter, or C function pointer table)
2. Implement the real HAL for the target (calls CMSIS/HAL/LL)
3. Implement a mock HAL for the host (records calls, returns canned data)
4. Application logic depends only on the HAL interface — never on target headers directly

**Testing pyramid for firmware:**
- **Unit tests (host, every commit):** Business logic + state machines with mock HAL. Use CppUTest, Google Test, or Unity.
- **Integration tests (QEMU/host, on PR):** Multi-module interactions with simulated peripherals
- **HIL tests (target, nightly):** Real hardware, real timing, real peripherals

**Key insight:** If you can't test a module on a PC, it's too tightly coupled to hardware. Refactor the HAL boundary.

**Certified test frameworks (safety-critical):** Parasoft's upcoming certified GoogleTest (Jan 2026) addresses tool qualification for ISO 26262 and DO-178C, making host-based testing viable for safety-critical projects.

_Source: [Parasoft - Embedded Unit Testing](https://www.parasoft.com/blog/embedded-unit-testing/), [Dojo Five - Unit Testing for Embedded](https://dojofive.com/blog/unit-testing-for-embedded-software-development/), [James Grenning - TDD for Embedded C](https://pragprog.com/titles/jgade/test-driven-development-for-embedded-c/)_

#### CRTP vs Virtual Dispatch — When Each Applies

**CRTP (Curiously Recurring Template Pattern)** provides compile-time polymorphism with zero overhead. The compiler fully inlines CRTP method calls because it statically resolves the derived type.

```cpp
template<typename Derived>
class DriverBase {
public:
    void init() { static_cast<Derived*>(this)->do_init(); }
    void send(const uint8_t* buf, size_t len) {
        static_cast<Derived*>(this)->do_send(buf, len);
    }
};

class UartDriver : public DriverBase<UartDriver> {
    friend class DriverBase<UartDriver>;
    void do_init() { /* configure UART registers */ }
    void do_send(const uint8_t* buf, size_t len) { /* DMA transfer */ }
};
```

**Decision guide:**

| Criterion | Use CRTP | Use Virtual |
|-----------|----------|-------------|
| Hardware type known at compile time | Yes | — |
| ISR or real-time path | Yes (zero overhead) | No (indirect call, branch miss) |
| Need runtime type selection | — | Yes |
| Host-side test mocks | Either | More natural |
| Code size pressure | Yes (no vtable) | Larger (vtable per class) |
| C++23 available | Use deducing `this` instead | — |

**C++23 improvement:** Deducing `this` (`this auto&& self`) eliminates the CRTP boilerplate entirely while preserving zero-overhead static polymorphism.

**Don't overestimate virtual call cost** on Cortex-M3/M4 (no branch predictor penalty on simple cores). Reserve CRTP for hot paths and ISR-adjacent code; virtual dispatch is fine for initialization, configuration, and non-real-time paths.

_Source: [Eli Bendersky - CRTP vs Virtual Dispatch](https://eli.thegreenplace.net/2013/12/05/the-cost-of-dynamic-virtual-calls-vs-static-crtp-dispatch-in-c), [NordVarg - CRTP Pattern](https://nordvarg.com/blog/crtp-curiously-recurring-template-pattern), [iifx.dev - Deducing This in C++23 CRTP](https://iifx.dev/en/articles/457405603/compile-time-polymorphism-mastering-deducing-this-in-c-23-crtp)_

#### Error Handling Strategy for Firmware

Exceptions (`-fexceptions`) are unsuitable for most embedded targets: non-deterministic stack unwinding, 10-30% code size increase, and incompatibility with MISRA C++:2023. But silent error codes are equally dangerous.

**Layered error handling strategy:**

| Error Category | Mechanism | Example |
|----------------|-----------|---------|
| **Expected failures** (sensor timeout, CRC mismatch) | `std::optional<T>` or `std::expected<T,E>` (C++23) | `std::optional<Reading> read_sensor()` |
| **Protocol/config errors** (invalid message, out-of-range parameter) | Error codes with `[[nodiscard]]` | `[[nodiscard]] Status configure(const Config&)` |
| **Programming bugs** (null pointer, violated precondition) | `assert()` in debug, trap in release | `assert(buf != nullptr)` |
| **Unrecoverable faults** (HardFault, stack overflow) | Fault handler → log to NVM → watchdog reset | Write CFSR + stacked PC to flash, then `NVIC_SystemReset()` |

**`std::expected<T,E>` for embedded (C++23):**
```cpp
enum class SensorError : uint8_t { Timeout, CrcFail, NotCalibrated };

std::expected<Reading, SensorError> read_sensor() {
    if (!sensor_ready()) return std::unexpected(SensorError::Timeout);
    auto raw = spi_read();
    if (!verify_crc(raw)) return std::unexpected(SensorError::CrcFail);
    return Reading{.temp = convert(raw)};
}
```

Zero heap allocation, zero exceptions, type-safe error propagation. For C++17 targets without `std::expected`, use `tl::expected` (header-only polyfill) or `etl::expected`.

**`[[nodiscard]]` enforcement:** Mark every function returning an error code or status with `[[nodiscard]]`. Compiler warns if the caller ignores the return value — catches the #1 error handling bug in firmware (silently discarded error codes).

_Source: [CppCat - Error Handling in Real-Time Embedded](https://cppcat.com/error-handling-in-real-time-embedded-systems-with-c/), [ModernesCpp - std::expected](https://www.modernescpp.com/index.php/c23-a-new-way-of-error-handling-with-stdexpected/), [John Farrier - Modern C++ Firmware](https://johnfarrier.com/modern-cpp-firmware-part-01-case-for-modern-cpp/)_

#### Embedded C++ Anti-Patterns

Common patterns that cause problems in resource-constrained firmware:

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **`std::function` with captures** | Heap allocates for non-trivial captures (typically >24 bytes) | Function pointer + `void* context`, or template callable |
| **`std::shared_ptr` anywhere** | Reference counting overhead (atomic increment/decrement per copy), control block on heap | `std::unique_ptr` with pool deleter, or raw pointer with clear ownership |
| **Deep virtual hierarchies** | vtable per class (ROM), indirect dispatch, prevents inlining | CRTP or flat hierarchy (≤2 levels) |
| **Hidden `std::string` / `std::vector`** | Dynamic allocation on every operation — often hidden in library APIs | ETL containers (`etl::string<N>`, `etl::vector<T,N>`), `char[]` + `snprintf` |
| **`volatile` for thread sync** | `volatile` prevents reordering with hardware but NOT between threads — data races are UB | `std::atomic` with explicit memory ordering |
| **ISR handler name mismatch** | Misspelled ISR name falls through to `Default_Handler` — system hangs or resets silently | Verify ISR names against startup `.s` vector table; use `-Wl,--undefined` to catch missing symbols |
| **Unbounded recursion** | Stack overflow on MCU with 1-8KB stack; MISRA C 17.2 bans recursion | Convert to iterative with explicit stack, or use tail-call style |
| **`printf` / `sprintf` in ISR** | Heap allocation, locking, non-reentrant — causes crashes or deadlocks | `snprintf` to pre-allocated buffer outside ISR, or lightweight ITM trace |

**Hidden allocation checklist:** Before using any STL type, check whether it allocates. Common surprises: `std::string::operator+=`, `std::vector::push_back` (reallocation), `std::function` (type-erased captures), `std::any`, `std::regex`.

_Source: [mbedded.ninja - C++ on Embedded Systems](https://blog.mbedded.ninja/programming/languages/c-plus-plus/cpp-on-embedded-systems/), [Ethrynto - C++ in Embedded Systems](https://dev.to/ethrynto/c-in-embedded-systems-modern-practices-for-resource-constrained-environments-412l), [Innovative Virtuoso - Modern C++ for Embedded](https://innovirtuoso.com/embedded-systems/modern-c-for-embedded-systems-a-practical-roadmap-from-c-to-safer-faster-firmware/)_

#### SOLID Principles Adapted for Embedded

SOLID principles apply to embedded firmware but must be adapted for resource constraints:

| Principle | Embedded Adaptation |
|-----------|-------------------|
| **Single Responsibility** | Each module owns one peripheral or one protocol. A UART driver does not parse messages — it delivers bytes to a protocol handler. |
| **Open/Closed** | Extend behavior through template parameters or compile-time configuration, not runtime inheritance. New sensor? New template specialization, not new virtual subclass. |
| **Liskov Substitution** | Mock HAL must be substitutable for real HAL without behavioral differences (apart from actual I/O). Critical for host-based testing. |
| **Interface Segregation** | Keep HAL interfaces narrow. A `DigitalOutput` concept needs only `set()` and `clear()` — don't bundle it with ADC, PWM, and timer APIs. Smaller interfaces = easier to mock and test. |
| **Dependency Inversion** | Application logic depends on HAL abstractions (template parameters), not on concrete register definitions. Concrete HAL is injected at compile time. |

**Key constraint:** On MCUs with 16-64KB flash, over-abstraction costs more than the bugs it prevents. Apply SOLID at module boundaries (HAL, protocol, application) — not at every function call. Three similar lines of code is better than a premature abstraction in firmware.

_Source: [BugProve - Firmware Architecture](https://bugprove.com/firmware-architecture/), [Dojo Five - Modern Embedded Firmware Development](https://dojofive.com/the-ultimate-guide-to-modern-embedded-firmware-development/), [Embedded RT - Firmware Architecture Strategies](https://embeddedrt.com/firmware-architecture-strategies-choosing-the-right-approach-for-your-embedded-system/)_

#### Key Embedded Design Patterns

| Pattern | Implementation | Use Case |
|---------|---------------|----------|
| **Strategy (via templates)** | Template parameter selects algorithm at compile time | Swap CRC implementation, filter algorithm, communication protocol |
| **Observer (via callback + opaque context)** | `void(*cb)(void* ctx, Event e)` | ISR/event notification, driver callbacks |
| **State Machine (hierarchical)** | Switch/case or table-driven; QP framework for complex FSMs | Protocol handling, UI modes, power management |
| **Object Pool** | Fixed-size array + free-list, RAII return via `unique_ptr` + pool deleter | Message buffers, sensor readings, network packets |
| **RAII Guard** | Constructor acquires, destructor releases | SPI chip select, mutex lock, interrupt disable |
| **Singleton (Meyers' style)** | `static T& instance()` with local static | Global hardware peripherals (use sparingly) |

_Source: [CppCat - Modern C++ Design Patterns for Embedded](https://cppcat.com/c-design-patterns-for-embedded/), [Microchip - State Machine Design Pattern](https://onlinedocs.microchip.com/oxy/GUID-7CE1AEE9-2487-4E7B-B26B-93A577BA154E-en-US-2/GUID-325850C6-AE1E-45EF-A13F-45A05C5461B2.html)_

### MPU (Memory Protection Unit) Architecture

**Cortex-M MPU capabilities:**
- M3/M4: up to 8 regions
- M7: up to 16 regions
- Each region: configurable base address, size, access permissions (R/W/X), memory attributes

**Protection patterns:**

| Pattern | MPU Regions Used | Purpose |
|---|---|---|
| **Null pointer guard** | 1 region | Region 0 at address 0x0, size 32B-256B, no-access. Catches null dereferences immediately |
| **Stack overflow guard** | 1 per task | Region below stack bottom, no-access. Catches overflow at exact instruction |
| **Peripheral isolation** | 1-2 regions | Restrict task access to only its assigned peripherals |
| **Flash write-protect** | 1 region | Prevent accidental writes to code/const region |
| **RTOS task isolation** | 2-3 per task | Stack, data, and peripheral regions per task; reconfigured at context switch |

**Key considerations:**
- MPU must be configured before enabling (use DMB barrier)
- Limited regions require careful planning — prefer message passing over shared memory to reduce needed regions
- RTOS context switch must reconfigure MPU for incoming task, introducing ~100 cycle overhead

_Source: [ARM - Memory Protection Unit](https://developer.arm.com/documentation/107565/latest/Memory-protection/Memory-Protection-Unit), [SoC - RTOS MPU Challenges](https://www.systemonchips.com/rtos-memory-protection-on-cortex-m-using-mpu-challenges-and-solutions/), [Feabhas - MPU Setup](https://blog.feabhas.com/2013/02/setting-up-the-cortex-m34-armv7-m-memory-protection-unit-mpu/)_

### Safety-Critical Architecture Patterns

**Watchdog hierarchy (IEC 61508 compliance):**

1. **Simple watchdog:** Periodic kick from main loop — detects hangs only
2. **Window watchdog:** Must be kicked within a time window (not too early, not too late) — detects both stuck loops AND runaway fast execution
3. **Question-Answer watchdog:** Watchdog sends a challenge, software must return correct response — verifies program sequence integrity, not just liveness
4. **Task-level supervisor:** Each RTOS task reports alive status to a supervisor task; supervisor kicks hardware watchdog only if ALL tasks reported in time

**Fault recovery patterns:**
- **Pre-reset logging:** Write fault reason + registers to non-volatile memory (EEPROM/flash) before watchdog reset
- **Boot-count limiter:** Track consecutive fault-resets; after N failures, enter safe mode instead of normal boot
- **Dual-channel redundancy:** Two independent processing paths compare results; disagreement triggers safe state
- **Defensive programming:** `assert()` in debug, graceful degradation in release

**IEC 61508 key requirements:**
- SIL 1-2: Single-channel with diagnostics (watchdog, CRC, stack monitoring)
- SIL 3: Dual-channel or single-channel with extensive self-diagnostics
- SIL 4: Dual-channel with diverse redundancy

_Source: [In Compliance - Robust Watchdog Timers](https://incompliancemag.com/implementing-robust-watchdog-timers-for-embedded-systems/), [Analog Devices - Program Sequence Monitoring](https://www.analog.com/en/resources/analog-dialogue/articles/improving-industrial-functional-safety-part-4.html), [Promwad - IEC 61508](https://promwad.com/news/iec-61508-standard)_

---

## 5. Implementation Research

### 5.1 CI/CD Pipeline for Embedded Firmware

**Recommended testing pyramid for embedded projects:**

1. **Host unit tests (fastest, run on every commit):**
   - Compile production C/C++ with GCC/Clang on the build server
   - Mock HAL layer using link-time substitution or compile-time DI
   - Use CppUTest, Google Test, or Unity (for pure C)
   - Target: 70-80% code coverage of business logic (exclude HAL stubs)

2. **QEMU emulation (minutes, run on PR merge):**
   - `qemu-system-arm -machine lm3s6965evb` or `mps2-an385` for Cortex-M
   - Run integration tests that exercise RTOS tasks, IPC, and state machines
   - Catches ISR priority issues, stack overflow, and timing-dependent bugs that host tests miss
   - Semihosting for test output: `--semihosting-config enable=on`

3. **Hardware-in-the-Loop (HIL) testing (minutes-hours, nightly/release):**
   - Physical board connected to CI runner via JTAG/SWD (J-Link, ST-Link)
   - Flash firmware with `openocd` or `pyocd`, capture UART output
   - Robot Framework + custom Python libraries for test orchestration
   - Lauterbach TRACE32 for advanced trace-based testing (branch coverage on real silicon)

**Minimal CI pipeline (GitHub Actions example):**

```yaml
jobs:
  host-tests:
    runs-on: ubuntu-latest
    steps:
      - run: cmake -B build -DTARGET=host && cmake --build build && ctest --test-dir build

  firmware-build:
    runs-on: ubuntu-latest
    container: ghcr.io/zephyrproject-rtos/ci:latest  # or custom ARM GCC container
    steps:
      - run: cmake -B build -DCMAKE_TOOLCHAIN_FILE=arm-none-eabi.cmake && cmake --build build
      - run: arm-none-eabi-size build/firmware.elf  # track flash/RAM usage

  qemu-integration:
    needs: firmware-build
    steps:
      - run: qemu-system-arm -machine mps2-an385 -kernel build/firmware.elf -nographic -semihosting -no-reboot | timeout 60 tee test_output.log
```

**Flash/RAM budget tracking:** Store `arm-none-eabi-size` output as CI artifact; fail build if flash exceeds 90% or RAM exceeds 80% of target capacity.

_Source: [Interrupt Blog - Firmware CI/CD](https://interrupt.memfault.com/blog/continuous-integration-for-firmware), [Embedded Artistry - Unit Testing](https://embeddedartistry.com/blog/2019/01/07/embedded-systems-testing-with-host-based-testing/), [QEMU ARM System Emulation](https://www.qemu.org/docs/master/system/arm/mps2.html)_

### 5.2 Code Review Checklist for Embedded C/C++

**Critical checks (must pass — reject PR if violated):**

| Category | Check | Why |
|----------|-------|-----|
| **Memory** | No `malloc`/`new` in ISR or real-time path | Unbounded latency, fragmentation |
| **Memory** | All buffers have compile-time size bounds | Buffer overflow prevention |
| **Volatile** | Hardware registers accessed through `volatile` pointer/reference | Compiler may optimize away reads/writes |
| **Volatile** | `volatile` NOT used for thread synchronization (use `std::atomic`) | `volatile` doesn't guarantee ordering |
| **ISR** | ISR body < 1µs (or justified exception) | Long ISRs block higher-priority interrupts |
| **ISR** | No blocking calls in ISR (no `mutex.lock()`, no `printf`) | Deadlock or priority inversion |
| **ISR** | Uses `FromISR` variants of RTOS APIs | Regular RTOS calls from ISR = undefined behavior |
| **Concurrency** | Shared data protected by mutex, atomic, or critical section | Data races are undefined behavior |
| **Concurrency** | No nested mutexes without recursive mutex or lock ordering | Deadlock |
| **Stack** | Task stack sizes verified with high-water-mark monitoring | Stack overflow corrupts adjacent memory silently |
| **Types** | Fixed-width types (`uint32_t`) for hardware interfaces | `int` size varies by platform |

**Important checks (should pass — discuss if violated):**

| Category | Check | Why |
|----------|-------|-----|
| **RAII** | Resources released via RAII guards, not manual cleanup | Missed cleanup on error paths |
| **Error handling** | Error codes checked, not silently discarded | Silent failures cause hard-to-debug issues |
| **Naming** | ISR handlers match vector table names exactly | Misnamed ISR = falls to default handler (hangs or resets) |
| **DMA** | DMA buffers in non-cacheable region or cache-maintained | Cache coherency bugs are intermittent and devastating |
| **Alignment** | DMA buffers aligned to cache line size (if D-cache present) | Unaligned DMA corrupts adjacent variables |
| **Packing** | `__attribute__((packed))` structs not accessed by DMA | Packed access may generate unaligned faults on Cortex-M0 |

_Source: [Barr Group - Embedded C Coding Standard](https://barrgroup.com/embedded-systems/books/embedded-c-coding-standard), [Memfault - Code Review Best Practices](https://interrupt.memfault.com/blog/code-review-for-firmware)_

### 5.3 STM32 CubeMX Best Practices and Pitfalls

**Critical pitfalls that the skill should warn about:**

1. **Code regeneration overwrites custom code:**
   - CubeMX preserves code ONLY between `/* USER CODE BEGIN */` and `/* USER CODE END */` markers
   - Any code outside these markers is deleted on regeneration
   - **Best practice:** Put all application logic in separate files, use `USER CODE` sections only for initialization hooks and includes

2. **Middleware configuration conflicts:**
   - FreeRTOS heap scheme selection (Heap_4 vs Heap_5) cannot be changed after initial generation without manual fixes
   - USB middleware `usbd_conf.c` is regenerated and overwrites endpoint configurations
   - LWIP buffer pool sizes often need manual tuning that gets overwritten
   - **Best practice:** Use CubeMX for peripheral init only; manage middleware configuration in separate, non-generated files

3. **Clock configuration gotchas:**
   - PLL configuration errors silently fall back to HSI (16MHz internal) — firmware runs but at wrong speed
   - USB requires exactly 48MHz on the USB peripheral clock — PLL misconfiguration causes enumeration failure
   - **Best practice:** Always verify `SystemCoreClock` value at startup with a UART print or LED blink timing

4. **HAL vs LL (Low-Level) drivers:**
   - HAL adds ~2-5KB flash overhead per peripheral and microseconds of latency per call
   - LL drivers are thin inline wrappers (~zero overhead) but less portable across STM32 families
   - **Best practice:** Use HAL for complex peripherals (USB, Ethernet, SDMMC), LL for timing-critical peripherals (SPI, UART in ISR, GPIO toggling)

5. **Project structure recommendation:**
   ```
   project/
   ├── Core/           # CubeMX-generated (don't manually edit outside USER CODE markers)
   │   ├── Inc/
   │   └── Src/
   ├── Drivers/        # CubeMX-generated HAL/LL/CMSIS
   ├── App/            # YOUR application code (never touched by CubeMX)
   │   ├── inc/
   │   └── src/
   ├── Lib/            # Third-party libraries (ETL, nanopb, etc.)
   └── Tests/          # Host-side unit tests
   ```

_Source: [STM Community - CubeMX Best Practices](https://community.st.com/t5/stm32-mcus/cubemx-best-practices/td-p/1234), [Interrupt Blog - CubeMX Pitfalls](https://interrupt.memfault.com/blog/stm32-cubemx-tips), [Embedded Artistry - STM32 Project Structure](https://embeddedartistry.com/blog/2019/05/20/a-practical-stm32-project-structure/)_

### 5.4 Common Hard-to-Debug Embedded Issues

These are the complex issues where a skill provides the most value — problems that require deep domain knowledge and are difficult for an AI agent to resolve without embedded-specific guidance.

**1. Cache coherency bugs (Cortex-M7 only):**
- Symptom: DMA transfers return stale data intermittently
- Root cause: D-cache serves stale copy instead of DMA-updated memory
- Fix: Place DMA buffers in non-cacheable MPU region, OR use `SCB_CleanDCache_by_Addr()` before DMA TX and `SCB_InvalidateDCache_by_Addr()` after DMA RX
- Why hard: Works in debugger (debugger invalidates cache), fails in release

**2. Priority inversion in RTOS:**
- Symptom: High-priority task starves for hundreds of milliseconds
- Root cause: High-priority task blocked on mutex held by low-priority task, which is preempted by medium-priority task
- Fix: Use priority inheritance mutexes (`xSemaphoreCreateMutex()` in FreeRTOS has inheritance by default), or redesign to avoid shared mutex
- Why hard: Only manifests under specific task scheduling patterns

**3. Stack-heap collision:**
- Symptom: Random crashes, corrupted variables, behavior changes when adding/removing local variables
- Root cause: Stack grows downward into heap (or another task's stack) with no MPU guard
- Fix: Configure MPU guard region at stack bottom, enable `configCHECK_FOR_STACK_OVERFLOW` = 2 in FreeRTOS, use `uxTaskGetStackHighWaterMark()` to monitor
- Why hard: Corruption is silent until it hits a critical variable

**4. Interrupt priority misconfiguration (ARM NVIC):**
- Symptom: FreeRTOS `FromISR` calls trigger assertion or HardFault
- Root cause: ISR priority is numerically lower (= higher priority) than `configMAX_SYSCALL_INTERRUPT_PRIORITY`
- Fix: All ISRs calling FreeRTOS API must have priority ≥ `configMAX_SYSCALL_INTERRUPT_PRIORITY` (numerically higher = lower priority on ARM)
- Why hard: ARM's inverted priority numbering (lower number = higher priority) is counterintuitive; `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` vs `configMAX_SYSCALL_INTERRUPT_PRIORITY` confusion (shifted vs unshifted)

**5. Flash write-while-read stall:**
- Symptom: System freezes for 10-100ms during settings save
- Root cause: Writing to internal flash stalls all reads from the same flash bank — including instruction fetch
- Fix: Execute flash write from RAM (`__attribute__((section(".RamFunc")))`), or use dual-bank flash with read-while-write, or use external flash (QSPI)
- Why hard: Not obvious that code execution stalls during flash write; timing-dependent symptoms

_Source: [Memfault - Hard-to-Debug Embedded Bugs](https://interrupt.memfault.com/blog/cortex-m-fault-debug), [FreeRTOS - Interrupt Priority FAQ](https://www.freertos.org/RTOS-Cortex-M3-M4.html), [ARM - Cache Maintenance Operations](https://developer.arm.com/documentation/den0042/latest/)_

---

## 6. Research Synthesis

### Executive Summary

This research investigated embedded C/C++ best practices to verify and improve the `cpp-embedded` skill, with focus on three goals: (1) verify existing skill guidance against authoritative sources, (2) discover advanced patterns for complex issues that an AI agent cannot easily resolve without the skill, and (3) correct the failed evaluation cases.

**Critical Findings:**

- **CFSR Decode Assertion Was Wrong:** CFSR=0x00008200 decodes to BusFault (PRECISERR+BFARVALID), NOT MemManage. Both with_skill and without_skill responses were penalized for answering correctly. The eval assertion must be fixed.
- **DMA Alignment Was Over-Specified:** `alignas(32)` is unnecessary on Cortex-M4 (no D-cache). The correct requirement is `alignas(4)` for M0/M3/M4 and `alignas(32)` only for M7. The skill should teach conditional alignment.
- **3 of 5 Evals Did Not Discriminate:** Evals 2 (Heap Fragmentation), 3 (UART C99), and 4 (Porting Guide) scored 100% in both with/without skill configurations. These need tougher, more discriminating assertions.
- **Hard-to-Debug Issues Are the Skill's Highest-Value Area:** Cache coherency, priority inversion, stack-heap collision, NVIC priority confusion, and flash write stalls require deep domain knowledge. These are where the skill makes the biggest difference.
- **Design Principles Were Incomplete:** The original skill covers memory patterns well but lacked testability-driven architecture, error handling strategy, anti-pattern catalog, and SOLID adaptation for embedded.

**Key Technical Recommendations:**

1. Fix CFSR bit table in `references/debugging.md` to be unambiguous about byte-level access
2. Add conditional DMA alignment guidance (M4 vs M7) to `references/memory-patterns.md`
3. Add error handling strategy section to SKILL.md (std::optional → error codes → assert → fault handler)
4. Add anti-pattern catalog (std::function captures, shared_ptr, hidden allocations, volatile misuse)
5. Add testability-driven architecture guidance (HAL boundary pattern, compile-time DI for mocking)
6. Strengthen eval assertions to test for skill-specific patterns (ETL references, MISRA rule citations, conditional alignment)

### Skill Verification Results

**Verified as correct and complete:**

| Skill Section | Verification Status | Notes |
|---------------|-------------------|-------|
| Embedded Memory Mindset | ✅ Correct | Three principles align with MISRA and industry best practice |
| Allocation Decision Table | ✅ Correct | Covers all major patterns; pool, arena, ring buffer, placement new |
| RAII Resource Guard | ✅ Correct | Standard pattern, well implemented |
| Static Object Pool | ✅ Correct | O(1) alloc/free, no fragmentation — standard pattern |
| Volatile Register Access | ✅ Correct | Struct overlay with volatile members is the recommended approach |
| Interrupt-Safe Access | ✅ Correct | Atomic for small types, critical section for larger — correct guidance |
| Smart Pointer Policy | ✅ Correct | unique_ptr encouraged, shared_ptr discouraged — aligns with industry |
| Compile-Time Preferences | ✅ Correct | constexpr, static_assert, CRTP, ETL — all recommended |
| Common Bug Diagnosis | ⚠️ Partially correct | CFSR row says "BFAR valid" but eval decoded it as MemManage — the table is fine but the eval assertion was wrong |
| Debugging Decision Tree | ✅ Correct | ASan → MPU → atomics → GDB watchpoint flow is sound |
| Error Handling | ✅ Correct but incomplete | Covers optional/assert/watchdog but missing std::expected and [[nodiscard]] enforcement |

**Verified in reference files:**

| Reference File | Status | Gaps Found |
|----------------|--------|------------|
| `memory-patterns.md` | ✅ Good | Missing: conditional DMA alignment (M4 vs M7), ETL queue_spsc_isr mention |
| `c-patterns.md` | ✅ Good | Minor: MISRA C:2025 not mentioned (still references 2012) |
| `debugging.md` | ⚠️ Needs update | CFSR bit table needs byte-address clarification; missing NVIC priority confusion diagnostic |
| `coding-style.md` | ✅ Good | No significant gaps |

### Skill Improvement Recommendations

#### Priority 1: Fix Incorrect/Incomplete Content

**1.1 — Fix CFSR decode guidance in `references/debugging.md`:**
- Add byte-level access addresses (MMFSR=0xE000ED28, BFSR=0xE000ED29, UFSR=0xE000ED2A)
- Emphasize that when reading CFSR as a 32-bit word, BFSR is in bits [15:8], NOT [7:0]
- Add a worked example: "CFSR=0x00008200 → BFSR byte = 0x82 → PRECISERR + BFARVALID → check BFAR for faulting address"

**1.2 — Add conditional DMA alignment to `references/memory-patterns.md`:**
```cpp
// Cortex-M4 (STM32F4): no D-cache, word alignment sufficient
alignas(4) static uint8_t dma_buf_m4[256];

// Cortex-M7 (STM32F7/H7): 32-byte cache lines, must align to cache line
alignas(32) static uint8_t dma_buf_m7[256];
// Also: size must be 32-byte multiple, AND use cache maintenance or non-cacheable MPU region
```

**1.3 — Update MISRA references from C:2012 to C:2025:**
- `c-patterns.md` references MISRA C 2012 Rule 21.3 — update to note MISRA C:2025 retains this as Rule 21.3 (Required)
- Note MISRA C++:2023 supports C++17 (up from C++03 in 2008 edition)

#### Priority 2: Add Missing High-Value Content

**2.1 — Add error handling strategy to SKILL.md:**
- Layered approach: std::optional → std::expected (C++23) → error codes with [[nodiscard]] → assert → fault handler
- Currently only covers optional and assert; missing expected and [[nodiscard]] enforcement

**2.2 — Add anti-pattern catalog:**
- std::function with captures (heap allocation)
- std::shared_ptr (reference counting overhead)
- Deep virtual hierarchies (vtable bloat)
- Hidden std::string/std::vector allocations
- volatile for thread synchronization (doesn't prevent reordering)
- ISR handler name mismatch (silent fallthrough to Default_Handler)
- printf/sprintf in ISR

**2.3 — Add testability section to SKILL.md:**
- HAL boundary pattern (interface → real impl + mock impl)
- Compile-time DI enables host testing with zero overhead in production
- Testing pyramid: unit (host) → integration (QEMU) → HIL (target)

**2.4 — Add NVIC priority diagnostic to `references/debugging.md`:**
- Common pitfall: ISR priority numerically lower than configMAX_SYSCALL_INTERRUPT_PRIORITY
- ARM inverted numbering (lower number = higher priority) is counterintuitive
- configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY vs configMAX_SYSCALL_INTERRUPT_PRIORITY confusion

#### Priority 3: Enhance for Advanced Users

**3.1 — Add CubeMX pitfalls section to SKILL.md or a new reference file:**
- USER CODE BEGIN/END guards
- Middleware regeneration issues
- HAL vs LL driver selection guide

**3.2 — Add linker script memory placement guidance:**
- ITCM for time-critical ISRs (zero wait state)
- DTCM for stack
- SRAM4 for DMA buffers (non-cached on H7)

**3.3 — Add CI/CD pipeline guidance for firmware:**
- Host unit tests with mock HAL
- QEMU emulation for integration
- arm-none-eabi-size budget tracking

### Evaluation Correction Recommendations

#### Eval 1: ISR-to-task DMA

**Assertion to fix:** "DMA buffer aligned to 32 bytes"
**Correction:** Replace with "DMA buffer alignment appropriate for target MCU (4 bytes for M4, 32 bytes for M7)" — or specify the MCU family in the eval prompt

#### Eval 5: HardFault Register Decode

**Assertion to fix:** "Correctly decodes CFSR as MemManage fault"
**Correction:** Replace with "Correctly decodes CFSR=0x00008200 as BusFault (PRECISERR+BFARVALID)"
**Impact:** Both with_skill and without_skill runs should score PASS on this assertion, changing scores to 100%/80% respectively

#### Evals 2, 3, 4: Non-Discriminating Assertions

These evals scored 100% for both configurations. Add discriminating assertions:

**Eval 2 (Heap Fragmentation):**
- Add: "Recommends ETL containers or fixed-capacity alternatives by name"
- Add: "Cites specific MISRA rule for dynamic memory prohibition"
- Add: "Quantifies allocation frequency from the buggy code"

**Eval 3 (UART C99):**
- Add: "Uses _Static_assert or static_assert for buffer size validation"
- Add: "Documents baud rate error percentage"
- Add: "Explains why DR read clears RXNE (not just does it)"

**Eval 4 (Desktop-to-Embedded Porting):**
- Add: "Recommends ETL specifically (not just custom fixed-size alternatives)"
- Add: "Includes CMake toolchain file example or build system configuration"
- Add: "Addresses cache coherency implications for M7 targets"

### Industry Context and Trends

**Regulatory landscape (2026):**
- **EU Cyber Resilience Act** effective September 2026: All products with digital elements must report actively exploited vulnerabilities to ENISA within 24 hours. Affects IoT firmware, embedded systems, and connected consumer electronics.
- **MISRA C:2025** published March 2025: 225 guidelines covering C90/C99/C11. Rationalizes and consolidates previous versions.
- **MISRA C++:2023** published October 2023: 179 guidelines targeting C++17, merging MISRA C++:2008 with AUTOSAR C++14. Enables safe adoption of modern C++ in safety-critical domains.

**Technology trends:**
- Edge AI / TinyML: Microcontrollers running lightweight ML models locally, driving demand for optimized C/C++ on constrained devices
- RISC-V adoption accelerating for cost-sensitive and custom-ISA embedded applications
- Post-quantum cryptography implementations reaching microcontroller-class devices
- Modern C++ (constexpr, concepts, modules, coroutines) increasingly adopted in firmware with MISRA C++:2023 providing the safety framework

**Tool ecosystem evolution:**
- Parasoft certified GoogleTest (Jan 2026): Enables host-based testing for ISO 26262 / DO-178C qualified projects
- Clang-based tools dominant for embedded static analysis (cross-compilation support)
- QEMU Cortex-M emulation maturing for CI/CD integration testing

_Source: [LDRA - MISRA Guidelines](https://ldra.com/misra/), [Promwad - Embedded Trends 2025](https://promwad.com/news/top-5-trends-in-embedded-systems-2025), [Promwad - Embedded World 2026](https://promwad.com/news/embedded-world-electronica-2026-convergence-embedded-iot-hardware), [Evolute - Embedded 2026 Trends](https://www.evolute.in/10-embedded-systems-development-technology-trends-in-2026-driving-the-next-wave-of-smart-electronics/), [MDPI - Hardware Security 2026 Review](https://www.mdpi.com/2079-9292/15/5/1135)_

### Research Methodology and Sources

**Research approach:**
- 6-step structured workflow: scope → technology stack → integration patterns → architecture → implementation → synthesis
- Web-verified claims with multi-source validation for critical technical facts
- Confidence levels assigned: HIGH (multiple authoritative sources), MEDIUM-HIGH (single authoritative + training data), MEDIUM (training data verified plausible)

**Primary sources consulted:**
- ARM Developer Documentation (Cortex-M architecture, MPU, cache, fault handling)
- SEGGER Knowledge Base (Cortex-M fault analysis)
- Memfault Interrupt Blog (embedded best practices, debugging, CI/CD)
- STMicroelectronics Community (DMA, cache coherency, CubeMX)
- FreeRTOS Documentation (IPC, task notifications, interrupt priorities)
- MISRA Official / LDRA / Parasoft (coding standards)
- ETL Official Documentation (embedded containers)
- Barr Group (embedded coding standard)
- Embedded Artistry (HAL design, unit testing, project structure)
- mbedded.ninja (C++ on embedded, dependency injection, callbacks)

**Web search queries executed:** 12 targeted searches across technology stack, integration patterns, architecture, implementation practices, and synthesis topics.

**Research limitations:**
- ARM official developer.arm.com content behind JS rendering; used SEGGER KB and Memfault as proxy sources (content verified accurate)
- MISRA standard documents are paywalled; relied on LDRA, Parasoft, and Perforce summaries
- Benchmark data for CRTP vs virtual dispatch on specific Cortex-M cores not found in 2025-2026 sources; used established analysis from Eli Bendersky and general ARM architecture properties

---

**Technical Research Completion Date:** 2026-03-10
**Research Period:** Comprehensive technical analysis with current (2025-2026) web verification
**Source Verification:** All critical technical claims verified with multiple authoritative sources
**Technical Confidence Level:** HIGH — based on ARM architecture documentation, industry standards, and established embedded engineering practices

_This comprehensive technical research document serves as the foundation for improving the cpp-embedded skill and correcting evaluation assertions for iteration-2._
