# Container Testing — Cross-Cutting Validation Guide

## Scope

This guide applies to any project with a Dockerfile or docker-compose.yml. It covers
Dockerfile linting, image building, container startup verification, and image size analysis.
Container tests are recommended when Docker files exist but do not block commits.

## Prerequisites

```bash
command -v docker && docker info > /dev/null 2>&1 && echo "Docker: available"
command -v docker compose version > /dev/null 2>&1 && echo "Docker Compose: available"
command -v hadolint && echo "hadolint: available"
```

## Dockerfile Linting

### hadolint (Dockerfile best practices)

```bash
# Docker-based (no local install needed)
docker run --rm -i hadolint/hadolint < Dockerfile

# Native
hadolint Dockerfile
```

Common issues caught:
- Using `latest` tag instead of pinned versions
- Running as root
- Missing `HEALTHCHECK`
- Inefficient layer ordering

## Image Build

```bash
# Build with no cache to verify reproducibility
docker build --no-cache -t test-image:validation .

# Build time
time docker build -t test-image:validation .
```

Must exit with code 0.

## Container Startup Verification

```bash
# Start container
docker run -d --name test-container test-image:validation
sleep 5

# Check container is still running (didn't crash)
docker ps | grep test-container && echo "Container: running"

# Check logs for errors
docker logs test-container 2>&1 | grep -i "error\|fatal\|panic" && echo "ERRORS FOUND" || echo "Logs: clean"

# Health check (if HEALTHCHECK defined)
docker inspect --format='{{.State.Health.Status}}' test-container 2>/dev/null

# Cleanup
docker stop test-container && docker rm test-container
```

## Docker Compose Validation

```bash
# Validate compose file syntax
docker compose config > /dev/null && echo "Compose config: valid"

# Start all services
docker compose up -d
sleep 10

# Check all services are running
docker compose ps
RUNNING=$(docker compose ps --format json | grep -c '"running"')
TOTAL=$(docker compose ps --format json | wc -l)
echo "Services running: $RUNNING/$TOTAL"

# Check for restart loops
docker compose ps | grep -i "restarting" && echo "WARNING: Services restarting"

# Cleanup
docker compose down
```

## Image Size Analysis

```bash
# Image size
docker images test-image:validation --format "Size: {{.Size}}"

# Layer breakdown
docker history test-image:validation --format "{{.Size}}\t{{.CreatedBy}}" | head -20

# Compare with base image
BASE=$(grep "^FROM" Dockerfile | head -1 | awk '{print $2}')
docker pull $BASE > /dev/null 2>&1
docker images $BASE --format "Base image size: {{.Size}}"
```

## Multi-Stage Build Verification

If the Dockerfile uses multi-stage builds:
```bash
# Verify final image doesn't contain build tools
docker run --rm test-image:validation which gcc make npm 2>/dev/null && \
  echo "WARNING: Build tools found in final image" || \
  echo "Multi-stage: clean (no build tools in final image)"
```

## Missing Tool Suggestions

```
SUGGESTION: For container testing:
  - Docker Desktop: https://docker.com/products/docker-desktop
  - hadolint: docker run --rm -i hadolint/hadolint < Dockerfile (no install needed)
```

## Report Template

```
CONTAINER REPORT (informational — does not block commit):
- Dockerfile lint: [OK|X issues] (hadolint)
- Image build: [OK|FAILED] (build time: Xs)
- Container startup: [OK|FAILED] (survived 5s)
- Health check: [OK|N/A|FAILED]
- Image size: [X MB] (base: Y MB, overhead: Z MB)
- Compose validation: [OK|N/A]
- Services: [X/Y running]
```
