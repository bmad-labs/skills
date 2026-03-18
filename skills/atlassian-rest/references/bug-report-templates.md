# Bug Report Templates

## Standard Bug Template

**Summary format:** `[Component] Brief description of the defect`

**Fields:**

| Field | Value |
|-------|-------|
| Issue Type | Bug |
| Priority | Based on severity + frequency |
| Labels | `bug`, component label |
| Components | Affected component |

**Description structure:**

```
## Description
Brief description of the bug.

## Steps to Reproduce
1. Navigate to ...
2. Click on ...
3. Enter ...
4. Observe ...

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Browser/Client: Chrome 120
- OS: macOS 14.2
- Environment: staging
- Version/Build: 2.3.1

## Severity
- Frequency: Always / Intermittent / Rare
- User impact: High / Medium / Low
- Workaround: Yes (describe) / No

## Additional Context
Screenshots, logs, related issues.
```

## Error Message Bug Template

For bugs triggered by specific errors:

```
## Error
`TypeError: Cannot read property 'id' of undefined`

## Where
Page/endpoint/action where error occurs.

## Stack Trace
Relevant portion of the stack trace.

## Trigger
What action or data causes this error.

## Frequency
Always / Under specific conditions (describe).

## Logs
Relevant log entries with timestamps.
```

## Regression Bug Template

For functionality that previously worked:

```
## Regression
This worked in version {X} and broke in version {Y}.

## Working Behavior (version X)
Describe the correct behavior.

## Broken Behavior (version Y)
Describe the broken behavior.

## Likely Cause
Link to commit/PR/release that may have caused it, if known.

## Steps to Reproduce
1. ...

## Verification
How to verify the fix restores original behavior.
```

## ADF Format: Standard Bug

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Steps to Reproduce"}]
    },
    {
      "type": "orderedList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Navigate to /settings"}]}
          ]
        },
        {
          "type": "listItem",
          "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Click 'Save' without changes"}]}
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Expected Behavior"}]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "Page saves silently with no error."}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Actual Behavior"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "500 error: "},
        {
          "type": "text",
          "text": "NullPointerException in SaveHandler",
          "marks": [{"type": "code"}]
        }
      ]
    }
  ]
}
```

## Priority Assignment Guide

| Severity | Frequency | Priority |
|----------|-----------|----------|
| Data loss / security | Any | Highest |
| Feature broken, no workaround | Always | High |
| Feature broken, no workaround | Intermittent | High |
| Feature broken, has workaround | Always | Medium |
| Feature broken, has workaround | Intermittent | Medium |
| Cosmetic / minor UX | Always | Low |
| Cosmetic / minor UX | Rare | Lowest |
