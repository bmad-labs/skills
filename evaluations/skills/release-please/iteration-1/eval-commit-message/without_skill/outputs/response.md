# Suggested Commit Message

```
feat!: replace API key authentication with Bearer token auth on all endpoints

BREAKING CHANGE: All REST API endpoints now require a Bearer token in the
Authorization header instead of an API key. Clients must update their
authentication method from passing an API key (e.g., via `X-API-Key` header
or query parameter) to sending a Bearer token in the `Authorization: Bearer <token>`
header.

Migration steps:
- Obtain a Bearer token from the auth/token endpoint (or your identity provider)
- Replace `X-API-Key: <key>` with `Authorization: Bearer <token>` in all requests
- Remove any API key query parameters from request URLs
```

# Explanation

This commit message follows the **Conventional Commits** specification, which is widely adopted and integrates well with tooling like `release-please`, `semantic-release`, and changelog generators.

## Key elements of this message

1. **`feat!:` prefix** -- The `!` after the type signals a breaking change. This is the Conventional Commits shorthand that tools use to trigger a major version bump (e.g., v1.x.x to v2.0.0) in semantic versioning.

2. **Concise subject line** -- The first line summarizes what changed and why in under 72 characters. It focuses on the *what* (replaced API key auth with Bearer token auth) and the *scope* (all endpoints).

3. **`BREAKING CHANGE:` footer** -- This is the formal Conventional Commits footer that explicitly describes the impact on consumers. Many tools (including release-please) look for this exact token to generate breaking change notes in changelogs and to determine the correct version bump.

4. **Migration steps** -- Including brief migration guidance directly in the commit body helps anyone reading the changelog or git history understand exactly what they need to do to adapt. This is especially valuable for API consumers who may not have access to separate migration docs at the time of release.

## Why this structure matters

- **Changelog generation**: Tools automatically pull the subject line and BREAKING CHANGE footer into release notes, so consumers see the breaking change prominently.
- **Version bumping**: The `!` and `BREAKING CHANGE` footer both ensure automated tooling bumps the major version.
- **Searchability**: Future developers can `git log --grep="BREAKING CHANGE"` to find all breaking changes in the project history.
