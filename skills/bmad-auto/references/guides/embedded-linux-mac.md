# Embedded/Firmware — Linux/macOS Validation Guide

## Scope

This guide covers validation for embedded firmware projects on Linux or macOS. Common frameworks:
PlatformIO, Arduino CLI, Make/CMake with cross-compilers, ESP-IDF, Zephyr, STM32CubeIDE.

The native-first principle applies: check if native tools are already installed and use them (they are
faster and more accurate). If native tools are not available, use Docker containers as a convenient
fallback. If neither is available, suggest both options to the user.

## Native Tool Validation

Use native tools when they are installed — they provide faster builds and more accurate results.

### Check Tool Availability

```bash
command -v pio && echo "PlatformIO: available"
command -v arduino-cli && echo "Arduino CLI: available"
command -v make && echo "Make: available"
command -v cmake && echo "CMake: available"
command -v arm-none-eabi-gcc && echo "ARM GCC: available"
command -v xtensa-esp32-elf-gcc && echo "ESP32 toolchain: available"
command -v idf.py && echo "ESP-IDF: available"
command -v qemu-system-arm && echo "QEMU ARM: available"
command -v renode && echo "Renode: available"
command -v cppcheck && echo "cppcheck: available"
```

### Step 1: Build for Target Hardware

PlatformIO:
```bash
pio run -e <default_env>
```

Make/CMake:
```bash
mkdir -p build && cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=<toolchain_file>
make -j$(nproc)
```

ESP-IDF:
```bash
idf.py build
```

Must exit with code 0. Report warnings but do not fail for warnings alone.

### Step 2: Build for Simulator (if available)

Look for simulator environments in `platformio.ini`:
```bash
grep -E '\[env:.*sim|native|linux|debug' platformio.ini
```

If found:
```bash
pio run -e <simulator_env>
```

### Step 3: Run Simulator (if available and environment supports it)

Check for simulator scripts:
```bash
ls scripts/sim-*.sh 2>/dev/null
```

If simulator build succeeded, run it:
```bash
# For Marlin/PlatformIO native simulator
.pio/build/<sim_env>/program

# For QEMU
qemu-system-arm -M <machine> -kernel <binary> -nographic -no-reboot

# For Renode
renode --disable-xwt -e "include @<script.resc>; start; sleep 10; quit"
```

### Step 4: Static Analysis

```bash
cppcheck --enable=all --error-exitcode=1 src/
```

### Step 5: Serial Port Testing (if hardware connected)

Only if hardware is physically connected:
```bash
# List serial ports
ls /dev/tty.usb* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Send test command (e.g., Marlin M115)
echo "M115" > /dev/ttyUSB0
```

## Docker Validation (Fallback)

If native tools are not installed, use Docker containers as a convenient alternative.

### PlatformIO in Docker

Build without installing PlatformIO locally:
```bash
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio run -e <default_env>
```

For projects with custom PlatformIO configurations:
```bash
# List available environments
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio project config --json-output | grep env

# Build specific environment
docker run --rm -v "$(pwd)":/project -w /project platformio/platformio-core:latest \
  pio run -e <env_name>
```

### Simulation in Docker

For QEMU-based simulation:
```bash
# Build a Dockerfile with QEMU
cat > /tmp/Dockerfile.sim << 'SIMEOF'
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y qemu-system-arm qemu-user-static
COPY . /firmware
WORKDIR /firmware
SIMEOF

docker build -f /tmp/Dockerfile.sim -t firmware-sim .
docker run --rm firmware-sim qemu-system-arm -M <machine> -kernel <binary> -nographic -no-reboot
```

For Renode simulation:
```bash
docker run --rm -v "$(pwd)":/firmware antmicro/renode:latest \
  renode --disable-xwt -e "include @/firmware/<script.resc>; start; sleep 10; quit"
```

### Static Analysis in Docker

```bash
docker run --rm -v "$(pwd)":/src neszt/cppcheck:latest \
  cppcheck --enable=all --error-exitcode=1 /src/src/
```

## Validation Priority

1. **Native tools** (if installed) → build + simulation + static analysis (fastest, most accurate)
2. **Docker container** (if native tools missing) → build + simulation + static analysis
3. **Nothing available** → suggest both native install and Docker as options

## Missing Tool Suggestions

```
SUGGESTION: Install native tools for the best experience:
  - PlatformIO: pip install platformio
  - QEMU: brew install qemu (macOS) or apt install qemu-system-arm (Linux)
  - Renode: https://renode.io/
  - cppcheck: brew install cppcheck (macOS) or apt install cppcheck (Linux)

Alternative (if native install is not feasible), use Docker:
  - Docker Desktop: https://docker.com/products/docker-desktop
  - Then build with: docker run --rm -v $(pwd):/project platformio/platformio-core pio run
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Method: [Docker|Native]
- Target build: [OK|FAILED] (command used, env: <env_name>)
- Simulator build: [OK|SKIPPED|FAILED]
- Simulator run: [OK|SKIPPED|FAILED]
- Static analysis: [OK|SKIPPED|FAILED] (N warnings, M errors)
- Binary size: [X bytes / Y% of flash]
- Missing tools: [list if any]
```
