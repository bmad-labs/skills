#!/usr/bin/env python3
"""
Book Merger - Phase 4: Assembly

Merges all formatted chapters into a single book with Table of Contents.
This is a reusable template that works with any book project.

Usage:
    python3 merge_book.py <project-directory>
    
Example:
    python3 merge_book.py books/effective-java
"""

import sys
import re
from pathlib import Path

def extract_headers(content: str) -> list[tuple[int, str, str]]:
    """Extract headers from markdown content for TOC generation."""
    headers = []
    for line in content.split('\n'):
        # Match H1, H2, H3
        match = re.match(r'^(#{1,3})\s+(.+)$', line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            # Handle potential internal anchors in titles or emphasis
            clean_title = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', title)
            clean_title = clean_title.replace('*', '').replace('`', '')
            
            # Generate anchor consistent with common markdown renderers
            anchor = re.sub(r'[^\w\s-]', '', clean_title.lower())
            anchor = re.sub(r'\s+', '-', anchor)
            headers.append((level, clean_title, anchor))
    return headers

def fix_image_paths(content: str, images_subdir: str = 'images') -> str:
    """
    Fix image paths to be relative to final book location.
    Changes: images/... -> book-name/images/...
    """
    # Pattern to match markdown image syntax
    pattern = r'!\[(.*?)\]\((?!http)([^)]+)\)'
    
    def replace_path(match):
        alt_text = match.group(1)
        img_path = match.group(2)
        
        # If path doesn't start with book directory, add it
        if not img_path.startswith(images_subdir + '/'):
            # Remove leading ./ or ../ if present
            img_path = re.sub(r'^\.\.?/', '', img_path)
            # Add book directory prefix
            if not img_path.startswith(images_subdir):
                img_path = f"{images_subdir}/{img_path}"
        
        return f'![{alt_text}]({img_path})'
    
    return re.sub(pattern, replace_path, content)

def load_chapter_map(project_dir: Path) -> list[dict]:
    """Load chapter order from CHAPTER_MAP.md."""
    chapter_map_file = project_dir / "CHAPTER_MAP.md"
    
    if not chapter_map_file.exists():
        print(f"✗ Error: CHAPTER_MAP.md not found in {project_dir}")
        print("  Run Phase 2 analysis first to create chapter map.")
        sys.exit(1)
    
    chapters = []
    with open(chapter_map_file, 'r', encoding='utf-8') as f:
        for line in f:
            # Parse table rows: | Chapter Title | filename.md | start | end |
            if line.strip().startswith('|') and not line.strip().startswith('|---'):
                parts = [p.strip() for p in line.split('|')[1:-1]]
                if len(parts) >= 2 and parts[1].endswith('.md'):
                    chapters.append({
                        'title': parts[0],
                        'filename': parts[1]
                    })
    
    if not chapters:
        print(f"✗ Error: No chapters found in CHAPTER_MAP.md")
        sys.exit(1)
    
    return chapters

def process_book(project_dir: Path, chapter_order: list[dict]) -> tuple[str, list[tuple[int, str, str]]]:
    """Process all chapter files and return combined content and headers."""
    chapters_dir = project_dir / "chapters"
    book_content = []
    book_headers = []
    
    print(f"\nProcessing chapters from: {chapters_dir}")
    
    for chapter_info in chapter_order:
        filename = chapter_info['filename']
        filepath = chapters_dir / filename
        
        if not filepath.exists():
            print(f"  [-] Warning: {filename} missing")
            continue
            
        print(f"  [+] Processing: {filename}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        # Fix image paths (use project directory name)
        project_name = project_dir.name
        content = fix_image_paths(content, f"{project_name}/images")
        
        # Extract headers
        book_headers.extend(extract_headers(content))
        
        # Add content with separator
        book_content.append(content)
        book_content.append("\n\n---\n\n")
        
    return '\n'.join(book_content), book_headers

def generate_toc(headers: list[tuple[int, str, str]], book_title: str) -> str:
    """Generate Table of Contents from headers."""
    toc = [
        f"# {book_title}",
        "",
        "## Table of Contents",
        "",
    ]
    
    for level, title, anchor in headers:
        if level == 1:
            toc.append(f"- [{title}](#{anchor})")
        elif level == 2:
            toc.append(f"  - [{title}](#{anchor})")
            
    toc.append("\n---\n\n")
    
    return '\n'.join(toc)

def detect_book_title(project_dir: Path) -> str:
    """Detect book title from project directory or first chapter."""
    # Try to get from directory name
    book_title = project_dir.name.replace('-', ' ').title()
    
    # Try to get from first chapter
    chapters_dir = project_dir / "chapters"
    chapter_files = sorted(chapters_dir.glob("*.md"))
    
    if chapter_files:
        with open(chapter_files[0], 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            # If first line is H1, use it
            if first_line.startswith('# '):
                book_title = first_line[2:].strip()
    
    return book_title

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 merge_book.py <project-directory>")
        print("\nExample:")
        print("  python3 merge_book.py books/effective-java")
        sys.exit(1)
    
    project_dir = Path(sys.argv[1])
    
    # Verify project directory
    if not project_dir.exists():
        print(f"✗ Error: Project directory not found: {project_dir}")
        sys.exit(1)
    
    chapters_dir = project_dir / "chapters"
    if not chapters_dir.exists():
        print(f"✗ Error: Chapters directory not found: {chapters_dir}")
        print("  Run Phase 3 formatting first.")
        sys.exit(1)
    
    print("=" * 60)
    print("Book Merger - Phase 4: Assembly")
    print("=" * 60)
    print(f"\nProject: {project_dir.name}")
    
    # Load chapter order
    print("\n1. Loading chapter map...")
    chapter_order = load_chapter_map(project_dir)
    print(f"   Found {len(chapter_order)} chapters")
    
    # Detect book title
    book_title = detect_book_title(project_dir)
    print(f"   Book title: {book_title}")
    
    # Process chapters
    print("\n2. Processing chapters...")
    content, headers = process_book(project_dir, chapter_order)
    
    # Generate TOC
    print("\n3. Generating Table of Contents...")
    toc = generate_toc(headers, book_title)
    print(f"   Generated {len(headers)} header entries")
    
    # Combine TOC and content
    final_markdown = toc + content
    
    # Remove final separator
    if final_markdown.endswith("\n\n---\n\n"):
        final_markdown = final_markdown[:-7]
    
    # Determine output filename
    output_file = project_dir.parent / f"{project_dir.name}-book.md"
    
    # Write output file
    print(f"\n4. Writing final book...")
    print(f"   Output: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(final_markdown)
    
    # Summary
    print("\n" + "=" * 60)
    print("Merge Complete!")
    print("=" * 60)
    print(f"Chapters merged: {len(chapter_order)}")
    print(f"Output file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024:.1f} KB")
    print(f"Total lines: {len(final_markdown.splitlines()):,}")
    print("\n✓ Book assembly complete!")

if __name__ == "__main__":
    main()
