---
name: 'step-05-security'
description: 'Check for security vulnerabilities — injection, XSS, auth, secrets'
referenceFiles:
  - 'references/smells/rules.md'
nextStepFile: './step-06-performance.md'
---

# Step 5: Check for Security Issues

## STEP GOAL

Identify potential security vulnerabilities in the PR changes.

## ANALYSIS PROCESS

Check all changed code for:

1. **Input validation** present?
2. **SQL injection** possible?
3. **XSS vulnerabilities**?
4. **Sensitive data** exposed?
5. **Authentication/authorization** checked?
6. **Secrets in code**?

### Common Issues

```typescript
// BAD: SQL injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD: Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

### Filter before reporting

Ask of every candidate: **would the author plausibly act on this?** Cut every no. A
correct finding nobody acts on is a false positive — it spends the trust that makes
the next finding land. Label what survives with the Conventional Comments vocabulary
in `references/smells/rules.md` → Severity vocabulary.

## PRESENT FINDINGS

```
Step 5: Security
================

<label> (<decoration>): vulnerability_type (file:line)
  - Risk: HIGH/MEDIUM/LOW
  - Description: what the vulnerability is
  - Attack vector: how it could be exploited
  - Fix: how to remediate

Summary: N security findings reported, N cut as unlikely to be acted on
  - HIGH: N
  - MEDIUM: N
  - LOW: N
```

**This step is done when** every security finding in scope has been examined, each surviving finding carries a label and a concrete fix, and the cut count is recorded.

Then ask: **[C] Continue to Step 6: Performance**

## FRONTMATTER UPDATE

Update the output document:
- Add `5` to `stepsCompleted`
- Append the findings section to the report

## NEXT STEP

After user confirms `[C]`, load `step-06-performance.md`.
