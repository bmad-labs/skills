#!/usr/bin/env python3
"""Parse BMAD artifacts into structured JSON for the github-sync agent.

This script reads BMAD story files, epics.md, and sprint-plan.md and outputs
structured JSON to stdout. It uses only Python stdlib -- no external dependencies.

Usage:
    python parse-artifacts.py --mode scan    --stories-dir DIR
    python parse-artifacts.py --mode epics   --file FILE
    python parse-artifacts.py --mode sprints --file FILE

Exit codes:
    0 = success (JSON written to stdout)
    1 = error (message written to stderr)
"""

import argparse
import glob
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Filename parsing
# ---------------------------------------------------------------------------

# Story files use two naming conventions:
#   "1-1-set-up-project-structure.md"  (dash separator: N-N-rest)
#   "4.1-stop-and-scan-capture-image.md" (dot separator: N.N-rest)
STORY_ID_RE = re.compile(r"^(\d+)[.\-](\d+)[.\-]")


def extract_story_id(filename: str) -> Optional[str]:
    """Extract story ID like '1.1' or '4.1' from a filename."""
    m = STORY_ID_RE.match(filename)
    if m:
        return f"{m.group(1)}.{m.group(2)}"
    return None


# ---------------------------------------------------------------------------
# Frontmatter parsing (regex-based, no pyyaml)
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> Dict[str, str]:
    """Extract YAML frontmatter as a flat key:value dict (simple values only)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    result = {}
    for line in m.group(1).splitlines():
        line = line.strip()
        if ":" in line and not line.startswith("#"):
            key, _, val = line.partition(":")
            result[key.strip()] = val.strip().strip("'\"")
    return result


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------

def read_file(path: str) -> str:
    """Read a file and return its contents, or raise a clear error."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"Error: file not found: {path}")
    except PermissionError:
        raise SystemExit(f"Error: permission denied: {path}")


def shorten_title(title: str, max_len: int = 50) -> str:
    """Truncate a title for use as a short label, keeping whole words."""
    if len(title) <= max_len:
        return title
    truncated = title[:max_len].rsplit(" ", 1)[0]
    return truncated.rstrip(" ,;:-")


# ---------------------------------------------------------------------------
# Mode: scan
# ---------------------------------------------------------------------------

def detect_synced(first_line: str) -> Tuple[bool, Optional[str]]:
    """Check if the H1 title is a markdown link (synced) or plain text.

    Synced:   # [Story 1.1: Title](https://github.com/...)
    Unsynced: # Story 1.1: Title
    """
    link_match = re.match(r"^#\s+\[(.+?)\]\((https?://\S+)\)", first_line)
    if link_match:
        return True, link_match.group(2)
    return False, None


def extract_status(text: str) -> str:
    """Extract the Status line value from a story file.

    Looks for 'Status: <value>' near the top of the file.
    """
    m = re.search(r"^Status:\s*(.+)$", text, re.MULTILINE)
    if m:
        return m.group(1).strip().lower()
    return "unknown"


def extract_title_from_h1(first_line: str) -> str:
    """Extract the full title from the H1 heading.

    Handles both linked and plain formats:
      # Story 1.1: Some Title...
      # [Story 1.1: Some Title...](url)
    Returns the part after 'Story N.N: ' if present, else the whole title.
    """
    # Strip markdown heading prefix
    title = re.sub(r"^#\s+", "", first_line).strip()
    # If it is a link, extract the link text
    link_match = re.match(r"\[(.+?)\]\(.+?\)", title)
    if link_match:
        title = link_match.group(1)
    # Strip 'Story N.N: ' prefix if present
    title = re.sub(r"^Story\s+\d+\.\d+:\s*", "", title)
    return title.strip()


def mode_scan(stories_dir: str) -> Dict[str, Any]:
    """Scan all .md files in the stories directory and return summary JSON."""
    if not os.path.isdir(stories_dir):
        raise SystemExit(f"Error: directory not found: {stories_dir}")

    pattern = os.path.join(stories_dir, "*.md")
    files = sorted(glob.glob(pattern))

    stories: List[Dict[str, Any]] = []
    for filepath in files:
        filename = os.path.basename(filepath)
        story_id = extract_story_id(filename)
        if story_id is None:
            # Skip files that don't match story naming pattern
            continue

        text = read_file(filepath)
        lines = text.splitlines()
        if not lines:
            continue

        first_line = lines[0]
        title = extract_title_from_h1(first_line)
        synced, gh_url = detect_synced(first_line)
        status = extract_status(text)

        stories.append({
            "id": story_id,
            "title": title,
            "short_title": shorten_title(title),
            "file": filepath,
            "status": status,
            "synced": synced,
            "gh_url": gh_url,
        })

    # Sort by story ID numerically (major, then minor)
    stories.sort(key=lambda s: [int(x) for x in s["id"].split(".")])

    synced_count = sum(1 for s in stories if s["synced"])
    return {
        "stories": stories,
        "summary": {
            "total": len(stories),
            "synced": synced_count,
            "unsynced": len(stories) - synced_count,
        },
    }


# ---------------------------------------------------------------------------
# Mode: epics
# ---------------------------------------------------------------------------
# (parse mode removed — the agent reads story files directly and decides
#  what content to include/exclude based on context)


# Pattern: "### Epic N: Name" or "### Story N.N: Name" inside epic sections
EPIC_HEADER_RE = re.compile(
    r"^###\s+Epic\s+(\d+):\s+(.+?)(?:\s*[-—]\s*(.+))?$"
)

# Pattern: "### Story N.N: Name" inside an epic section
EPIC_STORY_RE = re.compile(r"^###\s+Story\s+(\d+)\.(\d+):")

# Pattern for sprint info in epic description
EPIC_SPRINT_RE = re.compile(r"\*\*Sprint:\*\*\s*(\d+)")


def mode_epics(filepath: str) -> Dict[str, Any]:
    """Parse epics.md into structured JSON."""
    text = read_file(filepath)

    epics: List[Dict[str, Any]] = []

    # Split into H2 sections first
    h2_sections = re.split(r"^(?=## )", text, flags=re.MULTILINE)

    for section in h2_sections:
        # Look for epic H2 headers: "## Epic N: Name -- Subtitle"
        h2_match = re.match(
            r"^##\s+Epic\s+(\d+):\s+(.+?)(?:\s*[-—]\s*(.+))?\s*$",
            section,
            re.MULTILINE,
        )
        if not h2_match:
            continue

        epic_num = int(h2_match.group(1))
        epic_name = h2_match.group(2).strip()
        epic_subtitle = h2_match.group(3).strip() if h2_match.group(3) else None

        if epic_subtitle:
            full_name = f"{epic_name} -- {epic_subtitle}"
        else:
            full_name = epic_name

        # Find sprint number
        sprint_match = EPIC_SPRINT_RE.search(section)
        sprint = sprint_match.group(1) if sprint_match else ""

        # Find all story IDs in this epic section
        story_ids: List[str] = []
        for story_match in re.finditer(
            r"###\s+Story\s+(\d+)\.(\d+):", section
        ):
            sid = f"{story_match.group(1)}.{story_match.group(2)}"
            story_ids.append(sid)

        epics.append({
            "number": epic_num,
            "name": epic_name,
            "full_name": full_name,
            "sprint": sprint,
            "story_ids": story_ids,
        })

    # Sort by epic number
    epics.sort(key=lambda e: e["number"])

    return {"epics": epics}


# ---------------------------------------------------------------------------
# Mode: sprints
# ---------------------------------------------------------------------------

# Pattern for rows in the Story-to-Sprint Summary table:
# | 1.1 | Story Title | 1 | All |
SPRINT_TABLE_RE = re.compile(
    r"^\|\s*(\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|"
)

# Pattern for sprint rows in the Sprint Overview table:
# | **Sprint 1** | W1-W2 | Apr 1 (Wed) - Apr 10 (Fri) | 8 | PoC | Apr 10 | Epic 1 | 4 |
SPRINT_OVERVIEW_RE = re.compile(
    r"^\|\s*\*{0,2}Sprint\s+(\d+)\*{0,2}\s*\|"
    r"\s*\S+\s*\|"                           # weeks column
    r"\s*(.+?)\s*\|"                         # dates column
    r"\s*\*{0,2}(\d+)\*{0,2}.*?\|"          # working days
    r"\s*(\S+)\s*\|"                         # phase
    r"\s*(.+?)\s*\|"                         # demo date
    r"\s*(.+?)\s*\|"                         # epics
    r"\s*(.+?)\s*\|"                         # stories count
)

# Date extraction from sprint dates column: "Apr 1 (Wed) - Apr 10 (Fri)"
SPRINT_DATES_RE = re.compile(
    r"(\w+\s+\d+).*?[-–]\s*(\w+\s+\d+)"
)

# Month name to number
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_date_str(date_str: str, year: int = 2026) -> str:
    """Convert 'Apr 1' to '2026-04-01'."""
    parts = date_str.strip().split()
    if len(parts) != 2:
        return ""
    month_str = parts[0].lower()[:3]
    day = int(parts[1])
    month = MONTH_MAP.get(month_str, 0)
    if month == 0:
        return ""
    return f"{year}-{month:02d}-{day:02d}"


def parse_sprint_objective(section_text: str) -> str:
    """Extract the sprint objective from the **Objective:** line."""
    m = re.search(r"\*\*Objective:\*\*\s*(.+?)(?:\n|$)", section_text)
    if m:
        return m.group(1).strip()
    return ""


def mode_sprints(filepath: str) -> Dict[str, Any]:
    """Parse sprint-plan.md into structured JSON."""
    text = read_file(filepath)

    # --- Parse Story-to-Sprint Summary table ---
    story_sprint_map: Dict[str, int] = {}
    story_dev_map: Dict[str, str] = {}
    story_list_by_sprint: Dict[int, List[Dict[str, str]]] = {}

    # Find the Story-to-Sprint Summary section
    summary_match = re.search(
        r"## Story-to-Sprint Summary\s*\n(.*?)(?=\n##|\Z)",
        text,
        re.DOTALL,
    )
    if summary_match:
        for line in summary_match.group(1).splitlines():
            # Skip struck-through rows (superseded stories)
            if "~~" in line:
                continue
            m = SPRINT_TABLE_RE.match(line)
            if m:
                story_id = m.group(1)
                sprint_num = int(m.group(3))
                dev = m.group(4).strip()

                story_sprint_map[story_id] = sprint_num
                story_dev_map[story_id] = dev

                if sprint_num not in story_list_by_sprint:
                    story_list_by_sprint[sprint_num] = []
                story_list_by_sprint[sprint_num].append({
                    "id": story_id,
                    "dev": dev,
                })

    # --- Parse Sprint Overview for dates and metadata ---
    sprints: List[Dict[str, Any]] = []

    # Split file into sections by H3 headings for sprint details
    # (to extract objectives from sprint-specific sections)
    sprint_sections: Dict[int, str] = {}
    h3_splits = re.split(r"(?=^### Sprint \d+:)", text, flags=re.MULTILINE)
    for chunk in h3_splits:
        h3_match = re.match(r"^### Sprint (\d+):", chunk)
        if h3_match:
            sprint_sections[int(h3_match.group(1))] = chunk

    # Parse the overview table
    for line in text.splitlines():
        m = SPRINT_OVERVIEW_RE.match(line)
        if m:
            sprint_num = int(m.group(1))
            dates_col = m.group(2)
            working_days = int(m.group(3))
            phase = m.group(4).strip()
            demo_col = m.group(5).strip()

            # Parse start/end dates
            date_match = SPRINT_DATES_RE.search(dates_col)
            start_date = ""
            end_date = ""
            if date_match:
                start_date = parse_date_str(date_match.group(1))
                end_date = parse_date_str(date_match.group(2))

            # Parse demo date
            demo_date = parse_date_str(demo_col) if demo_col else ""

            # Get objective from detailed sprint section
            objective = ""
            if sprint_num in sprint_sections:
                objective = parse_sprint_objective(sprint_sections[sprint_num])

            stories = story_list_by_sprint.get(sprint_num, [])

            sprints.append({
                "number": sprint_num,
                "start": start_date,
                "end": end_date,
                "objective": objective,
                "demo_date": demo_date,
                "working_days": working_days,
                "stories": stories,
            })

    # Sort by sprint number
    sprints.sort(key=lambda s: s["number"])

    return {
        "sprints": sprints,
        "story_sprint_map": story_sprint_map,
        "story_dev_map": story_dev_map,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse BMAD artifacts into structured JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s --mode scan --stories-dir _bmad-output/implementation-artifacts\n"
            "  %(prog)s --mode epics --file _bmad-output/planning-artifacts/epics.md\n"
            "  %(prog)s --mode sprints --file _bmad-output/planning-artifacts/sprint-plan.md\n"
        ),
    )
    parser.add_argument(
        "--mode",
        required=True,
        choices=["scan", "epics", "sprints"],
        help="Operation mode: scan (list stories), epics (parse epics.md), sprints (parse sprint-plan.md)",
    )
    parser.add_argument(
        "--stories-dir",
        help="Directory containing story .md files (required for --mode scan)",
    )
    parser.add_argument(
        "--file",
        help="Path to a single file (required for --mode parse/epics/sprints)",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    # Validate arguments per mode
    if args.mode == "scan":
        if not args.stories_dir:
            parser.error("--stories-dir is required for --mode scan")
        result = mode_scan(args.stories_dir)

    elif args.mode == "epics":
        if not args.file:
            parser.error("--file is required for --mode epics")
        result = mode_epics(args.file)

    elif args.mode == "sprints":
        if not args.file:
            parser.error("--file is required for --mode sprints")
        result = mode_sprints(args.file)

    else:
        parser.error(f"Unknown mode: {args.mode}")

    # Output JSON to stdout
    json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
