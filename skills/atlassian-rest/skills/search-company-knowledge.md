# Search Company Knowledge

Workflow for searching across Jira and Confluence to find and synthesize information.

**Reference files:** `references/search-patterns.md`, `references/query-languages.md`

---

## Step 1: Understand Query

Parse the user's question to identify:

- **Key search terms** — the core concepts or keywords
- **Jira relevance** — whether issues, comments, or specific fields might hold the answer
- **Confluence relevance** — whether pages, blog posts, or documentation are likely sources
- **Scope narrowing** — any mentioned project keys, space keys, date ranges, or authors

Formulate appropriate search queries for both platforms.

## Step 2: Parallel Search

Run searches across both Confluence and Jira simultaneously.

**Confluence search:**

```bash
node <skill-path>/scripts/confluence.mjs search 'text ~ "search terms" AND type = page' --max 10
```

**Jira issue search:**

```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "search terms"' --max 10
```

If the user specified a project or space, narrow the queries:

```bash
node <skill-path>/scripts/confluence.mjs search 'text ~ "query" AND space = "SPACE"' --max 10
node <skill-path>/scripts/jira.mjs search 'text ~ "query" AND project = PROJ' --max 10
```

Consult `references/search-patterns.md` for advanced query techniques and `references/query-languages.md` for CQL/JQL syntax.

## Step 3: Fetch Details

For the most relevant results (top 3-5), fetch full content to read and analyze.

**Confluence pages:**

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId>
```

**Jira issues:**

```bash
node <skill-path>/scripts/jira.mjs get <issueKey>
```

Read through the full content of each result to extract relevant information.

## Step 4: Synthesize

Combine findings into a coherent answer:

- Summarize the key information discovered
- Cite sources with page titles, issue keys, and links
- Note any conflicting information found across sources
- Highlight the most authoritative or recent source

Format the response clearly with citations, for example:

> The deployment process is documented in "Release Runbook" (Confluence, DEVOPS space).
> Related issues: DEVOPS-456 tracks the automation effort.

## Step 5: Follow-up

Offer the user options to continue:

- Search with refined or different terms
- Search in specific spaces or projects not yet covered
- Fetch additional pages or issues for deeper reading
- Create a Confluence page summarizing the findings
