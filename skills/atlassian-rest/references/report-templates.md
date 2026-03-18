# Status Report Templates

## Executive Summary Template

```
## Executive Summary — {Project} ({Date})

**Overall Status:** {Green/Yellow/Red}

**Highlights:**
- {Key achievement 1}
- {Key achievement 2}

**Risks & Blockers:**
- {Risk/blocker with mitigation}

**Key Metrics:**
- Velocity: {X} pts/sprint
- Open bugs: {N} ({trend})
- Sprint completion: {X}%

**Next Period Focus:**
- {Priority 1}
- {Priority 2}
```

## Sprint Status Template

```
## Sprint {N} Status — {Sprint Name} ({Start} to {End})

### Completed ({X} pts)
| Key | Summary | Points |
|-----|---------|--------|
| PROJ-1 | Feature A | 5 |

### In Progress ({X} pts)
| Key | Summary | Assignee | Points | % Done |
|-----|---------|----------|--------|--------|
| PROJ-2 | Feature B | @john | 8 | 60% |

### Blocked ({X} pts)
| Key | Summary | Blocker | Action |
|-----|---------|---------|--------|
| PROJ-3 | Feature C | Waiting on API | Escalated |

### Not Started ({X} pts)
| Key | Summary | Points | Risk |
|-----|---------|--------|------|
| PROJ-4 | Feature D | 3 | Low |

### Sprint Health
- Commitment: {X} pts | Completed: {Y} pts | Completion: {Z}%
- Scope changes: +{added} / -{removed} pts
- Carryover from last sprint: {N} items
```

## Weekly Status Template

```
## Weekly Status — {Team} ({Week})

### Done This Week
- {Accomplishment 1}
- {Accomplishment 2}

### In Progress
- {Work item 1} — {status/ETA}
- {Work item 2} — {status/ETA}

### Blocked / Needs Attention
- {Blocker} — {owner} — {action needed}

### Planned Next Week
- {Plan 1}
- {Plan 2}

### Risks
- {Risk} — Likelihood: {H/M/L} — Impact: {H/M/L}
```

## Confluence Storage Format Example

```html
<h2>Sprint 5 Status</h2>
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">ON TRACK</ac:parameter>
</ac:structured-macro>

<h3>Completed</h3>
<table>
  <tbody>
    <tr><th>Key</th><th>Summary</th><th>Points</th></tr>
    <tr>
      <td><a href="https://site.atlassian.net/browse/PROJ-1">PROJ-1</a></td>
      <td>Feature A</td>
      <td>5</td>
    </tr>
  </tbody>
</table>

<h3>Risks</h3>
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p>API dependency may delay Feature C by 2 days.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

## Building Reports from JQL

| Report Section | JQL Query |
|---------------|-----------|
| Completed | `sprint = {id} AND status = Done ORDER BY resolved DESC` |
| In Progress | `sprint = {id} AND statusCategory = "In Progress"` |
| Blocked | `sprint = {id} AND status = Blocked` |
| Not Started | `sprint = {id} AND statusCategory = "To Do"` |
| Bugs this sprint | `sprint = {id} AND issuetype = Bug` |
| Carryover | `sprint = {id} AND sprint = {prev_id}` |
