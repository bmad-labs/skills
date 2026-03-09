# Accessibility Testing — Cross-Cutting Validation Guide

## Scope

This guide applies to UI/Frontend and Full-Stack projects as an optional enhancement. It
covers automated accessibility checks against WCAG 2.1 AA standards. Accessibility tests
warn but never block commits.

## Prerequisites

This guide requires a running frontend application and browser automation tools.

### Check Tool Availability

```bash
npx playwright --version 2>/dev/null && echo "Playwright: available"
npx lighthouse --version 2>/dev/null && echo "Lighthouse: available"
npm list @axe-core/playwright 2>/dev/null && echo "axe-core/playwright: available"
```

## axe-core via Playwright

The most reliable automated accessibility testing approach.

### Setup (if not installed)

```bash
npm install --save-dev @axe-core/playwright @playwright/test
npx playwright install chromium
```

### Run accessibility checks

```javascript
// a11y-check.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility check', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

```bash
npx playwright test a11y-check.spec.ts
```

## Lighthouse Accessibility Audit

```bash
# Start dev server first, then:
npx lighthouse http://localhost:3000 \
  --output=json \
  --chrome-flags="--headless" \
  --only-categories=accessibility \
  | jq '{score: .categories.accessibility.score, issues: [.audits | to_entries[] | select(.value.score == 0) | .value.title]}'
```

Target: accessibility score >= 0.9 (90%).

## Manual Checks to Suggest

Automated tools catch ~30-40% of accessibility issues. Suggest the user also check:

1. **Keyboard navigation** — can all interactive elements be reached with Tab?
2. **Color contrast** — do all text elements meet 4.5:1 ratio (AA)?
3. **Screen reader** — do images have alt text? Do forms have labels?
4. **Focus indicators** — are focus states visible?
5. **Responsive** — does the UI work at 200% zoom?

## Report Template

```
ACCESSIBILITY REPORT (informational — does not block commit):
- Lighthouse a11y score: [X/100]
- axe-core violations: [X violations found]
  - Critical: [list]
  - Serious: [list]
  - Moderate: [list]
- Recommendation: [Review violations before releasing to users]
```
