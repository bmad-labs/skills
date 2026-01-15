# Setup Unit Test Workflow

## Purpose

Initialize unit testing infrastructure for a NestJS/TypeScript project. This workflow ensures consistent test setup across all projects.

---

## Pre-Workflow Knowledge Loading

Before starting, load and review the following reference files:

1. **MANDATORY**: Read `references/common/knowledge.md` - Understand testing philosophy and pyramid
2. **MANDATORY**: Read `references/common/rules.md` - Understand naming conventions and setup requirements

---

## Execution Rules

- Complete each step before proceeding to the next
- Verify successful completion at each checkpoint
- Ask user for clarification when project-specific decisions are needed
- Document any deviations from standard setup

---

## Workflow Steps

### Step 1: Analyze Existing Test Infrastructure

**Actions:**

1. Check for existing test configuration:
   - Look for `jest.config.ts` or `jest.config.js` in project root
   - Check for existing `test/` directory structure
   - Look for `*.spec.ts` files to understand existing patterns

2. Check package.json for testing dependencies:
   - `@nestjs/testing`
   - `jest`
   - `@golevelup/ts-jest`
   - `ts-jest`

3. Report findings to user:
   ```
   **Test Infrastructure Analysis:**
   - Jest config: [Found/Not found] at [path]
   - Test directory: [Found/Not found] at [path]
   - Existing spec files: [count] files found
   - Dependencies status: [list missing dependencies]
   ```

**Checkpoint:** User confirms analysis before proceeding.

---

### Step 2: Install Missing Dependencies

**Required Dependencies:**

```json
{
  "devDependencies": {
    "@nestjs/testing": "^11.0.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.6",
    "@golevelup/ts-jest": "^0.4.0",
    "@types/jest": "^29.5.14"
  }
}
```

**Actions:**

1. Identify missing dependencies from Step 1 analysis
2. Present installation command to user:
   ```bash
   npm install --save-dev [missing-packages]
   ```
3. Wait for user confirmation before running installation

**Checkpoint:** All required dependencies installed successfully.

---

### Step 3: Configure Jest

**Actions:**

1. If `jest.config.ts` does not exist, create it:

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
```

2. If config exists, verify it includes:
   - Correct `testRegex` pattern for `.spec.ts` files
   - `ts-jest` transform
   - Coverage configuration
   - Path alias mapping if project uses them

**Checkpoint:** Jest configuration validated and working.

---

### Step 4: Create Test Helper Structure

**Actions:**

1. Create test helpers directory structure:
   ```
   test/
   └── helpers/
       └── mock-logger.service.ts
   ```

2. Create MockLoggerService:

```typescript
// test/helpers/mock-logger.service.ts
import { LoggerService } from '@nestjs/common';

export class MockLoggerService implements LoggerService {
  log(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
  verbose(): void {}
}
```

3. Check if project has existing logger service and adapt MockLoggerService accordingly

**Checkpoint:** Test helper files created and accessible.

---

### Step 5: Verify Setup with Sample Test

**Actions:**

1. Create a verification test file if no tests exist:

```typescript
// test/setup.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { MockLoggerService } from './helpers/mock-logger.service';

describe('Test Setup Verification', () => {
  it('should create testing module successfully', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [],
    })
      .setLogger(new MockLoggerService())
      .compile();

    expect(module).toBeDefined();
  });

  it('should create mocks with DeepMocked', () => {
    interface SampleService {
      getData(): Promise<string>;
    }

    const mockService: DeepMocked<SampleService> = createMock<SampleService>();
    mockService.getData.mockResolvedValue('test');

    expect(mockService.getData).toBeDefined();
  });
});
```

2. Run verification test:
   ```bash
   npm test -- test/setup.spec.ts
   ```

3. Report results to user

**Checkpoint:** Verification tests pass successfully.

---

### Step 6: Configure npm Scripts

**Actions:**

1. Verify package.json has required test scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand"
  }
}
```

2. Add any missing scripts

**Checkpoint:** All test scripts available and functional.

---

## Post-Workflow Verification

After completing all steps, verify the setup by reviewing:

1. **Re-read** `references/common/rules.md` to ensure setup aligns with testing rules
2. Run `npm test` to confirm all configuration is working
3. Confirm coverage reporting works with `npm run test:cov`

---

## Completion Summary

Present final summary to user:

```
**Unit Test Setup Complete:**

✅ Dependencies installed
✅ Jest configured at [path]
✅ Test helpers created at test/helpers/
✅ Verification tests passing
✅ npm scripts configured

**Next Steps:**
- Use `writing-unit-test.md` workflow to write tests
- Follow AAA pattern and naming conventions from references/common/rules.md
- Target 80%+ coverage for new code
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Module resolution errors | Check `moduleNameMapper` in jest.config.ts |
| TypeScript compilation errors | Verify `ts-jest` configuration |
| Import path errors | Ensure path aliases match tsconfig.json |
| Mock type errors | Ensure `@golevelup/ts-jest` is installed |
