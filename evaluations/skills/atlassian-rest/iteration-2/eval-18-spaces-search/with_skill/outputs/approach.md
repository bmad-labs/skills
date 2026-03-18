# Approach: List Confluence Spaces and Search for Onboarding Pages in HR Space

## Task

List all Confluence spaces the user has access to, then search for pages about "onboarding" within the HR space.

## Reference Files Consulted

1. **SKILL.md** (`skills/atlassian-rest/SKILL.md`) -- Identified the relevant Confluence commands: `confluence.mjs spaces` for listing spaces (under "Spaces & Navigation") and `confluence.mjs search` for CQL-based page search (under "Search Pages"). Also noted the principle to consult `references/query-languages.md` before writing CQL queries, and that read operations do not require user confirmation.
2. **references/query-languages.md** -- CQL syntax reference. Key operators: `space = KEY` for filtering by space key, `text ~ "term"` for full-text search across page content and titles, `type = page` for restricting results to pages only.
3. **references/confluence-api.md** -- Confluence REST API reference. Confirms the underlying endpoints: `GET /wiki/api/v2/spaces` (V2) for listing spaces, `GET /wiki/rest/api/content/search?cql=...` (V1) for CQL-based search.

## Command Sequence

### Step 1: List all Confluence spaces

```bash
node <skill-path>/scripts/confluence.mjs spaces --max 50
```

- **Purpose:** Retrieve all Confluence spaces the user can access, displaying each space's id, key, name, and type.
- **API endpoint:** `GET /wiki/api/v2/spaces?limit=50`
- **Flags:** `--max 50` to ensure we capture organizations with many spaces. The default limit is 25, which may truncate results for larger instances.
- **Read operation** -- no user confirmation required per SKILL.md guidelines.
- **Expected output:** A list of spaces including their keys. We need to identify the HR space's exact key (could be `HR`, `PEOPLE`, `HRD`, `HUMANRESOURCES`, etc.).

### Step 2: Search for onboarding pages in the HR space

```bash
node <skill-path>/scripts/confluence.mjs search 'type = page AND space = HR AND text ~ "onboarding"' --max 10
```

- **Purpose:** Find all pages within the HR space that mention "onboarding" in their content or title.
- **API endpoint:** `GET /wiki/rest/api/content/search?cql=type+%3D+page+AND+space+%3D+HR+AND+text+~+%22onboarding%22&limit=10`
- **CQL breakdown:**
  - `type = page` -- restricts results to pages only, excluding blog posts, comments, and attachments
  - `space = HR` -- targets the HR space specifically (the key will be confirmed from Step 1 output; `HR` is used as a placeholder)
  - `text ~ "onboarding"` -- performs full-text search for "onboarding" across both page titles and body content
- **Flags:** `--max 10` to return up to 10 matching pages; increase if more results are expected.
- **Read operation** -- no user confirmation required.

## Sequencing and Dependencies

1. **Step 1 must execute first.** The user refers to "HR space" but the actual Confluence space key is unknown until we list all spaces. The key could be `HR`, `PEOPLE`, `HRD`, or any other identifier the organization chose.

2. **Step 2 depends on Step 1 output.** After reviewing the spaces list:
   - If a space with key `HR` exists, proceed with `space = HR` in the CQL query as written.
   - If the HR-related space has a different key (e.g., `PEOPLE`, `HRD`), substitute the correct key into the CQL query: `space = PEOPLE AND text ~ "onboarding"`.
   - If no HR-related space is found, inform the user and suggest a broader search across all spaces: `type = page AND text ~ "onboarding"`.
   - If multiple spaces appear HR-related (e.g., `HR` and `HR-GLOBAL`), present them to the user and ask which to search, or search both.

3. **Both operations are read-only.** No mutations are performed, so no user confirmation is needed before execution. Per SKILL.md: "Read operations (search, get, list) don't need confirmation."

## Potential Adjustments

- **Truncated spaces list:** If the organization has more than 50 spaces, re-run with `--max 100` or higher to ensure the HR space appears.
- **No search results:** If the CQL search returns empty results, try broadening:
  - Search by title only: `type = page AND space = HR AND title ~ "onboarding"`
  - Remove the space filter to search globally: `type = page AND text ~ "onboarding"`
  - Use a broader term: `text ~ "onboard*"` to catch variations like "onboarded" or "onboarding"
- **Too many results:** Add additional CQL filters such as `lastModified > "2025-01-01"` to narrow to recent pages, or refine with `title ~ "onboarding"` instead of `text ~` to match only page titles.
- **Permission restrictions:** If the search returns a 403 error for the HR space, the user may lack permission. Suggest they request access from their Confluence admin.
