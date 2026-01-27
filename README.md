# BMAD Skills Marketplace

A collection of skills for Claude Code that extend its capabilities with specialized knowledge and workflows.

## What are Skills?

Skills are self-contained instruction sets that teach Claude Code how to perform specialized tasks. Each skill is defined in a `SKILL.md` file with optional supporting resources like scripts, templates, and reference documentation.

## Repository Structure

```
<root>/
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

### Method 1: Install via add-skill CLI (Recommended)

The easiest way to install skills using the [`add-skill`](https://www.npmjs.com/package/add-skill) package. Supports Claude Code, Cursor, Codex, OpenCode, and [20+ other agents](https://www.npmjs.com/package/add-skill#available-agents).

```bash
# List available skills
npx add-skill bmad-labs/skills --list

# Install all skills
npx add-skill bmad-labs/skills

# Install common skills for TypeScript development
npx add-skill bmad-labs/skills --skill typescript-clean-code --skill typescript-e2e-testing --skill typescript-unit-testing

# Install to specific agent (e.g., claude-code, cursor, codex)
npx add-skill bmad-labs/skills -a claude-code

# Install globally (user-level, available in all projects)
npx add-skill bmad-labs/skills -g
```

### Method 2: Install via Plugin Marketplace

This method installs the entire plugin with all skills automatically detected.

**Step 1: Add the marketplace**
```bash
/plugin marketplace add bmad-labs/skills
```

**Step 2: Install the plugin**
```bash
/plugin install bmad-labs@skills
```

**Step 3: Verify installation**
```bash
# Open the plugin manager to see installed plugins
/plugin

# Or ask Claude: "What skills are available?"
```

### Method 3: Install via settings.json

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "bmad-labs": {
      "source": {
        "source": "github",
        "repo": "bmad-labs/skills"
      }
    }
  },
  "enabledPlugins": {
    "bmad-labs@skills": true
  }
}
```

### Method 4: Install Individual Skills

If you only need specific skills, add them individually to your project's `.claude/settings.json`:

```json
{
  "skills": [
    "github:bmad-labs/skills/skills/clean-code",
    "github:bmad-labs/skills/skills/typescript-e2e-testing",
    "github:bmad-labs/skills/skills/typescript-unit-testing"
  ]
}
```

**Available skill paths:**
- `github:bmad-labs/skills/skills/mcp-builder`
- `github:bmad-labs/skills/skills/typescript-e2e-testing`
- `github:bmad-labs/skills/skills/typescript-unit-testing`
- `github:bmad-labs/skills/skills/skill-creator`
- `github:bmad-labs/skills/skills/typescript-clean-code`
- `github:bmad-labs/skills/skills/book-converter`
- `github:bmad-labs/skills/skills/skill-from-book`

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
| [skill-creator](skills/skill-creator) | Guide for creating effective Claude Code skills | Development |
| [typescript-clean-code](skills/typescript-clean-code) | Clean Code principles and workflows for TypeScript development | Development |
| [book-converter](skills/book-converter) | Convert EPUB books to formatted Markdown | Productivity |
| [skill-from-book](skills/skill-from-book) | Convert book content into structured Claude Code skills | Development |

## License

MIT License - See individual skills for specific licensing.
