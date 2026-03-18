# Approach: Move DO-456 to Done and Add Deployment Comment

## Task Summary

Move Jira issue DO-456 to "Done" status and add a deployment comment: "Deployed to production v2.3.1 on 2026-03-18".

## Skill Used

`atlassian-rest` skill at `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`

## Step-by-Step Approach

### Step 1: Verify Setup

Ensure Atlassian credentials are configured and the domain points to `wnesolutions.atlassian.net`.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

### Step 2: Get Current Issue Details

Retrieve DO-456 to confirm it exists and check its current status before transitioning.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-456 --fields summary,status
```

**Purpose:** Confirm the issue exists and verify its current status (e.g., "In Progress", "In Review", etc.) to understand the transition path.

### Step 3: List Available Transitions

The skill explicitly states: "Always list transitions first to get the correct ID -- don't guess."

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs transitions DO-456
```

**Purpose:** Get the transition ID for "Done". The output will list all available transitions from the current status, each with an ID and name. We need the ID corresponding to "Done" (e.g., `31`, `41`, etc. -- the actual ID depends on the project's workflow configuration).

**Expected output format:**
```
Available transitions for DO-456:
  ID: 31  Name: Done
  ID: 21  Name: In Progress
  ...
```

### Step 4: Transition to Done

Using the transition ID retrieved in Step 3 (assuming the "Done" transition ID is `<DONE_TRANSITION_ID>`):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs transition DO-456 <DONE_TRANSITION_ID>
```

**Example** (if the Done transition ID is `31`):
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs transition DO-456 31
```

**Note:** The actual transition ID must come from Step 3's output. This is a mutating operation, so per the skill guidelines, we confirm with the user before executing.

### Step 5: Add Deployment Comment

Add the deployment comment to the issue:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs comment DO-456 "Deployed to production v2.3.1 on 2026-03-18"
```

### Step 6: Verify Final State

Confirm both the transition and comment were applied successfully:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-456 --fields summary,status
```

**Expected:** Status should now show "Done".

## Execution Order

1. `setup.mjs` -- verify credentials
2. `jira.mjs get DO-456 --fields summary,status` -- confirm issue exists and current status
3. `jira.mjs transitions DO-456` -- get available transition IDs (MUST do before transitioning)
4. **Confirm with user** -- show planned transition and comment before executing
5. `jira.mjs transition DO-456 <DONE_TRANSITION_ID>` -- move to Done
6. `jira.mjs comment DO-456 "Deployed to production v2.3.1 on 2026-03-18"` -- add comment
7. `jira.mjs get DO-456 --fields summary,status` -- verify final state

## Key Skill Principles Applied

- **Always list transitions first** (Step 3) -- never guess transition IDs
- **Confirm before mutating** (Step 4) -- transition is a state change, requires user confirmation
- **Compose operations naturally** -- this task requires multiple script calls (get, transitions, transition, comment)
- **Read operations don't need confirmation** -- Steps 2, 3, and 6 execute without asking
