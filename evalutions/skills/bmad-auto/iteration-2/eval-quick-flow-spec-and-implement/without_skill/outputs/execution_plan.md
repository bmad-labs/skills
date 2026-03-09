# Execution Plan: Refactor UserService to Repository Pattern

## Task Summary

Refactor `UserService` in `src/users/` to use the repository pattern instead of direct database calls. This is a focused change across 3 files.

---

## Phase 1: Discovery & Analysis

### Step 1 - Understand current implementation

**Tools:** `Glob`, `Read`

1. **Find all files in `src/users/`** using `Glob` with pattern `src/users/**/*`.
2. **Read `UserService`** (likely `src/users/user.service.ts` or similar) to understand:
   - What database calls are made directly (e.g., ORM calls like `prisma.user.find()`, `typeorm.getRepository()`, raw SQL, etc.).
   - What methods the service exposes.
   - What dependencies are injected.
3. **Read related files** (e.g., `user.module.ts`, `user.controller.ts`, any existing models/entities) to understand the dependency graph.
4. **Search for database usage patterns** using `Grep` with patterns like `prisma`, `getRepository`, `query`, `db.`, `knex`, or ORM-specific calls to confirm all direct DB access points.

### Step 2 - Identify the 3 files in scope

Based on discovery, the 3 files would likely be:
- `src/users/user.service.ts` - the service being refactored
- `src/users/user.repository.ts` - new file to create (repository layer)
- `src/users/user.module.ts` - module wiring to register the repository as a provider

---

## Phase 2: Spec / Design

### Step 3 - Write a brief inline spec

**Tools:** `Write` (to save spec as an output artifact, or inline in a comment)

Define the repository interface and implementation plan:

1. **Repository Interface** - Extract all database operations from `UserService` into a `UserRepository` (or `IUserRepository` interface + concrete class):
   - Map each direct DB call in the service to a repository method.
   - Example methods: `findById(id)`, `findByEmail(email)`, `create(data)`, `update(id, data)`, `delete(id)`.
2. **Service Refactor** - Replace all direct DB calls in `UserService` with calls to the injected repository.
3. **Module Update** - Register `UserRepository` as a provider and inject it into `UserService`.

No separate spec document would be created unless the user requested one -- I would proceed directly to implementation with the design above.

---

## Phase 3: Implementation

### Step 4 - Create the Repository

**Tools:** `Write`

Create `src/users/user.repository.ts`:
- Define a class `UserRepository` (or an interface + implementation, depending on the framework).
- Move all raw database logic from the service into repository methods.
- If using NestJS: decorate with `@Injectable()`.
- If using TypeORM: extend `Repository<User>` or use a custom repository.
- If using Prisma: inject `PrismaService` and wrap calls.

### Step 5 - Refactor the Service

**Tools:** `Read`, `Edit`

Modify `src/users/user.service.ts`:
- Remove direct database dependency (e.g., remove `PrismaService` or `DataSource` injection).
- Add `UserRepository` as a constructor dependency.
- Replace every direct DB call with the corresponding repository method.
- Keep business logic (validation, transformation, error handling) in the service.

### Step 6 - Update the Module

**Tools:** `Read`, `Edit`

Modify `src/users/user.module.ts`:
- Add `UserRepository` to the `providers` array.
- Ensure it is available for injection into `UserService`.

### Step 7 - Check for test files

**Tools:** `Glob`, `Read`

1. Search for `src/users/**/*.spec.ts` or `src/users/**/*.test.ts`.
2. If tests exist for `UserService`, update them to mock the `UserRepository` instead of mocking the database layer directly.
3. This may add a 4th file to the change set if tests need updating.

---

## Phase 4: Verification

### Step 8 - Validate the refactoring

**Tools:** `Bash`, `Grep`

1. **Compile check**: Run `npx tsc --noEmit` (or the project's build command) to verify no type errors.
2. **Run tests**: Execute `npm test` or the project's test command to confirm nothing is broken.
3. **Search for leftover direct DB calls** in `user.service.ts` using `Grep` to ensure all were migrated.

---

## Tool Usage Summary

| Step | Tools Used | Purpose |
|------|-----------|---------|
| 1 | Glob, Read, Grep | Discover files, understand current DB usage |
| 2 | (analysis) | Identify files in scope |
| 3 | (design) | Plan repository interface |
| 4 | Write | Create new repository file |
| 5 | Read, Edit | Refactor service to use repository |
| 6 | Read, Edit | Wire repository into module |
| 7 | Glob, Read, Edit | Update tests if they exist |
| 8 | Bash, Grep | Compile check, run tests, verify cleanup |

## Estimated File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/users/user.repository.ts` | **CREATE** | New repository class with all DB operations |
| `src/users/user.service.ts` | **MODIFY** | Replace direct DB calls with repository calls |
| `src/users/user.module.ts` | **MODIFY** | Register repository as provider |

## Key Decisions Made Without Skill Guidance

1. **No formal spec document** - Proceeded with an implicit design rather than writing a separate specification. A skill might enforce a spec-first workflow.
2. **No scope assessment** - Did not formally evaluate whether this task warrants a larger planning process or can proceed as a "quick flow." A skill might provide criteria for this.
3. **Assumed standard patterns** - Assumed NestJS-style DI and typical repository pattern without checking project conventions. A skill might reference project-specific guidelines.
4. **Linear execution** - Followed a straightforward discover-design-implement-verify sequence. A skill might enforce checkpoints, reviews, or iterative loops.
5. **Test updates treated as optional** - Only checked for tests as an afterthought. A skill might require test updates as a mandatory step.
