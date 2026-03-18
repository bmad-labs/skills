# Approach: Link PROJ-100 and PROJ-200 (Blocks) + PROJ-100 and PROJ-50 (Relates To)

## Reference Files Consulted

- `SKILL.md` — Issue Links section (lines 103-107) for CLI syntax
- `references/jira-api.md` — Create issue link endpoint: `POST /issueLink` with `{type, inwardIssue, outwardIssue}`

## Step 1: List Available Link Types

Before creating any links, list the available link types to confirm the exact type names supported by this Jira instance.

```bash
node <skill-path>/scripts/jira.mjs link-types
```

This returns the available link type names (e.g., "Blocks", "relates to", "Duplicate", "Cloners", etc.) so we use the correct type string in subsequent commands.

## Step 2: Create "Blocks" Link — PROJ-200 is blocked by PROJ-100

PROJ-100 **blocks** PROJ-200. The standard Jira "Blocks" link type has:
- Outward description: "blocks"
- Inward description: "is blocked by"

The first issue argument is the outward (blocking) issue, and the second is the inward (blocked) issue, with `--type` matching the link type name.

```bash
node <skill-path>/scripts/jira.mjs link PROJ-100 PROJ-200 --type "Blocks"
```

This creates a link where PROJ-100 blocks PROJ-200 (i.e., PROJ-200 is blocked by PROJ-100).

## Step 3: Create "Relates To" Link — PROJ-100 relates to PROJ-50

```bash
node <skill-path>/scripts/jira.mjs link PROJ-100 PROJ-50 --type "relates to"
```

This creates a symmetric "relates to" link between PROJ-100 and PROJ-50. Since "relates to" is symmetric, argument order does not matter.

## Notes

- The skill instructs to always list link types first before creating links (SKILL.md line 105: "List available link types first").
- The exact type name strings ("Blocks", "relates to") should be confirmed from the `link-types` output. Common Jira instances use "Blocks" (capitalized) and "relates to" (lowercase), but this varies by instance configuration.
- Both link creation commands are mutating operations, so per SKILL.md guidelines, confirmation from the user should be obtained before execution.
