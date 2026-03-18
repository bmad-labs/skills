# Approach: Move PROJ-456 to 'Done' and Add Comment

## 1. Exact Commands in Order

### Step 1 — List available transitions for PROJ-456

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs transitions PROJ-456
```

This returns a list of available transitions with their IDs, e.g.:

```
ID   Name
21   In Progress
31   Done
41   Reopened
```

### Step 2 — Transition PROJ-456 to 'Done'

Using the transition ID obtained from Step 1 (e.g., `31` if "Done" has ID 31):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs transition PROJ-456 <transition-id-for-Done>
```

### Step 3 — Add a comment to PROJ-456

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs comment PROJ-456 "Deployed to production in release v2.3.1"
```

## 2. Why List Transitions Before Executing

Transition IDs are **not universal** — they vary across Jira projects, workflows, and workflow schemes. The transition named "Done" might have ID 31 in one project and ID 71 in another. Even within the same project, different issue types can have different workflow configurations with different transition IDs.

The SKILL.md explicitly states under **Transitions (move ticket status)**:

> Always list transitions first to get the correct ID — don't guess.

Additionally, the Jira REST API endpoint `GET /issue/{issueKey}/transitions` only returns transitions that are **valid from the issue's current status**. For example, if PROJ-456 is currently "In Progress", the available transitions might include "Done" and "Blocked" but not "In Progress" (since it's already there). Listing transitions first ensures:

1. **Correctness** — We use the exact numeric ID that Jira expects, not a guessed value.
2. **Validity** — We confirm "Done" is actually reachable from the issue's current state. If it isn't (e.g., the workflow requires moving to "In Review" first), we can inform the user before attempting an operation that would fail.
3. **Error avoidance** — Passing an invalid transition ID results in a 400 error from Jira. Querying first prevents this.

## 3. Reference Files Consulted

| File | Why |
|------|-----|
| `SKILL.md` | Primary instruction file — contains the command syntax for `transitions`, `transition`, and `comment`, plus the rule to always list transitions before executing. |
| `references/jira-api.md` | Confirms the underlying REST API endpoints: `GET /issue/{issueKey}/transitions` to list and `POST /issue/{issueKey}/transitions` with `{transition: {id}}` to execute. Also confirms `POST /issue/{issueKey}/comment` for adding comments. |
