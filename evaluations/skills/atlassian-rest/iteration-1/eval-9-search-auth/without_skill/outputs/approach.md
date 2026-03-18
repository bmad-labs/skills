# Approach: Search Authentication System Knowledge (Without Skill)

## Task

The user asks: "What do we know about our authentication system? I'm new to the team and trying to understand how login works, what OAuth providers we support, and any known issues."

This is a knowledge discovery task. The expected approach (per `evals/evals.json` eval #9) is to trigger the `search-company-knowledge` workflow, which performs parallel searches across Confluence and Jira, fetches top results, and synthesizes a coherent answer.

## What Was Attempted

Without the Atlassian REST skill (no MCP tools, no configured environment variables, no access to the company's Jira or Confluence instances), the only option is to search the **local codebase** for authentication-related information.

### Local Codebase Search

Searched the entire repository for keywords: `auth`, `login`, `oauth`, `sign-in`, `credential`, `token`, `session`, `password`.

**Result:** 15 files matched, but none contain actual application authentication system documentation. All matches fall into these categories:

1. **Atlassian API authentication** (how this skill authenticates to Atlassian REST APIs):
   - Basic auth via `email:api-token` base64-encoded
   - Environment variables: `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `ATLASSIAN_DOMAIN`
   - Setup script at `scripts/setup.mjs`
   - References in `references/jira-api.md` and `references/confluence-api.md`

2. **Example/template content** (illustrative text in reference docs):
   - "Fix login bug" appears as example ticket summaries in `references/ticket-writing-guide.md`
   - "Auth Service" appears as example JQL component filter in `references/jql-patterns.md`
   - "auth module refactor" appears as example meeting note in `references/action-item-patterns.md`

3. **The eval definition itself** (`evals/evals.json` eval #9) which defines this exact question.

### What Would Be Needed

To properly answer this question, the agent would need to:

1. **Extract search terms:** authentication, login, OAuth, sign-in, SSO
2. **Run parallel Jira + Confluence searches:**
   ```bash
   node scripts/jira.mjs search 'text ~ "authentication" OR text ~ "login" OR text ~ "OAuth"' --max 10
   node scripts/confluence.mjs search 'text ~ "authentication" AND type = page' --max 10
   node scripts/confluence.mjs search 'text ~ "OAuth" AND type = page' --max 10
   node scripts/confluence.mjs search 'text ~ "login" AND type = page' --max 10
   ```
3. **Broaden with synonyms** (per `references/search-patterns.md`): search "auth" AND "authentication" AND "login" AND "SSO" AND "single sign-on"
4. **Fetch full content** from top 3-5 results via `confluence.mjs get-page` and `jira.mjs get`
5. **Synthesize** into sections: how login works, OAuth providers, known issues
6. **Cite sources** with page titles, issue keys, and links
7. **Offer follow-up** searches for deeper dives

## Outcome

**Unable to answer the user's question.** This repository is a skill/plugin for AI agents -- it does not contain company authentication system documentation. The authentication information that exists here is solely about how the skill itself authenticates to Atlassian APIs (Basic auth with API tokens), which is not what the user is asking about.

The user's question requires live access to the company's Jira and Confluence instances, which requires:
- The `atlassian-rest` skill to be installed and active
- Environment variables (`ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, `ATLASSIAN_DOMAIN`) to be configured
- Network access to the Atlassian Cloud instance

## Limitations Without the Skill

| Capability | With Skill | Without Skill |
|-----------|-----------|---------------|
| Search Jira issues | Yes (via `jira.mjs search`) | No |
| Search Confluence pages | Yes (via `confluence.mjs search`) | No |
| Fetch full page/issue content | Yes | No |
| Synthesize cross-platform results | Yes | No |
| Provide citations with links | Yes | No |
| Offer refined follow-up searches | Yes | No |

Without the Atlassian skill, this task is fundamentally impossible to complete. The information lives in external systems (Jira and Confluence) that cannot be queried without proper tooling and credentials.
