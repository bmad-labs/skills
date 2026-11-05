"""Validate SKILL.md frontmatter for the given skill directories.

Usage: python check_skill_frontmatter.py skills/<name> [skills/<name> ...]
Exits 1 when any skill breaks a rule; prints GitHub Actions error annotations.
"""

import re
import sys
from pathlib import Path

import yaml

MAX_DESCRIPTION = 1024
NAME_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def check(skill_dir: Path) -> list[str]:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return ["SKILL.md is missing"]

    text = skill_md.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        return ["SKILL.md has no YAML frontmatter"]

    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as error:
        return [f"frontmatter is not valid YAML: {error}"]

    errors = []
    name = meta.get("name")
    description = meta.get("description")
    if name != skill_dir.name:
        errors.append(f"name '{name}' does not match directory '{skill_dir.name}'")
    if not isinstance(name, str) or not NAME_PATTERN.match(name):
        errors.append("name must be lowercase letters, digits and hyphens")
    if not isinstance(description, str) or not description.strip():
        errors.append("description is missing")
    elif len(description) > MAX_DESCRIPTION:
        errors.append(f"description is {len(description)} characters (limit {MAX_DESCRIPTION})")
    if "allowed-tools" in meta and not isinstance(meta["allowed-tools"], str):
        errors.append("allowed-tools must be a comma-separated string")
    return errors


def main() -> int:
    failed = False
    for arg in sys.argv[1:]:
        skill_dir = Path(arg)
        if not skill_dir.exists():
            print(f"{skill_dir}: removed, skipped")
            continue
        errors = check(skill_dir)
        for error in errors:
            print(f"::error file={skill_dir}/SKILL.md::{error}")
        print(f"{skill_dir}: {'FAIL' if errors else 'ok'}")
        failed = failed or bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
