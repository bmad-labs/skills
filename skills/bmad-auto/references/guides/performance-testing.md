# Performance Testing — Cross-Cutting Validation Guide

## Scope

This guide applies to all project types as an optional enhancement. It covers build size
analysis, response time benchmarks, load testing, and resource profiling. Performance tests
warn but never block commits.

## Build Size Analysis

### Compiled Languages (Rust, Go, C/C++)

```bash
# Binary size
ls -lh target/release/<binary> 2>/dev/null
ls -lh bin/<name> 2>/dev/null

# Stripped vs unstripped
strip -o /tmp/stripped <binary>
ls -lh /tmp/stripped
```

### Frontend Applications

```bash
# Bundle size analysis
npx webpack-bundle-analyzer stats.json 2>/dev/null
du -sh dist/ build/ .next/ 2>/dev/null

# Individual chunk sizes
find dist/ -name "*.js" -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -10
```

### Docker Images

```bash
docker images --format "table {{.Repository}}\t{{.Size}}" | grep <image_name>
# Layer analysis
docker history <image_name> --no-trunc
```

### Firmware / Embedded

```bash
# Flash and RAM usage (PlatformIO)
pio run -e <env> -t size

# Or parse ELF
arm-none-eabi-size <binary>.elf
```

## Response Time Benchmarks

### API Endpoints

```bash
# Simple latency check with curl
curl -o /dev/null -s -w "Time: %{time_total}s\n" http://localhost:${PORT}/api/endpoint

# Multiple requests for average
for i in {1..10}; do
  curl -o /dev/null -s -w "%{time_total}\n" http://localhost:${PORT}/api/endpoint
done | awk '{sum+=$1} END {printf "Average: %.3fs\n", sum/NR}'
```

### Frontend Page Load

```bash
# Lighthouse performance score
npx lighthouse http://localhost:3000 --output=json --chrome-flags="--headless" \
  --only-categories=performance | jq '.categories.performance.score'
```

## Load Testing

### Tools (check availability first)

```bash
command -v k6 && echo "k6: available"
command -v wrk && echo "wrk: available"
command -v ab && echo "ab: available"
command -v artillery && echo "Artillery: available"
```

### k6 (recommended)

```bash
# Quick load test
k6 run --vus 10 --duration 30s - << 'K6EOF'
import http from 'k6/http';
export default function() {
  http.get('http://localhost:${PORT}/api/endpoint');
}
K6EOF
```

### wrk

```bash
wrk -t4 -c100 -d30s http://localhost:${PORT}/api/endpoint
```

### Apache Bench

```bash
ab -n 1000 -c 10 http://localhost:${PORT}/api/endpoint
```

## Memory/CPU Profiling

### Node.js

```bash
node --prof app.js  # Generates v8.log
node --prof-process isolate-*.log > profile.txt
```

### Python

```bash
python -m cProfile -o profile.prof main.py
python -c "import pstats; p=pstats.Stats('profile.prof'); p.sort_stats('cumtime').print_stats(20)"
```

### Go

```bash
go test -bench=. -benchmem ./...
go tool pprof http://localhost:6060/debug/pprof/heap
```

## Regression Detection

Compare current metrics with previous builds:
```bash
# Save current metrics
echo "binary_size=$(stat -f%z <binary> 2>/dev/null || stat -c%s <binary>)" > perf-metrics.txt
echo "test_duration=$(time npm test 2>&1)" >> perf-metrics.txt

# Compare with previous (if exists)
if [ -f "perf-metrics-previous.txt" ]; then
  diff perf-metrics-previous.txt perf-metrics.txt
fi
```

## Report Template

```
PERFORMANCE REPORT (informational — does not block commit):
- Build size: [X MB] (delta: +/- Y% from previous)
- API latency: [X ms average] (N requests)
- Load test: [X req/s at Y concurrent users]
- Memory usage: [X MB peak]
- Firmware flash: [X bytes / Y% of available]
- Firmware RAM: [X bytes / Y% of available]
```
