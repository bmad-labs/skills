# Approach: Search Company Knowledge About Authentication System

## Task

Search across Jira (project DO) and Confluence for information about the authentication system, covering login, OAuth, and known issues.

## Workflow Used

`workflows/search-company-knowledge.md` -- a 5-step workflow for searching across Jira and Confluence to find and synthesize information.

## Reference Files Consulted

- `references/search-patterns.md` -- multi-source search strategies, refinement techniques, broadening/narrowing patterns
- `references/query-languages.md` -- JQL and CQL syntax for constructing queries

---

## Step 1: Understand Query

**Key search terms identified:**
- Primary: "authentication", "login", "OAuth"
- Secondary/synonyms: "auth", "SSO", "sign-in", "token", "session"

**Jira relevance:** High -- bugs, stories, and tasks related to authentication features and known issues would live in the DO project.

**Confluence relevance:** High -- architecture docs, runbooks, design decisions, and API docs about the auth system would live in Confluence pages.

**Scope narrowing:**
- Jira: project = DO
- Confluence: search across all spaces (no space key specified by user)

---

## Step 2: Parallel Search -- Exact Commands

### Search 1: Confluence -- broad authentication search

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'text ~ "authentication" AND type = page' --max 10
```

### Search 2: Confluence -- login-specific search

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'text ~ "login" AND type = page' --max 10
```

### Search 3: Confluence -- OAuth-specific search

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'text ~ "OAuth" AND type = page' --max 10
```

### Search 4: Jira -- authentication issues in DO project

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND text ~ "authentication"' --max 10
```

### Search 5: Jira -- login-related issues in DO project

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND text ~ "login"' --max 10
```

### Search 6: Jira -- OAuth-related issues in DO project

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND text ~ "OAuth"' --max 10
```

### Search 7: Jira -- known auth bugs specifically

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "authentication" ORDER BY updated DESC' --max 10
```

### Search 8: Jira -- broader auth keyword with synonym coverage

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND (text ~ "auth" OR text ~ "SSO" OR text ~ "session" OR text ~ "token") ORDER BY updated DESC' --max 15
```

**Rationale for multiple searches:** The search-patterns reference recommends using synonyms to broaden results ("auth", "authentication", "login") and separate queries for each major term to avoid missing results. Running Jira and Confluence searches in parallel maximizes coverage.

---

## Step 3: Fetch Details -- Exact Commands

After collecting search results from Step 2, fetch full content for the top 3-5 most relevant results from each platform.

### For each relevant Confluence page (by page ID from search results):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <pageId>
```

Example (assuming page IDs 11111, 22222, 33333 are top results):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page 11111
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page 22222
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page 33333
```

### For each relevant Jira issue (by issue key from search results):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get <issueKey>
```

Example (assuming DO-101, DO-205, DO-312 are top results):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-101
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-205
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-312
```

---

## Step 4: Synthesize

After reading the full content of each fetched result:

1. **Summarize key findings** -- group information by sub-topic (login flow, OAuth integration, known issues/bugs)
2. **Cite sources** -- include Confluence page titles with links and Jira issue keys with links, e.g.:
   - "The OAuth integration architecture is documented in 'Authentication Architecture' (Confluence, ENG space)"
   - "Known login timeout bug tracked in DO-205"
3. **Note conflicts** -- flag any contradictions between sources (e.g., outdated Confluence docs vs. recent Jira tickets)
4. **Highlight authoritative sources** -- prioritize the most recently updated documents and active (non-closed) issues

---

## Step 5: Follow-up

Offer the user these continuation options:
- Refine search with different terms (e.g., "2FA", "MFA", "password reset")
- Search in specific Confluence spaces not yet covered
- Fetch additional pages or issues for deeper reading
- Create a Confluence page summarizing all authentication-related findings

---

## Summary of All Commands

| # | Platform | Command | Purpose |
|---|----------|---------|---------|
| 1 | Confluence | `confluence.mjs search 'text ~ "authentication" AND type = page' --max 10` | Find auth documentation pages |
| 2 | Confluence | `confluence.mjs search 'text ~ "login" AND type = page' --max 10` | Find login-related pages |
| 3 | Confluence | `confluence.mjs search 'text ~ "OAuth" AND type = page' --max 10` | Find OAuth-specific pages |
| 4 | Jira | `jira.mjs search 'project = DO AND text ~ "authentication"' --max 10` | Find auth issues in DO |
| 5 | Jira | `jira.mjs search 'project = DO AND text ~ "login"' --max 10` | Find login issues in DO |
| 6 | Jira | `jira.mjs search 'project = DO AND text ~ "OAuth"' --max 10` | Find OAuth issues in DO |
| 7 | Jira | `jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "authentication" ORDER BY updated DESC' --max 10` | Find known auth bugs |
| 8 | Jira | `jira.mjs search 'project = DO AND (text ~ "auth" OR text ~ "SSO" OR text ~ "session" OR text ~ "token") ORDER BY updated DESC' --max 15` | Broad synonym search for auth-related issues |
| 9 | Confluence | `confluence.mjs get-page <pageId>` (x3-5) | Fetch full content of top Confluence results |
| 10 | Jira | `jira.mjs get <issueKey>` (x3-5) | Fetch full content of top Jira results |

All script paths are prefixed with: `node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/`
