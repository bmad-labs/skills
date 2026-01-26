#!/usr/bin/env python3
"""
Merge all chapter files from Clean Code into a single 
high-quality Markdown book with an auto-generated Table of Contents.
"""

import re
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
CLEAN_CODE_DIR = BASE_DIR / "clean-code"
OUTPUT_FILE = BASE_DIR.parent / "clean-code-book.md"

# Chapter order for Clean Code
CLEAN_CODE_ORDER = [
    "front-matter.md",
    "foreword.md",
    "introduction.md",
    "chapter-01-clean-code.md",
    "chapter-02-meaningful-names.md",
    "chapter-03-functions.md",
    "chapter-04-comments.md",
    "chapter-05-formatting.md",
    "chapter-06-objects-and-data-structures.md",
    "chapter-07-error-handling.md",
    "chapter-08-boundaries.md",
    "chapter-09-unit-tests.md",
    "chapter-10-classes.md",
    "chapter-11-systems.md",
    "chapter-12-emergence.md",
    "chapter-13-concurrency.md",
    "chapter-14-successive-refinement-part-1.md",
    "chapter-14-successive-refinement-part-2.md",
    "chapter-15-junit-internals.md",
    "chapter-16-refactoring-serialdate.md",
    "chapter-17-smells-and-heuristics.md",
    "appendix-a-concurrency-ii.md",
    "appendix-b-serialdate.md",
]

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

def fix_image_paths(content: str) -> str:
    """
    Fix image paths to be relative to books/ directory.
    Changes: clean-code-md-images/... -> clean-code/clean-code-md-images/...
    """
    # Pattern to match markdown image syntax
    pattern = r'!\[(.*?)\]\(clean-code-md-images/(.*?)\)'
    replacement = r'![\1](clean-code/clean-code-md-images/\2)'
    return re.sub(pattern, replacement, content)

def process_book(book_dir: Path, order: list[str]) -> tuple[str, list[tuple[int, str, str]]]:
    """Process all chapter files and return combined content and headers."""
    book_content = []
    book_headers = []
    
    print(f"\nProcessing chapters from: {book_dir}")
    
    for filename in order:
        filepath = book_dir / filename
        if not filepath.exists():
            print(f"  [-] Warning: {filename} missing")
            continue
            
        print(f"  [+] Processing: {filename}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        # Fix image paths
        content = fix_image_paths(content)
        
        # Extract headers
        book_headers.extend(extract_headers(content))
        
        # Add content with separator
        book_content.append(content)
        book_content.append("\n\n---\n\n")
        
    return '\n'.join(book_content), book_headers

def generate_toc(headers: list[tuple[int, str, str]]) -> str:
    """Generate Table of Contents from headers."""
    toc = [
        "# Clean Code",
        "",
        "**A Handbook of Agile Software Craftsmanship**",
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

def main():
    print("=" * 60)
    print("Merging Clean Code Book")
    print("=" * 60)
    
    # Process the book
    content, headers = process_book(CLEAN_CODE_DIR, CLEAN_CODE_ORDER)
    
    # Generate TOC
    toc = generate_toc(headers)
    
    # Combine TOC and content
    final_markdown = toc + content
    
    # Remove final separator
    if final_markdown.endswith("\n\n---\n\n"):
        final_markdown = final_markdown[:-7]
    
    # Write output file
    print(f"\nWriting output to: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(final_markdown)
    
    # Summary
    print("\n" + "=" * 60)
    print("Merge Complete!")
    print("=" * 60)
    print(f"Chapters processed: {len(CLEAN_CODE_ORDER)}")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"File size: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")
    print(f"Total lines: {len(final_markdown.splitlines()):,}")

if __name__ == "__main__":
    main()
