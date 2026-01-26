#!/usr/bin/env python3
"""
Book Converter - Phase 1: Setup and Extraction

Converts EPUB books to Markdown using pandoc and sets up project structure.

Usage:
    python3 convert_book.py "/path/to/book.epub"
"""

import sys
import subprocess
import shutil
from pathlib import Path
import re

def sanitize_name(name: str) -> str:
    """Convert book name to valid directory name."""
    # Remove file extension
    name = Path(name).stem
    # Convert to lowercase
    name = name.lower()
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
        print("✗ Error: pandoc not found. Install with: brew install pandoc")
        sys.exit(1)

def copy_formatting_standards(project_dir: Path, skill_dir: Path):
    """Copy formatting standards, templates, and scripts to project."""
    # Reference files
    standards_src = skill_dir / "references" / "formatting-standards.md"
    workflow_src = skill_dir / "references" / "chapter-workflow.md"
    progress_template_src = skill_dir / "references" / "progress-template.md"
    chapter_map_template_src = skill_dir / "references" / "chapter-map-template.md"
    formatting_plan_template_src = skill_dir / "references" / "formatting-plan-template.md"
    
    # Script files
    merge_script_src = skill_dir / "scripts" / "merge_book.py"
    analyze_script_src = skill_dir / "scripts" / "analyze_structure.py"
    
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
    
    # Copy scripts to project root
    if merge_script_src.exists():
        shutil.copy(merge_script_src, project_dir / "merge_book.py")
        print(f"✓ Copied: merge_book.py")
    
    if analyze_script_src.exists():
        shutil.copy(analyze_script_src, project_dir / "analyze_structure.py")
        print(f"✓ Copied: analyze_structure.py")

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
- [ ] Merge script created
- [ ] Final book generated

---

## Next Steps

1. Launch subagent to analyze structure and create CHAPTER_MAP.md
2. Launch subagents to format each chapter
3. Create merge script and generate final book
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
    if len(sys.argv) != 2:
        print("Usage: python3 convert_book.py '/path/to/book.epub'")
        sys.exit(1)
    
    epub_path = Path(sys.argv[1])
    
    # Verify input
    if not epub_path.exists():
        print(f"✗ Error: File not found: {epub_path}")
        sys.exit(1)
    
    if epub_path.suffix.lower() != '.epub':
        print(f"✗ Error: Not an EPUB file: {epub_path}")
        sys.exit(1)
    
    print("=" * 60)
    print("Book Converter - Phase 1: Setup and Extraction")
    print("=" * 60)
    print(f"\nInput: {epub_path.name}")
    
    # Determine base directory (books/ in project root)
    skill_dir = Path(__file__).parent.parent
    base_dir = skill_dir.parent.parent / "books"
    base_dir.mkdir(exist_ok=True)
    
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
    
    # Summary
    print("\n" + "=" * 60)
    print("Phase 1 Complete!")
    print("=" * 60)
    print(f"\nProject directory: {dirs['project_dir']}")
    print(f"Raw markdown: {parsed_file}")
    print(f"Line count: {subprocess.run(['wc', '-l', str(parsed_file)], capture_output=True, text=True).stdout.strip().split()[0]}")
    
    print("\n" + "=" * 60)
    print("Next Steps:")
    print("=" * 60)
    print("\n1. Run structure analysis script:")
    print(f"""
python3 books/{dirs['book_name']}/analyze_structure.py books/{dirs['book_name']}
""")
    
    print("2. Then launch subagent to create mapping files:")
    print(f"""
Task(
  subagent_type="general",
  description="Create chapter map and formatting plan",
  prompt=\"\"\"Create CHAPTER_MAP.md and FORMATTING_PLAN.md:

1. Read books/{dirs['book_name']}/STRUCTURE_ANALYSIS.md (generated by script)
2. Read books/{dirs['book_name']}/references/chapter-map-template.md for format
3. Read books/{dirs['book_name']}/references/formatting-plan-template.md for format
4. Create books/{dirs['book_name']}/CHAPTER_MAP.md based on structure analysis
5. Create books/{dirs['book_name']}/FORMATTING_PLAN.md based on issues found
6. Update books/{dirs['book_name']}/progress.md to mark Phase 2 complete

Return: Summary of chapters found and major issues identified.\"\"\"
)
""")

if __name__ == "__main__":
    main()
