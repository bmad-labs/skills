# Contributing to BMAD Skills

Thank you for your interest in contributing to the BMAD Skills marketplace!

## Creating a New Skill

### Step 1: Plan Your Skill

Before creating a skill, consider:

- **Purpose**: What specific problem does this skill solve?
- **Audience**: Who will use this skill?
- **Scope**: Keep skills focused on a single domain or task
- **Value**: Does this add capabilities Claude doesn't already have?

### Step 2: Set Up Your Skill

1. Copy the template:
   ```bash
   cp -r template/ skills/your-skill-name/
   ```

2. Rename and edit `SKILL.md`:
   - Set a unique, descriptive `name` in the frontmatter
   - Write a clear `description` explaining when to use the skill
   - Add detailed instructions and examples

### Step 3: Structure Your Skill

```
your-skill-name/
├── SKILL.md           # Required - Main definition
├── scripts/           # Optional - Helper scripts
├── references/        # Optional - Reference docs
└── assets/            # Optional - Resources
```

### Step 4: Write the SKILL.md

#### Frontmatter (Required)

```yaml
---
name: your-skill-name
description: A complete description of what this skill does and when Claude should use it.
---
```

#### Content Guidelines

- **Be Specific**: Provide concrete instructions, not vague guidelines
- **Include Examples**: Show actual input/output scenarios
- **Stay Focused**: One skill = one domain or task
- **Keep It Concise**: Aim for under 500 lines
- **Reference Resources**: Link to scripts/docs instead of inlining large content

### Step 5: Test Your Skill

1. Install locally in Claude Code:
   ```json
   {
     "skills": ["/path/to/bmad-skills/skills/your-skill-name"]
   }
   ```

2. Test various scenarios:
   - Does Claude invoke the skill appropriately?
   - Are the instructions clear and actionable?
   - Do examples cover common use cases?

### Step 6: Submit Your Skill

1. Create a branch: `git checkout -b skill/your-skill-name`
2. Add your skill files
3. Update the README.md skills table
4. Submit a pull request

## Skill Quality Checklist

- [ ] `name` is lowercase, hyphenated, and unique
- [ ] `description` clearly explains purpose and use cases
- [ ] Instructions are specific and actionable
- [ ] Examples demonstrate real usage scenarios
- [ ] No sensitive data or credentials included
- [ ] Scripts are well-commented and functional
- [ ] Tested locally with Claude Code

## Code Style

### SKILL.md

- Use clear, imperative language
- Structure with headers and lists
- Include code blocks with language hints
- Keep paragraphs short

### Scripts

- Include shebang and encoding declarations
- Add docstrings/comments explaining purpose
- Handle errors gracefully
- Follow language conventions (PEP 8, etc.)

## Getting Help

- Open an issue for questions
- Tag maintainers for review
- Check existing skills for examples

## License

By contributing, you agree that your contributions will be licensed under the same license as this repository.
