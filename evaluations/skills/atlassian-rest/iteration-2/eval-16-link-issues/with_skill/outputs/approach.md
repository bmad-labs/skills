# Approach: Link DO-100 blocks DO-200, and DO-100 relates to DO-50

## Reference Files Consulted

- `SKILL.md` — Issue Links section (lines 116-119) for CLI syntax
- `references/jira-api.md` — Create issue link endpoint: `POST /issueLink` with `{type, inwardIssue, outwardIssue}`

## Step 1: List Available Link Types

Before creating any links, list the available link types to confirm the exact type names supported by this Jira instance. The SKILL.md explicitly instructs: "List available link types first."

```bash
node <skill-path>/scripts/jira.mjs link-types
```

Expected output includes link type names such as "Blocks", "relates to", "Duplicate", "Cloners", etc. The exact strings from this output will be used in subsequent commands to ensure correctness.

## Step 2: Create "Blocks" Link — DO-100 blocks DO-200

DO-100 **blocks** DO-200. The standard Jira "Blocks" link type has:
- Outward description: "blocks"
- Inward description: "is blocked by"

The first issue argument is the outward (blocking) issue, and the second is the inward (blocked) issue, with `--type` matching the link type name from Step 1.

```bash
node <skill-path>/scripts/jira.mjs link DO-100 DO-200 --type "Blocks"
```

This creates a link where DO-100 blocks DO-200 (i.e., DO-200 is blocked by DO-100).

**Note:** Per SKILL.md guidelines, this is a mutating operation — confirm with the user before executing.

## Step 3: Create "Relates To" Link — DO-100 relates to DO-50

```bash
node <skill-path>/scripts/jira.mjs link DO-100 DO-50 --type "relates to"
```

This creates a symmetric "relates to" link between DO-100 and DO-50. Since "relates to" is symmetric, argument order does not matter.

**Note:** Per SKILL.md guidelines, this is a mutating operation — confirm with the user before executing.

## Summary of Commands

| # | Command | Purpose |
|---|---------|---------|
| 1 | `jira.mjs link-types` | Discover exact link type names for the instance |
| 2 | `jira.mjs link DO-100 DO-200 --type "Blocks"` | DO-100 blocks DO-200 |
| 3 | `jira.mjs link DO-100 DO-50 --type "relates to"` | DO-100 relates to DO-50 |

## Notes

- The skill instructs to always list link types first before creating links (SKILL.md: "List available link types first").
- The exact type name strings ("Blocks", "relates to") should be confirmed from the `link-types` output in Step 1. Common Jira instances use "Blocks" (capitalized) and "relates to" (lowercase), but this varies by instance configuration.
- Both link creation commands are mutating operations, so per SKILL.md guidelines, confirmation from the user should be obtained before execution.
- The `--type` value must match the link type name exactly as returned by `link-types` — not the inward/outward description.
