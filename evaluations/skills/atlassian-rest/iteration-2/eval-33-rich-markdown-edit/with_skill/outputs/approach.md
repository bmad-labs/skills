# Approach: Update DO-100 with Rich Markdown Description

## Task

Update the description of Jira issue DO-100 with rich markdown content including: a heading, bold/italic text, a bullet list, a table, and a code block.

## Skill Used

`atlassian-rest` — specifically `jira.mjs edit` with `--description` flag.

## How It Works

The `jira.mjs edit` command accepts a `--description` flag containing markdown text. The script's `toAdf()` function:
1. Replaces literal `\n` sequences (from shell arguments) with actual newline characters
2. Passes the normalized markdown through `marklassian`'s `markdownToAdf()` to convert it into Atlassian Document Format (ADF)
3. Sends the ADF payload via `PUT /rest/api/3/issue/DO-100` with the `fields.description` set to the converted ADF

This means we can write standard markdown in the `--description` argument and it will be automatically converted to rich ADF content in Jira.

## Steps

### Step 1: Verify credentials are configured

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

### Step 2: Confirm the issue exists by fetching its current state

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-100 --fields summary,status,description
```

This is a read operation, so no user confirmation is needed.

### Step 3: Update the description with rich markdown content

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs edit DO-100 \
  --description "## Release Notes\n\nThis release includes **critical performance improvements** and *new user-facing features* that enhance the overall experience.\n\n- Upgraded authentication module to support OAuth 2.0\n- Resolved memory leak in background worker processing\n- Added dark mode toggle to user preferences\n\n| Feature | Status | Owner |\n|---------|--------|-------|\n| OAuth 2.0 Migration | Complete | Alice Chen |\n| Memory Leak Fix | Complete | Bob Smith |\n| Dark Mode | In Progress | Carol Davis |\n\n\`\`\`javascript\nconst releaseConfig = {\n  version: '2.4.0',\n  date: '2026-03-18',\n  features: ['oauth2', 'memory-fix', 'dark-mode'],\n  rollbackEnabled: true\n};\n\nconsole.log('Deploying release:', releaseConfig.version);\n\`\`\`"
```

**Key details about the command:**

- `\n` literal sequences in the shell string are converted to actual newlines by the `toAdf()` function before markdown parsing
- `## Release Notes` becomes an ADF heading node (level 2)
- `**bold**` and `*italic*` become ADF text nodes with `strong` and `em` marks
- The bullet list (`- item`) becomes an ADF `bulletList` with `listItem` children
- The markdown table becomes an ADF `table` with `tableHeader` and `tableCell` nodes
- The fenced code block with `javascript` language becomes an ADF `codeBlock` node with `attrs.language = "javascript"`
- `marklassian` handles all the markdown-to-ADF conversion automatically

### Step 4: Verify the update was applied

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-100 --fields description
```

Confirm the response shows the ADF content with the expected structure (heading, paragraph with marks, bulletList, table, codeBlock).

## Expected Output

After Step 3, the script should print:
```json
{
  "updated": "DO-100"
}
```

The Jira issue DO-100 will display a properly formatted description with:
- An H2 heading "Release Notes"
- A paragraph with bold and italic styled text
- A 3-item bullet list
- A 3-row table (plus header) with Feature, Status, and Owner columns
- A syntax-highlighted JavaScript code block

## Why This Works

The `atlassian-rest` skill uses the `marklassian` npm package to convert markdown to ADF. This is the same format Jira v3 API requires for rich text fields. The conversion happens transparently inside the `toAdf()` helper, so the user only needs to provide standard markdown. No manual ADF JSON construction is needed.
