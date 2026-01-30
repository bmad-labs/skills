# Kafka Test Isolation

## Table of Contents
- [Why Common Approaches Fail](#why-common-approaches-fail)
- [The Pre-Subscription Pattern](#the-pre-subscription-pattern)
- [Test Isolation Strategies](#test-isolation-strategies)
- [Common Issues and Solutions](#common-issues-and-solutions)

---

## Why Common Approaches Fail

| Common Approach | Why It Fails | Better Solution |
|-----------------|--------------|-----------------|
| `fromBeginning: true` | Reads ALL historical messages including from previous runs | Pre-subscribe with `fromBeginning: false`, clear buffer between tests |
| Unique consumer groups per test | Complex setup, offset cleanup needed | Single test consumer, message buffer clearing |
| Delete/recreate topics | Slow (1-3s per topic), admin permissions needed | Keep topics, clear in-memory buffers |
| Aggressive retries + short timeouts | Flaky in CI, race conditions | Fixed long waits (deterministic) |

### Key Insight

The commonly suggested `auto.offset.reset: 'earliest'` or `fromBeginning: true` does NOT provide test isolation because:

1. **Reads ALL historical messages** - Including from previous test runs, causing false positives/negatives
2. **Messages accumulate** - Multiple tests share the same topic
3. **Offset tracking issues** - Consumer group offset tracking causes inconsistent behavior

---

## The Pre-Subscription Pattern

### Core Principle

Subscribe to topics BEFORE the application starts, accumulate messages in memory buffers, and clear buffers between tests.

### Implementation Flow

```
1. beforeAll:
   ├── Connect KafkaTestHelper
   ├── Subscribe to output topics (fromBeginning: false)
   ├── Start NestJS app with Kafka microservice
   └── Wait 5s for consumer subscription

2. beforeEach:
   ├── Clear message buffers
   └── Wait 2s grace period

3. Test:
   ├── Publish to input topic
   ├── Poll for output messages (smart polling)
   └── Assert results

4. afterAll:
   ├── Disconnect KafkaTestHelper
   └── Close app
```

### Why This Works

| Approach | Problem | Pre-Subscription Solution |
|----------|---------|---------------------------|
| Ad-hoc subscription | Race condition - messages sent before consumer ready | Subscribe before app starts |
| `fromBeginning: true` | Reads old messages from previous runs | Use `fromBeginning: false`, clear buffer |
| Topic deletion | Slow, requires admin permissions | Keep topics, clear in-memory buffers only |
| Callback-based assertions | Complex async handling | Polling-based with timeout |

---

## Test Isolation Strategies

### Primary: Message Buffer Clearing

```typescript
// In beforeEach - the main isolation mechanism
beforeEach(async () => {
  kafkaHelper.clearMessages(outputTopic);
  await new Promise(r => setTimeout(r, 2000)); // Grace period
});
```

### Secondary: Unique Consumer Groups (for parallel suites)

```typescript
// Only needed if running test suites in parallel
const uniqueGroupId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

### Avoid: Topic Deletion/Recreation

```typescript
// DON'T DO THIS - slow and error-prone
await admin.deleteTopics({ topics: [testTopic] }); // 1-3s
await admin.createTopics({ topics: [{ topic: testTopic }] }); // 1-2s
await new Promise(r => setTimeout(r, 3000)); // Wait for propagation
```

---

## Common Issues and Solutions

### Issue: `fromBeginning: true` reads old messages

```typescript
// WRONG: Reads ALL historical messages
await consumer.subscribe({ topic, fromBeginning: true });

// CORRECT: Pre-subscribe with fromBeginning: false, clear buffer
await kafkaHelper.subscribeToTopic(outputTopic, false);
// In beforeEach:
kafkaHelper.clearMessages(outputTopic);
```

### Issue: Consumer not ready when test starts

**Known Data Race:** There's a known issue where the consumer may not be fully up and running after calling `.run()`. This often only triggers in CI.

```typescript
// Solution: Wait after starting microservices
await app.startAllMicroservices();
await app.init();
await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
```

### Issue: Tests interfere with each other

```typescript
// Solution: Clear message buffer between tests (NOT topics)
beforeEach(async () => {
  kafkaHelper.clearMessages(outputTopic);
  await new Promise(r => setTimeout(r, 2000)); // Grace period
});
```

### Issue: Slow consumer rebalancing

```typescript
// Solution 1: Optimize consumer config for fast rebalancing
const consumer = kafka.consumer({
  groupId: 'test-consumer',
  sessionTimeout: 6000,      // Reduce from 45s default
  heartbeatInterval: 2000,   // Must be < sessionTimeout/3
  rebalanceTimeout: 10000,   // Reduce from 60s default
});

// Solution 2: Use Admin API to verify rebalance completion
// This is MORE RELIABLE than blind waits
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
```

### Issue: Consumer not ready after dynamic subscription

When subscribing to topics after consumer is already running, rebalance occurs and messages may be lost.

```typescript
// ❌ WRONG: Assume subscription is immediate
await client.subscribeToResponseOf('new-topic');
await publish('new-topic', event); // Message may be lost during rebalance!

// ✅ CORRECT: Use Admin API to wait for rebalance completion
await client.subscribeToResponseOf('new-topic');
const groupId = client.getResponseConsumerGroupId();
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
await publish('new-topic', event); // Safe - consumer is stable
```

### Issue: Intermittent test failures (flaky tests)

Often caused by race conditions where tests assume consumer is ready based on time, not state.

```typescript
// ❌ WRONG: Blind wait may not be long enough
await app.startAllMicroservices();
await new Promise(r => setTimeout(r, 5000));

// ✅ CORRECT: State-based synchronization
await app.startAllMicroservices();
const state = await kafkaHelper.getConsumerGroupState(groupId);
console.log(`Consumer group state: ${state}`); // Debug visibility
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
```

### Issue: Consumer doesn't receive messages in CI

Common causes and solutions:

1. **Consumer not ready** - Add 5s wait after `startAllMicroservices()`
2. **Wrong broker address** - Use `localhost:9094` for external access from host
3. **Topic doesn't exist** - Use `ensureTopicExists()` before test
4. **Messages sent before consumer ready** - Use pre-subscription pattern

### Issue: Delivery reports not received

```typescript
// KafkaJS handles this automatically
// For node-rdkafka, flush after sending:
await producer.send({ topic, messages: [...] });
// producer.flush(10000);
```

---

## Test Isolation Summary

| Strategy | How It Works | When to Use |
|----------|--------------|-------------|
| **Admin API Synchronization** | Poll consumer group state until `Stable` | Always - replaces blind waits |
| **Message Buffer Clearing** | Clear accumulated messages in `beforeEach()` | Always - primary mechanism |
| **Pre-subscription Model** | Subscribe before app starts | Always - prevents race conditions |
| **Unique Consumer Groups** | Per-suite unique group ID | Only for parallel suites |
| **Environment-based Topics** | `env-${env}-topic-name` pattern | Multi-environment testing |

---

## Admin API Synchronization Pattern

**CRITICAL: Prefer Admin API state verification over blind waits.**

The Admin API `describeGroups` method provides real-time consumer group state. This enables deterministic test synchronization.

### Consumer Group States

| State | Numeric Value | Meaning | Test Action |
|-------|---------------|---------|-------------|
| `Unknown` | 0 | State unknown | ⏳ Retry query |
| `PreparingRebalance` | 1 | Members joining/leaving | ⏳ Poll and wait |
| `CompletingRebalance` | 2 | Partitions being assigned | ⏳ Poll and wait |
| `Stable` | 3 | All partitions assigned, ready | ✅ Proceed with test |
| `Dead` | 4 | Group has been deleted | ❌ Error - reinitialize |
| `Empty` | 5 | No active members | ⚠️ Check consumer started |

**Note:** KafkaJS uses string states ('Stable'), while @confluentinc/kafka-javascript (node-rdkafka) uses numeric states.

### Implementation Pattern

```typescript
/**
 * Wait for consumer group to reach Stable state.
 * Use this instead of fixed setTimeout() calls.
 */
async waitForConsumerGroupStable(
  groupId: string,
  timeoutMs: number = 15000,
  pollIntervalMs: number = 500
): Promise<void> {
  const startTime = Date.now();
  const STABLE_STATE = 3; // numeric for node-rdkafka, use 'Stable' for KafkaJS

  while (Date.now() - startTime < timeoutMs) {
    const state = await this.getConsumerGroupState(groupId);
    const stateNum = typeof state === 'string' ? parseInt(state, 10) : state;

    if (stateNum === STABLE_STATE) {
      await new Promise(r => setTimeout(r, 500)); // Small buffer
      return; // Ready!
    }

    // Log state for debugging
    const stateNames = {
      0: 'Unknown', 1: 'PreparingRebalance', 2: 'CompletingRebalance',
      3: 'Stable', 4: 'Dead', 5: 'Empty'
    };
    console.log(`Group '${groupId}' state: ${stateNames[stateNum] || state}`);

    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Timeout waiting for consumer group ${groupId} to be Stable`);
}
```

### When to Use Admin API Synchronization

1. **After `startAllMicroservices()`** - Before running any tests
2. **After dynamic topic subscription** - Before publishing to new topics
3. **After consumer scaling** - When adding/removing consumers
4. **Debugging flaky tests** - Replace blind waits with state verification
