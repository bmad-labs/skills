# Kafka E2E Testing Knowledge

## Overview

E2E testing with Kafka requires a fundamentally different approach than other infrastructure. Common patterns like `fromBeginning: true` fail to provide test isolation.

## Why Kafka Testing is Different

| Challenge | Why It Matters |
|-----------|----------------|
| Async processing | Messages processed with variable latency |
| Consumer groups | Offsets persist across test runs |
| Rebalancing | Consumers need time to join groups |
| Message retention | Old messages interfere with new tests |

## Common Approaches That FAIL

| Approach | Why It Fails |
|----------|--------------|
| `fromBeginning: true` | Reads ALL historical messages including from previous runs |
| Unique consumer groups per test | Complex setup, offset cleanup needed |
| Delete/recreate topics | Slow (1-3s per topic), admin permissions needed |
| Aggressive retries + short timeouts | Flaky in CI, race conditions |

**Key Insight:** `auto.offset.reset: 'earliest'` or `fromBeginning: true` does NOT provide test isolation because:
1. Reads ALL historical messages including from previous test runs
2. Multiple tests share the same topic - messages accumulate
3. Consumer group offset tracking causes inconsistent behavior

## The Proven Solution: Pre-Subscription + Buffer Clearing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        E2E Test Architecture                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Test       │         │   NestJS     │         │    Output    │    │
│  │   Helper     │         │   App        │         │    Topic     │    │
│  │  (Producer)  │         │  (Consumer)  │         │   Listener   │    │
│  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘    │
│         │                        │                        │             │
│         │ 1. Publish             │ 2. Consume            │ 3. Produce  │
│         ▼                        ▼                        ▼             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         KAFKA BROKER                             │   │
│  │  ┌─────────────┐                          ┌─────────────┐       │   │
│  │  │ Input Topic │  ───────────────────▶    │ Output Topic│       │   │
│  │  └─────────────┘                          └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                            │                            │
│                                            │ 4. Collect in Buffer      │
│                                            ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    MESSAGE BUFFER (In-Memory)                     │  │
│  │    [msg1, msg2, ...]  ◀── Clear between tests                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                            │                            │
│                                            │ 5. Poll & Assert           │
│                                            ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      TEST ASSERTIONS                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Test helper subscribes BEFORE the application starts**
2. **Messages accumulate in memory buffers** per topic
3. **Tests poll for expected messages** with timeout
4. **Buffers are cleared between tests** (NOT topics)

## Kafka-Specific Timing

| Phase | Value | Purpose |
|-------|-------|---------|
| Setup timeout | 90s | Full app + Kafka initialization |
| Consumer ready | Admin API | Use `waitForConsumerGroupStable()` instead of fixed wait |
| Between-test delay | 2s | Buffer clearing grace period |
| Polling interval | 50ms | Message check frequency |
| Processing wait | 10-20s max | Async message handling timeout |
| Test timeout | 30-60s | Account for variability |

## Admin API for Test Synchronization

**CRITICAL: Use Admin API to determine when tests are ready to proceed, instead of blind waits.**

### Why Admin API?

| Blind Wait Problems | Admin API Benefits |
|--------------------|--------------------|
| May wait too long (slow tests) | Proceeds as soon as ready |
| May not wait long enough (flaky) | State-based, deterministic |
| Guessing game in CI | Consistent across environments |
| No visibility into consumer state | Can log/debug actual state |

### Key Admin API Methods for E2E Tests

| Method | Purpose |
|--------|---------|
| `describeGroups([groupId])` | Get consumer group state (Stable, PreparingRebalance, etc.) |
| `listGroups()` | List all consumer groups |
| `deleteGroups([groupId])` | Reset consumer group for clean start |

### Consumer Group States

```
PreparingRebalance (1) → CompletingRebalance (2) → Stable (3)
          ↑                                            │
          └──────────── (new subscription) ────────────┘
```

| State | Numeric | String (KafkaJS) | Meaning |
|-------|---------|------------------|---------|
| Unknown | 0 | 'Unknown' | State unknown |
| PreparingRebalance | 1 | 'PreparingRebalance' | Rebalance in progress ⏳ |
| CompletingRebalance | 2 | 'CompletingRebalance' | Assigning partitions ⏳ |
| **Stable** | **3** | **'Stable'** | **Ready to consume ✅** |
| Dead | 4 | 'Dead' | Group deleted ❌ |
| Empty | 5 | 'Empty' | No consumers ⚠️ |

**Note:** @confluentinc/kafka-javascript (node-rdkafka) uses numeric states, KafkaJS uses strings.

### Usage Pattern

```typescript
// After starting microservices or subscribing to topics
const groupId = client.getConsumerGroupId();
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
// NOW safe to publish test messages
```

## Broker Options for E2E Tests

| Broker | Startup Time | Memory | Recommendation |
|--------|--------------|--------|----------------|
| Redpanda | ~5.1s | Low (C++) | ✅ Recommended for tests |
| Kafka Native | ~5.1s | Medium | Good for CI |
| Confluent Kafka | ~8.5s | High (JVM) | Production parity |

## Test Category Organization

```
test/
├── e2e/
│   ├── 01-happy-path.e2e-spec.ts      # Basic message flow
│   ├── 02-error-handling.e2e-spec.ts  # Malformed messages
│   ├── 03-performance.e2e-spec.ts     # Throughput, latency
│   └── 04-data-integrity.e2e-spec.ts  # Zero data loss
├── fixtures/events/
│   ├── valid-events.ts
│   └── malformed-events.ts
└── helpers/
    ├── kafka-helper.ts                # KafkaTestHelper
    └── assertion-helpers.ts
```

## Key Files in This Section

| File | Purpose |
|------|---------|
| [rules.md](rules.md) | Kafka-specific testing rules |
| [test-helper.md](test-helper.md) | KafkaTestHelper implementation |
| [docker-setup.md](docker-setup.md) | Redpanda/Kafka Docker configs |
| [performance.md](performance.md) | Optimization techniques |
| [examples.md](examples.md) | Complete test examples |
