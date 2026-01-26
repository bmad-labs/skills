#!/usr/bin/env python3
"""
Merge all chapter files from The Clean Coder into a single 
high-quality Markdown book with an auto-generated Table of Contents.
"""

import re
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
CODER_DIR = BASE_DIR / "clean-coder"
OUTPUT_FILE = BASE_DIR.parent / "clean-coder-book.md"

# Chapter order for The Clean Coder
CODER_ORDER = [
    "coder-front-matter.md",
    "coder-foreword.md",
    "coder-introduction.md",
    "coder-chapter-01-professionalism.md",
    "coder-chapter-02-saying-no.md",
    "coder-chapter-03-saying-yes.md",
    "coder-chapter-04-coding.md",
    "coder-chapter-05-tdd.md",
    "coder-chapter-06-practicing.md",
    "coder-chapter-07-acceptance-testing.md",
    "coder-chapter-08-testing-strategies.md",
    "coder-chapter-09-time-management.md",
    "coder-chapter-10-estimation.md",
    "coder-chapter-11-pressure.md",
    "coder-chapter-12-collaboration.md",
    "coder-chapter-13-teams-and-projects.md",
    "coder-chapter-14-mentoring.md",
    "coder-appendix-a-tooling.md",
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
        "# The Clean Coder",
        "",
        "**A Code of Conduct for Professional Programmers**",
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
    print("Merging The Clean Coder Book")
    print("=" * 60)
    
    # Process the book
    content, headers = process_book(CODER_DIR, CODER_ORDER)
    
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
    print(f"Chapters processed: {len(CODER_ORDER)}")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"File size: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")
    print(f"Total lines: {len(final_markdown.splitlines()):,}")

if __name__ == "__main__":
    main()
