# Approach: Spec to Backlog -- Notification System

## 1. Sub-Skill Loaded

The **Spec to Backlog** workflow sub-skill was loaded from `skills/spec-to-backlog.md`. This is a 7-step process: Get Spec, Analyze Spec, Create Breakdown, Present Plan, Create Epic, Create Child Tickets, Report. Three reference files were also consulted (see section 9).

---

## 2. Exact Command to Fetch Confluence Page

Per Step 1 of the sub-skill, fetch the spec content using the page ID provided by the user:

```bash
node <skill-path>/scripts/confluence.mjs get-page 98765
```

This retrieves the full page content (storage format by default) so we can analyze the specification. No `--format` flag is needed since the default storage format gives us the structured content.

---

## 3. Command to Check Available Issue Types

Before creating any issues, verify which issue types are available in the MOBILE project (as instructed by SKILL.md principle #1 -- "Resolve ambiguity first"):

```bash
node <skill-path>/scripts/jira.mjs issue-types MOBILE
```

This confirms that Epic, Story, and Task are valid issue types in the MOBILE project. If the project uses different names (e.g., "Feature" instead of "Epic"), we would adapt accordingly.

---

## 4. How to Analyze and Break Down a Spec

Per Step 2 of the sub-skill, read the spec content thoroughly and identify:

- **Major features or sections** -- these map to the Epic scope. If the spec covers multiple major areas (e.g., push notifications, email notifications, in-app notifications, preferences management), each could be an Epic or grouped under one Epic with stories per area.
- **Implementation tasks** -- discrete units of work that become Stories or Tasks. Following `breakdown-examples.md`, each should be 1-3 days of work (no more than 8 story points).
- **Technical requirements** -- infrastructure, API, or architecture work (e.g., notification service setup, message queue integration, device token management).
- **Acceptance criteria** -- testable conditions extracted from requirements, using Given/When/Then or checklist format per `epic-templates.md`.
- **Dependencies** -- ordering constraints (e.g., data model must exist before API endpoints, API must exist before UI).

Following the **Breakdown Principles** from `breakdown-examples.md`:
- Prefer vertical slices over horizontal layers
- Each story should be independently deployable when possible
- Add a spike story when unknowns exceed 30% of effort
- No story exceeds 8 points; split larger items

---

## 5. Epic Description Format

Per `references/epic-templates.md`, the Epic description follows this structure:

```
## Goal
Deliver a notification system for the mobile app that enables push, email, and in-app notifications with user-configurable preferences.

## Scope
- Push notification delivery via FCM/APNs
- Email notification integration
- In-app notification center UI
- User notification preferences (per-channel toggles)
- Notification batching/digest option

## Out of Scope
- SMS notifications (Phase 2)
- Admin notification management dashboard
- Third-party webhook integrations

## Success Criteria
- [ ] Users receive push notifications within 30 seconds of trigger
- [ ] Users can toggle notification channels independently
- [ ] Notification preferences persist across sessions
- [ ] In-app notification center loads in under 2 seconds

## Dependencies
- Backend notification service (or existing infrastructure)
- FCM/APNs credentials and configuration
- Email service provider integration

## Risks
- APNs certificate expiry requires monitoring (mitigation: automated renewal alerts)
- High notification volume may require message queue scaling (mitigation: load test in staging)

Specification: https://<domain>/wiki/spaces/.../pages/98765
```

---

## 6. Plan Presented to User for Confirmation

Per Step 4 of the sub-skill, before creating anything, the following plan would be presented to the user for review and approval:

---

**Proposed Backlog Structure for MOBILE Project**

**Epic:** Implement Notification System

| # | Type  | Summary                                                    | Points | Dependencies |
|---|-------|------------------------------------------------------------|--------|--------------|
| - | Epic  | Implement notification system for mobile app               | -      | -            |
| 1 | Spike | Research push notification architecture (FCM/APNs)         | 2      | -            |
| 2 | Task  | Create notification data model and DB migrations           | 3      | 1            |
| 3 | Story | Build notification preferences API endpoints (GET/PUT)     | 5      | 2            |
| 4 | Story | Implement push notification delivery service               | 5      | 2            |
| 5 | Story | Integrate email notification channel with preference checks| 3      | 3            |
| 6 | Story | Build in-app notification center UI                        | 5      | 3            |
| 7 | Story | Add notification preferences settings screen               | 5      | 3            |
| 8 | Story | Implement notification batching/digest option              | 3      | 3            |
| 9 | Task  | Write E2E tests for notification flows                     | 3      | 4,5,6,7      |
| 10| Task  | Add monitoring and alerting for notification failures      | 2      | 4,5          |

**Total:** ~36 points across ~3-4 sprints

"Please review the proposed breakdown. You can request changes to any item -- add, remove, split, rename, reprioritize -- before I create the tickets."

---

## 7. Commands: Create Epic First, Then Children with --parent

Per Steps 5 and 6 of the sub-skill, the Epic is created first, its key is captured, then each child ticket is created with `--parent`:

**Create Epic:**
```bash
node <skill-path>/scripts/jira.mjs create \
  --project MOBILE \
  --type Epic \
  --summary "Implement notification system for mobile app" \
  --description "## Goal\nDeliver a notification system for the mobile app...\n\nSpecification: https://<domain>/wiki/spaces/.../pages/98765"
```

Capture returned key, e.g., `MOBILE-200`.

**Create child tickets (in priority order):**
```bash
node <skill-path>/scripts/jira.mjs create \
  --project MOBILE \
  --type Story \
  --summary "Research push notification architecture (FCM/APNs)" \
  --description "## Context\nSpike to evaluate push notification infrastructure...\n\n## Acceptance Criteria\n- [ ] Architecture decision documented\n- [ ] FCM and APNs trade-offs compared\n- [ ] Recommended approach approved by team" \
  --parent MOBILE-200

node <skill-path>/scripts/jira.mjs create \
  --project MOBILE \
  --type Task \
  --summary "Create notification data model and DB migrations" \
  --description "## Context\nDesign and implement the data model...\n\n## Acceptance Criteria\n- [ ] notifications table created with migration\n- [ ] notification_preferences table created\n- [ ] Indexes added for user_id and created_at" \
  --parent MOBILE-200

node <skill-path>/scripts/jira.mjs create \
  --project MOBILE \
  --type Story \
  --summary "Build notification preferences API endpoints (GET/PUT)" \
  --description "## Context\nAPI for managing per-user notification preferences...\n\n## Acceptance Criteria\n- [ ] GET /api/v1/users/{id}/notification-preferences returns current settings\n- [ ] PUT /api/v1/users/{id}/notification-preferences updates settings\n- [ ] Input validation rejects invalid channel names\n- [ ] Default preferences applied for new users" \
  --parent MOBILE-200
```

...and so on for each remaining child ticket, following the same pattern.

---

## 8. Summary Format

Per Step 7 of the sub-skill, the final summary is presented as a table with links:

```
Backlog created successfully from Confluence spec (page 98765).

| Type  | Key        | Summary                                                     |
|-------|------------|-------------------------------------------------------------|
| Epic  | MOBILE-200 | Implement notification system for mobile app                |
| Spike | MOBILE-201 | Research push notification architecture (FCM/APNs)          |
| Task  | MOBILE-202 | Create notification data model and DB migrations            |
| Story | MOBILE-203 | Build notification preferences API endpoints (GET/PUT)      |
| Story | MOBILE-204 | Implement push notification delivery service                |
| Story | MOBILE-205 | Integrate email notification channel with preference checks |
| Story | MOBILE-206 | Build in-app notification center UI                         |
| Story | MOBILE-207 | Add notification preferences settings screen                |
| Story | MOBILE-208 | Implement notification batching/digest option               |
| Task  | MOBILE-209 | Write E2E tests for notification flows                      |
| Task  | MOBILE-210 | Add monitoring and alerting for notification failures       |

10 child tickets created under Epic MOBILE-200.
Source spec: https://<domain>/wiki/spaces/.../pages/98765
```

---

## 9. Reference Files Consulted

| Reference File | Path | Why Consulted |
|----------------|------|---------------|
| **epic-templates.md** | `references/epic-templates.md` | Used for Epic description structure (Goal, Scope, Out of Scope, Success Criteria, Dependencies, Risks), ADF format reference, acceptance criteria patterns (Given/When/Then, Checklist, Rule-Based), and story point estimation guidance. |
| **ticket-writing-guide.md** | `references/ticket-writing-guide.md` | Used for ticket summary format (Verb + Object + Context), description structure (Context, Requirements, Acceptance Criteria, Technical Notes, References), priority assignment guidelines, and label/component conventions. |
| **breakdown-examples.md** | `references/breakdown-examples.md` | Used for breakdown patterns (the "User Notification Preferences" example was directly relevant), sizing guidance (1-8 points per story), vertical slicing principles, dependency ordering, and spike-first patterns for unknowns. |

Additionally, the main `SKILL.md` was consulted for:
- Confluence script usage (`confluence.mjs get-page`)
- Jira script usage (`jira.mjs create`, `jira.mjs issue-types`)
- Core principles: resolve ambiguity first, confirm before mutating
