#!/usr/bin/env python3
"""
Merge all chapter files from the Clean Code book into a single markdown file
with an auto-generated Table of Contents.

Usage:
    python merge_book.py [--input-dir DIR] [--output FILE] [--no-toc]

Default output: clean-code-complete.md
"""

import re
import argparse
from pathlib import Path

# Define the chapter order based on CHAPTER_FORMATTING_WORKFLOW.md
CHAPTER_ORDER = [
    # Book 1: Clean Code
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
    # Chapter 14 may be split into parts
    "chapter-14-successive-refinement.md",
    "chapter-14-successive-refinement-part-1.md",
    "chapter-14-successive-refinement-part-2.md",
    "chapter-15-junit-internals.md",
    "chapter-16-refactoring-serialdate.md",
    "chapter-17-smells-and-heuristics.md",
    "appendix-a-concurrency-ii.md",
    "appendix-b-serialdate.md",
]


def extract_headers(content: str) -> list[tuple[int, str, str]]:
    """
    Extract headers from markdown content.
    Returns list of (level, title, anchor) tuples.
    """
    headers = []
    for line in content.split('\n'):
        match = re.match(r'^(#{1,3})\s+(.+)$', line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            # Generate anchor (lowercase, spaces to hyphens, remove special chars)
            anchor = re.sub(r'[^\w\s-]', '', title.lower())
            anchor = re.sub(r'\s+', '-', anchor)
            headers.append((level, title, anchor))
    return headers


def generate_toc(all_headers: list[tuple[str, list[tuple[int, str, str]]]]) -> str:
    """
    Generate Table of Contents from all headers.
    all_headers is a list of (filename, headers) tuples.
    """
    toc_lines = [
        "# Clean Code: A Handbook of Agile Software Craftsmanship",
        "",
        "## Table of Contents",
        "",
    ]
    
    for filename, headers in all_headers:
        for level, title, anchor in headers:
            # Only include H1 and H2 in TOC for readability
            if level <= 2:
                indent = "  " * (level - 1)
                toc_lines.append(f"{indent}- [{title}](#{anchor})")
    
    toc_lines.append("")
    toc_lines.append("---")
    toc_lines.append("")
    
    return '\n'.join(toc_lines)


def merge_files(input_dir: Path, output_file: Path, include_toc: bool = True) -> None:
    """
    Merge all chapter files into a single markdown file.
    """
    all_content = []
    all_headers = []
    files_processed = []
    files_missing = []
    
    # Track which base chapters have been processed (for handling split files)
    processed_bases = set()
    
    # Process files in order
    for filename in CHAPTER_ORDER:
        filepath = input_dir / filename
        
        # Determine base name for split file tracking
        base_name = filename.replace("-part-1.md", ".md").replace("-part-2.md", ".md")
        
        if filepath.exists():
            # Skip if we already processed the non-split version
            if "-part-" in filename and base_name in processed_bases:
                continue
            # Skip split parts if the combined file exists
            if "-part-" not in filename:
                processed_bases.add(filename)
            
            print(f"  [+] Processing: {filename}")
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract headers for TOC
            headers = extract_headers(content)
            all_headers.append((filename, headers))
            
            # Add content with separator
            all_content.append(content.strip())
            all_content.append("\n\n---\n\n")
            
            files_processed.append(filename)
        else:
            # Only report missing if it's not an optional split variant
            if "-part-" in filename:
                # Skip - it's optional
                continue
            elif (input_dir / filename.replace(".md", "-part-1.md")).exists():
                # The split version exists, so the combined is not needed
                continue
            else:
                files_missing.append(filename)
    
    # Generate TOC
    if include_toc:
        toc = generate_toc(all_headers)
    else:
        toc = ""
    
    # Combine everything
    final_content = toc + '\n'.join(all_content)
    
    # Write output file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(final_content)
    
    # Summary
    print(f"\n{'='*50}")
    print(f"Merge Complete!")
    print(f"{'='*50}")
    print(f"Files processed: {len(files_processed)}")
    print(f"Output file: {output_file}")
    print(f"Output size: {output_file.stat().st_size / 1024:.1f} KB")
    
    if files_missing:
        print(f"\nWarning: Missing files:")
        for f in files_missing:
            print(f"  [-] {f}")


def main():
    parser = argparse.ArgumentParser(
        description="Merge Clean Code chapter files into a single markdown file."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path(__file__).parent / "clean-code",
        help="Input directory containing chapter files (default: ./clean-code)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "clean-code-complete.md",
        help="Output file path (default: ./clean-code-complete.md)"
    )
    parser.add_argument(
        "--no-toc",
        action="store_true",
        help="Skip generating Table of Contents"
    )
    
    args = parser.parse_args()
    
    # Validate input directory
    if not args.input_dir.exists():
        print(f"Error: Input directory not found: {args.input_dir}")
        return 1
    
    print(f"Merging Clean Code book...")
    print(f"Input directory: {args.input_dir}")
    print(f"Output file: {args.output}")
    print()
    
    merge_files(args.input_dir, args.output, include_toc=not args.no_toc)
    
    return 0


if __name__ == "__main__":
    exit(main())
