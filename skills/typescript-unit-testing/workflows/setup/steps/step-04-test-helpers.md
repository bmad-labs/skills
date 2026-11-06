---
name: 'step-04-test-helpers'
description: 'Create test helper utilities'
nextStepFile: './step-05-verify-setup.md'
---

# Step 4: Create Test Helpers

## STEP GOAL

Create the test helpers directory and settle how tests silence the Nest logger, so every test uses the same logger mock.

## EXECUTION

### 1. Create Directory Structure

Ensure the following directory structure exists in the project:

```
test/
└── helpers/
```

### 2. Check for an Existing Logger Mock

- Search the project for an existing logger mock (e.g. a class implementing `LoggerService` under `test/` or `src/**/mock*`)
- If one exists, record its import path: tests pass it to `.setLogger()`
- If the project has a custom logger with extra methods, the mock must cover those methods too

### 3. Default: No Helper File Needed

If no logger mock exists, tests create one inline with `@golevelup/ts-jest`:

```typescript
import { LoggerService } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';

const module = await Test.createTestingModule({ providers: [/* ... */] })
  .setLogger(createMock<LoggerService>())
  .compile();
```

Alternatively, keep Nest's `Logger` and silence it with `jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)` (repeat for `error`, `warn`).

### 4. Append to Report

Append to the output document:

```markdown
## Step 4: Test Helpers

**Directory Created**: test/helpers/
**Logger Mock**: [Existing mock at path / Inline `createMock<LoggerService>()`]
```

## PRESENT FINDINGS

Present the test helper status:

```
Step 4: Test Helpers
====================

Directory: test/helpers/ [created/already existed]
Logger Mock: [Existing mock at path / Inline createMock<LoggerService>()]
```

Then ask: **[C] Continue to Step 5: Verify Setup**

## FRONTMATTER UPDATE

Update the output document:
- Add `4` to `stepsCompleted`
- Append the test helpers section to the report

## NEXT STEP

After user confirms `[C]`, load `step-05-verify-setup.md`.
