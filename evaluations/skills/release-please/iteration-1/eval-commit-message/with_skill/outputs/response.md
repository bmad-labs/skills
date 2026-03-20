# Suggested Commit Message

## Recommended Type: `feat` with Breaking Change

This is a `feat` (new feature / behavior change) because you are changing the authentication mechanism across all endpoints. Since every existing API consumer using API keys will break, this is a **breaking change** that will trigger a **major version bump**.

## Commit Message

```
feat(api)!: require Bearer token authentication on all endpoints

Replace API key authentication with Bearer token authentication
across every REST endpoint. Clients must now include an
Authorization header with a valid Bearer token instead of passing
an API key via header or query parameter.

BREAKING CHANGE: all endpoints now require a Bearer token in the
Authorization header. API key authentication has been removed.
Existing clients must obtain a Bearer token and update their
requests accordingly.
```

## Why This Format

- **Type `feat`** -- this changes the public behavior of the API, not just an internal refactor.
- **Scope `(api)`** -- narrows the change to the API surface, which keeps the changelog organized.
- **`!` after the scope** -- the exclamation mark signals a breaking change in the commit header, making it visible at a glance in `git log --oneline`.
- **`BREAKING CHANGE:` footer** -- release-please reads this footer to trigger a major version bump and includes the footer text in the changelog so consumers understand the migration impact.
- **Body** -- explains *what* changed and *how* (Bearer token replaces API key), giving future readers context without needing to open the diff.

## Version Impact

This commit will cause release-please to create a **major** version bump (e.g., `1.x.x` to `2.0.0`, or `0.x.x` to `1.0.0` depending on your current version and `bump-minor-pre-major` setting).
