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
// Solution: Optimize consumer config for fast rebalancing
const consumer = kafka.consumer({
  groupId: 'test-consumer',
  sessionTimeout: 6000,      // Reduce from 45s default
  heartbeatInterval: 2000,   // Must be < sessionTimeout/3
  rebalanceTimeout: 10000,   // Reduce from 60s default
});
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
| **Message Buffer Clearing** | Clear accumulated messages in `beforeEach()` | Always - primary mechanism |
| **Pre-subscription Model** | Subscribe before app starts | Always - prevents race conditions |
| **Unique Consumer Groups** | Per-suite unique group ID | Only for parallel suites |
| **Grace Periods** | Fixed delays between phases | Always - reliability over speed |
| **Environment-based Topics** | `env-${env}-topic-name` pattern | Multi-environment testing |
