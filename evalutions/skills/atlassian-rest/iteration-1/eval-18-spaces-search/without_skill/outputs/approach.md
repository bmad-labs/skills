# Approach: List Confluence Spaces and Search for Onboarding Pages in HR Space

## Task
1. Show all Confluence spaces the user has access to.
2. Search for any pages about "onboarding" in the HR space.

## Approach Without Skill

Without the Atlassian REST skill, the task was completed by directly invoking the
raw MCP Atlassian plugin tools. This required:

### Step 1: Discover the Cloud ID
- Called `getAccessibleAtlassianResources` to find the Atlassian cloud instance.
- Result: Cloud ID `983cd706-e88f-407a-88c0-75f957a662d7` (site: oneline.atlassian.net).

### Step 2: List All Confluence Spaces
- Called `getConfluenceSpaces` with `limit=250`.
- The API returned 250 spaces (the maximum per page) with a pagination cursor indicating more exist.
- A second lookup was needed to find the HR space specifically, since it was not in the first 250 results.
- Used `getConfluenceSpaces` with `keys=["HR"]` to confirm the space exists.

### Step 3: Identify HR-Related Spaces
- Searched for spaces with "HR" in the title using CQL: `space.title ~ "HR" AND type = space`.
- Found 2 HR-related spaces:
  - **HR** (key: `HR`) - "HR Strategy & Planning Team"
  - **HMB** (key: `HMB`) - "HR Metrics & BAMbi"

### Step 4: Search for Onboarding Pages in HR Spaces
- Searched by title: `title ~ "onboarding" AND type = page AND space = "HR"` -- 0 results.
- Searched by content: `text ~ "onboarding" AND type = page AND space = "HR"` -- 0 results.
- Also searched the second HR space (HMB) -- 0 results.

### Step 5: Broader Onboarding Search (for context)
- Searched across all spaces: `title ~ "onboarding" AND type = page` -- 50 results found across
  various non-HR spaces (OPUS Modernization, eCommerce, DevSecOps, etc.).

## Challenges Without Skill
1. **Manual cloud ID discovery** -- Had to call an extra tool to find the cloud ID before any other operation.
2. **Pagination handling** -- The spaces endpoint returned 250 results with more pages available. Without the skill, the agent must manually handle cursor-based pagination to get a complete list.
3. **No guidance on CQL syntax** -- Had to know Confluence Query Language (CQL) syntax to construct proper search queries. The skill would provide guidance or abstract this away.
4. **Multiple tool calls required** -- Finding the HR space required separate calls since it was not in the first page of results. With a skill, this could be streamlined.
5. **No structured output formatting** -- Raw JSON responses required manual parsing to extract meaningful information.

## Key Findings
- The user has access to 250+ Confluence spaces on oneline.atlassian.net.
- Two HR-related spaces exist: "HR Strategy & Planning Team" (HR) and "HR Metrics & BAMbi" (HMB).
- **Neither HR space contains any pages about "onboarding"** (by title or content).
- There are 50+ onboarding-related pages across other spaces (primarily in OPUS Modernization Journey, DevSecOps Governance, Zokyo, New eCommerce, etc.).
