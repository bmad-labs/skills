# Approach: List Confluence Spaces and Search for Onboarding Pages in HR Space

## Task

Show all Confluence spaces the user has access to, then search for pages about "onboarding" in the HR space.

## Reference Files Consulted

1. **SKILL.md** (`skills/atlassian-rest/SKILL.md`) -- Primary instruction set. Identified the two relevant commands: `confluence.mjs spaces` for listing spaces, and `confluence.mjs search` for CQL-based page search. Also noted the principle: "Read reference docs when needed -- before writing CQL queries, consult `references/query-languages.md`."
2. **references/query-languages.md** -- CQL syntax reference. Used to construct the correct CQL query. Key fields: `space` for filtering by space key, `text ~ "term"` for full-text search, `type = page` for restricting to pages.
3. **references/confluence-api.md** -- Confluence REST API reference. Confirmed the underlying endpoints: `GET /wiki/api/v2/spaces` (V2) for listing spaces, `GET /wiki/rest/api/content/search?cql=...` (V1) for CQL search.
4. **scripts/confluence.mjs** -- Script source. Verified exact command syntax, flag names, and default behaviors (e.g., `--max` defaults to 25).

## Command Sequence

### Step 1: List all Confluence spaces

```bash
node <skill-path>/scripts/confluence.mjs spaces
```

- **Purpose:** Show the user every Confluence space they have access to (id, key, name, type).
- **API endpoint:** `GET /wiki/api/v2/spaces?limit=25`
- **No flags needed** unless the user has many spaces; could add `--max 50` or higher to see more.
- **This is a read operation** -- no confirmation needed per SKILL.md guidelines.

### Step 2: Search for onboarding pages in the HR space

```bash
node <skill-path>/scripts/confluence.mjs search 'type = page AND space = HR AND text ~ "onboarding"' --max 10
```

- **Purpose:** Find all pages in the HR space that contain the word "onboarding."
- **API endpoint:** `GET /wiki/rest/api/content/search?cql=type+%3D+page+AND+space+%3D+HR+AND+text+~+%22onboarding%22&limit=10`
- **CQL breakdown:**
  - `type = page` -- restrict to pages (exclude blog posts, comments, attachments)
  - `space = HR` -- target the HR space specifically (assumes the space key is "HR"; this would be confirmed from Step 1 output)
  - `text ~ "onboarding"` -- full-text search for "onboarding" in page content and title
- **This is a read operation** -- no confirmation needed.

## Sequencing and Dependencies

These two commands have a **sequential dependency**:

1. **Step 1 must run first** because we need to confirm the exact space key for the HR space. The user said "HR space," but the actual Confluence space key could be `HR`, `HUMAN`, `HUMANRES`, or something else entirely. The `spaces` command output provides the `key` field for every space, so we can identify the correct one.

2. **Step 2 depends on Step 1's output.** After reviewing the spaces list:
   - If a space with key `HR` exists, proceed with `space = HR` in the CQL query.
   - If the HR-related space has a different key (e.g., `PEOPLE`, `HRD`), substitute the correct key in the CQL query.
   - If no HR-related space exists, inform the user and suggest alternative searches (e.g., a broader `text ~ "onboarding"` search across all spaces).

3. **No mutations involved.** Both operations are read-only, so no user confirmation is required before execution per the SKILL.md principle: "Read operations (search, get, list) don't need confirmation."

## Potential Adjustments

- If the spaces list is truncated (more than 25 spaces), re-run with `--max 100` to ensure the HR space is visible.
- If the initial search returns no results, broaden by searching `title ~ "onboarding"` instead of `text ~`, or drop the space filter to search across all spaces.
- If multiple HR-related spaces exist, present them to the user and ask which one to search.
