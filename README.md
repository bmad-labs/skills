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

## Installation

### Method 1: Install via Plugin Marketplace (Recommended)

This method installs the entire plugin with all skills automatically detected.

**Step 1: Add the marketplace**
```bash
/plugin marketplace add thuantan2060/bmad-skills
```

**Step 2: Install the plugin**
```bash
/plugin install bmad-skills@bmad-skills
```

**Step 3: Verify installation**
```bash
# Open the plugin manager to see installed plugins
/plugin

# Or ask Claude: "What skills are available?"
```

### Method 2: Install via settings.json

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "bmad-skills": {
      "source": {
        "source": "github",
        "repo": "thuantan2060/bmad-skills"
      }
    }
  },
  "enabledPlugins": {
    "bmad-skills@bmad-skills": true
  }
}
```

### Method 3: Install Individual Skills (Manual)

Add individual skills to your project's `.claude/settings.json`:

```json
{
  "skills": [
    "github:thuantan2060/bmad-skills/skills/mcp-builder",
    "github:thuantan2060/bmad-skills/skills/typescript-e2e-testing",
    "github:thuantan2060/bmad-skills/skills/typescript-unit-testing"
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

### Troubleshooting

If skills are not detected after installation:

1. **Clear the plugin cache:**
   ```bash
   rm -rf ~/.claude/plugins/cache
   ```

2. **Restart Claude Code** (exit and run `claude` again)

3. **Verify skills are loaded:**
   - Ask Claude: "What skills are available?"
   - Or run `/plugin` and check the **Errors** tab

4. **Check plugin structure:**
   ```bash
   claude plugin validate .
   ```

## Using Skills

### Invoking a Skill

Once installed, you can invoke skills using the slash command format:

```
/skill-name [arguments]
```

Or simply describe what you need - Claude will automatically use relevant skills based on their descriptions.

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
| [mcp-builder](skills/mcp-builder) | Guide for creating high-quality MCP servers for LLM integrations | Development |
| [typescript-e2e-testing](skills/typescript-e2e-testing) | Comprehensive E2E testing for TypeScript/NestJS with Kafka, PostgreSQL, MongoDB, Redis | Development |
| [typescript-unit-testing](skills/typescript-unit-testing) | Unit testing for TypeScript/NestJS with Jest, DeepMocked, mongodb-memory-server, pg-mem, Kafka, Redis | Development |

## License

MIT License - See individual skills for specific licensing.
