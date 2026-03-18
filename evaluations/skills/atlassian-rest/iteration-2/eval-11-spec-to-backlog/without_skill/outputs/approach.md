# Approach: Spec-to-Backlog Without Atlassian Skill

## Task Summary

Read a Confluence spec (page ID 98765) and create a full backlog in the DO Jira project at wnesolutions.atlassian.net, consisting of an Epic with child Stories and Tasks.

## Required Atlassian Operations

### Step 1: Read the Confluence Spec

- **Tool:** `mcp__plugin_atlassian_atlassian__getConfluencePage`
- **Parameters:** `cloudId: "wnesolutions.atlassian.net"`, `pageId: "98765"`, `contentFormat: "markdown"`
- **Purpose:** Retrieve the full specification content to understand scope, requirements, and acceptance criteria. Using markdown format for easier parsing and comprehension.

### Step 2: Discover Project Issue Types

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- **Parameters:** `cloudId: "wnesolutions.atlassian.net"`, `projectIdOrKey: "DO"`
- **Purpose:** Determine which issue types are available in the DO project (Epic, Story, Task, Sub-task, Bug, etc.) and confirm their exact names before attempting to create issues.

### Step 3: Analyze the Spec and Plan Breakdown

Without a dedicated skill, the agent must manually:

- Read through the entire spec content returned in Step 1.
- Identify major feature areas that define the Epic scope.
- Break features into discrete Stories (user-facing functionality) and Tasks (technical/infrastructure work).
- Define acceptance criteria for each ticket from the spec requirements.
- Determine dependency ordering between tickets.
- Estimate rough sizing if story points are relevant.

There is no template, breakdown guide, or ticket-writing reference to follow. The agent relies entirely on general reasoning to produce a coherent backlog structure.

### Step 4: Present Plan to User

Before creating any issues, the agent should present the proposed breakdown to the user for review. However, without a skill enforcing this step, the agent may skip confirmation and proceed directly to creation. This is a significant risk -- mistakes would require manual cleanup in Jira.

A proper plan presentation would look like:

| # | Type  | Summary                          | Dependencies |
|---|-------|----------------------------------|--------------|
| - | Epic  | [Epic title from spec]           | -            |
| 1 | Story | [First story]                    | -            |
| 2 | Task  | [First task]                     | 1            |
| ...| ...  | ...                              | ...          |

### Step 5: Create the Epic

- **Tool:** `mcp__plugin_atlassian_atlassian__createJiraIssue`
- **Parameters:**
  - `cloudId: "wnesolutions.atlassian.net"`
  - `projectKey: "DO"`
  - `issueTypeName: "Epic"`
  - `summary: "[Epic title derived from spec]"`
  - `description: "[Epic description summarizing scope, goals, success criteria]"`
  - `contentFormat: "markdown"`
- **Output:** The returned issue key (e.g., `DO-100`) is captured for use as the parent of all child tickets.

### Step 6: Create Child Stories and Tasks

For each child ticket identified in the breakdown, call `createJiraIssue` individually:

- **Tool:** `mcp__plugin_atlassian_atlassian__createJiraIssue` (called N times)
- **Parameters for each:**
  - `cloudId: "wnesolutions.atlassian.net"`
  - `projectKey: "DO"`
  - `issueTypeName: "Story"` or `"Task"`
  - `summary: "[Ticket summary]"`
  - `description: "[Context, requirements, acceptance criteria]"`
  - `parent: "DO-100"` (the Epic key from Step 5)
  - `contentFormat: "markdown"`

Each child ticket uses the `parent` field to establish the Epic-child relationship.

### Step 7 (Optional): Link Related Issues

- **Tool:** `mcp__plugin_atlassian_atlassian__createIssueLink`
- **Purpose:** Create dependency links between tickets (e.g., "is blocked by") if the spec implies ordering constraints.

## Challenges Without the Skill

1. **No structured workflow or sub-skill:** There is no guided multi-step process (like a spec-to-backlog sub-skill) to orchestrate the decomposition. The agent must invent its own workflow from scratch.

2. **No reference templates:** Without access to files like `epic-templates.md`, `ticket-writing-guide.md`, or `breakdown-examples.md`, the agent has no conventions for Epic description structure (Goal, Scope, Out of Scope, Success Criteria, Dependencies, Risks), ticket summary format (Verb + Object + Context), or sizing guidance (1-8 points per story).

3. **No spec parsing heuristics:** The agent has no guidance on how to identify story boundaries, vertical slicing principles, spike-first patterns for unknowns, or when to split oversized stories. Quality depends entirely on general reasoning.

4. **No confirmation enforcement:** Without the skill mandating a "present plan before creating" step, the agent may skip user review entirely and create tickets that need manual correction.

5. **No field discovery automation:** The agent must manually determine which fields are required, how parent-child relationships work in this Jira instance, and whether custom fields (like Epic Name) are needed.

6. **Sequential API calls with no batching:** Each Jira issue requires an individual MCP tool call. A typical breakdown of 1 Epic + 8-12 children means 9-13 sequential creation calls.

## Estimated Tool Calls

| Operation                  | Calls |
|----------------------------|-------|
| Read Confluence page       | 1     |
| Get project issue types    | 1     |
| Create Epic                | 1     |
| Create child Stories/Tasks | 5-12  |
| Create issue links         | 0-5   |
| **Total**                  | **8-20** |

## Conclusion

Without a dedicated skill, the task is achievable but lacks structure and guardrails. The agent must manually orchestrate the entire workflow: fetching the spec, reasoning about decomposition without templates or examples, and creating issues one at a time. There is no enforced confirmation step, no ticket-writing conventions, and no reference materials for Epic structure or breakdown patterns. The quality of the resulting backlog depends entirely on the agent's general capability rather than domain-specific guidance.
