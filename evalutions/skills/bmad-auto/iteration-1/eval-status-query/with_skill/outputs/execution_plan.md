# Execution Plan: Status Query via bmad-auto Skill

## Task

User asks: "What's the status of the implementation? How many stories are done?"

## Skill Identification

The SKILL.md explicitly handles this scenario under the **"Status Query"** section (lines 207-211). The skill description also lists status queries as a primary trigger: "check implementation progress or status ('what's the status?', 'how many stories are done?', 'how's phase 4 going?', 'any blockers?')".

## Execution Steps (Dry Run)

### Step 1: Read sprint-status.yaml

Per the Status Query section, the first action is to read the sprint status file at:

```
_bmad-output/implementation-artifacts/sprint-status.yaml
```

**Two possible outcomes:**

- **File does NOT exist:** Per the Startup Sequence (step 1), this means the project is not yet in Phase 4. The skill instructs to invoke `skill: "bmad-help"` to suggest next actions, report to the user, and stop. The status answer would be: "Implementation has not started yet -- no sprint-status.yaml found. The project is not in Phase 4."

- **File exists:** Proceed to Step 2.

### Step 2: Summarize Status from sprint-status.yaml

Parse the YAML file and extract:

1. **Overall progress:** Count total stories vs. stories with status `done`.
2. **Current epic:** Identify which epic has status `in-progress` (or the first `backlog` epic if none is in progress).
3. **Per-story breakdown:** For each epic, list stories and their statuses (`backlog`, `ready-for-dev`, `in-progress`, `review`, `done`).
4. **Blockers/issues:** Check for any noted blockers or error states in the status file.

### Step 3: Report to User

Format and present:
- "X of Y stories are done."
- Which epic is currently in progress.
- Which stories are done, in-progress, or remaining.
- Any known blockers or issues.

### Step 4: Stop

Per the Status Query section: **"Do NOT continue the main loop -- just report and wait."** This is critical. A status query does NOT trigger any implementation work, team creation, or sub-agent spawning.

## What This Skill Does NOT Do for a Status Query

- Does NOT create a team (`TeamCreate`)
- Does NOT spawn any sub-agents
- Does NOT invoke any other BMAD slash commands (unless the file is missing, in which case `bmad-help` is invoked)
- Does NOT start or resume any implementation work
- Does NOT modify any files

## Key Difference from Non-Skill Execution

Without this skill, an agent would need to:
1. Know where `sprint-status.yaml` lives (the skill provides the exact path)
2. Know how to interpret the YAML structure (the skill defines the status values: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`)
3. Know not to accidentally trigger implementation work when only status is requested (the skill explicitly says "Do NOT continue the main loop")
4. Know to fall back to `bmad-help` if the project isn't in Phase 4 yet

The skill provides a clear, bounded protocol for answering status queries without side effects.

## Summary

This is a **read-only, report-only** operation. The entire execution is: read one file, summarize its contents, report to user, stop. The skill's value here is providing the exact file path, the interpretation rules for status values, and the guard rail against accidentally triggering the main implementation loop.
