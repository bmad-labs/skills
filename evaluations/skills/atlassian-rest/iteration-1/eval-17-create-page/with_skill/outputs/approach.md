# Approach: Create Confluence ADR Page

## Task

Create a new Confluence page in the TEAM space titled "Architecture Decision Record - Microservices Migration" with a structured ADR template containing Context, Decision, Consequences, and Status sections.

## Reference Files Consulted

1. **SKILL.md** (`skills/atlassian-rest/SKILL.md`) — Lines 136-142: Confluence `create-page` command syntax, `--body` flag behavior (auto-detects storage format when content starts with `<`).
2. **references/confluence-api.md** — Lines 40-51: Create page request JSON structure showing `spaceId`, `title`, `body.representation`, `body.value`. Lines 76-90: Storage format basics (XHTML-based: `<h1>`, `<h2>`, `<p>`, `<ul>`, `<table>`, status macros).
3. **scripts/confluence.mjs** — Lines 181-208: `cmdCreatePage` implementation confirming `--space` is passed as `spaceId`, `--body` is processed through `toStorageFormat()` which passes through raw HTML when it starts with `<`. Lines 114-121: `toStorageFormat` function.

## Pre-requisite Step

Before creating the page, the skill instructs to resolve the space key "TEAM" to a numeric `spaceId`. The `--space` flag in `confluence.mjs` is passed directly as `spaceId` in the API payload. Confluence V2 API requires a numeric space ID, not a space key.

To get the space ID:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs spaces --max 50
```

Then find the `id` for the space with key `TEAM` from the output. Assume the space ID is `<TEAM_SPACE_ID>` below.

## Storage Format HTML

The body content in Confluence XHTML storage format:

```html
<h1>Architecture Decision Record - Microservices Migration</h1>
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Yellow</ac:parameter>
  <ac:parameter ac:name="title">PROPOSED</ac:parameter>
</ac:structured-macro>
<h2>Context</h2>
<p>Describe the architectural context and the forces at play. What is the issue that is motivating this decision or change?</p>
<ul>
  <li>What is the current state of the system?</li>
  <li>What technical, business, or organizational drivers are relevant?</li>
  <li>What constraints or requirements must be considered?</li>
</ul>
<h2>Decision</h2>
<p>Describe the change that is being proposed or has been agreed upon.</p>
<ul>
  <li>What is the approach chosen?</li>
  <li>What alternatives were considered and why were they rejected?</li>
  <li>What is the migration strategy?</li>
</ul>
<h2>Consequences</h2>
<p>Describe the resulting context after applying the decision. All consequences should be listed, not just the positive ones.</p>
<h3>Positive</h3>
<ul>
  <li>List positive outcomes and benefits</li>
</ul>
<h3>Negative</h3>
<ul>
  <li>List negative outcomes, trade-offs, and risks</li>
</ul>
<h3>Neutral</h3>
<ul>
  <li>List neutral observations or side effects</li>
</ul>
<h2>Status</h2>
<table><tbody>
  <tr><th>Field</th><th>Value</th></tr>
  <tr><td>Status</td><td><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Yellow</ac:parameter><ac:parameter ac:name="title">PROPOSED</ac:parameter></ac:structured-macro></td></tr>
  <tr><td>Date</td><td><em>YYYY-MM-DD</em></td></tr>
  <tr><td>Decision Makers</td><td><em>List names or teams</em></td></tr>
  <tr><td>Supersedes</td><td><em>Link to previous ADR if applicable</em></td></tr>
</tbody></table>
```

## Exact Command

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space <TEAM_SPACE_ID> \
  --title "Architecture Decision Record - Microservices Migration" \
  --body '<h1>Architecture Decision Record - Microservices Migration</h1><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Yellow</ac:parameter><ac:parameter ac:name="title">PROPOSED</ac:parameter></ac:structured-macro><h2>Context</h2><p>Describe the architectural context and the forces at play. What is the issue that is motivating this decision or change?</p><ul><li>What is the current state of the system?</li><li>What technical, business, or organizational drivers are relevant?</li><li>What constraints or requirements must be considered?</li></ul><h2>Decision</h2><p>Describe the change that is being proposed or has been agreed upon.</p><ul><li>What is the approach chosen?</li><li>What alternatives were considered and why were they rejected?</li><li>What is the migration strategy?</li></ul><h2>Consequences</h2><p>Describe the resulting context after applying the decision. All consequences should be listed, not just the positive ones.</p><h3>Positive</h3><ul><li>List positive outcomes and benefits</li></ul><h3>Negative</h3><ul><li>List negative outcomes, trade-offs, and risks</li></ul><h3>Neutral</h3><ul><li>List neutral observations or side effects</li></ul><h2>Status</h2><table><tbody><tr><th>Field</th><th>Value</th></tr><tr><td>Status</td><td><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Yellow</ac:parameter><ac:parameter ac:name="title">PROPOSED</ac:parameter></ac:structured-macro></td></tr><tr><td>Date</td><td><em>YYYY-MM-DD</em></td></tr><tr><td>Decision Makers</td><td><em>List names or teams</em></td></tr><tr><td>Supersedes</td><td><em>Link to previous ADR if applicable</em></td></tr></tbody></table>'
```

## Key Implementation Notes

1. **Space ID resolution required**: The `--space` flag maps directly to `spaceId` in the V2 API payload (line 192 of `confluence.mjs`). Confluence V2 requires a numeric space ID, not the key "TEAM". Must run `spaces` command first to resolve.
2. **Storage format auto-detection**: The `toStorageFormat()` function (line 115-121) checks if content starts with `<` and passes it through unchanged. Since our body starts with `<h1>`, it will be treated as raw storage format HTML.
3. **Confirm before mutating**: Per SKILL.md principle #2, the agent should show the user the planned page content and get confirmation before executing the create command.
4. **Status macro**: Uses Confluence's `ac:structured-macro` with `colour=Yellow` and `title=PROPOSED` to render a visible status lozenge, per `confluence-api.md` lines 94-101.
5. **No parent specified**: The page will be created at the top level of the TEAM space since no `--parent` flag is provided.
