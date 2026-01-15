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
| App startup wait | 5s | Consumer subscription |
| Between-test delay | 2s | Buffer clearing grace period |
| Polling interval | 50ms | Message check frequency |
| Processing wait | 10-20s max | Async message handling timeout |
| Test timeout | 30-60s | Account for variability |

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
