# Epic Description Templates

## Epic Structure

Every epic description should include:

```
## Goal
What business outcome does this epic deliver? One sentence.

## Scope
- {Capability 1}
- {Capability 2}
- {Capability 3}

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
```

## ADF Format for Epic Description

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Goal"}]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "Enable users to manage their notification preferences, reducing unwanted notifications by 50%."}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Scope"}]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Notification preferences UI"}]}]
        },
        {
          "type": "listItem",
          "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Per-channel settings (email, push, in-app)"}]}]
        },
        {
          "type": "listItem",
          "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Digest/batching option"}]}]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Success Criteria"}]
    },
    {
      "type": "taskList",
      "attrs": {"localId": "criteria"},
      "content": [
        {
          "type": "taskItem",
          "attrs": {"state": "TODO", "localId": "c1"},
          "content": [{"type": "text", "text": "Users can toggle notifications per channel"}]
        },
        {
          "type": "taskItem",
          "attrs": {"state": "TODO", "localId": "c2"},
          "content": [{"type": "text", "text": "Email notification volume reduced by 50%"}]
        }
      ]
    }
  ]
}
```

## Acceptance Criteria Patterns

Use these formats for story-level acceptance criteria within an epic:

### Given/When/Then

```
Given I am a logged-in user
When I navigate to notification settings
Then I see toggle controls for each notification channel
```

### Checklist Style

```
- [ ] User can enable/disable email notifications
- [ ] User can enable/disable push notifications
- [ ] Changes persist across sessions
- [ ] Default settings apply to new users
```

### Rule-Based

```
Rule: Notification preferences are per-channel
  - Email, push, and in-app can be toggled independently
  - Disabling all channels shows a confirmation warning
  - Changes take effect within 5 minutes
```

## Story Point Estimation Guidance

| Points | Complexity | Duration Hint | Example |
|--------|-----------|---------------|---------|
| 1 | Trivial | < 0.5 day | Config change, copy update |
| 2 | Small | 0.5 - 1 day | Simple UI change, add field |
| 3 | Moderate | 1 - 2 days | New API endpoint, form component |
| 5 | Medium | 2 - 4 days | Feature with tests, integration |
| 8 | Large | 4 - 7 days | Multi-component feature |
| 13 | Very large | 1 - 2 weeks | Should probably be split |

## Epic Sizing Guide

| Epic Size | Story Count | Sprint Estimate |
|-----------|-------------|-----------------|
| Small | 3-5 stories | 1 sprint |
| Medium | 6-12 stories | 2-3 sprints |
| Large | 13-20 stories | 3-5 sprints |
| Too large | 20+ stories | Split into multiple epics |
