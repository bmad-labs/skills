# Execution Plan: Add Rate Limiting to /api/users Endpoint

## Overview

Implement a sliding window rate limiter using Redis (ioredis) for the `/api/users` endpoint in a NestJS application. The rate limiter allows 100 requests per 60-second sliding window per client, returning HTTP 429 when exceeded.

## Steps

### Step 1: Install ioredis dependency

**Tool:** Bash
**Command:** `npm install ioredis` and `npm install -D @types/ioredis` (if not bundled)
**Rationale:** ioredis is the Redis client specified in the tech spec. Types may be needed for TypeScript support (though modern ioredis bundles its own types).

---

### Step 2: Create RateLimiterService in `src/common/rate-limiter.service.ts`

**Tool:** Write (file creation)
**File:** `src/common/rate-limiter.service.ts`

**Implementation plan:**
- Create an `@Injectable()` NestJS service
- Inject Redis connection configuration (host, port) via `@nestjs/config` or constructor params
- Instantiate an ioredis client in `onModuleInit` / constructor
- Implement a `isRateLimited(key: string, limit: number, windowSec: number): Promise<{ limited: boolean; remaining: number; retryAfter: number }>` method
- **Sliding window algorithm using Redis sorted sets:**
  1. Generate a timestamp-based member: `Date.now()` as both score and member (with random suffix to avoid collisions)
  2. Use a Redis pipeline/multi to atomically:
     - `ZREMRANGEBYSCORE key 0 (now - windowSec * 1000)` — remove expired entries
     - `ZADD key now member` — add current request
     - `ZCARD key` — count requests in window
     - `EXPIRE key windowSec` — set TTL as safety net
  3. If count exceeds limit, return limited=true with retryAfter calculated from the oldest entry in the window
- Clean up Redis connection in `onModuleDestroy`

---

### Step 3: Create RateLimiterGuard in `src/common/rate-limiter.guard.ts`

**Tool:** Write (file creation)
**File:** `src/common/rate-limiter.guard.ts`

**Implementation plan:**
- Create a class implementing `CanActivate` from `@nestjs/common`
- Inject `RateLimiterService`
- In `canActivate(context: ExecutionContext)`:
  1. Extract client identifier from the request (IP address via `request.ip`, or a custom header / auth token)
  2. Build a rate limit key, e.g., `rate_limit:/api/users:<clientIp>`
  3. Call `rateLimiterService.isRateLimited(key, 100, 60)`
  4. If limited, set response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) and throw `HttpException` with status 429
  5. If not limited, set informational rate limit headers and return `true`

---

### Step 4: Apply guard to UsersController

**Tool:** Read (to find the existing UsersController file), then Edit (to modify it)
**File:** Likely `src/users/users.controller.ts` (would search with Glob/Grep if unsure)

**Implementation plan:**
- Add `@UseGuards(RateLimiterGuard)` decorator at the controller level (applies to all routes in `/api/users`)
- Import `RateLimiterGuard` from `../common/rate-limiter.guard`
- Ensure `RateLimiterService` is provided in the relevant module (either `UsersModule` or a shared `CommonModule`)
- Register `RateLimiterService` and its Redis dependency in the module's `providers` array

---

### Step 5: Add unit tests for RateLimiterService

**Tool:** Write (file creation)
**File:** `src/common/rate-limiter.service.spec.ts`

**Implementation plan:**
- Mock ioredis using `jest.mock('ioredis')` or a manual mock
- Mock the Redis pipeline methods (`zremrangebyscore`, `zadd`, `zcard`, `expire`, `exec`)
- **Test cases:**
  1. **Allows requests under the limit:** Mock `zcard` returning 50 -> expect `limited: false`, `remaining: 50`
  2. **Blocks requests at the limit:** Mock `zcard` returning 101 -> expect `limited: true`
  3. **Returns correct remaining count:** Mock `zcard` returning 99 -> expect `remaining: 1`
  4. **Sliding window expiry:** Simulate time passing beyond the window, verify old entries are cleaned (verify `zremrangebyscore` called with correct range)
  5. **Handles Redis connection errors gracefully:** Mock Redis throwing an error -> decide on fail-open or fail-closed behavior (recommend fail-open: allow request through, log error)
  6. **Key generation uses client identifier:** Verify the key format includes the client IP

---

## Execution Order

```
Step 1 (install dependency)
    |
    v
Step 2 (create service) --> Step 3 (create guard) --> Step 4 (apply to controller)
    |
    v
Step 5 (unit tests)
```

Steps 2 and 5 can be done in sequence. Steps 2 and 3 are sequential (guard depends on service). Step 4 requires reading the existing controller first.

## Tools Summary

| Step | Tools Used | Action |
|------|-----------|--------|
| 1 | Bash | `npm install ioredis` |
| 2 | Write | Create `src/common/rate-limiter.service.ts` |
| 3 | Write | Create `src/common/rate-limiter.guard.ts` |
| 4 | Glob, Read, Edit | Find and modify UsersController + module |
| 5 | Write | Create `src/common/rate-limiter.service.spec.ts` |

## Assumptions

- The project uses NestJS (based on the guard/service/controller pattern in the spec)
- Redis is available as an infrastructure dependency
- Client identification is done via IP address (could be enhanced with auth tokens)
- Fail-open policy on Redis errors (allow traffic if Redis is down, log warnings)
- The 100 requests / 60 seconds limit is hardcoded initially but could be made configurable via environment variables
