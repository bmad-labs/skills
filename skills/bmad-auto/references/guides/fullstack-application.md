# Full-Stack Application — Functional Validation Guide

## Scope

This guide covers validation for applications with both backend and frontend components,
typically connected via API calls. Common stacks include: Next.js (full-stack), React + Express,
Vue + FastAPI, Angular + Spring Boot, etc.

## Detection

A project is full-stack when:
- `docker-compose.yml` exists with both API and frontend services, OR
- Monorepo with `packages/`, `apps/`, or separate `frontend/`/`backend/` directories, OR
- Framework like Next.js or Nuxt that includes both SSR and API routes

## Validation Steps

### Step 1: Start All Services

**Docker Compose approach (preferred):**
```bash
if [ -f "docker-compose.yml" ] || [ -f "compose.yml" ]; then
  docker compose up -d --build
  echo "Waiting for all services..."
  sleep 15
  docker compose ps
fi
```

**Manual approach (if no Docker Compose):**
```bash
# Start backend
cd backend && npm install && npm run dev &
BACKEND_PID=$!
sleep 5

# Start frontend
cd ../frontend && npm install && npm run dev &
FRONTEND_PID=$!
sleep 5
```

### Step 2: Backend Validation

Follow the steps in `backend-application.md`:
- Build verification
- Health check
- API endpoint testing

### Step 3: Frontend Validation

Follow the steps in `ui-application.md`:
- Build verification
- Page render check (via browser automation if available)

### Step 4: End-to-End Testing

If E2E test framework is configured:

```bash
# Playwright
npx playwright test

# Cypress
npx cypress run

# Custom E2E
npm run test:e2e
```

### Step 5: Integration Verification

Test that frontend can communicate with backend:
```bash
# Check frontend loads and makes API calls
curl -sf http://localhost:3000 | grep -q "root\|app\|__next" && echo "Frontend: renders"
curl -sf http://localhost:8080/api/health && echo "Backend API: responds"
```

### Step 6: Cleanup

```bash
docker compose down 2>/dev/null
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Backend build: [OK|FAILED]
- Frontend build: [OK|FAILED]
- Backend start: [OK|FAILED]
- Frontend start: [OK|FAILED]
- Backend health: [OK|FAILED]
- Frontend render: [OK|SKIPPED]
- E2E tests: [OK|SKIPPED|FAILED]
- Integration: [OK|SKIPPED]
- Missing tools: [list if any]
```
