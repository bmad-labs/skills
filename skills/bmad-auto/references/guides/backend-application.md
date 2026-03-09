# Backend/API Application — Functional Validation Guide

## Scope

This guide covers validation for backend applications and API servers built with Node.js
(Express, Fastify, NestJS), Go, Rust (Actix, Axum), Python (FastAPI, Django, Flask), Java
(Spring Boot), or similar frameworks. The goal is to verify the application builds, starts,
and responds to API requests correctly.

## Required Tools

### Build Tools (language-specific)
- **Node.js**: `npm` / `yarn` / `pnpm`
- **Go**: `go`
- **Rust**: `cargo`
- **Python**: `pip` / `poetry` / `uv`
- **Java**: `gradle` / `mvn`

### Infrastructure
- **Docker** + **Docker Compose** — for databases, message brokers, caches

### API Testing
- `curl` (almost always available)
- `httpie` (optional, nicer output)
- `grpcurl` (for gRPC services)

Check availability:
```bash
command -v docker && docker info > /dev/null 2>&1 && echo "Docker: available"
command -v docker && command -v docker compose version > /dev/null 2>&1 && echo "Docker Compose: available"
command -v curl && echo "curl: available"
command -v http && echo "httpie: available"
command -v grpcurl && echo "grpcurl: available"
```

## Validation Steps

### Step 1: Build

Language-specific build commands:

| Language | Build Command | Success Criteria |
|----------|--------------|-----------------|
| Node.js | `npm run build` or `npx tsc` | Exit code 0 |
| Go | `go build ./...` | Exit code 0 |
| Rust | `cargo build` | Exit code 0 |
| Python | `pip install -e .` or `poetry install` | Exit code 0 |
| Java | `./gradlew build -x test` or `mvn compile` | Exit code 0 |

### Step 2: Run Tests

| Language | Test Command |
|----------|-------------|
| Node.js | `npm test` |
| Go | `go test ./...` |
| Rust | `cargo test` |
| Python | `pytest` |
| Java | `./gradlew test` or `mvn test` |

### Step 3: Start Infrastructure (if docker-compose.yml exists)

```bash
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ] || [ -f "compose.yml" ]; then
  docker compose up -d
  echo "Waiting for infrastructure to be healthy..."
  sleep 10
  docker compose ps  # Verify all services are running
fi
```

If Docker is not available, skip this step and note it as a gap.

### Step 4: Start Server and Test APIs

1. Start the server in background:
   ```bash
   # Detect and run the appropriate start command
   npm start &  # or go run main.go & or cargo run & etc.
   SERVER_PID=$!
   sleep 5
   ```

2. Test health/readiness endpoint:
   ```bash
   curl -sf http://localhost:${PORT:-3000}/health && echo "Health: OK"
   # or common alternatives:
   curl -sf http://localhost:${PORT:-3000}/api/health
   curl -sf http://localhost:${PORT:-3000}/readyz
   curl -sf http://localhost:${PORT:-8080}/actuator/health  # Spring Boot
   ```

3. Test key API endpoints from story acceptance criteria:
   ```bash
   # Example: test a GET endpoint
   curl -sf http://localhost:${PORT:-3000}/api/v1/resource | head -c 200
   ```

4. Stop server and infrastructure:
   ```bash
   kill $SERVER_PID 2>/dev/null
   docker compose down 2>/dev/null
   ```

### Step 5: Message Broker Testing (if applicable)

If the application uses message brokers, test connectivity:

| Broker | Check Command |
|--------|--------------|
| Kafka | `docker compose exec kafka kafka-topics --list --bootstrap-server localhost:9092` |
| RabbitMQ | `curl -sf http://guest:guest@localhost:15672/api/overview` |
| Redis | `docker compose exec redis redis-cli ping` |
| NATS | `curl -sf http://localhost:8222/varz` |

### Step 6: gRPC Testing (if applicable)

```bash
grpcurl -plaintext localhost:50051 list  # List available services
grpcurl -plaintext localhost:50051 describe  # Describe service methods
```

### Step 7: GraphQL Testing (if applicable)

```bash
curl -sf -X POST http://localhost:${PORT:-3000}/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

## Missing Tool Suggestions

```
SUGGESTION: For full backend validation, install:
  - Docker Desktop: https://docker.com/products/docker-desktop
  - httpie: pip install httpie (nicer API testing output)
  - grpcurl: https://github.com/fullstorydev/grpcurl (for gRPC services)
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Build: [OK|FAILED] (command used)
- Tests: [OK|SKIPPED|FAILED] (X passed, Y failed)
- Infrastructure: [OK|SKIPPED] (docker compose)
- Server start: [OK|SKIPPED|FAILED]
- Health check: [OK|SKIPPED|FAILED]
- API endpoints: [OK|SKIPPED|FAILED] (N endpoints tested)
- Message broker: [OK|SKIPPED|N/A]
- Missing tools: [list if any]
```
