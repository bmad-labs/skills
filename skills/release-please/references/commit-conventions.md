# Conventional Commits Reference

This is a detailed reference for writing Conventional Commits compatible with release-please. For a quick overview, see the Commit Message Guide in the main SKILL.md.

## Format Specification

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Header

- **type** — required, lowercase, determines version bump behavior
- **scope** — optional, noun in parentheses describing the affected code section
- **`!`** — optional, placed after scope (or after type if no scope) to signal a breaking change
- **description** — required, after `: `, imperative present tense

**Rules for description:**
- Use imperative mood: "add", "fix", "remove" — not "added", "fixes", "removing"
- Do not capitalize the first letter
- Do not end with a period
- Keep under ~100 characters

### Body

- Separated from header by a blank line
- Free-form text explaining the "what" and "why"
- Can be multiple paragraphs

### Footer(s)

- Separated from body (or header) by a blank line
- Format: `token: value` or `token #value`
- Multi-line values: subsequent lines must be indented

## No AI Co-Author Trailers

**NEVER add `Co-Authored-By` trailers for AI agents.** No lines like:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
AI attribution pollutes changelogs, adds noise to git history, and provides no value. This applies to ALL commits.

## Commit Types

### Releasable Types (trigger a release)

| Type | SemVer Bump | Description | Examples |
|------|-------------|-------------|----------|
| `feat` | **Minor** | New capability or feature | `feat(auth): add OAuth2 login flow` |
| | | | `feat: introduce dark mode toggle` |
| `fix` | **Patch** | Bug fix for existing functionality | `fix(parser): handle empty input without crash` |
| | | | `fix: correct timezone offset calculation` |
| `deps` | **Patch** | Dependency updates | `deps: upgrade express to v5.0.0` |
| | | | `deps(core): bump typescript to 5.4` |

### Non-Releasable Types (won't trigger a release alone)

| Type | Description | Examples |
|------|-------------|----------|
| `refactor` | Code restructuring, no behavior change | `refactor(api): extract validation middleware` |
| | | `refactor: consolidate error handling` |
| `perf` | Performance improvement | `perf(query): add index for user lookup` |
| | | `perf: lazy-load dashboard widgets` |
| `test` | Adding or correcting tests | `test(auth): add JWT expiration edge cases` |
| | | `test: increase coverage for utils module` |
| `docs` | Documentation changes only | `docs(api): update endpoint descriptions` |
| | | `docs: add contributing guidelines` |
| `style` | Code style (formatting, whitespace) | `style: apply prettier formatting` |
| | | `style(components): fix indentation` |
| `chore` | Maintenance tasks | `chore: update .gitignore` |
| | | `chore(config): rotate API key names` |
| `build` | Build system changes | `build: switch from webpack to vite` |
| | | `build(docker): optimize multi-stage build` |
| `ci` | CI/CD pipeline changes | `ci: add caching to GitHub Actions` |
| | | `ci(release): fix publish step condition` |

### Decision Tree

```
Is it a new capability or feature?              → feat
Is it fixing broken behavior?                   → fix
Is it updating dependencies?                    → deps
Is it improving performance?                    → perf
Is it restructuring without behavior change?    → refactor
Is it only changing documentation?              → docs
Is it only adding/updating tests?               → test
Is it changing CI/CD or build config?           → ci / build
Is it anything else (configs, tooling, etc.)?   → chore
```

## Scopes

Scopes describe which code section is affected. They help organize changelogs and, in monorepo setups, route changes to the correct package.

### When to Use Scopes

- **Use** when the change is clearly within a specific module, domain, or package
- **Omit** when the change spans multiple areas or is project-wide

### Naming Conventions

- Use lowercase, hyphenated names: `user-auth`, `api-gateway`, `data-layer`
- Use the domain or module name, not file paths
- Keep consistent within a project

### Good Scopes

```
feat(auth): add JWT validation
fix(scheduler): correct cron expression parsing
refactor(booking): extract date utility
docs(api): update endpoint descriptions
```

### Bad Scopes (Anti-patterns)

```
fix(PROJ-1234): ...          ← ticket IDs are not scopes
feat(john): ...               ← people are not scopes
chore(src/utils/helper.ts):  ← file paths are not scopes
feat(minor): ...              ← semver labels are not scopes
```

### Monorepo Scopes

In monorepos, use the package/component name as the scope so release-please routes changes correctly:

```
feat(core): add streaming support
fix(cli): resolve argument parsing
docs(utils): update API reference
```

## Breaking Changes

Any commit type with a breaking change triggers a **major** version bump (or minor if < 1.0.0 with `bump-minor-pre-major`).

### Syntax Option A: `!` in Header + Footer

```
feat(api)!: redesign authentication flow

The authentication system now uses OAuth2 exclusively.
Session-based auth is removed.

BREAKING CHANGE: the /auth/login endpoint now requires OAuth2 tokens
instead of API keys. All existing integrations must migrate to the
new /auth/oauth/token endpoint.
```

### Syntax Option B: Footer Only

```
refactor(database): migrate from MongoDB to PostgreSQL

Complete data layer rewrite using PostgreSQL with Prisma ORM.

BREAKING CHANGE: all database connection strings must be updated.
The MongoDB driver is no longer included. See migration guide at
docs/migration-v3.md.
```

**Best practice:** Always include a `BREAKING CHANGE:` footer explaining migration impact, even when using the `!` syntax. The footer is what consumers read to understand what they need to change.

Both `BREAKING CHANGE` (space) and `BREAKING-CHANGE` (hyphen) are recognized.

## Special Footers

### Release-As

Force a specific version number for the next release:

```
chore: prepare v3.0.0 release

Release-As: 3.0.0
```

Useful for:
- Initial releases (bootstrapping a version)
- Coordinated version jumps across packages
- Correcting a version after an incorrect bump

### BREAKING CHANGE

```
BREAKING CHANGE: description of what changed and migration path
```

Can span multiple lines:

```
BREAKING CHANGE: the configuration format has changed from YAML to TOML.
All existing config files must be converted. A migration script is
available at scripts/migrate-config.sh.
```

## Real-World Examples Gallery

### Feature with body (minor bump)
```
feat(booking): add search by date range endpoint

Supports ISO 8601 date ranges with inclusive start and exclusive end.
Results are paginated with a default page size of 20.
```

### Bug fix with context (patch bump)
```
fix(auth): resolve token refresh race condition

The refresh token was being invalidated before the new access token
was issued, causing a brief window where requests would fail with 401.
```

### Dependency update (patch bump)
```
deps: upgrade @nestjs/core to v11.0.0
```

### Breaking API change (major bump)
```
feat(api)!: remove deprecated v1 booking endpoints

BREAKING CHANGE: all /api/v1/bookings/* endpoints are removed.
Consumers must migrate to /api/v2/bookings/* which uses cursor-based
pagination instead of offset-based.
```

### Performance improvement (no release)
```
perf(query): add composite index for user+date lookup

Reduces booking search query time from ~200ms to ~15ms for
date-filtered queries.
```

### Refactoring (no release)
```
refactor(middleware): extract rate limiting into shared module

No behavior change. Moves rate limiting logic from individual route
handlers into a reusable NestJS guard.
```

### CI change (no release)
```
ci(release): add npm provenance to publish step
```

### Multi-scope breaking change (major bump)
```
feat!: migrate from Express to Fastify

Complete HTTP framework migration. All middleware must be rewritten
to use Fastify's plugin system.

BREAKING CHANGE: Express middleware is no longer compatible.
Custom middleware must be converted to Fastify plugins.
See docs/fastify-migration.md for the migration guide.
```

### Initial release with Release-As
```
feat: initial public release

Release-As: 1.0.0
```

### Test-only change (no release)
```
test(scheduler): add unit tests for cron expression parser

Covers edge cases: leap years, DST transitions, and
timezone-aware scheduling.
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `Update stuff` | Not conventional format | `fix(auth): resolve login timeout` |
| `feat: Add feature` | Capitalized description | `feat: add feature` |
| `feat: add feature.` | Trailing period | `feat: add feature` |
| `chore: fix bug` | Wrong type for a bug fix | `fix: resolve the issue` |
| `feat: refactor auth` | Wrong type for refactoring | `refactor(auth): restructure module` |
| `fix(JIRA-123): thing` | Ticket ID as scope | `fix(auth): thing` (reference ticket in body) |
| `feat: added feature` | Past tense | `feat: add feature` |
| Multiple unrelated changes | Hard to revert, confuses changelog | Split into separate commits |
