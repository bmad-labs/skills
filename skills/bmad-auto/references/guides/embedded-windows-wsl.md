# Embedded/Firmware — Windows Validation Guide

## Scope

This guide covers validation for embedded firmware projects on Windows. Use native PlatformIO
for target builds if installed — it's the fastest option. For simulation and additional tooling,
prefer Docker containers over WSL because WSL has poor interoperability with the agent
(filesystem boundary issues, shell context switching, unreliable display forwarding via WSLg).

## Native Windows Validation (Primary — Target Build)

Use PlatformIO on Windows directly for target builds — this is the fastest and most reliable option.

### Check Native Tool Availability

```bash
command -v pio && echo "PlatformIO: available"
command -v cppcheck && echo "cppcheck: available"
```

### PlatformIO on Windows

```bash
# Build for target hardware
pio run -e <default_env>

# List available environments
pio project config --json-output | grep env
```

This validates the target build only. For simulation, use Docker (see below).

## Docker Validation (Preferred for Simulation & Fallback for Build)

Docker Desktop for Windows is the preferred approach for simulation and for builds when native
PlatformIO is not installed. Unlike WSL, Docker containers work reliably with the agent — no
filesystem boundary issues, no display forwarding problems, and commands execute in a
predictable environment.

### Check Docker Availability

```bash
command -v docker && docker info > /dev/null 2>&1 && echo "Docker Desktop: available"
```

### PlatformIO in Docker (if native pio not installed)

```bash
# Build for target hardware
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio run -e <default_env>

# List available environments
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio project config --json-output | grep env
```

### Simulation in Docker (preferred over WSL)

Run QEMU or Renode inside a Docker container — avoids WSL display and interop issues entirely:

```bash
# QEMU simulation
docker run --rm -v "$(pwd)":/firmware -w /firmware ubuntu:22.04 bash -c \
  "apt-get update -qq && apt-get install -y -qq qemu-system-arm && \
   qemu-system-arm -M <machine> -kernel <binary> -nographic -no-reboot"

# Renode simulation
docker run --rm -v "$(pwd)":/firmware antmicro/renode:latest \
  renode --disable-xwt -e "include @/firmware/<script.resc>; start; sleep 10; quit"
```

### Static Analysis in Docker

```bash
docker run --rm -v "$(pwd)":/src neszt/cppcheck:latest \
  cppcheck --enable=all --error-exitcode=1 /src/src/
```

## WSL-Based Validation (Last Resort)

WSL can work for simulation but has significant limitations for agent-driven workflows:
- Agent cannot reliably interact with WSL shell (context switching between Windows and Linux)
- Filesystem access across the boundary is slow and error-prone
- WSLg display forwarding is unreliable for graphical simulators
- Path translation between Windows and Linux causes issues

**Only use WSL if both native PlatformIO AND Docker are unavailable**, or if the user
explicitly requests it.

### Check WSL Availability

```bash
wsl --status 2>/dev/null && echo "WSL: available"
wsl -l -v 2>/dev/null  # List installed distributions
```

### Build and Simulate in WSL

If the project has simulator setup scripts:

```bash
# One-time setup
wsl bash scripts/sim-setup.sh

# Sync config and build simulator
wsl bash scripts/sim-sync.sh

# Run simulator (requires WSLg for display)
wsl bash scripts/sim-run.sh
```

For projects without simulator scripts:
```bash
wsl pip install platformio
wsl pio run -e <simulator_env>
```

## Validation Priority

1. **Native PlatformIO** (if installed) → `pio run` directly for target build (fastest)
2. **Docker** → simulation + build fallback (reliable agent interaction, no WSL issues)
3. **WSL** (last resort) → only if native pio AND Docker are both unavailable
4. **Nothing available** → suggest PlatformIO install or Docker Desktop

## Project-Specific Notes (Marlin on MKS TinyBee)

This project uses Marlin firmware with PlatformIO:

```bash
# Target build — use pio directly if installed (preferred)
pio run -e mks_tinybee

# Target build via Docker (if pio not installed)
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio run -e mks_tinybee

# Simulator build via Docker (preferred over WSL)
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio run -e simulator_mks_tinybee_linux_debug

# WSL scripts (last resort — agent interaction issues):
# scripts/sim-setup.sh   # One-time WSL environment setup
# scripts/sim-sync.sh    # Sync config from Windows and rebuild
# scripts/sim-run.sh     # Run simulator (needs WSLg)
```

## Missing Tool Suggestions

```
SUGGESTION: For target builds, install PlatformIO natively:
  - PlatformIO: pip install platformio

For simulation and full validation, install Docker Desktop (recommended):
  - Docker Desktop: https://docker.com/products/docker-desktop
  - Build: docker run --rm -v %cd%:/project platformio/platformio-core pio run
  - Simulate: docker run --rm -v %cd%:/firmware antmicro/renode renode ...

WSL is NOT recommended for agent-driven validation due to interop limitations.
Only use WSL for manual interactive testing.
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Method: [Native|Docker|WSL]
- Target build: [OK|FAILED] (pio run -e <env>)
- Simulator build: [OK|SKIPPED|FAILED]
- Simulator run: [OK|SKIPPED|FAILED]
- Static analysis: [OK|SKIPPED|FAILED]
- Binary size: [X bytes / Y% of flash]
- Missing tools: [list if any]
```
