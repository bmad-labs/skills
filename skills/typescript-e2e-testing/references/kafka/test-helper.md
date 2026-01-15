# KafkaTestHelper Implementation

## Table of Contents
- [Complete Implementation](#complete-implementation)
- [Usage Patterns](#usage-patterns)
- [API Reference](#api-reference)

---

## Complete Implementation

```typescript
// test/helpers/kafka-helper.ts
import { Kafka, Producer, Consumer, Admin } from 'kafkajs';

export class KafkaTestHelper {
  private kafka: Kafka;
  private producer: Producer;
  private admin: Admin;
  private messageBuffers: Map<string, Array<{ key: string | null; value: unknown }>> = new Map();
  private runningConsumers: Map<string, Consumer> = new Map();

  async connect(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'test-helper',
      brokers: [process.env.KAFKA_BROKER_URL || 'localhost:9094'],
    });
    this.producer = this.kafka.producer();
    this.admin = this.kafka.admin();
    await this.producer.connect();
    await this.admin.connect();
  }

  /**
   * Subscribe BEFORE app starts - accumulate messages in buffer.
   * Use fromBeginning: false for isolation (NOT true!)
   */
  async subscribeToTopic(topic: string, fromBeginning: boolean = false): Promise<void> {
    if (this.runningConsumers.has(topic)) {
      return; // Prevent duplicate subscriptions
    }

    const consumer = this.kafka.consumer({
      groupId: 'test-consumer-helper',
      sessionTimeout: 30000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning });

    // Initialize buffer
    this.messageBuffers.set(topic, []);

    // Start consuming - accumulate in buffer
    await consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value ? JSON.parse(message.value.toString()) : null;
        const buffer = this.messageBuffers.get(topic) || [];
        buffer.push({
          key: message.key?.toString() || null,
          value,
        });
        this.messageBuffers.set(topic, buffer);
      },
    });

    this.runningConsumers.set(topic, consumer);
  }

  /**
   * Poll for messages with timeout - key to async testing.
   * Returns as soon as expected count is reached (smart polling).
   */
  async waitForMessages(
    topic: string,
    count: number,
    timeoutMs: number = 10000
  ): Promise<Array<{ key: string | null; value: unknown }>> {
    if (!this.runningConsumers.has(topic)) {
      throw new Error(`No consumer subscribed to topic: ${topic}`);
    }

    const startTime = Date.now();
    const pollInterval = 50; // Check every 50ms for speed

    while (Date.now() - startTime < timeoutMs) {
      const messages = this.messageBuffers.get(topic) || [];
      if (messages.length >= count) {
        return messages.slice(0, count);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const messages = this.messageBuffers.get(topic) || [];
    throw new Error(`Timeout: Expected ${count} messages but received ${messages.length}`);
  }

  /**
   * Wait for a specific message matching a predicate.
   */
  async waitForMessage<T>(
    topic: string,
    predicate: (msg: { key: string | null; value: T }) => boolean,
    timeoutMs: number = 10000
  ): Promise<{ key: string | null; value: T }> {
    if (!this.runningConsumers.has(topic)) {
      throw new Error(`No consumer subscribed to topic: ${topic}`);
    }

    const startTime = Date.now();
    const pollInterval = 50;

    while (Date.now() - startTime < timeoutMs) {
      const messages = this.messageBuffers.get(topic) || [];
      const found = messages.find(predicate as any);
      if (found) {
        return found as { key: string | null; value: T };
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout: Message matching predicate not found`);
  }

  /**
   * CRITICAL: Clear buffer between tests for isolation.
   * This is the primary isolation mechanism - NOT topic deletion.
   */
  clearMessages(topic: string): void {
    this.messageBuffers.set(topic, []);
  }

  /** Clear all message buffers */
  clearAllMessages(): void {
    for (const topic of this.messageBuffers.keys()) {
      this.messageBuffers.set(topic, []);
    }
  }

  /** Get current messages without waiting */
  getMessages(topic: string): Array<{ key: string | null; value: unknown }> {
    return this.messageBuffers.get(topic) || [];
  }

  /** Publish single message */
  async publishEvent(topic: string, event: unknown, key?: string): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{
        key: key || null,
        value: JSON.stringify(event),
      }],
    });
  }

  /** Publish batch for performance tests */
  async publishBatch(
    topic: string,
    events: Array<{ event: unknown; key?: string }>
  ): Promise<void> {
    await this.producer.send({
      topic,
      messages: events.map(item => ({
        key: item.key || null,
        value: JSON.stringify(item.event),
      })),
    });
  }

  /** Ensure topic exists before testing */
  async ensureTopicExists(topic: string, numPartitions: number = 1): Promise<void> {
    const topics = await this.admin.listTopics();
    if (!topics.includes(topic)) {
      await this.admin.createTopics({
        topics: [{ topic, numPartitions }],
      });
    }
  }

  /** Delete consumer group offsets (for complete reset) */
  async deleteConsumerGroupOffsets(groupId: string): Promise<void> {
    try {
      await this.admin.deleteGroups([groupId]);
    } catch {
      // Group may not exist, ignore
    }
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.admin.disconnect();
    for (const consumer of this.runningConsumers.values()) {
      await consumer.disconnect();
    }
    this.runningConsumers.clear();
    this.messageBuffers.clear();
  }
}
```

---

## Usage Patterns

### Basic Setup and Teardown

```typescript
describe('Kafka E2E Tests', () => {
  let kafkaHelper: KafkaTestHelper;
  const outputTopic = 'test-output';

  beforeAll(async () => {
    kafkaHelper = new KafkaTestHelper();
    await kafkaHelper.connect();
    await kafkaHelper.subscribeToTopic(outputTopic, false);
    // ... start app
  }, 90000);

  afterAll(async () => {
    await kafkaHelper?.disconnect();
  });

  beforeEach(() => {
    kafkaHelper.clearMessages(outputTopic);
  });
});
```

### Waiting for Specific Messages

```typescript
it('should process order and emit completion event', async () => {
  const orderId = `order-${Date.now()}`;

  await kafkaHelper.publishEvent('orders.created', { orderId, items: [] });

  // Wait for specific message
  const completionEvent = await kafkaHelper.waitForMessage(
    'orders.completed',
    (msg) => msg.value.orderId === orderId,
    15000
  );

  expect(completionEvent.value).toMatchObject({
    orderId,
    status: 'completed',
  });
});
```

### Performance Testing

```typescript
it('should handle 100 messages within 30 seconds', async () => {
  const events = Array.from({ length: 100 }, (_, i) => ({
    event: { id: `event-${i}`, data: 'test' },
    key: `event-${i}`,
  }));

  const startTime = Date.now();
  await kafkaHelper.publishBatch('input-topic', events);

  const messages = await kafkaHelper.waitForMessages('output-topic', 100, 30000);
  const duration = Date.now() - startTime;

  expect(messages.length).toBe(100);
  expect(duration).toBeLessThan(30000);
});
```

---

## API Reference

| Method | Description |
|--------|-------------|
| `connect()` | Initialize Kafka connections |
| `subscribeToTopic(topic, fromBeginning)` | Pre-subscribe to topic, accumulate in buffer |
| `waitForMessages(topic, count, timeout)` | Poll for expected message count |
| `waitForMessage(topic, predicate, timeout)` | Poll for specific message |
| `clearMessages(topic)` | Clear buffer for topic (primary isolation) |
| `clearAllMessages()` | Clear all buffers |
| `getMessages(topic)` | Get current buffer contents |
| `publishEvent(topic, event, key)` | Publish single message |
| `publishBatch(topic, events)` | Publish multiple messages |
| `ensureTopicExists(topic, partitions)` | Create topic if not exists |
| `deleteConsumerGroupOffsets(groupId)` | Reset consumer group |
| `disconnect()` | Clean up all connections |
