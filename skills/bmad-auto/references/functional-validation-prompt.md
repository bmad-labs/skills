# Functional Validation Sub-Agent Prompt Reference

This file contains the full instructions for the functional validation sub-agent
(Step 4.5 of the BMAD Auto orchestrator). The sub-agent should follow these steps
exactly.

## Step 1: Detect Project Type

Examine the repository to determine the project type. Check these markers in order:

- `platformio.ini` → Embedded/Firmware
- `package.json` with framework (react, next, vue, angular) → UI/Frontend
- `package.json` with server framework or `go.mod` or `Cargo.toml` with web framework → Backend/API
- `pubspec.yaml` or `react-native` in package.json → Mobile
- `docker-compose.yml` + frontend framework in subdir → Full-Stack
- `Cargo.toml` / `setup.py` / `pyproject.toml` with CLI entry point → CLI/Library
- `main.tf` / `Pulumi.yaml` / `cdk.json` → Infrastructure as Code
- `dvc.yaml` / ML framework imports → Data Pipeline / ML

Also read the PRD at `_bmad-output/planning-artifacts/prd.md` and architecture at
`_bmad-output/planning-artifacts/architecture.md` for explicit project type information.

## Step 2: Read Validation Guide

Read the strategy overview at:
`<skill_directory>/references/functional-validation-strategies.md`

Then read the appropriate per-type guide from:
`<skill_directory>/references/guides/<detected-type>.md`

Also check cross-cutting guides (security-testing.md, container-testing.md, etc.) if applicable.

## Step 3: Check Tool Availability

Check if native tools are already installed first — if they are, use them directly (faster
and more accurate). If native tools are missing, check if Docker is available as a fallback.
If neither is available, suggest both options to the user.

## Step 4: Execute Validation

Follow the validation strategy from the guide. At minimum, always attempt to BUILD the project.

## Step 5: Report Results

Report results to the team lead via SendMessage with one of these outcomes:

- **PASS**: Build succeeded + runtime tests passed (or runtime not applicable).
- **PARTIAL**: Build succeeded but runtime validation could not be performed.
- **FAIL**: Build failed or runtime tests failed. Include full error output and suggested fixes.
