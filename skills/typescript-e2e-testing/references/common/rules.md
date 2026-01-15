# E2E Testing Rules

## Core Rules

| Rule | Requirement |
|------|-------------|
| Setup | Replicate `main.ts` configuration exactly |
| Execution | `--runInBand` (sequential) - NEVER parallel |
| Logger | File logging via `.env.e2e` - DO NOT mock, DO NOT console.log |
| Log file | `logs/e2e-test.log` - clean before each test run |
| Test structure | MUST follow GWT pattern (Given-When-Then) |

## Environment Configuration

E2E tests MUST use `.env.e2e`:

```bash
# Logger configuration
LOG_LEVEL=debug
LOG_FILE=./logs/e2e-test.log
LOG_SYNC_FILE=./logs/application.pid

# Database
DATABASE_URL=postgresql://test:test@localhost:5433/testdb
MONGODB_URI=mongodb://localhost:27018/testdb

# Kafka
KAFKA_BROKER=localhost:9094
KAFKA_CLIENT_ID=e2e-test-client
KAFKA_GROUP_ID=e2e-test-group

# Redis
REDIS_URL=redis://localhost:6380

# Application
NODE_ENV=test
```

## Timeout Rules

| Context | Value | Purpose |
|---------|-------|---------|
| `jest.setTimeout()` | 25000 | Default per-test timeout |
| `beforeAll` | 90000 | Full app + infrastructure setup |
| `afterAll` | 30000 | Graceful cleanup |
| Kafka waits | 8-10s | Consumer group rebalancing |
| MongoDB cleanup wait | 1000ms | In-flight message completion |

## Test Isolation Rules

1. **Clean Before AND After:** Clear data in both `beforeEach` and `afterEach`
2. **Wait Before Cleanup:** Add 1s delay before cleanup for in-flight operations
3. **Unique Identifiers:** Generate unique IDs per test (e.g., `test-${Date.now()}-${uuid}`)
4. **Sequential Execution:** Use `--runInBand` to prevent conflicts

## Logging Rules

```typescript
// ❌ BAD - NEVER DO
console.log('debug info');
mockLogger.log.mockImplementation(() => {});

// ✅ GOOD - ALWAYS
app.useLogger(app.get(CustomLoggerService));
// Configure LOG_FILE in .env.e2e
```

**Viewing Logs:**
```bash
npm run e2e:logs           # Tail logs in real-time
cat logs/e2e-test.log      # View complete log
grep -i error logs/e2e-test.log  # Search for errors
```

## Mock Rules

**Mock ALL retry attempts:**
```typescript
// ❌ BAD - Retry succeeds on 2nd attempt
mockHttpService.post.mockReturnValueOnce(of({ status: 500 }));

// ✅ GOOD - All 3 retry attempts fail
mockHttpService.post.mockClear();
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 1
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 2
mockHttpService.post.mockReturnValueOnce(of({ status: 500 })); // attempt 3
```

## Exception Type Rules

| Exception | HTTP Status | Use Case |
|-----------|-------------|----------|
| `ValidateException` | 400 | Input validation, malformed requests |
| `InternalException` | 500 | Infrastructure failures, external service errors |
| `UnauthorizedException` | 401 | Authentication failures |
| `ForbiddenException` | 403 | Authorization failures |
| `NotFoundException` | 404 | Resource not found |

## NestJS Setup Rules

**CRITICAL:** E2E tests MUST replicate production setup:

```typescript
// ✅ REQUIRED in beforeAll
app.useLogger(app.get(CustomLoggerService));
app.useGlobalFilters(new UnknownExceptionsFilter(httpAdapter));
app.useGlobalFilters(new DefaultValidateExceptionFilter(httpAdapter));
app.useGlobalFilters(new DefaultInternalExceptionFilter(httpAdapter));
app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));
app.useGlobalInterceptors(new HttpRequestLoggingInterceptor(cls, reflector));
app.useGlobalInterceptors(new KafkaRequestLoggingInterceptor(cls, reflector));
app.useGlobalPipes(new ValidationPipe(DefaultValidationOptions));

// ✅ REQUIRED for Kafka
app.connectMicroservice(kafkaConfig, { inheritAppConfig: true });
```

## Failure Handling Rules

**CRITICAL:** Fix ONE test at a time. NEVER fix multiple simultaneously.

**Workflow:**
1. Create `_e2e-failures.md` tracking file
2. Select ONE failing test
3. Run ONLY that test: `npm run test:e2e -- -t "test name"`
4. Analyze logs: `grep -A 20 "FAIL" logs/e2e-test.log`
5. Fix and re-run SAME test to verify
6. Mark as fixed in tracking file
7. Repeat for next test
8. Run full suite ONLY after ALL individual tests pass
9. Delete tracking file when complete

## Checklist

**Environment:**
- [ ] `.env.e2e` with file logging configuration
- [ ] `logs/` directory in `.gitignore`
- [ ] Global setup deletes previous log file

**Setup:**
- [ ] Use real logger via `app.useLogger()`
- [ ] Global filters match `main.ts`
- [ ] Global interceptors match `main.ts`
- [ ] ValidationPipe BEFORE `connectMicroservice`
- [ ] `inheritAppConfig: true` for Kafka
- [ ] Unique consumer group ID
- [ ] `--runInBand` in package.json

**Test Structure:**
- [ ] ALL tests follow GWT pattern
- [ ] GWT sections marked: `// GIVEN:`, `// WHEN:`, `// THEN:`
- [ ] One test, one behavior
- [ ] No conditional assertions

**Assertions:**
- [ ] Assert specific values, not just existence
- [ ] Tests fail when any field differs
- [ ] Verify database state matches expected
