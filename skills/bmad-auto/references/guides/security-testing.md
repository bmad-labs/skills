# Security Testing — Cross-Cutting Validation Guide

## Scope

This guide applies to all project types as an optional enhancement. It covers dependency
auditing, secret scanning, and static application security testing (SAST). Security tests
warn but never block commits — they surface risks for the user to evaluate.

## Dependency Audit

### By Language

| Language | Tool | Command |
|----------|------|---------|
| Node.js | npm audit | `npm audit --production` |
| Python | pip-audit | `pip-audit` or `safety check` |
| Rust | cargo-audit | `cargo audit` |
| Go | govulncheck | `govulncheck ./...` |
| Java | OWASP Dep Check | `./gradlew dependencyCheckAnalyze` |
| Ruby | bundler-audit | `bundle audit check` |

### Docker-based audit (if native tools not available)

```bash
# Node.js
docker run --rm -v "$(pwd)":/app -w /app node:20 npm audit --production

# Python
docker run --rm -v "$(pwd)":/app -w /app python:3.11 \
  bash -c "pip install pip-audit && pip-audit -r requirements.txt"
```

## Secret Scanning

Scan staged changes for accidentally committed secrets:

```bash
# gitleaks (if available)
command -v gitleaks && gitleaks detect --source . --no-banner

# Docker-based
docker run --rm -v "$(pwd)":/repo zricethezav/gitleaks:latest detect --source /repo --no-banner

# trufflehog
docker run --rm -v "$(pwd)":/repo trufflesecurity/trufflehog:latest \
  filesystem --directory /repo --only-verified
```

## Static Application Security Testing (SAST)

### Semgrep (multi-language)

```bash
# Docker-based (recommended)
docker run --rm -v "$(pwd)":/src returntocorp/semgrep:latest \
  semgrep scan --config=auto /src

# Native
semgrep scan --config=auto .
```

### Language-specific SAST

| Language | Tool | Command |
|----------|------|---------|
| Python | Bandit | `bandit -r src/` |
| JavaScript | ESLint Security | `npx eslint --plugin security src/` |
| Go | gosec | `gosec ./...` |
| Java | SpotBugs | `./gradlew spotbugsMain` |

## License Compliance

```bash
# Node.js
npx license-checker --summary

# Rust
cargo deny check licenses 2>/dev/null

# Python
pip-licenses --format=table
```

## Report Template

```
SECURITY REPORT (informational — does not block commit):
- Dependency audit: [X vulnerabilities found (H high, M medium, L low)]
- Secret scanning: [OK|X potential secrets found]
- SAST: [X issues found (categorized by severity)]
- License compliance: [OK|X copyleft licenses found]
- Recommendation: [Review findings before deploying to production]
```
