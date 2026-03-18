# Commit Command for Breaking Change in om-blk-auth-service

## Context

- **Service**: om-blk-auth-service (submodule at `services/om-blk-auth-service/`)
- **Branch**: develop
- **Story**: 3-1-auth-migration
- **Change**: Removed `/api/v1/auth/login` endpoint, replaced with OAuth2 flow at `/api/v2/auth/login`
- **This is a breaking change** -- consumers of the old v1 login endpoint will break.

## Commit Command

The commit must be run from within the submodule directory. Since this is a breaking change, Conventional Commits requires a `BREAKING CHANGE` footer or a `!` after the type/scope.

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service && \
git add src/auth/login.controller.ts src/auth/login.service.ts src/auth/dto/login.dto.ts && \
git commit -m "$(cat <<'EOF'
feat(auth)!: replace v1 login endpoint with OAuth2 v2 flow

Remove /api/v1/auth/login and introduce /api/v2/auth/login with OAuth2
authentication flow. All API consumers must migrate to the v2 endpoint.

Story: 3-1-auth-migration

BREAKING CHANGE: /api/v1/auth/login has been removed. Use /api/v2/auth/login with OAuth2 flow instead.
EOF
)"
```

## Explanation

| Element | Value | Reason |
|---------|-------|--------|
| **Type** | `feat` | This introduces new functionality (OAuth2 login flow) |
| **Scope** | `auth` | Change is scoped to the auth module |
| **`!` suffix** | Present after `(auth)` | Signals a breaking change per Conventional Commits spec |
| **Subject line** | `replace v1 login endpoint with OAuth2 v2 flow` | Concise description of what changed |
| **Body** | Describes removal and introduction | Explains the "what" and "why" |
| **Story reference** | `Story: 3-1-auth-migration` | Traceability to the story |
| **BREAKING CHANGE footer** | Present | Conventional Commits requires this footer (or the `!`) to formally mark the commit as breaking. Both are included for maximum clarity. |

## After the Submodule Commit

After committing inside the submodule, the parent repo (`om-blk`) will show the submodule pointer has changed. A separate commit in the parent repo would be needed to update the submodule reference:

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk && \
git add services/om-blk-auth-service && \
git commit -m "$(cat <<'EOF'
chore: update om-blk-auth-service submodule ref

Points to OAuth2 v2 login migration (Story: 3-1-auth-migration).
EOF
)"
```
