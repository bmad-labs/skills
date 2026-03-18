# Approach: Create Epic with 3 Child Stories and Assign Story #1

## Overview

Create an Epic titled "Q2 Performance Initiative" in the DO project, then create 3 child stories under it, and assign the first story to john.doe.

The SKILL.md provides all necessary commands via `jira.mjs` for this multi-step operation.

---

## Step 1: Verify Setup

Run the setup check to confirm credentials are configured and the Atlassian domain `wnesolutions.atlassian.net` is accessible.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

## Step 2: Verify Project and Issue Types

Confirm the DO project exists and that Epic and Story issue types are available.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs projects
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types DO
```

This tells us the exact issue type names to use (e.g., "Epic" vs "epic", "Story" vs "story").

## Step 3: Look Up john.doe's Account ID

The `--assignee` flag requires an Atlassian account ID, not a display name. Use `lookup-user` to resolve it.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "john.doe"
```

This returns the account ID (e.g., `5f1234567890abcdef123456`) needed for assignment in Step 5.

## Step 4: Create the Epic

Create the parent Epic in the DO project.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Epic \
  --summary "Q2 Performance Initiative" \
  --description "Epic tracking all Q2 performance improvement initiatives including database optimization, caching strategy, and API response time improvements."
```

**Expected output:** The newly created Epic key, e.g., `DO-101`. Record this key for use as the `--parent` in subsequent story creation.

## Step 5: Create Story #1 (Assigned to john.doe)

Create the first child story under the Epic and assign it to john.doe using the account ID from Step 3.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Story \
  --summary "Optimize database query performance" \
  --description "Identify and optimize the top 10 slowest database queries. Profile current performance, add missing indexes, and refactor N+1 queries." \
  --parent DO-101 \
  --assignee <accountId-from-step-3>
```

Replace `DO-101` with the actual Epic key from Step 4, and `<accountId-from-step-3>` with the resolved account ID.

## Step 6: Create Story #2

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Story \
  --summary "Implement caching layer for API responses" \
  --description "Design and implement a Redis-based caching strategy for frequently accessed API endpoints. Define cache invalidation policies and TTL settings." \
  --parent DO-101
```

Replace `DO-101` with the actual Epic key from Step 4.

## Step 7: Create Story #3

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Story \
  --summary "Reduce API response time to under 200ms" \
  --description "Benchmark current API response times, identify bottlenecks, and implement optimizations to bring p95 response time under 200ms." \
  --parent DO-101
```

Replace `DO-101` with the actual Epic key from Step 4.

## Step 8: Verify the Epic and Stories

Confirm everything was created correctly by searching for all issues under the Epic.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search \
  'project = DO AND "Epic Link" = DO-101 ORDER BY created ASC'
```

Also verify Story #1's assignment:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get <story-1-key> --fields summary,status,assignee
```

---

## Summary of Commands (in order)

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `setup.mjs` | Verify credentials |
| 2 | `jira.mjs projects` | Confirm DO project exists |
| 2 | `jira.mjs issue-types DO` | Confirm Epic/Story types |
| 3 | `jira.mjs lookup-user "john.doe"` | Get account ID for assignment |
| 4 | `jira.mjs create --project DO --type Epic --summary "Q2 Performance Initiative" ...` | Create the Epic |
| 5 | `jira.mjs create --project DO --type Story --summary "Optimize database query performance" --parent <epic-key> --assignee <accountId>` | Create Story #1 + assign |
| 6 | `jira.mjs create --project DO --type Story --summary "Implement caching layer for API responses" --parent <epic-key>` | Create Story #2 |
| 7 | `jira.mjs create --project DO --type Story --summary "Reduce API response time to under 200ms" --parent <epic-key>` | Create Story #3 |
| 8 | `jira.mjs search 'project = DO AND "Epic Link" = <epic-key>'` | Verify all stories linked |

## Key Skill Principles Applied

- **Resolve ambiguity first** (Step 2): Verified project and issue types before creating anything.
- **Compose operations naturally** (Steps 3-5): Used `lookup-user` to resolve account ID before assigning, as documented in the skill.
- **Confirm before mutating** (Steps 4-7): Each create command should be confirmed with the user before execution.
- **Use `--parent` for hierarchy**: The `jira.mjs create` command supports `--parent` to link stories to an Epic, as shown in the SKILL.md example.
