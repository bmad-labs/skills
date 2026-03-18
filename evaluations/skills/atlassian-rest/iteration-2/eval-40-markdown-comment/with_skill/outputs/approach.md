# Approach: Create a Jira Comment on DO-123 with Markdown Formatting

## Task

Add a comment to Jira issue DO-123 that includes bold text, a bullet list, and an inline code snippet, using the atlassian-rest skill's markdown-to-ADF conversion.

## Skill Understanding

The `jira.mjs comment` command accepts a comment body as a plain string argument. Internally, the script:

1. Passes the body text through `toAdf()`, which normalizes literal `\n` sequences into real newlines.
2. Calls `markdownToAdf()` from the `marklassian` library to convert markdown into Atlassian Document Format (ADF).
3. POSTs the ADF payload to `POST /rest/api/3/issue/{issueKey}/comment`.

This means the comment body can use standard markdown syntax -- bold (`**text**`), bullet lists (`- item`), and inline code (`` `code` ``) -- and it will be rendered correctly in Jira.

## Exact Command

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs comment DO-123 "**Status Update**\n\nKey findings from the investigation:\n\n- The root cause has been identified in the authentication module\n- A fix has been prepared and is ready for review\n- No data loss occurred during the incident\n\nThe relevant config change is in \`auth.config.ts\` on line 42."
```

## Argument Breakdown

| Argument | Value | Purpose |
|----------|-------|---------|
| Command | `comment` | Invokes `cmdComment` in jira.mjs |
| Positional 0 | `DO-123` | The issue key to comment on |
| Positional 1 | (the body string) | Markdown-formatted comment text |

## Markdown Elements in the Comment Body

1. **Bold text**: `**Status Update**` -- renders as bold heading-like text in the comment.
2. **Bullet list**: Three lines starting with `- ` after a blank line -- renders as an unordered list in ADF.
3. **Inline code**: `` \`auth.config.ts\` `` -- renders as a monospace code snippet inline.

## How Markdown-to-ADF Conversion Works

The `toAdf()` function in `jira.mjs` (line 81-84):
- Replaces literal `\n` sequences with real newline characters (since shell arguments cannot contain actual newlines easily).
- Passes the normalized markdown string to `markdownToAdf()` from the `marklassian` npm package (v1.2.0).
- `marklassian` parses the markdown using `marked` and produces a valid ADF document node tree that Jira's REST API v3 accepts.

The resulting ADF will contain:
- A `paragraph` node with a `strong` mark for the bold text
- A `bulletList` node with `listItem` children for each bullet point
- A `text` node with a `code` mark for the inline code snippet

## Pre-flight Checks

Before executing, verify environment variables are set:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This confirms `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, and `ATLASSIAN_DOMAIN` (wnesolutions.atlassian.net) are configured.

## Expected Output

On success, the script prints:

```json
{
  "id": "<comment-id>",
  "created": "<ISO-8601-timestamp>"
}
```

## No Confirmation Needed

Per the skill instructions, "Confirm before mutating" applies to creating issues, transitioning tickets, or publishing Confluence pages. Adding a comment is a lightweight operation and the SKILL.md shows the comment command used directly without a confirmation step. However, in practice, an agent should still confirm with the user before posting.
