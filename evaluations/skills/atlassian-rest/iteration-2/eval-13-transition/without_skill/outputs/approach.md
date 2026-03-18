# Approach: Move DO-456 to Done and Add Deployment Comment

## Task

Move Jira issue DO-456 to the "Done" status and add a comment: "Deployed to production v2.3.1 on 2026-03-18".

Target: Project DO at https://wnesolutions.atlassian.net

## Approach Using Atlassian MCP Tools

Since no custom skill or helper scripts (e.g., jira.mjs) are available, the approach relies on the native Atlassian MCP plugin tools exposed in the environment.

### Step 1: Resolve the Cloud ID

Use `getAccessibleAtlassianResources` or pass the site URL `wnesolutions.atlassian.net` as the `cloudId` parameter (the MCP plugin accepts either a UUID or a site URL).

### Step 2: Get Available Transitions for DO-456

Call `getTransitionsForJiraIssue` to discover valid transitions from the issue's current status. This is critical -- transition IDs are workflow-specific and must not be guessed or hardcoded.

```
Tool: mcp__plugin_atlassian_atlassian__getTransitionsForJiraIssue
Parameters:
  cloudId: "wnesolutions.atlassian.net"
  issueIdOrKey: "DO-456"
```

From the response, locate the transition where the target status name is "Done" (or equivalent) and note its `id`.

### Step 3: Transition the Issue to Done

Using the transition ID discovered in Step 2, call `transitionJiraIssue`:

```
Tool: mcp__plugin_atlassian_atlassian__transitionJiraIssue
Parameters:
  cloudId: "wnesolutions.atlassian.net"
  issueIdOrKey: "DO-456"
  transition:
    id: "<transition_id_from_step_2>"
```

### Step 4: Add the Deployment Comment

Call `addCommentToJiraIssue` with the deployment message:

```
Tool: mcp__plugin_atlassian_atlassian__addCommentToJiraIssue
Parameters:
  cloudId: "wnesolutions.atlassian.net"
  issueIdOrKey: "DO-456"
  commentBody: "Deployed to production v2.3.1 on 2026-03-18"
  contentFormat: "markdown"
```

Using `contentFormat: "markdown"` allows passing a plain text string without needing to construct ADF JSON manually.

### Step 5: Verify (Optional)

Call `getJiraIssue` to confirm the issue status is now "Done" and the comment is present:

```
Tool: mcp__plugin_atlassian_atlassian__getJiraIssue
Parameters:
  cloudId: "wnesolutions.atlassian.net"
  issueIdOrKey: "DO-456"
  fields: ["status", "comment"]
```

## Key Considerations

| Consideration | Details |
|---|---|
| Transition ID discovery | Must query transitions first; IDs vary by workflow and project |
| Intermediate transitions | If no direct path to "Done" exists from the current status, intermediate transitions may be needed (e.g., "In Progress" -> "Done") |
| Cloud ID | The MCP plugin accepts the site URL as the cloudId parameter |
| Comment format | Using markdown contentFormat avoids the complexity of constructing Atlassian Document Format (ADF) JSON |
| Ordering | The transition and comment are independent operations; either can be done first, but transitioning first is conventional |

## What Cannot Be Done Without a Skill

- No automated script orchestration (jira.mjs) to chain these steps in a single command
- No pre-configured authentication or site URL defaults -- must specify cloudId on every call
- No shorthand commands; each MCP tool call requires full parameter specification
