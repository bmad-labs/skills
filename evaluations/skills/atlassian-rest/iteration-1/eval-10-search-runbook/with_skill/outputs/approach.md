# Approach: Search Confluence for Deployment Runbook

## 1. Sub-Skill Loaded

The workflow sub-skill **Search Company Knowledge** (`skills/search-company-knowledge.md`) was loaded. It defines a five-step process:

1. **Understand Query** -- parse keywords, determine Jira/Confluence relevance, identify scope narrowing.
2. **Parallel Search** -- run CQL against Confluence and JQL against Jira simultaneously.
3. **Fetch Details** -- retrieve full content for the top 3-5 results.
4. **Synthesize** -- combine findings, cite sources with titles and links, note conflicts.
5. **Follow-up** -- offer the user options to refine, broaden, or save the results.

---

## 2. How I Target Confluence Specifically (Not Jira)

The user asked to "search our Confluence for the deployment runbook." The sub-skill's Step 1 ("Understand Query") instructs me to assess **Confluence relevance** vs **Jira relevance** independently. Since the user explicitly said "Confluence" and is looking for a "runbook" (a documentation artifact, not a ticket), the analysis is:

- **Confluence relevance: HIGH** -- runbooks are documentation pages, typically stored in Confluence spaces.
- **Jira relevance: LOW** -- the user did not ask about issues or tickets. However, the sub-skill says to search both in parallel for comprehensiveness.

In practice, I would **prioritize and lead with Confluence results**, but still run a lightweight Jira search to surface any linked issues (e.g., tickets tracking runbook updates or deployment automation work). The Confluence search would be the primary source; Jira would be supplementary context only.

The sub-skill does not say "skip Jira entirely" -- it says run both in parallel. But the synthesis in Step 4 would weight Confluence pages far more heavily for this query.

---

## 3. Exact CQL Search Command

Based on the sub-skill's Step 2 template and the CQL syntax from `references/query-languages.md`, the primary Confluence search command would be:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND text ~ "deployment runbook"' --max 10
```

If the initial search returns too few results, I would broaden using techniques from `references/search-patterns.md`:

**Broadened search (synonyms):**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND (text ~ "deployment runbook" OR text ~ "deploy to production" OR text ~ "release runbook")' --max 10
```

**Label-based search (runbooks are often labeled):**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND label = "runbook" AND text ~ "deployment"' --max 10
```

**Space-scoped search (if a DevOps or OPS space is known):**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND space IN (DEVOPS, OPS) AND text ~ "deployment"' --max 10
```

The supplementary Jira search would be:
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'text ~ "deployment runbook"' --max 10
```

---

## 4. How I Fetch Full Page Content

Per the sub-skill's Step 3, after receiving search results I would identify the top 3-5 most relevant pages by title match and recency, then fetch each page's full content using `get-page`:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <pageId>
```

For example, if the search returned a page titled "Production Deployment Runbook" with page ID 78901:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page 78901
```

The `--format view` flag could also be used for a cleaner rendering:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page 78901 --format view
```

I would read through the full content of each fetched page to extract the deployment steps the user is looking for.

---

## 5. How I Present with Citations

Per the sub-skill's Step 4 ("Synthesize"), findings are presented as a coherent answer with explicit source citations. The sub-skill provides this example format:

> The deployment process is documented in "Release Runbook" (Confluence, DEVOPS space).
> Related issues: DEVOPS-456 tracks the automation effort.

For this task, the presentation would:

1. **Summarize the deployment steps** extracted from the most authoritative Confluence page, presented in a numbered list.
2. **Cite each source** with the page title, Confluence space key, and a direct URL constructed as `https://{ATLASSIAN_DOMAIN}/wiki{content._links.webui}` (per the result normalization table in `references/search-patterns.md`).
3. **Note conflicting information** if multiple pages describe different processes (e.g., an outdated runbook vs. a current one), highlighting which is more recent based on the `lastmodified` / `content.version.when` field.
4. **Highlight the most authoritative source** based on recency and relevance scoring heuristics (title match +3, recency up to +3, exact phrase match +2).
5. **Offer follow-up options** per Step 5 -- e.g., "Would you like me to search in a specific space?" or "Should I look for related Jira tickets tracking deployment improvements?"

---

## 6. Reference Files Consulted

| Reference File | Path | Why Consulted |
|---|---|---|
| **Search Company Knowledge** (sub-skill) | `skills/atlassian-rest/skills/search-company-knowledge.md` | Primary workflow -- defines the 5-step search process |
| **Search Strategy Patterns** | `skills/atlassian-rest/references/search-patterns.md` | Multi-source search strategy, result normalization schema, relevance scoring heuristics, search refinement techniques (narrowing/broadening), combined search patterns |
| **JQL & CQL Syntax Reference** | `skills/atlassian-rest/references/query-languages.md` | CQL field reference (`type`, `space`, `text`, `label`, `title`), CQL operator syntax (`~`, `IN`), CQL example patterns (e.g., `type = page AND space = TEAM AND label = "runbook"`) |
| **SKILL.md** (main skill entry point) | `skills/atlassian-rest/SKILL.md` | Confluence script commands (`search`, `get-page`), workflow routing table, principle to "consult references/query-languages.md before writing CQL queries" |
