# Triage Issue Approach: Connection Timeout in Payment Service

## 1. Sub-Skill / Workflow Loaded

**Primary workflow:** `skills/triage-issue.md` -- the "Triage Issue" sub-skill, which handles bug reports with duplicate detection before creating or updating Jira tickets.

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
| **User-facing symptom** | Checkout fails for users |
| **Environment** | Production |
| **Severity** | High (feature broken for users, no workaround implied) |
| **Frequency** | "a lot" -- suggests frequent/widespread |
| **Steps to reproduce** | User initiates checkout |

**Missing details the workflow would prompt for (Step 1 follow-ups):**
- Exact error message text (is it literally "Connection timeout" or a more specific message?)
- When did this start? (recent deploy, gradual onset, specific timestamp?)
- Which downstream service is timing out? (payment gateway, internal DB, third-party API?)
- Any specific user segments affected? (region, payment method, account type?)
- Browser/client details, or is this server-side?
- Any related infrastructure changes or deployments?

Per the triage workflow Step 1: "If any critical details are missing, ask follow-up questions before proceeding." However, we have enough to begin duplicate searching while waiting for clarifications.

---

## 3. Multiple Search Strategies with Exact JQL Commands

The triage workflow (Step 2) prescribes three search strategies: by error message, by component, and by summary keywords. Following `references/search-patterns.md`, I would also add an incident investigation pattern and a broader text search.

### Strategy 1: Search by error message text

```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "connection timeout" AND issuetype = Bug' --max 10
```

Rationale: Finds any bug that mentions "connection timeout" anywhere in summary, description, or comments.

### Strategy 2: Search by component (payment service)

```bash
node <skill-path>/scripts/jira.mjs search 'component = "payment-service" AND issuetype = Bug AND statusCategory != Done' --max 10
```

Rationale: Finds all open bugs against the payment service component, regardless of error message wording. Note: the exact component name may vary (e.g., "Payment", "payment-api", "Payments") -- would need to confirm or try variants.

### Strategy 3: Search by summary keywords

```bash
node <skill-path>/scripts/jira.mjs search 'summary ~ "timeout" AND summary ~ "payment" AND issuetype = Bug' --max 10
```

Rationale: Catches bugs specifically titled around payment timeouts.

### Strategy 4: Broader keyword combinations (synonyms/variants)

```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "timeout" AND text ~ "checkout" AND issuetype = Bug' --max 10
```

```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "timeout" AND text ~ "payment" AND issuetype IN (Bug, Incident)' --max 10
```

Rationale: Per `references/search-patterns.md` "Broadening Results" guidance -- use synonyms. "checkout" and "payment" are related terms users might use interchangeably. Also includes Incident issue type for incident investigation pattern.

### Strategy 5: Recent bugs in the area (time-scoped)

```bash
node <skill-path>/scripts/jira.mjs search 'issuetype IN (Bug, Incident) AND text ~ "payment" AND created >= -30d ORDER BY created DESC' --max 10
```

Rationale: Even if the error message differs, recent payment-related bugs may be related to the same root cause (e.g., infrastructure issue causing multiple symptoms).

### Strategy 6: Confluence search for postmortems or known issues

```bash
node <skill-path>/scripts/confluence.mjs search 'text ~ "connection timeout" AND text ~ "payment" AND type = page' --max 5
```

Rationale: Per `references/search-patterns.md` incident investigation pattern -- check Confluence for postmortems or runbooks that document this known issue.

---

## 4. How I Would Analyze Matches and Present Findings

### Analysis Process (Step 3 of triage workflow)

For each potential duplicate from the top results (up to 5 most relevant), I would:

```bash
node <skill-path>/scripts/jira.mjs get <issueKey>
```

Then compare each match against the new report on four dimensions:

| Dimension | What to Check |
|-----------|---------------|
| **Error messages** | Does the existing ticket mention "connection timeout"? Same service? |
| **Affected components** | Is it the payment service or a different service with timeout issues? |
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

Searched 6 JQL/CQL queries across Jira and Confluence.

Potential Duplicates:
- **PAY-456** (Open, High) -- "Connection timeout during payment processing"
  Assessment: LIKELY DUPLICATE -- same error message, same component, reported 3 days ago
  Assignee: Jane Smith

- **PAY-412** (Resolved, 2 weeks ago) -- "Checkout fails with timeout error"
  Assessment: POSSIBLE REGRESSION -- was fixed in v2.3.1 but symptoms match

Related Issues:
- **PAY-489** (In Progress) -- "Payment gateway latency spike"
  Assessment: LIKELY RELATED -- may share root cause (upstream timeout)

No Matches:
- If all searches return zero relevant results, I would state: "No existing tickets found
  matching this issue. Recommend creating a new bug."

Recommendation: [Create new / Comment on existing / Link as related]
```

---

## 5. What I Would Ask the User Before Taking Action

### Before searching (missing details):
1. "What is the exact error message users are seeing? Is it literally 'Connection timeout' or is there a more specific error code or stack trace?"
2. "When did this start happening? Was there a recent deployment or infrastructure change?"
3. "Do you know which downstream service is timing out -- the payment gateway (e.g., Stripe, PayPal), an internal database, or another microservice?"
4. "Which Jira project should I search in? (e.g., PAY, CHECKOUT, PLATFORM)"

### After presenting search results (before action):
5. "I found [N] potential matches. Would you like me to:
   - (a) Add a comment to [EXISTING-KEY] with your additional report details?
   - (b) Create a new bug ticket and link it to [EXISTING-KEY] as related?
   - (c) Create a brand new standalone bug ticket?"
6. "What priority should this be? Based on the impact (production, user-facing checkout blocked, frequent occurrence), I'd recommend **High**. Does that align with your assessment?"
7. "Should I assign this to a specific person or team?"
8. "Are there any labels or fix versions to apply?"

Per SKILL.md principle #2: "Confirm before mutating. Before creating issues, transitioning tickets, or publishing Confluence pages, show the user what you're about to do and get confirmation."

---

## 6. Exact Commands for Creating the Bug or Commenting

### Option A: Create a new bug ticket

```bash
node <skill-path>/scripts/jira.mjs create \
  --project PAY \
  --type Bug \
  --summary "[Payment Service] Connection timeout during checkout in production" \
  --description "## Description
Users are experiencing 'Connection timeout' errors when attempting to complete checkout via the payment service in production. Multiple reports indicate this is widespread.

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
- Environment: Production
- Component: Payment Service

## Severity
- Frequency: Frequent ('a lot' of reports)
- User impact: High -- checkout is blocked
- Workaround: None reported

## Additional Context
Reported via internal triage. Further investigation needed to identify which downstream dependency is timing out." \
  --priority High \
  --labels "bug,production,payment" \
  --components "payment-service"
```

Summary follows `references/ticket-writing-guide.md` format: `[Component] Verb + Object + Context`, under 80 characters.

Description follows `references/bug-report-templates.md` "Standard Bug Template" structure.

Priority set to High per `references/bug-report-templates.md` priority guide: "Feature broken, no workaround + Frequent = High".

### Option B: Comment on an existing duplicate

```bash
node <skill-path>/scripts/jira.mjs comment PAY-456 "Additional report: Multiple users experiencing 'Connection timeout' errors during checkout in production. This appears to be the same issue. Impact is widespread -- users cannot complete purchases. Reported via internal triage on $(date +%Y-%m-%d)."
```

### Option C: Create new bug and link to related issue

```bash
# First create the bug (same command as Option A)
node <skill-path>/scripts/jira.mjs create \
  --project PAY \
  --type Bug \
  --summary "[Payment Service] Connection timeout during checkout in production" \
  --description "..." \
  --priority High \
  --labels "bug,production,payment" \
  --components "payment-service"

# Then link to the related issue (using the key returned from create)
node <skill-path>/scripts/jira.mjs link PAY-NEW PAY-456 --type "relates to"
```

Note: Per SKILL.md, I would first run `node <skill-path>/scripts/jira.mjs link-types` to confirm the exact link type name available, rather than guessing.

### Option D: If this is a regression of a previously resolved ticket

```bash
# Comment on the resolved ticket noting regression
node <skill-path>/scripts/jira.mjs comment PAY-412 "This issue appears to have regressed. Users are again seeing 'Connection timeout' errors during checkout in production."

# Reopen the ticket (first check available transitions)
node <skill-path>/scripts/jira.mjs transitions PAY-412
node <skill-path>/scripts/jira.mjs transition PAY-412 <reopen-transition-id>
```

---

## 7. Reference Files Consulted

| Reference | Path | Why Consulted |
|-----------|------|---------------|
| **Triage Issue workflow** | `skills/triage-issue.md` | Primary workflow defining the 6-step triage process |
| **Bug Report Templates** | `references/bug-report-templates.md` | Description structure, priority assignment guide, error message template |
| **Ticket Writing Guide** | `references/ticket-writing-guide.md` | Summary format (Verb + Object + Context), description structure, priority guidelines |
| **JQL Patterns** | `references/jql-patterns.md` | Bug tracking queries, component queries, date-based queries |
| **Query Languages** | `references/query-languages.md` | JQL syntax reference for fields, operators, functions |
| **Search Patterns** | `references/search-patterns.md` | Multi-source search strategy, incident investigation pattern, broadening/narrowing techniques |
| **SKILL.md** | `SKILL.md` | Core principles (resolve ambiguity, confirm before mutating), script command reference |
