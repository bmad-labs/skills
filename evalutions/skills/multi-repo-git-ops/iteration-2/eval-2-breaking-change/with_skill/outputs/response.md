# Commit Command for Breaking Change in om-blk-auth-service

## Context

This is a **breaking change** — the old `/api/v1/auth/login` endpoint was removed and replaced with an OAuth2 flow at `/api/v2/auth/login`. Per the skill's Conventional Commits rules, this requires:

1. The `!` marker after the scope in the header to signal a breaking change
2. A `BREAKING CHANGE:` footer explaining migration impact (mandatory even when using `!`)
3. A `Story:` reference in the footer
4. No `Co-Authored-By` trailers (explicitly prohibited by the skill)
5. Specific files staged (never `git add .` or `git add -A`)

## Commands

First, navigate into the service repo and stage the specific changed files:

```bash
cd services/om-blk-auth-service
git add src/auth/login.controller.ts src/auth/login.service.ts src/auth/dto/login.dto.ts
```

Then commit with the properly formatted message:

```bash
git commit -m "$(cat <<'EOF'
feat(auth)!: replace v1 login endpoint with OAuth2 flow

Remove the deprecated /api/v1/auth/login endpoint and replace it with
/api/v2/auth/login using OAuth2 authorization code flow.

BREAKING CHANGE: the /api/v1/auth/login endpoint is removed. All consumers
must migrate to /api/v2/auth/login which requires OAuth2 tokens instead of
direct credential submission. Existing API key integrations will stop working.

Story: 3-1-auth-migration
EOF
)"
```

## Why this format

| Element | Rationale |
|---------|-----------|
| `feat` type | This is a new capability (OAuth2 flow), which triggers a **minor** bump — but the breaking change overrides to a **major** bump |
| `(auth)` scope | Domain/module name as scope, not a ticket ID (per skill anti-pattern rules) |
| `!` after scope | Signals breaking change in the header for release-please |
| `BREAKING CHANGE:` footer | Required explanation of migration impact for consumers; release-please uses this to trigger a **major** version bump |
| `Story: 3-1-auth-migration` | BMAD story reference in the footer, not in the scope |
| No `Co-Authored-By` | Explicitly prohibited by the skill — AI attribution pollutes changelogs and git history |
| Specific file staging | `git add` with explicit paths, never `git add .` or `git add -A` (safety rule #5) |
