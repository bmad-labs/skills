# Triage Issue Approach: Connection Timeout in Payment Service

## 1. Sub-Skill / Workflow Loaded

**Primary workflow:** `workflows/triage-issue.md` -- the "Triage Issue" workflow for bug reports with duplicate detection before creating or updating Jira tickets.

**Target project:** DO at `wnesolutions.atlassian.net`

The triage workflow defines a 6-step process:
1. Receive Bug Report (gather details)
2. Search for Duplicates (multiple JQL strategies)
3. Analyze Matches (fetch and compare top results)
4. Present Findings (summary with recommendations)
5. Take Action (create, comment, or link)
6. Confirm (report outcome)

---

## 2. Key Information Extracted

From the user's report, the following details are available:

| Field | Extracted Value |
|-------|----------------|
| **Error signature** | `Connection timeout` |
| **Component** | Payment service |
| **User-facing symptom** | Checkout fails |
| **Severity** | High (feature broken, no workaround implied) |
| **Frequency** | Unknown -- needs clarification |
| **Steps to reproduce** | User initiates checkout in payment service |

**Missing details the workflow would prompt for (Step 1 follow-ups):**
- Exact error message text (literal "Connection timeout" or a more specific message with error code/stack trace?)
- When did this start? (recent deploy, gradual onset, specific timestamp?)
- Which downstream service is timing out? (payment gateway like Stripe/PayPal, internal DB, third-party API?)
- Environment details (production, staging, specific region?)
- Frequency and scope (all users, specific payment methods, intermittent or constant?)
- Any recent infrastructure changes or deployments?
- Browser/client details, or is this purely server-side?

Per the triage workflow Step 1: "If any critical details are missing, ask follow-up questions before proceeding." However, we have enough information to begin duplicate searching while awaiting clarifications.

---

## 3. Multiple Search Strategies with Exact Commands

The triage workflow (Step 2) prescribes three search strategies: by error message, by component, and by summary keywords. Following `references/jql-patterns.md`, I also add time-scoped and broader synonym searches.

### Strategy 1: Search by error message text

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND text ~ "connection timeout" AND issuetype = Bug' --max 10
```

Rationale: Full-text search finds any bug in the DO project that mentions "connection timeout" anywhere in summary, description, or comments.

### Strategy 2: Search by component (payment service)

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND component = "payment-service" AND issuetype = Bug AND statusCategory != Done' --max 10
```

Rationale: Finds all open bugs against the payment service component regardless of error message wording. The exact component name may differ (e.g., "Payment", "Payments", "payment-api") -- would try variants if no results.

### Strategy 3: Search by summary keywords

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND summary ~ "timeout" AND summary ~ "payment" AND issuetype = Bug' --max 10
```

Rationale: Catches bugs specifically titled around payment timeouts, even if the description uses different error message phrasing.

### Strategy 4: Broader keyword combinations (synonyms/variants)

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND text ~ "timeout" AND text ~ "checkout" AND issuetype = Bug' --max 10
```

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND text ~ "timeout" AND text ~ "payment" AND issuetype IN (Bug, Incident)' --max 10
```

Rationale: Users might describe the same issue using "checkout" vs "payment" interchangeably. Also includes Incident issue type for incident tracking.

### Strategy 5: Recent bugs in the payment area (time-scoped)

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND issuetype IN (Bug, Incident) AND text ~ "payment" AND created >= -30d ORDER BY created DESC' --max 10
```

Rationale: Even if the error message differs, recent payment-related bugs may share the same root cause (e.g., infrastructure issue causing multiple symptoms).

### Strategy 6: Confluence search for postmortems or known issues

```bash
node <skill-path>/scripts/confluence.mjs search 'text ~ "connection timeout" AND text ~ "payment" AND type = page' --max 5
```

Rationale: Check Confluence for postmortems, runbooks, or known issue documentation that might reference this problem.

---

## 4. How I Would Analyze Matches and Present Findings

### Analysis Process (Step 3 of triage workflow)

For each potential duplicate from the top results (up to 5 most relevant), I would fetch full details:

```bash
node <skill-path>/scripts/jira.mjs get DO-<issueNumber>
```

Then compare each match against the new report on four dimensions per the workflow:

| Dimension | What to Check |
|-----------|---------------|
| **Error messages** | Does the existing ticket mention "connection timeout"? Same service? Same error code? |
| **Affected components** | Is it the payment service specifically, or a different service with timeout issues? |
| **Root cause** | If resolved, was the fix related to timeouts, networking, or payment processing? |
| **Status** | Open = likely duplicate; Resolved = possible regression; Closed = might be different issue |

Each match would be rated as:
- **Exact duplicate** -- same error, same component, same symptoms, still open
- **Likely related** -- similar symptoms or same component, but different specifics
- **Possible regression** -- was previously fixed but may have recurred
- **Unrelated** -- different root cause despite keyword overlap

### Presentation Format (Step 4)

I would present findings to the user in this format:

```
Search Results Summary
======================

Searched 7 JQL/CQL queries across Jira (project DO) and Confluence.

Potential Duplicates:
- **DO-234** (Open, High) -- "Connection timeout during payment processing"
  Assessment: LIKELY DUPLICATE -- same error message, same component, reported recently
  Assignee: <name>

- **DO-189** (Resolved, 2 weeks ago) -- "Checkout fails with timeout error"
  Assessment: POSSIBLE REGRESSION -- was fixed but symptoms match current report

Related Issues:
- **DO-301** (In Progress) -- "Payment gateway latency spike"
  Assessment: LIKELY RELATED -- may share root cause (upstream timeout)

No Matches:
- If all searches return zero relevant results: "No existing tickets found matching
  this issue. Recommend creating a new bug."

Recommendation: [Create new / Comment on existing / Link as related]
```

---

## 5. What I Would Ask the User Before Taking Action

### Before searching (missing details):
1. "What is the exact error message? Is it literally 'Connection timeout' or is there a more specific error code or stack trace?"
2. "When did this start happening? Was there a recent deployment or infrastructure change?"
3. "Which downstream service is timing out -- the payment gateway (e.g., Stripe, PayPal), an internal database, or another microservice?"
4. "How frequent is this? Is it affecting all checkout attempts or only some?"

### After presenting search results (before action):
5. "I found [N] potential matches. Would you like me to:
   - (a) Add a comment to [DO-XXX] with your additional report details?
   - (b) Create a new bug ticket and link it to [DO-XXX] as related?
   - (c) Create a brand new standalone bug ticket?"
6. "What priority should this be? Based on the impact (user-facing checkout blocked), I'd recommend **High**. Does that align?"
7. "Should I assign this to a specific person or team?"
8. "Are there any labels or fix versions to apply?"

Per SKILL.md principle #2: "Confirm before mutating. Before creating issues, transitioning tickets, or publishing Confluence pages, show the user what you're about to do and get confirmation."

---

## 6. Exact Commands for Creating the Bug or Commenting

### Option A: Create a new bug ticket

```bash
node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Bug \
  --summary "[Payment Service] Connection timeout errors during checkout" \
  --description "## Description
Users are experiencing 'Connection timeout' errors when attempting to complete checkout via the payment service. The issue prevents users from completing purchases.

## Steps to Reproduce
1. Navigate to checkout page
2. Enter payment details
3. Click 'Pay' / 'Complete Order'
4. Observe 'Connection timeout' error

## Expected Behavior
Payment processes successfully and order is confirmed.

## Actual Behavior
Request times out with 'Connection timeout' error. Users cannot complete checkout.

## Environment
- Component: Payment Service
- Environment: (to be confirmed)

## Severity
- Frequency: (to be confirmed)
- User impact: High -- checkout is blocked
- Workaround: None reported

## Additional Context
Reported via internal triage. Further investigation needed to identify which downstream dependency is timing out." \
  --priority High \
  --labels "bug,payment" \
  --components "payment-service"
```

Summary follows `references/bug-report-templates.md` format: `[Component] Brief description of the defect`, kept under 80 characters.

Description follows the "Standard Bug Template" structure from `references/bug-report-templates.md`.

Priority set to High per the priority assignment guide: "Feature broken, no workaround + Frequent = High".

### Option B: Comment on an existing duplicate

```bash
node <skill-path>/scripts/jira.mjs comment DO-234 "Additional report: Users experiencing 'Connection timeout' errors during checkout in the payment service. This appears to be the same issue. Impact is significant -- users cannot complete purchases. Reported via internal triage."
```

### Option C: Create new bug and link to related issue

```bash
# First create the bug (same command as Option A)
node <skill-path>/scripts/jira.mjs create \
  --project DO \
  --type Bug \
  --summary "[Payment Service] Connection timeout errors during checkout" \
  --description "..." \
  --priority High \
  --labels "bug,payment" \
  --components "payment-service"

# Check available link types
node <skill-path>/scripts/jira.mjs link-types

# Then link to the related issue (using the key returned from create)
node <skill-path>/scripts/jira.mjs link DO-NEW DO-234 --type "relates to"
```

Per SKILL.md, I would first run `link-types` to confirm the exact link type name available, rather than guessing.

### Option D: If this is a regression of a previously resolved ticket

```bash
# Comment on the resolved ticket noting regression
node <skill-path>/scripts/jira.mjs comment DO-189 "This issue appears to have regressed. Users are again seeing 'Connection timeout' errors during checkout in the payment service."

# Check available transitions for reopening
node <skill-path>/scripts/jira.mjs transitions DO-189

# Reopen the ticket (using the transition ID from above)
node <skill-path>/scripts/jira.mjs transition DO-189 <reopen-transition-id>
```

Per SKILL.md: "Always list transitions first to get the correct ID -- don't guess."

---

## 7. Reference Files Consulted

| Reference | Path | Why Consulted |
|-----------|------|---------------|
| **Triage Issue workflow** | `workflows/triage-issue.md` | Primary workflow defining the 6-step triage process |
| **Bug Report Templates** | `references/bug-report-templates.md` | Description structure, priority assignment guide, error message template |
| **JQL Patterns** | `references/jql-patterns.md` | Bug tracking queries, component queries, date-based queries |
| **Query Languages** | `references/query-languages.md` | JQL syntax reference for fields, operators, functions |
| **SKILL.md** | `SKILL.md` | Core principles (resolve ambiguity, confirm before mutating), script command reference |
