# Commit Command for @nestjs/core v10 to v11 Upgrade in om-blk-auth-service

## The Commit Command

```bash
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-blk-auth-service && git add package.json package-lock.json && git commit -m "$(cat <<'EOF'
chore(deps): upgrade @nestjs/core from v10 to v11

Bump @nestjs/core major version to v11 for latest framework
features, performance improvements, and security patches.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Key Details

- **Working directory**: `services/om-blk-auth-service/` (the submodule, not the parent repo)
- **Files staged**: Only `package.json` and `package-lock.json` -- the two files that changed
- **Commit scope**: This commit is made inside the submodule's own git history
- **Message style**: Conventional commit format (`chore(deps):`) since this is a dependency update with no application logic change
- **No parent repo commit needed yet**: The parent repo (`om-blk`) would need a separate commit later to update the submodule pointer if desired, but that is a distinct step
