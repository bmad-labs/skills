# Approach: Spec to Backlog -- Confluence Page 98765 to DO Project

## 1. Workflow Loaded

The **Spec to Backlog** workflow was loaded from `workflows/spec-to-backlog.md`. This is a 7-step process: Get Spec, Analyze Spec, Create Breakdown, Present Plan, Create Epic, Create Child Tickets, Report. Three reference files were also consulted (see section 9).

---

## 2. Exact Command to Fetch Confluence Spec

Per Step 1 of the workflow, fetch the spec content using the Confluence page ID provided by the user:

```bash
node <skill-path>/scripts/confluence.mjs get-page 98765
```

This retrieves the full page content in storage format so we can analyze the specification. No `--format` flag is needed since the default storage format gives us the structured content. The domain is `wnesolutions.atlassian.net` (configured via `ATLASSIAN_DOMAIN` env var).

---

## 3. Command to Check Available Issue Types in DO Project

Before creating any issues, verify which issue types are available in the DO project (as instructed by SKILL.md principle #1 -- "Resolve ambiguity first"):

```bash
node <skill-path>/scripts/jira.mjs issue-types DO
```

This confirms that Epic, Story, Task, and Bug (or project-specific types) are valid issue types in the DO project. If the project uses different names (e.g., "Feature" instead of "Epic"), we would adapt accordingly.

---

## 4. How to Analyze and Break Down the Spec

Per Step 2 of the workflow, read the spec content thoroughly and identify:

- **Major features or sections** -- these map to the Epic scope. If the spec covers multiple major areas, each could be an Epic or grouped under one Epic with stories per area.
- **Implementation tasks** -- discrete units of work that become Stories or Tasks. Following `breakdown-examples.md`, each should be 1-3 days of work (no more than 8 story points).
- **Technical requirements** -- infrastructure, API, or architecture work (e.g., service setup, database schemas, integrations).
- **Acceptance criteria** -- testable conditions extracted from requirements, using Given/When/Then or checklist format per `epic-templates.md`.
- **Dependencies** -- ordering constraints (e.g., data model must exist before API endpoints, API must exist before UI).

Following the **Breakdown Principles** from `breakdown-examples.md`:
- Prefer vertical slices over horizontal layers
- Each story should be independently deployable when possible
- Add a spike story when unknowns exceed 30% of effort
- No story exceeds 8 points; split larger items
- Minimize dependencies; sequence dependent stories in the same sprint

---

## 5. Epic Description Format

Per `references/epic-templates.md`, the Epic description follows this structure:

```
## Goal
{One-sentence business outcome derived from the Confluence spec.}

## Scope
- {Capability 1 extracted from spec}
- {Capability 2 extracted from spec}
- {Capability 3 extracted from spec}

## Out of Scope
- {Explicitly excluded item 1}
- {Explicitly excluded item 2}

## Success Criteria
- [ ] {Measurable outcome 1}
- [ ] {Measurable outcome 2}
- [ ] {Measurable outcome 3}

## Dependencies
- {Dependency on other team/epic/service}

## Risks
- {Risk with mitigation}

Specification: https://wnesolutions.atlassian.net/wiki/spaces/.../pages/98765
```

The description includes a link back to the original Confluence spec page, allowing team members to reference the full specification.

---

## 6. Plan Presented to User for Confirmation

Per Step 4 of the workflow, before creating anything, the following plan structure would be presented to the user for review and approval. The exact tickets depend on what the spec contains, but the format follows `breakdown-examples.md`:

---

**Proposed Backlog Structure for DO Project**

**Epic:** {Summary derived from spec's primary goal}

| # | Type  | Summary                                          | Points | Dependencies |
|---|-------|--------------------------------------------------|--------|--------------|
| - | Epic  | {Epic summary from spec}                         | -      | -            |
| 1 | Spike | {Research/discovery task if unknowns exist}       | 2      | -            |
| 2 | Task  | {Data model or infrastructure setup}              | 3      | 1            |
| 3 | Story | {Core API or backend implementation}              | 5      | 2            |
| 4 | Story | {Secondary feature or integration}                | 3      | 3            |
| 5 | Story | {UI or frontend implementation}                   | 5      | 3            |
| 6 | Task  | {Testing -- E2E, integration}                     | 3      | 3,4,5        |
| 7 | Task  | {Monitoring, documentation, or deployment}        | 2      | 4,5          |

**Total:** ~23 points across ~2-3 sprints

"Please review the proposed breakdown. You can request changes to any item -- add, remove, split, rename, reprioritize -- before I create the tickets."

---

Per SKILL.md principle #2 ("Confirm before mutating"), the user must approve the plan before any tickets are created.

---

## 7. Commands: Create Epic First, Then Children with --parent

Per Steps 5 and 6 of the workflow, the Epic is created first, its key is captured, then each child ticket is created with `--parent`:

**Create Epic:**
```bash
node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Epic \
  --summary "{Epic summary derived from spec}" \
  --description "## Goal\n{Goal from spec analysis}\n\n## Scope\n- {Scope item 1}\n- {Scope item 2}\n\n## Out of Scope\n- {Excluded item}\n\n## Success Criteria\n- [ ] {Criterion 1}\n- [ ] {Criterion 2}\n\n## Dependencies\n- {Dependency}\n\n## Risks\n- {Risk with mitigation}\n\nSpecification: https://wnesolutions.atlassian.net/wiki/spaces/.../pages/98765"
```

Capture returned key, e.g., `DO-500`.

**Create child tickets (in priority order):**
```bash
node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Story \
  --summary "{Spike or first task summary}" \
  --description "## Context\n{Why this work is needed, linked to epic}\n\n## Requirements\n- {Requirement 1}\n- {Requirement 2}\n\n## Acceptance Criteria\n- [ ] {Testable criterion 1}\n- [ ] {Testable criterion 2}\n- [ ] {Testable criterion 3}" \
  --parent DO-500

node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "{Second task summary}" \
  --description "## Context\n{Context from spec}\n\n## Acceptance Criteria\n- [ ] {Criterion 1}\n- [ ] {Criterion 2}\n- [ ] {Criterion 3}" \
  --parent DO-500

node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Story \
  --summary "{Third task summary}" \
  --description "## Context\n{Context}\n\n## Requirements\n- {Requirement}\n\n## Acceptance Criteria\n- [ ] {Criterion 1}\n- [ ] {Criterion 2}" \
  --parent DO-500
```

...and so on for each remaining child ticket, following the same pattern. Each child uses `--parent DO-500` to link it under the Epic. Tickets are created in priority/dependency order so the backlog is pre-sorted.

Ticket summaries follow the **Verb + Object + Context** pattern from `ticket-writing-guide.md` (e.g., "Build notification preferences API endpoints", "Create notification data model and migrations", "Add monitoring for notification failures").

---

## 8. Summary Report Format

Per Step 7 of the workflow, the final summary is presented as a table with links:

```
Backlog created successfully from Confluence spec (page 98765).

| Type  | Key    | Summary                                          |
|-------|--------|--------------------------------------------------|
| Epic  | DO-500 | {Epic summary}                                   |
| Spike | DO-501 | {Spike summary}                                  |
| Task  | DO-502 | {Task summary}                                   |
| Story | DO-503 | {Story summary}                                  |
| Story | DO-504 | {Story summary}                                  |
| Story | DO-505 | {Story summary}                                  |
| Task  | DO-506 | {Task summary}                                   |
| Task  | DO-507 | {Task summary}                                   |

7 child tickets created under Epic DO-500.
Source spec: https://wnesolutions.atlassian.net/wiki/spaces/.../pages/98765
```

---

## 9. Reference Files Consulted

| Reference File | Path | Why Consulted |
|----------------|------|---------------|
| **epic-templates.md** | `references/epic-templates.md` | Used for Epic description structure (Goal, Scope, Out of Scope, Success Criteria, Dependencies, Risks), ADF format reference, acceptance criteria patterns (Given/When/Then, Checklist, Rule-Based), and story point estimation guidance (1-13 point scale). |
| **ticket-writing-guide.md** | `references/ticket-writing-guide.md` | Used for ticket summary format (Verb + Object + Context), description structure (Context, Requirements, Acceptance Criteria, Technical Notes, References), priority assignment guidelines, and label/component conventions. |
| **breakdown-examples.md** | `references/breakdown-examples.md` | Used for breakdown patterns and sizing guidance (1-8 points per story), vertical slicing principles, dependency ordering, spike-first patterns for unknowns, and estimation patterns (CRUD endpoint 3-5 pts, new UI component 3-5 pts, etc.). |

Additionally, the main `SKILL.md` was consulted for:
- Confluence script usage (`confluence.mjs get-page <pageId>`)
- Jira script usage (`jira.mjs create`, `jira.mjs issue-types`)
- Core principles: resolve ambiguity first (principle #1), confirm before mutating (principle #2)
- Workflow routing (principle #6): matched "spec to backlog" workflow

## 10. Key Skill Principles Applied

1. **Resolve ambiguity first** (SKILL.md #1): Check issue types with `jira.mjs issue-types DO` before creating tickets.
2. **Confirm before mutating** (SKILL.md #2): Present full breakdown plan to user and wait for approval before creating any tickets.
3. **Never delete** (SKILL.md #3): Only create operations are used; no deletions.
4. **Use workflows for complex tasks** (SKILL.md #6): Loaded `workflows/spec-to-backlog.md` as the governing process.
5. **Read reference docs when needed** (SKILL.md #7): Consulted `epic-templates.md`, `ticket-writing-guide.md`, and `breakdown-examples.md` for quality output.
