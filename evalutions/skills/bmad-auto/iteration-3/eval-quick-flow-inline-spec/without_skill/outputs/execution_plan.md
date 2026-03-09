# Execution Plan: Add Rate Limiting to /api/users Endpoint

## 1. Approach

I would treat this as a straightforward implementation task and proceed linearly through the spec's task list. Since the user provided a clear tech spec with defined tasks and acceptance criteria, I would execute each task in order, writing code directly based on assumptions about the project structure (NestJS, TypeScript).

### Key assumptions I would make (without investigating first):
- The project uses NestJS (inferred from "Guard", "Service", "Controller" naming)
- TypeScript is the language
- A `src/common/` directory exists or should be created
- A `UsersController` already exists somewhere in the project
- Testing framework is Jest (common NestJS default)

## 2. Tools and Order of Operations

### Step 1: Install ioredis dependency
- **Tool:** Bash
- **Command:** `npm install ioredis` and `npm install -D @types/ioredis`
- **No preliminary investigation** into whether Redis dependencies already exist, what package manager the project uses (npm vs yarn vs pnpm), or whether the project has a lockfile convention.

### Step 2: Create RateLimiterService
- **Tool:** Write
- **Action:** Create `src/common/rate-limiter.service.ts`
- **Implementation approach:** Write the full service file in one shot, implementing a sliding window algorithm using Redis sorted sets. The service would:
  - Accept an ioredis instance via constructor injection
  - Expose a method like `isRateLimited(key: string, limit: number, windowSec: number): Promise<boolean>`
  - Use `ZADD`, `ZREMRANGEBYSCORE`, and `ZCARD` Redis commands for the sliding window

### Step 3: Create RateLimiterGuard
- **Tool:** Write
- **Action:** Create `src/common/rate-limiter.guard.ts`
- **Implementation approach:** Write a NestJS guard that:
  - Injects `RateLimiterService`
  - Extracts client IP from the request
  - Calls the service to check the rate limit
  - Returns `true` or throws a `429 Too Many Requests` HttpException

### Step 4: Apply guard to UsersController
- **Tools:** Grep (to find the controller), then Edit
- **Action:** Find `UsersController`, add `@UseGuards(RateLimiterGuard)` decorator
- **This is the first point where I would actually look at existing code.**

### Step 5: Write unit tests
- **Tool:** Write
- **Action:** Create `src/common/rate-limiter.service.spec.ts`
- **Implementation approach:** Write Jest tests that mock the Redis client and verify the two acceptance criteria.

### Step 6: Verify
- **Tool:** Bash
- **Commands:** `npm run build` and `npm run test`

## 3. Implementation Details

### RateLimiterService (sliding window with Redis sorted sets)
```typescript
@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: Redis) {}

  async isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();
    const count = results[2][1] as number;
    return count > limit;
  }
}
```

### RateLimiterGuard
```typescript
@Injectable()
export class RateLimiterGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = `rate-limit:${request.ip}:${request.path}`;
    const isLimited = await this.rateLimiterService.isRateLimited(key, 100, 60000);
    if (isLimited) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
```

### Unit tests
- Test that requests under the limit pass through
- Test that the 101st request within 60 seconds returns rate-limited
- Test that after window expiration, requests are allowed again
- All tests would mock the Redis client

## 4. Review and Validation Steps

### What I would do:
- Run `npm run build` to check for compilation errors
- Run `npm run test` to verify unit tests pass
- Manually review the generated files for obvious issues

### What I would NOT do (gaps):
- **No codebase investigation before writing code:** I would not examine the existing project structure, coding conventions, module organization, or dependency injection patterns before writing code
- **No existing pattern analysis:** I would not look at how other services/guards are structured in this specific project
- **No package manager verification:** I would assume npm without checking for yarn.lock or pnpm-lock.yaml
- **No Redis configuration review:** I would not check if there is already a Redis module or connection configured in the project
- **No integration testing plan:** Only unit tests as specified, no consideration of integration or e2e tests
- **No review of existing middleware/interceptors:** There might already be rate limiting or similar patterns in place
- **No module registration:** I might forget to register the new service and guard in the appropriate NestJS module
- **No environment configuration:** No consideration of making rate limit values configurable via environment variables or config service
- **No error handling for Redis connection failures:** What happens if Redis is down?
- **No documentation updates:** No update to API docs or README about the new rate limiting behavior
- **No incremental verification:** I would write all files, then test at the end rather than verifying after each step

## 5. Summary of Approach Characteristics

| Aspect | Approach |
|--------|----------|
| Planning | Minimal -- follow the spec linearly |
| Codebase investigation | Only when needed to find the controller |
| Convention adherence | Generic NestJS patterns, not project-specific |
| Risk assessment | None |
| Dependency conflicts | Not checked |
| Incremental validation | None until the end |
| Configurability | Hardcoded values (100 requests, 60 seconds) |
| Error scenarios | Not considered (Redis down, malformed keys) |
| Module registration | Likely overlooked |
