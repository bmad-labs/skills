# Approach: Spec-to-Backlog Without Atlassian Skill

## Task Summary

Read a Confluence spec (page ID 98765) for a notification system, then create a full backlog in the MOBILE Jira project consisting of an Epic with child Stories and Tasks.

## Required Atlassian Operations

### Step 1: Read the Confluence Spec

- **Tool needed:** `mcp__plugin_atlassian_atlassian__getConfluencePage`
- **Parameters:** page ID `98765`
- **Purpose:** Retrieve the full specification content to understand scope, requirements, and acceptance criteria for the notification system.

### Step 2: Discover Project Metadata

- **Tool needed:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- **Parameters:** project key `MOBILE`
- **Purpose:** Determine available issue types (Epic, Story, Task, Sub-task) and their IDs in the MOBILE project.

- **Tool needed:** `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields`
- **Parameters:** project key `MOBILE`, each relevant issue type ID
- **Purpose:** Discover required and optional fields for creating each issue type (e.g., custom fields for Epic Name, Story Points, etc.).

### Step 3: Create the Epic

- **Tool needed:** `mcp__plugin_atlassian_atlassian__createJiraIssue`
- **Parameters:** project `MOBILE`, issue type `Epic`, summary derived from spec title, description summarizing the full scope, plus any required Epic-specific fields (e.g., Epic Name).
- **Output:** Epic key (e.g., `MOBILE-XXX`).

### Step 4: Create Child Stories

For each functional area identified in the spec, create a Story:

- **Tool needed:** `mcp__plugin_atlassian_atlassian__createJiraIssue` (called N times)
- **Parameters:** project `MOBILE`, issue type `Story`, summary, description with acceptance criteria, parent or Epic Link set to the Epic key from Step 3.
- **Output:** Story keys for each created issue.

### Step 5: Create Child Tasks

For each technical/implementation task identified in the spec, create a Task:

- **Tool needed:** `mcp__plugin_atlassian_atlassian__createJiraIssue` (called M times)
- **Parameters:** project `MOBILE`, issue type `Task`, summary, description, parent or Epic Link set to the Epic key from Step 3.
- **Output:** Task keys for each created issue.

### Step 6 (Optional): Link Issues

- **Tool needed:** `mcp__plugin_atlassian_atlassian__createIssueLink`
- **Purpose:** Create any dependency links between stories/tasks (e.g., "is blocked by", "relates to").

## Challenges Without the Skill

1. **No structured workflow:** Without the Atlassian REST skill, there is no guided process for decomposing a spec into a well-structured backlog. The agent must manually reason about how to break down the spec into Epics, Stories, and Tasks.

2. **No field discovery automation:** The agent must manually call metadata endpoints to figure out which fields are required, what the Epic Link custom field ID is, and how parent-child relationships are modeled in this specific Jira instance.

3. **No templates or conventions:** There are no predefined templates for Story/Task descriptions, acceptance criteria formatting, or consistent naming conventions. Each issue's content is ad-hoc.

4. **No validation or review step:** There is no built-in mechanism to review the proposed backlog structure before creating issues, meaning mistakes require manual cleanup in Jira.

5. **Sequential tool calls:** Each Jira issue must be created one at a time via individual MCP tool calls. For a typical spec that might produce 1 Epic + 5-10 Stories + 5-10 Tasks, this means 11-21 sequential API calls with no batching.

6. **No spec parsing heuristics:** The agent has no guidance on how to identify story boundaries, acceptance criteria, or task decomposition from a free-form Confluence page. This is entirely dependent on the agent's general reasoning.

## Estimated Tool Calls

| Operation                  | Calls |
|----------------------------|-------|
| Read Confluence page       | 1     |
| Get project metadata       | 1-2   |
| Get issue type field meta  | 2-3   |
| Create Epic                | 1     |
| Create Stories             | 5-10  |
| Create Tasks               | 5-10  |
| Create issue links         | 0-5   |
| **Total**                  | **15-32** |

## Conclusion

Without a dedicated skill, the task is achievable but requires the agent to manually orchestrate many sequential API calls, reason about Jira data model specifics (custom fields, parent linking), and independently decompose the spec into a coherent backlog structure. The quality of the output depends entirely on the agent's general capability rather than any domain-specific guidance.
