# Approach: List Confluence Spaces and Search for Onboarding Pages in HR Space

## Task

1. List all Confluence spaces the user has access to.
2. Search for pages about "onboarding" in the HR space.

## Approach Without Skill

Without the Atlassian REST skill, no helper scripts (e.g., `confluence.mjs`) or reference documentation (CQL syntax guides, API references) are available. The task must be completed by directly invoking the raw MCP Atlassian plugin tools and manually constructing any query syntax.

### Step 1: Discover the Cloud ID

Before any Confluence operation, the cloud ID is required as a mandatory parameter for every MCP tool call.

- **Tool:** `getAccessibleAtlassianResources`
- **Purpose:** Retrieve the list of Atlassian cloud instances the user has access to, extracting the `cloudId` (a UUID) and the site URL.
- **Why this is extra work:** The skill's scripts handle cloud ID resolution internally. Without the skill, this is an additional preliminary call that the agent must remember to make.

### Step 2: List All Confluence Spaces

- **Tool:** `getConfluenceSpaces`
- **Parameters:** `cloudId` (from Step 1), `limit: 250` (max per page)
- **Purpose:** Retrieve every Confluence space the user can access, showing id, key, name, and type.
- **Pagination concern:** If the instance has more than 250 spaces, the first call only returns the first page. The agent must manually detect the presence of a next page cursor in the response and issue additional calls with the `start` parameter to retrieve subsequent pages. There is no built-in "fetch all" behavior.

### Step 3: Identify the HR Space Key

- From the spaces list returned in Step 2, scan for a space whose name or key relates to "HR."
- If the HR space does not appear in the first 250 results (due to pagination), a targeted lookup is needed:
  - Call `getConfluenceSpaces` with `keys: ["HR"]` to check if a space with that exact key exists.
  - Alternatively, search for spaces with "HR" in the name using CQL: `space.title ~ "HR" AND type = space`.
- **Possible outcomes:**
  - A single HR space is found (e.g., key `HR`) -- proceed to Step 4 with that key.
  - Multiple HR-related spaces are found -- note all of them and search each.
  - No HR-related space exists -- inform the user and suggest a broader search.

### Step 4: Search for Onboarding Pages in the HR Space

- **Tool:** `searchConfluenceUsingCql`
- **Parameters:**
  - `cloudId` (from Step 1)
  - `cql`: `type = page AND space = "HR" AND text ~ "onboarding"`
  - `limit`: 25
- **CQL breakdown:**
  - `type = page` -- restrict results to pages only (excludes blog posts, comments, attachments)
  - `space = "HR"` -- target the HR space specifically (using the key confirmed in Step 3)
  - `text ~ "onboarding"` -- full-text search across page title and body content
- **Fallback queries if no results:**
  - Try title-only search: `type = page AND space = "HR" AND title ~ "onboarding"`
  - Try the broader Rovo search tool (`searchAtlassian`) with query `"onboarding"` as a less structured alternative
  - Remove the space filter to search across all spaces: `type = page AND text ~ "onboarding"`

### Step 5: Present Results

- Format the spaces list and search results for the user.
- Raw JSON responses from MCP tools require manual parsing to extract the meaningful fields (title, space key, URL, last modified date, etc.).

## Sequencing and Dependencies

The operations have a strict sequential dependency chain:

1. **Cloud ID discovery** (Step 1) must complete before anything else -- every subsequent tool call requires the `cloudId` parameter.
2. **Spaces listing** (Step 2) must complete before the search -- the agent needs to confirm the correct space key for the HR space. The user said "HR space" but the actual key could differ.
3. **CQL search** (Step 4) depends on the confirmed space key from Steps 2-3.

## Challenges Without Skill

1. **Manual cloud ID discovery** -- An extra preliminary tool call is required that the skill would handle automatically.
2. **No CQL syntax guidance** -- The agent must know Confluence Query Language syntax from training data. Without the skill's `references/query-languages.md`, there is no on-hand reference for correct field names, operators, or quoting rules. Mistakes in CQL syntax lead to API errors with unhelpful messages.
3. **Pagination is manual** -- The `getConfluenceSpaces` tool returns at most 250 results per call. For large instances, the agent must implement cursor-based pagination logic manually, issuing multiple calls and aggregating results.
4. **No structured output formatting** -- MCP tools return raw JSON. The agent must manually extract and format relevant fields (space key, name, page title, URL) into a readable presentation for the user.
5. **More tool calls required** -- What the skill accomplishes in two script invocations (`confluence.mjs spaces` then `confluence.mjs search`) requires at minimum three MCP tool calls (get resources, get spaces, search), and potentially more if pagination or fallback queries are needed.
6. **No confirmation workflow guidance** -- The skill provides clear rules about when to confirm with the user (writes) vs. proceed silently (reads). Without it, the agent must rely on general judgment.
