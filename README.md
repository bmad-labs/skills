# BMAD Skills Marketplace

A collection of skills for Claude Code that extend its capabilities with specialized knowledge and workflows.

## What are Skills?

Skills are self-contained instruction sets that teach Claude Code how to perform specialized tasks. Each skill is defined in a `SKILL.md` file with optional supporting resources like scripts, templates, and reference documentation.

## Repository Structure

```
bmad-skills/
├── skills/                  # All skill implementations
│   └── [skill-name]/        # Individual skill folder
│       ├── SKILL.md         # Required - Main skill definition
│       ├── scripts/         # Optional - Supporting scripts
│       ├── references/      # Optional - Reference documentation
│       └── assets/          # Optional - Images, resources
├── template/                # Starter template for new skills
├── spec/                    # Skills specification documentation
├── CONTRIBUTING.md          # Contribution guidelines
└── README.md                # This file
```

## Using Skills

### Installing a Skill

To use a skill in Claude Code, add it to your project's `.claude/settings.json`:

```json
{
  "skills": [
    "github:bmad-labs/skills/skills/skill-name"
  ]
}
```

Or install from a local path during development:

```json
{
  "skills": [
    "/path/to/bmad-skills/skills/skill-name"
  ]
}
```

### Invoking a Skill

Once installed, you can invoke skills using the slash command format:

```
/skill-name [arguments]
```

Or simply describe what you need - Claude will automatically use relevant skills.

## Creating New Skills

1. Copy the `template/` folder to `skills/your-skill-name/`
2. Edit `SKILL.md` with your skill definition
3. Add any supporting scripts or references
4. Test the skill locally
5. Submit a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Skill Categories

| Category | Description |
|----------|-------------|
| Development | Coding, architecture, testing, DevOps |
| Productivity | Documents, project management, workflows |
| Creative | Design, content creation, branding |
| Data | Processing, analysis, visualization |

## Available Skills

| Skill | Description | Category |
|-------|-------------|----------|
| [skill-creator](skills/skill-creator) | Guide for creating effective skills that extend Claude's capabilities | Development |
| [mcp-builder](skills/mcp-builder) | Guide for creating high-quality MCP servers for LLM integrations | Development |

## License

MIT License - See individual skills for specific licensing.
