#!/usr/bin/env python3
"""
Book Converter - Phase 1: Setup and Extraction

Converts EPUB books to Markdown using pandoc and sets up project structure.

Usage:
    python3 convert_book.py "/path/to/book.epub" [--out DIR]

The project is created under --out (default: ./books in the current working
directory), never inside the skill's install directory.
"""

import argparse
import sys
import subprocess
import shutil
from pathlib import Path
import re

PANDOC_HINT = """✗ Error: pandoc not found on PATH. Install it, then re-run:
  macOS:   brew install pandoc
  Linux:   sudo apt install pandoc   (or dnf/pacman install pandoc)
  Windows: winget install --id JohnMacFarlane.Pandoc   (or choco install pandoc)
  Other:   https://pandoc.org/installing.html"""

def sanitize_name(name: str) -> str:
    """Convert book name to valid directory name."""
    # Remove file extension
    name = Path(name).stem
    # Convert to lowercase
    name = name.lower()
    # Treat dots and underscores as word separators (Effective.Java.epub)
    name = re.sub(r'[._]', ' ', name)
    # Replace spaces and special chars with hyphens
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[-\s]+', '-', name)
    return name.strip('-')

def setup_project_structure(epub_path: Path, base_dir: Path) -> dict:
    """Create project directory structure."""
    book_name = sanitize_name(epub_path.name)
    
    project_dir = base_dir / book_name
    raw_dir = project_dir / "raw"
    chapters_dir = project_dir / "chapters"
    images_dir = project_dir / "images"
    references_dir = project_dir / "references"
    
    # Create directories
    for directory in [project_dir, raw_dir, chapters_dir, images_dir, references_dir]:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"✓ Created: {directory}")
    
    return {
        'project_dir': project_dir,
        'raw_dir': raw_dir,
        'chapters_dir': chapters_dir,
        'images_dir': images_dir,
        'references_dir': references_dir,
        'book_name': book_name
    }

def extract_epub_with_pandoc(epub_path: Path, output_dir: Path) -> Path:
    """Use pandoc to convert EPUB to Markdown."""
    output_file = output_dir / "book-parsed.md"
    
    print(f"\nExtracting EPUB with pandoc...")
    print(f"  Input: {epub_path}")
    print(f"  Output: {output_file}")
    
    try:
        # Run pandoc
        cmd = [
            'pandoc',
            str(epub_path),
            '-f', 'epub',
            '-t', 'markdown',
            '--extract-media', str(output_dir.parent / 'images'),
            '-o', str(output_file),
            '--wrap=none'  # Don't wrap lines
        ]
        
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"✓ Pandoc conversion complete")
        
        # Count lines
        with open(output_file, 'r', encoding='utf-8') as f:
            line_count = sum(1 for _ in f)
        print(f"  Generated: {line_count:,} lines")
        
        return output_file
        
    except subprocess.CalledProcessError as e:
        print(f"✗ Pandoc error: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print(PANDOC_HINT)
        sys.exit(1)

def copy_formatting_standards(project_dir: Path, skill_dir: Path):
    """Copy formatting standards and templates to the project for subagents."""
    # Reference files
    standards_src = skill_dir / "references" / "formatting-standards.md"
    workflow_src = skill_dir / "references" / "chapter-workflow.md"
    progress_template_src = skill_dir / "references" / "progress-template.md"
    chapter_map_template_src = skill_dir / "references" / "chapter-map-template.md"
    formatting_plan_template_src = skill_dir / "references" / "formatting-plan-template.md"
    
    references_dir = project_dir / "references"
    
    # Copy reference files
    if standards_src.exists():
        shutil.copy(standards_src, references_dir / "formatting-standards.md")
        print(f"✓ Copied: formatting-standards.md")
    
    if workflow_src.exists():
        shutil.copy(workflow_src, references_dir / "chapter-workflow.md")
        print(f"✓ Copied: chapter-workflow.md")
    
    if progress_template_src.exists():
        shutil.copy(progress_template_src, references_dir / "progress-template.md")
        print(f"✓ Copied: progress-template.md")
    
    if chapter_map_template_src.exists():
        shutil.copy(chapter_map_template_src, references_dir / "chapter-map-template.md")
        print(f"✓ Copied: chapter-map-template.md")
    
    if formatting_plan_template_src.exists():
        shutil.copy(formatting_plan_template_src, references_dir / "formatting-plan-template.md")
        print(f"✓ Copied: formatting-plan-template.md")


def create_progress_file(project_dir: Path, book_name: str, raw_file: Path):
    """Create initial progress tracking file from template."""
    progress_file = project_dir / "progress.md"
    template_file = project_dir / "references" / "progress-template.md"
    
    # Read template
    if template_file.exists():
        template = template_file.read_text()
    else:
        # Fallback if template not found
        template = """# {BOOK_NAME} - Conversion Progress

## Overview

- **Source**: {SOURCE_FILE}
- **Started**: {DATE}

---

## Phase 1: Setup ✓
- [x] EPUB extracted with pandoc
- [x] Project structure created
- [x] Formatting standards copied

## Phase 2: Planning
- [ ] Book structure analyzed
- [ ] Chapter map created
- [ ] Formatting plan documented

## Phase 3: Chapter Formatting
- [ ] Chapters identified
- [ ] Formatting in progress...

## Phase 4: Assembly
- [ ] merge_book.py run
- [ ] Final book generated

---

## Next Steps

1. Launch subagent to analyze structure and create CHAPTER_MAP.md
2. Launch subagents to format each chapter
3. Run merge_book.py to generate the final book
"""
    
    # Get line count
    with open(raw_file, 'r', encoding='utf-8') as f:
        line_count = sum(1 for _ in f)
    
    # Replace placeholders
    content = template.replace('{BOOK_NAME}', book_name.replace('-', ' ').title())
    content = content.replace('{SOURCE_FILE}', raw_file.name)
    content = content.replace('{DATE}', subprocess.run(['date', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip())
    content = content.replace('{LINE_COUNT}', f"{line_count:,}")
    content = content.replace('{STATUS}', "Pending")
    content = content.replace('{CHAPTER_COUNT}', "TBD (will be determined in Phase 2)")
    content = content.replace('{COMPLETED_COUNT}', "0")
    content = content.replace('{TOTAL_COUNT}', "TBD")
    
    progress_file.write_text(content)
    print(f"✓ Created: progress.md ({line_count:,} lines in source)")

def main():
    parser = argparse.ArgumentParser(
        description="Phase 1 of book-converter: extract an EPUB to Markdown with pandoc "
                    "and set up the book project directory.")
    parser.add_argument("epub", type=Path, help="path to the .epub file")
    parser.add_argument("--out", type=Path, default=Path.cwd() / "books",
                        help="directory that will hold the book project (default: ./books)")
    args = parser.parse_args()

    epub_path = args.epub

    # Verify input
    if not epub_path.exists():
        print(f"✗ Error: File not found: {epub_path}")
        sys.exit(1)

    if epub_path.suffix.lower() != '.epub':
        print(f"✗ Error: Not an EPUB file: {epub_path}")
        sys.exit(1)

    if shutil.which('pandoc') is None:
        print(PANDOC_HINT)
        sys.exit(1)

    print("=" * 60)
    print("Book Converter - Phase 1: Setup and Extraction")
    print("=" * 60)
    print(f"\nInput: {epub_path.name}")

    skill_dir = Path(__file__).resolve().parent.parent
    base_dir = args.out.resolve()
    base_dir.mkdir(parents=True, exist_ok=True)

    # Setup project
    print("\n1. Setting up project structure...")
    dirs = setup_project_structure(epub_path, base_dir)

    # Extract with pandoc
    print("\n2. Extracting EPUB with pandoc...")
    parsed_file = extract_epub_with_pandoc(epub_path, dirs['raw_dir'])

    # Copy standards
    print("\n3. Copying formatting standards...")
    copy_formatting_standards(dirs['project_dir'], skill_dir)

    # Create progress file
    print("\n4. Creating progress tracker...")
    create_progress_file(dirs['project_dir'], dirs['book_name'], parsed_file)

    project = dirs['project_dir']
    print("\n" + "=" * 60)
    print("Phase 1 Complete!")
    print("=" * 60)
    print(f"\nProject directory: {project}")
    print(f"Raw markdown: {parsed_file}")

    print("\n" + "=" * 60)
    print("Next Steps:")
    print("=" * 60)
    print("\n1. Run structure analysis script:")
    print(f'\npython3 "{skill_dir / "scripts" / "analyze_structure.py"}" "{project}"\n')
    print("2. Then spawn a general-purpose subagent with this prompt:")
    print(f"""
Create CHAPTER_MAP.md and FORMATTING_PLAN.md:

1. Read {project}/STRUCTURE_ANALYSIS.md (generated by script)
2. Read {project}/references/chapter-map-template.md for format
3. Read {project}/references/formatting-plan-template.md for format
4. Create {project}/CHAPTER_MAP.md based on structure analysis
5. Create {project}/FORMATTING_PLAN.md based on issues found
6. Update {project}/progress.md to mark Phase 2 complete

Return: Summary of chapters found and major issues identified.
""")

if __name__ == "__main__":
    main()
