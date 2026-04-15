# Database Selection for Shipping Container Tracking Microservice: Trade-off Analysis

**System:** Container Tracking Event Processor -- NestJS + Kafka Microservice
**Date:** 2026-04-15
**Author:** TanNT (Architect)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Context and Requirements](#2-context-and-requirements)
3. [Technology Options](#3-technology-options)
4. [Master Comparison Matrix](#4-master-comparison-matrix)
5. [Per-Dimension Detail Tables](#5-per-dimension-detail-tables)
6. [Risk Assessment](#6-risk-assessment)
7. [Implementation Complexity](#7-implementation-complexity)
8. [Recommendation](#8-recommendation)

---

## 1. Executive Summary

A new NestJS microservice consumes shipping container tracking events from Kafka at **~10K events/second**. The primary query pattern is **simple lookup by container ID** (latest position, event history for a container). Two database candidates are evaluated: **PostgreSQL** and **MongoDB**.

Both databases can handle this workload, but they differ in write throughput characteristics, schema flexibility, operational maturity within the team's stack, and long-term query flexibility. See **Section 4** for the scored comparison matrix.

**Bottom-line recommendation:** **PostgreSQL** is the recommended choice for this workload, scoring higher overall due to stronger transactional guarantees, better ecosystem alignment with NestJS/TypeORM, and sufficient write performance at the target scale -- while MongoDB's document model advantages are not strongly differentiated for this use case.

---

## 2. Context and Requirements

### 2.1 Problem Statement

- A new microservice receives container tracking events (GPS positions, port arrivals/departures, customs status changes) from Kafka
- Events arrive at approximately **10,000 events/second** sustained, with bursts up to 20K/sec
- Each event is associated with a **container ID** (e.g., `MSCU1234567`)
- Primary query patterns:
  - Get latest tracking event for a given container ID
  - Get event history for a container ID (time-ordered)
  - Bulk status queries across a set of container IDs (batch lookups)

### 2.2 Technical Context

| Aspect | Detail |
|--------|--------|
| **Runtime** | NestJS (TypeScript) |
| **Message Broker** | Apache Kafka (already in production) |
| **Event Size** | ~0.5-2 KB per event (JSON) |
| **Retention** | 90 days of event history |
| **Team Experience** | Strong PostgreSQL experience; moderate MongoDB experience |
| **Existing Infra** | PostgreSQL already used for other services; MongoDB would be net-new |

### 2.3 Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Write throughput | 10K events/sec sustained, 20K burst |
| Read latency (single container lookup) | < 10ms p99 |
| Data retention | 90 days |
| Availability | 99.9% |
| Consistency | Eventual consistency acceptable for reads; writes must not lose events |

---

## 3. Technology Options

### Option A: PostgreSQL

Relational database with strong ACID guarantees. Using table partitioning (by date range) for retention management, and B-tree index on `container_id` + timestamp for query performance. NestJS integration via TypeORM or Prisma.

**Schema approach:**
```sql
CREATE TABLE container_events (
    id              BIGSERIAL,
    container_id    VARCHAR(11) NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    payload         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (event_timestamp);

CREATE INDEX idx_container_events_lookup 
    ON container_events (container_id, event_timestamp DESC);
```

**Key characteristics:**
- Table partitioning enables efficient 90-day retention (drop old partitions)
- JSONB column for flexible payload without full schema migration
- Mature connection pooling (PgBouncer) for high-concurrency writes
- `COPY` or batch `INSERT` for high-throughput ingestion

### Option B: MongoDB

Document database with flexible schema. Using a collection with compound index on `containerId` + `eventTimestamp`. NestJS integration via Mongoose or the native MongoDB driver.

**Schema approach:**
```json
{
  "containerId": "MSCU1234567",
  "eventType": "GPS_UPDATE",
  "eventTimestamp": "2026-04-15T08:30:00Z",
  "location": {
    "type": "Point",
    "coordinates": [103.8198, 1.3521]
  },
  "payload": {
    "speed": 12.5,
    "heading": 245
  }
}
```

**Key characteristics:**
- Native JSON document storage aligns with Kafka event format
- WiredTiger storage engine with document-level locking
- TTL index for automatic 90-day expiration
- Replica set for high availability; sharding available if needed
- Geospatial indexes for location-based queries (future potential)

---

## 4. Master Comparison Matrix

**Scoring:** 1 (Poor) to 5 (Excellent). Weights reflect the priorities of this specific use case.

| # | Dimension | Weight | PostgreSQL | MongoDB | Notes |
|---|-----------|--------|------------|---------|-------|
| 1 | Write Throughput (10K/sec) | 20% | 4 | 5 | MongoDB slightly faster for document inserts at this scale; PG with batching is competitive |
| 2 | Read Latency (container lookup) | 15% | 5 | 5 | Both achieve < 10ms with proper indexing |
| 3 | Schema Flexibility | 10% | 4 | 5 | PG's JSONB provides flexibility; MongoDB natively schema-free |
| 4 | Data Retention Management | 10% | 5 | 4 | PG partition drops are instant; MongoDB TTL has background deletion overhead |
| 5 | NestJS Ecosystem Fit | 15% | 5 | 4 | TypeORM/Prisma are first-class in NestJS; Mongoose is mature but slightly more boilerplate |
| 6 | Operational Complexity | 10% | 5 | 3 | Team already operates PG; MongoDB is net-new infrastructure |
| 7 | Transactional Guarantees | 5% | 5 | 4 | PG has stronger ACID; MongoDB multi-doc transactions are sufficient but less mature |
| 8 | Query Flexibility (future) | 5% | 5 | 3 | SQL enables ad-hoc analytics, JOINs to other services; MongoDB aggregation pipeline is powerful but less familiar |
| 9 | Horizontal Scalability | 5% | 3 | 5 | MongoDB native sharding is simpler than PG Citus/partitioning for horizontal scale-out |
| 10 | Geospatial Capabilities | 5% | 4 | 5 | MongoDB has best-in-class geospatial; PostGIS is also excellent |

### Weighted Scores

| Option | Calculation | Total |
|--------|-------------|-------|
| **PostgreSQL** | (4x20)+(5x15)+(4x10)+(5x10)+(5x15)+(5x10)+(5x5)+(5x5)+(3x5)+(4x5) | **4.55** |
| **MongoDB** | (5x20)+(5x15)+(5x10)+(4x10)+(4x15)+(3x10)+(4x5)+(3x5)+(5x5)+(5x5) | **4.35** |

---

## 5. Per-Dimension Detail Tables

### 5.1 Write Throughput (Weight: 20%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Single-row insert rate** | ~5-8K/sec per connection | ~10-15K/sec per connection |
| **Batch insert rate** | 50-100K/sec with `COPY` or multi-row INSERT | 30-50K/sec with `insertMany` (unordered) |
| **Kafka consumer pattern** | Batch consume + batch INSERT every 100-500ms | Individual or batch `insertMany` |
| **Bottleneck** | WAL writes, index maintenance | WiredTiger journal, index updates |
| **Tuning knobs** | `synchronous_commit=off`, batch size, connection pooling | Write concern `w:1`, journal: false (risky), batch size |
| **Score** | 4 | 5 |

**Analysis:** At 10K/sec, both databases handle the load with batching. PostgreSQL's `COPY` command or multi-row INSERT with `synchronous_commit=off` comfortably reaches this target. MongoDB's document-oriented write path has slightly less overhead per write. The difference is marginal at this scale -- it becomes meaningful above 50K/sec.

### 5.2 Read Latency (Weight: 15%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Single container lookup** | < 1ms with B-tree index on `container_id` | < 1ms with compound index on `containerId` |
| **History query (last 100 events)** | < 5ms with composite index `(container_id, event_timestamp DESC)` | < 5ms with compound index `{containerId: 1, eventTimestamp: -1}` |
| **Batch lookup (100 containers)** | < 10ms with `IN` clause | < 10ms with `$in` operator |
| **Hot data caching** | `shared_buffers` + OS page cache | WiredTiger cache + OS page cache |
| **Score** | 5 | 5 |

**Analysis:** Both databases achieve sub-10ms p99 for the required query patterns. With proper indexing, there is no meaningful difference for simple key-based lookups.

### 5.3 Schema Flexibility (Weight: 10%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Schema evolution** | ALTER TABLE for columns; JSONB for flexible parts | No migration needed; schema validation optional |
| **Mixed event types** | JSONB `payload` column handles varying structures | Naturally supports heterogeneous documents |
| **Validation** | CHECK constraints, NOT NULL, custom domains | JSON Schema validation (optional) |
| **Migration tooling** | TypeORM migrations, Prisma migrate | No migrations needed; Mongoose schema versioning |
| **Score** | 4 | 5 |

**Analysis:** Container tracking events have a mostly-stable core schema (container ID, timestamp, location) with a variable payload. PostgreSQL's JSONB handles this well -- full document flexibility is not a strong differentiator here.

### 5.4 Data Retention Management (Weight: 10%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Mechanism** | Table partitioning by month; `DROP PARTITION` for cleanup | TTL index on `eventTimestamp` |
| **Cleanup performance** | Instant (drop partition = metadata-only operation) | Background thread deletes expired documents continuously |
| **Impact on live traffic** | Zero impact | TTL deletion competes with write I/O |
| **Storage reclamation** | Immediate | Requires compaction for full space reclaim |
| **Operational complexity** | Need partition creation cron/automation | Set-and-forget TTL index |
| **Score** | 5 | 4 |

**Analysis:** At 10K/sec over 90 days, the table will accumulate ~77 billion events. Partition drops are instantaneous and have zero I/O impact. MongoDB's TTL index works but the continuous background deletion at this scale creates I/O pressure and requires compaction.

### 5.5 NestJS Ecosystem Fit (Weight: 15%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **ORM/ODM** | TypeORM (first-class NestJS module), Prisma, MikroORM | Mongoose (`@nestjs/mongoose`), Prisma (preview) |
| **NestJS documentation** | Primary examples use PostgreSQL | Supported but secondary in docs |
| **Type safety** | Full with Prisma or TypeORM entities | Mongoose schemas + TypeScript interfaces (more boilerplate) |
| **Existing team patterns** | Already in use across other services | Would be the first MongoDB service |
| **Kafka integration** | Consume -> TypeORM repository -> save | Consume -> Mongoose model -> save |
| **Score** | 5 | 4 |

**Analysis:** The team already uses PostgreSQL with NestJS. Adopting MongoDB introduces a new ODM, new patterns, and a learning curve with no strong justification from the query requirements.

### 5.6 Operational Complexity (Weight: 10%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Infrastructure** | Already provisioned and monitored | Net-new: deploy replica set or Atlas |
| **Backup/restore** | Existing pg_dump / pgBackRest pipeline | New backup strategy needed (mongodump or Atlas backup) |
| **Monitoring** | Existing Grafana dashboards, pg_stat_statements | New dashboards needed (mongostat, Atlas monitoring) |
| **Team expertise** | Strong (daily use) | Moderate (used in past projects, not current) |
| **On-call runbooks** | Exist | Need to be created |
| **Score** | 5 | 3 |

**Analysis:** Adding MongoDB means a second database platform to operate, monitor, and maintain. This is a significant operational cost with no proportional benefit for this use case.

### 5.7 Transactional Guarantees (Weight: 5%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Single-record writes** | Full ACID | Full ACID (single document) |
| **Multi-record transactions** | Full ACID, mature | Multi-document transactions (since 4.0), higher overhead |
| **Relevance to this use case** | Low -- events are independent writes | Low -- events are independent writes |
| **Score** | 5 | 4 |

**Analysis:** Container tracking events are independent writes -- transactions across multiple events are not needed. Both databases are sufficient, but PostgreSQL's transactional maturity is a safety net for future requirements.

### 5.8 Query Flexibility (Weight: 5%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Ad-hoc analytics** | Full SQL: window functions, CTEs, aggregations | Aggregation pipeline (powerful but less familiar) |
| **Cross-service JOINs** | JOIN to other PG-backed services directly | Requires application-level joins or data duplication |
| **Reporting** | Connect any BI tool via SQL | Limited BI tool support; need connectors |
| **Score** | 5 | 3 |

**Analysis:** Even though current query patterns are simple, future analytics needs (dwell time analysis, route optimization, carrier performance) are much easier with SQL.

### 5.9 Horizontal Scalability (Weight: 5%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Sharding** | Citus extension or application-level partitioning | Native sharding by `containerId` |
| **Scale-out complexity** | High (Citus adds operational complexity) | Moderate (built-in, but config shards + mongos) |
| **When needed** | Beyond ~100K/sec or >1TB active dataset | Beyond ~100K/sec or >1TB active dataset |
| **Score** | 3 | 5 |

**Analysis:** At 10K/sec, neither database requires horizontal scaling. PostgreSQL with partitioning handles this comfortably on a single node. If the workload grows 10x, MongoDB's native sharding would be simpler to implement.

### 5.10 Geospatial Capabilities (Weight: 5%)

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Geospatial extension** | PostGIS (industry standard for GIS) | Native geospatial indexes and operators |
| **Query types** | All geospatial operations (distance, within, intersects) | 2dsphere, near, geoWithin, geoIntersects |
| **Ease of use** | Requires PostGIS extension installation | Built-in, no extension needed |
| **Score** | 4 | 5 |

**Analysis:** Both are excellent for geospatial queries. MongoDB's built-in support is slightly more convenient. PostGIS is more powerful for complex GIS operations but requires extension setup.

---

## 6. Risk Assessment

### 6.1 PostgreSQL Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Write throughput ceiling at extreme scale (>50K/sec) | Low | Medium | Batch inserts with `COPY`, connection pooling via PgBouncer, `synchronous_commit=off` |
| Table bloat from high write volume | Medium | Medium | Partition-based retention (drop old partitions); autovacuum tuning |
| Partition management overhead | Low | Low | Automate partition creation with pg_partman or cron |
| JSONB payload queries slower than native document DB | Low | Low | Create GIN index on JSONB if needed; most queries use container_id, not payload |

### 6.2 MongoDB Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Operational burden of net-new infrastructure | High | Medium | Use MongoDB Atlas (managed) to reduce ops burden; but adds cloud cost |
| TTL deletion I/O pressure at high volume | Medium | Medium | Tune TTL monitor sleep interval; schedule during low traffic |
| Team unfamiliarity leads to suboptimal schema/index design | Medium | Medium | Invest in training; code review by MongoDB-experienced engineer |
| Fragmented tooling (two DB platforms to maintain) | High | Low | Accept as cost of adoption; document runbooks |
| WiredTiger cache pressure under sustained writes | Low | High | Size cache appropriately (50% of RAM); monitor eviction rates |

---

## 7. Implementation Complexity

### 7.1 Effort Comparison

| Activity | PostgreSQL | MongoDB |
|----------|-----------|---------|
| Database provisioning | 0 (exists) | 2-3 days (new cluster + networking + auth) |
| Schema/collection setup | 0.5 day | 0.5 day |
| NestJS integration | 0.5 day (familiar patterns) | 1-2 days (new ODM patterns, Mongoose setup) |
| Kafka consumer -> DB write pipeline | 1 day | 1 day |
| Index optimization | 0.5 day | 0.5 day |
| Monitoring setup | 0.5 day (extend existing) | 2 days (new dashboards, alerts) |
| Backup/DR configuration | 0 (existing pipeline) | 1-2 days |
| Performance testing | 1 day | 1 day |
| **Total estimated effort** | **~4 days** | **~9-11 days** |

### 7.2 Ongoing Maintenance

| Activity | PostgreSQL | MongoDB |
|----------|-----------|---------|
| Partition management | Automated (pg_partman) | None (TTL handles it) |
| Vacuum/compaction | Autovacuum (automatic) | Compaction (manual or scheduled) |
| Upgrades | In existing upgrade cycle | Separate upgrade cycle |
| On-call | Existing runbooks | New runbooks needed |

---

## 8. Recommendation

### 8.1 Decision

**Recommended: PostgreSQL (Option A)**

### 8.2 Rationale

1. **Performance is sufficient.** PostgreSQL with batch inserts and partitioning handles 10K/sec with headroom. The read patterns (container ID lookups) perform identically on both databases.

2. **Operational efficiency.** Zero new infrastructure, zero new monitoring, zero new runbooks. The team already operates PostgreSQL in production. Adding MongoDB for this use case introduces operational overhead disproportionate to the marginal write-throughput benefit.

3. **Ecosystem alignment.** NestJS + TypeORM/Prisma + PostgreSQL is the team's established stack. Consistency across services reduces cognitive overhead and enables code reuse.

4. **Future flexibility.** SQL enables ad-hoc analytics, cross-service joins, and BI integration without additional tooling. Container tracking data has high analytical value (dwell times, route optimization, carrier performance).

5. **Retention management.** Partition-based retention is more efficient than TTL indexes at this event volume -- instant partition drops versus continuous background deletion.

### 8.3 When to Reconsider

MongoDB would become the better choice if:

- **Write volume exceeds 50K/sec sustained** and PostgreSQL batching reaches its limits
- **Schema becomes highly heterogeneous** with many different event types having entirely different structures
- **Horizontal sharding is needed** (multiple TB of active data that cannot fit on a single node)
- **Geospatial queries become a primary access pattern** and the team wants built-in geospatial support without PostGIS setup

### 8.4 Implementation Notes for PostgreSQL

1. **Kafka consumer strategy:** Use `@nestjs/microservices` KafkaJS consumer with batch processing. Accumulate events in memory for 100-500ms, then bulk INSERT.
2. **Partitioning:** Use `pg_partman` to auto-create monthly partitions. Set retention policy to drop partitions older than 90 days.
3. **Connection pooling:** Deploy PgBouncer in front of PostgreSQL to handle high concurrency from multiple Kafka consumer instances.
4. **Write tuning:** Set `synchronous_commit = off` for the tracking events database/role (acceptable since Kafka is the durable source of truth -- events can be replayed).
5. **Index strategy:** Composite index `(container_id, event_timestamp DESC)` covers both latest-event and history queries efficiently.
6. **JSONB payload:** Store variable event data in a JSONB column. Add GIN index only if payload queries become frequent.

---

*This analysis evaluates PostgreSQL and MongoDB specifically for the container tracking event processing workload described above. Different workload characteristics (e.g., higher write volume, complex document nesting, geospatial-first access patterns) could shift the recommendation.*
