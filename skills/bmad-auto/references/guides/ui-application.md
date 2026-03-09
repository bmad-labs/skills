# UI/Frontend Application — Functional Validation Guide

## Scope

This guide covers validation for frontend applications built with React, Next.js, Vue, Angular,
Svelte, or similar frameworks. The goal is to verify that the application builds, renders, and
provides the expected user-facing functionality.

## Required Tools

### Build Tools (at least one required)
- `npm` / `yarn` / `pnpm` / `bun`

### Browser Automation (optional but recommended)
- **Playwright CLI** — `npx playwright` (preferred)
- **Cypress** — `npx cypress`
- **Browser MCP** — check for `mcp__browser__` tools in the environment
- **Chrome MCP** — check for `mcp__chrome__` tools in the environment

Check availability:
```bash
command -v npm && echo "npm: available"
command -v yarn && echo "yarn: available"
command -v pnpm && echo "pnpm: available"
command -v bun && echo "bun: available"
npx playwright --version 2>/dev/null && echo "Playwright: available"
npx cypress --version 2>/dev/null && echo "Cypress: available"
```

## Validation Steps

### Step 1: Install Dependencies

```bash
# Detect package manager from lockfile
if [ -f "bun.lockb" ]; then bun install
elif [ -f "pnpm-lock.yaml" ]; then pnpm install --frozen-lockfile
elif [ -f "yarn.lock" ]; then yarn install --frozen-lockfile
elif [ -f "package-lock.json" ]; then npm ci
else npm install
fi
```

Must exit with code 0. Report any peer dependency warnings.

### Step 2: Build

```bash
npm run build
```

Must exit with code 0. This catches:
- TypeScript type errors
- Import/export issues
- Missing modules
- Build configuration problems

### Step 3: Lint (if available)

```bash
npm run lint 2>/dev/null && echo "Lint: PASS" || echo "Lint: no script or issues found"
```

Report lint errors but do not fail validation for lint-only issues.

### Step 4: Run Tests (if available)

```bash
# Check if test script exists and is not the default "echo error"
node -e "const p=require('./package.json'); if(p.scripts?.test && !p.scripts.test.includes('Error: no test')) process.exit(0); else process.exit(1)" && npm test
```

### Step 5: Browser Automation (if tools available)

If Playwright, Cypress, browser MCP, or Chrome MCP is available:

1. Start dev server in background:
   ```bash
   npm run dev &
   DEV_PID=$!
   sleep 5  # Wait for server to start
   ```

2. Run smoke tests:
   - **Playwright**: `npx playwright test` (if tests exist)
   - **Cypress**: `npx cypress run` (if tests exist)
   - **Browser MCP**: Navigate to `http://localhost:3000` (or configured port), verify page renders
   - **Agent Browser**: 
     - Install agent browser: `npx agent-browser install`
     - Add the agent-browser skill: `npx skills add vercel-labs/agent-browser --skill agent-browser --yes` 
     - Open the browser: `npx agent-browser open http://localhost:3000`. Using the installed skills to verify page renders and basic interactions work.
   - **Chrome MCP**: Same as Browser MCP

3. Stop dev server:
   ```bash
   kill $DEV_PID 2>/dev/null
   ```

### Step 6: Lighthouse Audit (optional)

If `lighthouse` is available:
```bash
npx lighthouse http://localhost:3000 --output=json --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices
```

## Missing Tool Suggestions

If no browser automation tool is found, suggest:
```
SUGGESTION: Install Playwright for browser-based validation:
  npm init playwright@latest

Alternative options:
  - Install browser MCP server for Claude Code
  - Install Chrome MCP server for Claude Code
  - Install Cypress: npm install --save-dev cypress
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Dependencies: [OK|FAILED] (npm ci)
- Build: [OK|FAILED] (npm run build)
- Lint: [OK|SKIPPED|WARNINGS] (npm run lint)
- Tests: [OK|SKIPPED|FAILED] (npm test, X passed, Y failed)
- Browser: [OK|SKIPPED] (tool used: Playwright/Cypress/MCP)
- Missing tools: [list if any]
```
