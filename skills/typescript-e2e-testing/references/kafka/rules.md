# Kafka E2E Testing Rules

## Core Rules

| Rule | Requirement |
|------|-------------|
| Topic creation | Use Admin to create topics - NEVER rely on auto-create |
| Kafka waits | Use smart polling (10-20s timeout, 50ms interval) |
| Consumer isolation | Use `fromBeginning: false`, clear buffer between tests |
| Consumer group | Unique per test suite: `${baseId}-e2e-${Date.now()}` |
| Microservice config | `{ inheritAppConfig: true }` |
| Consumer readiness | Use Admin API `waitForConsumerGroupStable()` - NOT blind waits |

## Topic Management Rules

### NEVER Rely on Auto-Create

Auto-create causes intermittent test failures due to timing issues. Topics may not be ready when tests start.

```typescript
// ❌ WRONG: Relying on auto-create
const producer = kafka.producer({ allowAutoTopicCreation: true });
await producer.send({ topic: 'my-topic', messages: [...] }); // Topic may not exist!

// ✅ CORRECT: Explicit topic creation with Admin
beforeAll(async () => {
  await kafkaHelper.connect();
  await kafkaHelper.createTopicIfNotExists(inputTopic, 1);  // Create first
  await kafkaHelper.createTopicIfNotExists(outputTopic, 1);
  // Then subscribe and start app
});
```

### Setup Order

1. Initialize KafkaTestHelper and connect
2. Create topics with Admin (createTopicIfNotExists)
3. Subscribe to output topics
4. Start application

## Isolation Rules

### Primary: Message Buffer Clearing

```typescript
// In beforeEach - the main isolation mechanism
beforeEach(async () => {
  kafkaHelper.clearMessages(outputTopic);
  await new Promise(r => setTimeout(r, 2000)); // Grace period
});
```

### DO NOT Use

```typescript
// ❌ WRONG: fromBeginning reads ALL historical messages
await consumer.subscribe({ topic, fromBeginning: true });

// ❌ WRONG: Topic deletion is slow and error-prone
await admin.deleteTopics({ topics: [testTopic] });
await admin.createTopics({ topics: [{ topic: testTopic }] });
```

### DO Use

```typescript
// ✅ CORRECT: Pre-subscribe with fromBeginning: false
await kafkaHelper.subscribeToTopic(outputTopic, false);

// ✅ CORRECT: Clear buffer between tests
beforeEach(() => {
  kafkaHelper.clearMessages(outputTopic);
});
```

## Consumer Configuration Rules

### Optimized for E2E Tests

```typescript
const consumer = kafka.consumer({
  groupId: `test-consumer-${Date.now()}`, // Unique per suite

  // FAST REBALANCING
  sessionTimeout: 6000,      // Reduce from 45s default
  heartbeatInterval: 2000,   // Must be < sessionTimeout/3
  rebalanceTimeout: 10000,   // Reduce from 60s default

  // NO RETRIES IN TESTS
  retry: { retries: 0 },

  // IMMEDIATE FETCH
  maxWaitTimeInMs: 100,      // Max wait 100ms (default: 5000ms)
});
```

## Producer Configuration Rules

```typescript
const producer = kafka.producer({
  allowAutoTopicCreation: true,
  metadataMaxAge: 10000,  // 10s (default: 300s)
});

await producer.send({
  topic: 'test-topic',
  messages: [{ value: JSON.stringify(event) }],
  acks: 1,        // Don't wait for all replicas
  timeout: 5000,
});
```

## NestJS Kafka Setup Rules

```typescript
// ✅ REQUIRED: Create topics BEFORE starting app
await kafkaHelper.createTopicIfNotExists(inputTopic, 1);
await kafkaHelper.createTopicIfNotExists(outputTopic, 1);

// ✅ REQUIRED: Generate unique consumer group
const uniqueGroupId = `${configService.get('KAFKA_GROUP_ID')}-e2e-${Date.now()}`;

// ✅ REQUIRED: Connect microservice with inheritAppConfig
app.connectMicroservice({
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: configService.get('KAFKA_CLIENT_ID'),
      brokers: [configService.get('KAFKA_BROKER')],
    },
    consumer: {
      groupId: uniqueGroupId,
      // ❌ DON'T use allowAutoTopicCreation - create topics with Admin instead
    },
    subscribe: { fromBeginning: false }, // NOT fromBeginning!
  },
}, { inheritAppConfig: true }); // ← CRITICAL

// ✅ REQUIRED: Wait for consumer subscription
await app.startAllMicroservices();
await app.init();
await new Promise(r => setTimeout(r, 5000)); // Wait 5s
```

## Consumer Group Synchronization Rules

### CRITICAL: Use Admin API for Consumer Readiness

**Never use blind waits to assume consumer readiness.** Use Admin API `describeGroups` to verify consumer group state.

```typescript
// ❌ WRONG: Blind wait (guessing consumer is ready)
await app.startAllMicroservices();
await new Promise(r => setTimeout(r, 5000)); // Hope 5s is enough

// ✅ CORRECT: Admin API state verification
await app.startAllMicroservices();
const groupId = getConsumerGroupId(); // Expose from your client
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
```

### After Dynamic Topic Subscription

When subscribing to topics after consumer is already running, a rebalance occurs. The consumer is NOT ready until rebalance completes.

```typescript
// ❌ WRONG: Assume subscription is immediate
await client.subscribeToResponseOf('new-topic');
await kafkaHelper.publishEvent('new-topic', event); // May be lost!

// ✅ CORRECT: Wait for rebalance completion
await client.subscribeToResponseOf('new-topic');
await kafkaHelper.waitForConsumerGroupStable(groupId, 15000);
await kafkaHelper.publishEvent('new-topic', event); // Safe
```

### Consumer Group State Reference

| State | Value | Ready? | Action |
|-------|-------|--------|--------|
| `Stable` | 3 | ✅ Yes | Proceed with test |
| `PreparingRebalance` | 1 | ❌ No | Wait |
| `CompletingRebalance` | 2 | ❌ No | Wait |
| `Empty` | 5 | ❌ No | Consumer not started |
| `Dead` | 4 | ❌ No | Error - check setup |

**Note:** @confluentinc/kafka-javascript uses numeric values, KafkaJS uses string names.

---

## Polling Rules

### Smart Polling vs Fixed Waits

```typescript
// ❌ WRONG: Fixed wait (slow - always waits full time)
await new Promise(resolve => setTimeout(resolve, 8000));
const messages = kafkaHelper.getMessages(topic);

// ✅ CORRECT: Smart polling (fast - returns when ready)
const messages = await kafkaHelper.waitForMessages(topic, 1, 20000);
```

### Polling Implementation

```typescript
async waitForMessages(topic: string, count: number, timeoutMs: number = 10000) {
  const startTime = Date.now();
  const pollInterval = 50; // Check every 50ms

  while (Date.now() - startTime < timeoutMs) {
    const messages = this.messageBuffers.get(topic) || [];
    if (messages.length >= count) {
      return messages.slice(0, count);
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error(`Timeout: Expected ${count} messages`);
}
```

## Error Handling Rules

### Known Kafka Issues

| Issue | Solution |
|-------|----------|
| Topic doesn't exist / timing issues | Use `createTopicIfNotExists()` in beforeAll - NEVER auto-create |
| Consumer not ready | Wait 5s after `startAllMicroservices()` |
| Wrong broker address | Use `localhost:9094` for external access |
| Slow rebalancing | Optimize consumer config (sessionTimeout: 6000) |
| Messages from previous runs | Use `fromBeginning: false`, clear buffer |

### Retry Mock Rules

```typescript
// ❌ BAD: Only mocking one failure
mockHttpService.post.mockReturnValueOnce(of({ status: 500 }));

// ✅ GOOD: Mock ALL retry attempts
mockHttpService.post.mockClear();
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 1
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 2
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 3
```

## Checklist

**Topic Management:**
- [ ] Create topics with Admin in `beforeAll` (createTopicIfNotExists)
- [ ] NEVER rely on auto-create
- [ ] Use unique topic names per suite: `topic-${Date.now()}`

**Setup:**
- [ ] Unique consumer group ID per suite
- [ ] `fromBeginning: false` in subscribe options
- [ ] `inheritAppConfig: true` in connectMicroservice
- [ ] Pre-subscribe to output topics before app starts

**Consumer Synchronization (Admin API):**
- [ ] Use `waitForConsumerGroupStable()` instead of blind waits
- [ ] Expose consumer group ID from your Kafka client
- [ ] After dynamic subscription, wait for rebalance completion
- [ ] Verify state is `Stable` before publishing test messages

**Test Isolation:**
- [ ] Clear message buffer in `beforeEach`
- [ ] 2s grace period after buffer clearing
- [ ] NO topic deletion/recreation between tests

**Assertions:**
- [ ] Use smart polling (waitForMessages)
- [ ] 20s max timeout for message expectations
- [ ] Verify message content with `toMatchObject`

**Performance:**
- [ ] Consumer optimized (sessionTimeout: 6000)
- [ ] Producer optimized (acks: 1)
- [ ] Polling interval: 50ms
