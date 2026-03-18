# Approach: Search Company Knowledge — Authentication System

**User query:** "What do we know about our authentication system? I'm new to the team and trying to understand how login works, what OAuth providers we support, and any known issues."

---

## 1. Sub-skill Loaded

Loaded the **Search Company Knowledge** workflow from `skills/search-company-knowledge.md`. This is the correct sub-skill because the user wants to find and synthesize information scattered across Confluence documentation and Jira issues. The workflow defines a 5-step process: Understand Query, Parallel Search, Fetch Details, Synthesize, and Follow-up.

---

## 2. Search Terms Extracted

Following Step 1 of the sub-skill ("Parse the user's question to identify key search terms, Jira relevance, Confluence relevance, and scope narrowing"):

**Key search terms identified:**
- Primary: `authentication`, `login`, `OAuth`
- Synonyms / broadening terms (per `references/search-patterns.md` "Broadening Results" section): `auth`, `SSO`, `identity`, `sign-in`, `authorization`, `identity provider`, `OIDC`, `SAML`

**Jira relevance:** High — known issues, bugs, and feature work related to authentication would live in Jira tickets (Bugs, Stories, Epics).

**Confluence relevance:** High — architecture docs, setup guides, decision records, and runbooks about authentication would be on Confluence pages.

**Scope narrowing:** None specified by the user — no project key, space key, date range, or author mentioned. We search broadly across all accessible projects and spaces.

---

## 3. Parallel Search Commands

Following Step 2 of the sub-skill ("Run searches across both Confluence and Jira simultaneously") and consulting `references/search-patterns.md` for the multi-source parallel search strategy and `references/query-languages.md` for syntax:

### Confluence CQL Searches (documentation, architecture, decisions)

**Search 1 — Core authentication documentation:**
```bash
node <skill-path>/scripts/confluence.mjs search 'type = page AND text ~ "authentication" AND text ~ "login"' --max 10
```

**Search 2 — OAuth provider documentation:**
```bash
node <skill-path>/scripts/confluence.mjs search 'type = page AND text ~ "OAuth" AND type = page' --max 10
```

**Search 3 — SSO / identity provider docs:**
```bash
node <skill-path>/scripts/confluence.mjs search 'type = page AND (text ~ "SSO" OR text ~ "identity provider" OR text ~ "SAML" OR text ~ "OIDC")' --max 10
```

**Search 4 — Architecture decision records related to auth:**
```bash
node <skill-path>/scripts/confluence.mjs search 'label IN ("adr", "decision", "architecture") AND text ~ "auth"' --max 10
```

### Jira JQL Searches (issues, bugs, feature work)

**Search 5 — Known bugs and incidents related to authentication:**
```bash
node <skill-path>/scripts/jira.mjs search 'issuetype IN (Bug, Incident) AND text ~ "authentication" ORDER BY updated DESC' --max 10
```

**Search 6 — Epics and stories for auth features:**
```bash
node <skill-path>/scripts/jira.mjs search 'issuetype IN (Epic, Story) AND (text ~ "authentication" OR text ~ "OAuth" OR text ~ "login") ORDER BY updated DESC' --max 10
```

**Search 7 — Open/unresolved auth issues (current problems):**
```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "auth" AND statusCategory != Done AND (component = Auth OR component = Authentication OR labels IN (auth, authentication, login, oauth)) ORDER BY priority DESC' --max 10
```

All 7 searches would be launched in parallel to minimize wait time, following the "Parallel Search Flow" pattern from `references/search-patterns.md`.

---

## 4. How I Would Fetch Details from Top Results

Following Step 3 of the sub-skill ("For the most relevant results (top 3-5), fetch full content"):

After receiving search results, I would apply the **relevance scoring heuristics** from `references/search-patterns.md`:
- **Title match (+3):** Does the title contain "authentication", "login", "OAuth"?
- **Exact phrase match (+2):** Full phrase like "OAuth provider" found?
- **Recency (+3/+2/+1):** Prioritize recently updated content (within 7d, 30d, 90d).
- **Status active (+1):** Jira issues not in Done status; current Confluence pages.

From the ranked results, I would fetch the top 3-5 from each source:

**Confluence pages — fetch full content:**
```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId1>
node <skill-path>/scripts/confluence.mjs get-page <pageId2>
node <skill-path>/scripts/confluence.mjs get-page <pageId3>
```

**Jira issues — fetch full details:**
```bash
node <skill-path>/scripts/jira.mjs get <ISSUE-KEY-1>
node <skill-path>/scripts/jira.mjs get <ISSUE-KEY-2>
node <skill-path>/scripts/jira.mjs get <ISSUE-KEY-3>
```

These fetches would also run in parallel. I would read through each result's full content to extract relevant sections about authentication architecture, OAuth configuration, login flow, and known issues.

---

## 5. How I Would Synthesize and Cite Sources

Following Step 4 of the sub-skill ("Combine findings into a coherent answer, cite sources, note conflicts, highlight authoritative sources"):

The synthesized response would be organized into the sections the user asked about:

**Structure of the response:**

1. **Authentication System Overview** — Summarize how login works, citing the most authoritative Confluence page (e.g., an architecture doc or design doc).

2. **OAuth Providers Supported** — List each provider found in documentation, with configuration details if available. Cite the specific Confluence page(s).

3. **Known Issues** — Summarize open Jira bugs and incidents related to auth, grouped by severity. Provide issue keys as links.

4. **Related Work in Progress** — Any in-flight epics or stories that are changing the auth system (important for a new team member to know).

**Citation format (per the sub-skill example):**

> The authentication system uses OAuth 2.0 with PKCE flow for all client applications.
> **Source:** "Authentication Architecture" (Confluence, ENG space, last updated 2026-02-15)
>
> Currently supported OAuth providers: Google, GitHub, and Azure AD.
> **Source:** "OAuth Provider Configuration Guide" (Confluence, DEVOPS space)
>
> Known issues:
> - AUTH-456: Token refresh fails intermittently for Azure AD users (Priority: High, Status: In Progress)
> - AUTH-489: Login timeout on mobile Safari (Priority: Medium, Status: Open)

**Conflict handling:** If Confluence docs say one thing and a Jira ticket reveals a different reality (e.g., a provider was deprecated), I would flag the discrepancy and note which source is more recent.

---

## 6. Follow-up Offers

Following Step 5 of the sub-skill ("Offer the user options to continue"):

After presenting the synthesis, I would offer:

- **Refine the search:** "Would you like me to search for a specific OAuth provider (e.g., Google, Azure AD) in more detail?"
- **Explore specific spaces/projects:** "Should I look in a particular team's Confluence space or Jira project for more targeted results?"
- **Deep-dive on issues:** "Want me to pull up the full details on any of the open auth bugs?"
- **Create a summary page:** "I can create a Confluence page summarizing these findings as an onboarding reference for new team members."
- **Search for related topics:** "Would you also like to know about authorization/permissions, session management, or API key handling?"

---

## 7. Reference Files Consulted

| File | Why consulted |
|------|---------------|
| `skills/search-company-knowledge.md` | Primary sub-skill workflow — defined the 5-step process followed |
| `references/search-patterns.md` | Multi-source parallel search strategy, relevance scoring heuristics, broadening/narrowing techniques, combined search patterns |
| `references/query-languages.md` | JQL and CQL syntax for constructing search queries (fields, operators, functions, examples) |

**Reference files available but not consulted (not needed for this task):**
- `references/jira-api.md` — Would consult if I needed raw API endpoint details beyond what the scripts expose.
- `references/confluence-api.md` — Same; the scripts abstract the API calls.
- `references/jql-patterns.md` — Would consult for more advanced JQL patterns if initial searches returned poor results.
- `references/ticket-writing-guide.md` — Not applicable; we are reading, not creating tickets.
- `references/bug-report-templates.md` — Not applicable; no bug is being filed.
