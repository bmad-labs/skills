# Git Commit Command for search-by-date Feature

Based on the multi-repo-git-ops skill, here are the exact commands you would run. Do NOT run these -- they are written out for review.

## Commands

```bash
cd services/om-newblink-bl-service

git add src/booking/search-by-date.use-case.ts src/booking/search-by-date.use-case.spec.ts

git commit -m "feat(booking): add search by date use case

Story: 2-4-booking-search"
```

## Rationale

- **Repository**: The commit happens inside `services/om-newblink-bl-service/` because that is the service submodule where the code lives. Each service has its own git history.
- **Type**: `feat` -- this is a new capability (search-by-date feature), which triggers a minor version bump via release-please.
- **Scope**: `booking` -- the domain/module name, not a ticket ID or person name. The skill specifies using the domain or module name as the scope.
- **Description**: `add search by date use case` -- imperative, present tense, lowercase, no trailing period, under 100 characters.
- **Story reference**: `Story: 2-4-booking-search` -- placed in the commit body (not the scope), derived from the BMAD story identifier. The skill explicitly states story keys go in the body or footer, not the scope.
- **No Co-Authored-By trailer**: The skill explicitly prohibits AI co-author trailers in commit messages (Safety Rule #9). They pollute changelogs and git history.
- **Specific files added**: `git add` targets the two specific files rather than using `git add .` or `git add -A` (Safety Rule #5).
