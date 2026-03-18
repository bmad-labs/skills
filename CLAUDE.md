# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **BMAD Skills Marketplace** — a collection of skills for Claude Code and other AI agents (Cursor, Codex, OpenCode, etc.). Skills are self-contained instruction sets defined in `SKILL.md` files that extend agent capabilities.

## Architecture

```
skills/[skill-name]/
├── SKILL.md         # Required: YAML frontmatter + instruction content
├── scripts/         # Optional: helper scripts
├── references/      # Optional: reference documentation
└── assets/          # Optional: images, resources
```

**Key directories:**
- `skills/` — all skill implementations (10+ skills)
- `template/` — starter template for new skills
- `spec/` — skills specification documentation
- `_bmad/` — BMAD workflow automation framework (roles, phases, orchestration)
- `.claude/commands/` — BMAD slash commands for Claude Code
- `books/` — source books used by book-related skills

## SKILL.md Format

Every skill requires a `SKILL.md` with YAML frontmatter:

```yaml
---
name: skill-name          # lowercase, hyphenated, unique
description: >            # Complete description of what the skill does
  and when Claude should use it. This drives auto-invocation.
---
```

Content guidelines: specific and actionable instructions, real examples, under 500 lines, link to scripts/docs instead of inlining large content.

## Evaluations and Benchmarks

!IMPORTANT: Evaluation and benchmark results for each skill are stored in `evaluations/skills/<skill-name>/`:

## Testing a Skill Locally

Install a skill by adding it to `.claude/settings.json`:

```json
{
  "skills": ["/absolute/path/to/skills/your-skill-name"]
}
```

Then verify in Claude Code: ask "What skills are available?" or run `/plugin`.

## Validating Plugin Structure

```bash
claude plugin validate .
```

## Creating a New Skill

1. Copy the template: `cp -r template/ skills/your-skill-name/`
2. Edit `SKILL.md` frontmatter and content
3. Update the skills table in `README.md`
4. Test locally, then submit a PR from branch `skill/your-skill-name`

## Installing Skills (for users)

```bash
# Install all skills via CLI
npx skills add bmad-labs/skills

# Install specific skills
npx skills add bmad-labs/skills --skill typescript-clean-code --skill typescript-unit-testing

# Install globally
npx skills add bmad-labs/skills -g
```

## Troubleshooting

If skills are not detected after installation:
1. Clear cache: `rm -rf ~/.claude/plugins/cache`
2. Restart Claude Code
3. Run `claude plugin validate .` to check structure
