# CLI Tool / Library — Functional Validation Guide

## Scope

This guide covers validation for command-line tools and libraries. Common languages: Rust, Go,
Python, Node.js, C/C++. The goal is to verify the project builds, tests pass, and (for CLIs)
basic commands work.

## Validation Steps

### Step 1: Build

| Language | Build Command | Artifact |
|----------|--------------|----------|
| Rust | `cargo build --release` | `target/release/<binary>` |
| Go | `go build -o bin/<name> ./...` | `bin/<name>` |
| Node.js | `npm run build` | `dist/` or `lib/` |
| Python | `pip install -e .` or `poetry build` | Package installed |
| C/C++ | `make` or `cmake --build build` | Binary in `build/` |

### Step 2: Run Tests

| Language | Test Command | Coverage |
|----------|-------------|----------|
| Rust | `cargo test` | `cargo llvm-cov` (if available) |
| Go | `go test ./...` | `go test -cover ./...` |
| Node.js | `npm test` | Built into Jest/Vitest |
| Python | `pytest` | `pytest --cov` |
| C/C++ | `make test` or `ctest` | `gcov` (if configured) |

### Step 3: CLI Smoke Test (for CLI tools)

```bash
# Test help flag
./<binary> --help && echo "Help: OK"
./<binary> --version && echo "Version: OK"

# Test with sample input (if applicable)
echo "test input" | ./<binary> <subcommand>
```

### Step 4: Library Example Validation (for libraries)

If an `examples/` directory exists:
```bash
# Rust
for example in examples/*.rs; do
  name=$(basename "$example" .rs)
  cargo run --example "$name" && echo "Example $name: OK"
done

# Python
for example in examples/*.py; do
  python "$example" && echo "Example $(basename $example): OK"
done

# Node.js
for example in examples/*.js examples/*.ts; do
  node "$example" && echo "Example $(basename $example): OK"
done
```

### Step 5: Binary Size Check

```bash
# Report binary size for compiled languages
ls -lh target/release/<binary> 2>/dev/null  # Rust
ls -lh bin/<name> 2>/dev/null               # Go
ls -lh build/<binary> 2>/dev/null           # C/C++

# Report package size for interpreted languages
du -sh dist/ 2>/dev/null                    # Node.js
du -sh *.whl 2>/dev/null                    # Python wheel
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Build: [OK|FAILED] (command used)
- Tests: [OK|SKIPPED|FAILED] (X passed, Y failed)
- CLI smoke test: [OK|SKIPPED|N/A] (--help, --version)
- Examples: [OK|SKIPPED|N/A] (N examples built/run)
- Binary size: [X MB]
- Missing tools: [list if any]
```
