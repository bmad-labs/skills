# Approach: Search Confluence for Deployment Runbook

## Task Understanding

The user wants to search Confluence specifically for a "deployment runbook." This is a read-only search operation — no confirmation needed. The target Atlassian instance is `wnesolutions.atlassian.net` and the related Jira project is DO.

## Workflow Selection

This task maps to the **Search Company Knowledge** workflow (`workflows/search-company-knowledge.md`). Since the user specifically asked about Confluence, the primary search targets Confluence pages, with an optional secondary Jira search for related issues.

## Reference Documents Consulted

- `references/query-languages.md` — for CQL syntax (Confluence Query Language)
- `references/search-patterns.md` — for search strategy patterns and refinement techniques

## Step-by-Step Approach

### Step 1: Parse the Query

- **Key search terms:** "deployment", "runbook"
- **Confluence relevance:** High — runbooks are documentation, typically stored as Confluence pages
- **Jira relevance:** Low — but worth a secondary search for linked issues
- **Scope narrowing:** No specific space mentioned; search broadly first, then narrow if needed

### Step 2: Primary Confluence Search — Title Match

Search for pages with "runbook" in the title, combined with "deployment" in the text. Title matches are highest relevance.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND title ~ "deployment runbook"' --max 10
```

### Step 3: Broader Confluence Search — Text Match

If Step 2 returns few or no results, broaden to full-text search for pages containing both terms anywhere in the content.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND text ~ "deployment runbook"' --max 10
```

### Step 4: Even Broader Search — Individual Terms

If still insufficient results, search for each term separately to catch pages titled "Runbook" that discuss deployment, or deployment docs that serve as runbooks.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND title ~ "runbook"' --max 10
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND text ~ "deployment" AND label = "runbook"' --max 10
```

### Step 5: Fetch Full Content of Top Results

For the top 3-5 most relevant results from the searches above, retrieve full page content to confirm relevance and extract key information.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <pageId>
```

(Replace `<pageId>` with the actual page ID from search results.)

### Step 6: Optional Secondary Jira Search

Search Jira in the DO project for any issues referencing the deployment runbook, which may provide additional context or link to the Confluence page.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND text ~ "deployment runbook"' --max 5
```

### Step 7: Synthesize and Present Results

Combine findings into a clear response:
- List each matching Confluence page with title, space, page ID, and direct URL
- Summarize the content of the most relevant page(s)
- Cite sources with links (e.g., `https://wnesolutions.atlassian.net/wiki/...`)
- If Jira issues reference the runbook, include those links as well
- Offer follow-up options: refine search, fetch more pages, or search in a specific space

## Key Design Decisions

1. **Confluence-first approach** — The user explicitly asked about Confluence, so that is the primary search target. Jira is secondary.
2. **Progressive broadening** — Start with a tight title match (`title ~ "deployment runbook"`), then broaden to text search, then individual terms. This avoids overwhelming results while ensuring we find the page.
3. **No confirmation needed** — All operations are read-only searches, per the skill's principle: "Read operations (search, get, list) don't need confirmation."
4. **CQL syntax** — Uses `type = page` to filter out comments, attachments, and blog posts. Uses `~` operator for text contains matching per the query-languages reference.

## Expected Execution Flow

```
[Search: title ~ "deployment runbook"]
    |
    v
  Results found? --YES--> [Fetch top pages] --> [Present results]
    |
    NO
    v
[Search: text ~ "deployment runbook"]
    |
    v
  Results found? --YES--> [Fetch top pages] --> [Present results]
    |
    NO
    v
[Search: title ~ "runbook"]
    |
    v
[Fetch top pages] --> [Present results + suggest refinements]
```
