# Execution Plan: Status Query (Without Skill Guidance)

**Eval:** eval-status-query (eval_id: 3)
**Prompt:** "What's the status of the implementation? How many stories are done?"
**Mode:** DRY RUN — no skill guidance

---

## Approach

Without the bmad-auto SKILL.md to guide behavior, I would approach this prompt as a general-purpose
AI assistant trying to answer the user's question about implementation status. Here is what I would
do and why.

### Step 1: Search for Status/Progress Tracking Files

I would search the project for files that might track implementation status:

- Look for files named `status`, `progress`, `sprint`, `backlog`, `board`, or `tracker`
- Look for YAML/JSON files that might contain story or task status
- Look for kanban-style or sprint-planning artifacts

**Specific searches:**
- `**/sprint-status*` — the conventional BMAD status file
- `**/*progress*` — general progress files
- `**/*backlog*` — backlog tracking
- `**/_bmad-output/**` — BMAD output artifacts directory

### Step 2: Read Any Found Status Files

If a status tracking file (e.g., `sprint-status.yaml`) is found, read it and parse the structure
to identify:
- How many epics exist and their statuses
- How many stories exist and their statuses (done, in-progress, backlog, etc.)
- Any blockers or issues noted

### Step 3: Supplement with Other Artifacts

If the status file is incomplete or missing, look for supplementary information:
- Read `epics.md` to understand the full scope of planned work
- Check `implementation-artifacts/` for story files that might indicate completion
- Look at git log for implementation-related commits

### Step 4: Summarize and Report

Compile the findings into a status summary:
- Total stories and how many are done / in-progress / remaining
- Which epic is currently active
- Any blockers or issues
- Overall percentage complete

---

## What I Would NOT Do (Without Skill Guidance)

Without the SKILL.md, I would lack knowledge of these specific behaviors:

1. **Would not know the exact file path** `_bmad-output/implementation-artifacts/sprint-status.yaml`
   — I would have to search for it by pattern matching rather than going directly to the known path.

2. **Might enter the main loop** — The skill explicitly says "Do NOT continue the main loop — just
   report and wait" for status queries. Without this guidance, if the user's phrasing were slightly
   different (e.g., "check status and continue"), I might try to start implementing.

3. **Would not invoke bmad-help** — If the sprint-status.yaml file is missing, the skill routes to
   the `bmad-help` skill. Without guidance, I would just report that no status file exists.

4. **Would not know the status vocabulary** — The skill defines specific status values (`backlog`,
   `ready-for-dev`, `in-progress`, `review`, `done`). Without this, I might misinterpret custom
   status values.

5. **Would not know to avoid spawning sub-agents** — The eval assertion explicitly checks that no
   sub-agents are spawned. Without skill guidance, there is no sub-agent architecture to invoke
   anyway, but the distinction matters for evaluation.

---

## Predicted Outcome Against Assertions

| Assertion | Without Skill | Notes |
|-----------|--------------|-------|
| Reads sprint-status.yaml for current state | LIKELY PARTIAL | Would search broadly rather than go to the known path directly. Would find it eventually via file search, but the path is not guaranteed. |
| Provides a summary of epic and story progress | LIKELY PASS | General-purpose summarization is a core LLM capability. |
| Does NOT enter the main loop or spawn any sub-agents | LIKELY PASS | Without skill guidance, there is no main loop or sub-agent architecture to invoke. Passes by default, not by design. |

**Expected Score: 2/3 assertions reliably met, 1 partially met**

The main risk is Step 1 — without knowing the exact path to `sprint-status.yaml`, the agent must
discover it through search. In a project where this file exists, it would likely be found. In a
project where it does not exist, the agent would not know to invoke `bmad-help` as a fallback.

---

## Key Differences: With vs Without Skill

| Dimension | Without Skill | With Skill |
|-----------|--------------|------------|
| File discovery | Search-based (broad) | Direct path (precise) |
| Missing file handling | Report "not found" | Invoke bmad-help |
| Scope control | May over-act | Explicitly scoped to report-only |
| Status vocabulary | Inferred from data | Known schema |
| Sub-agent risk | None (no architecture) | Explicitly prevented |
| Response format | Free-form | Structured summary |
