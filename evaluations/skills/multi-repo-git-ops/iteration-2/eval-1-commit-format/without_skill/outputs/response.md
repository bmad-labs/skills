# Git Commit Command for Search-by-Date Feature

## Prerequisites

You need to run this command from inside the submodule directory:

```
cd /Users/tannt/Works/GIT/OPUS/Sources/om-blk/services/om-newblink-bl-service
```

## Stage the specific files

```bash
git add src/booking/search-by-date.use-case.ts src/booking/search-by-date.use-case.spec.ts
```

## Commit command

```bash
git commit -m "$(cat <<'EOF'
feat(booking): add search-by-date use case

Add search-by-date feature to the booking module with unit tests.

Ref: BMAD story 2-4-booking-search
EOF
)"
```

## Notes

- The commit is made inside the `om-newblink-bl-service` submodule, which has its own git history and tracks the `dev` branch.
- Only the two changed files are staged explicitly, avoiding unintended additions.
- After committing in the submodule, the parent repo (`om-blk`) will show the submodule pointer as modified. You would commit that separately in the parent repo if needed.
