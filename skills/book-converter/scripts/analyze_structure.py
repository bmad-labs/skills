#!/usr/bin/env python3
"""
Book Structure Analyzer - Phase 2 Helper

Extracts headers, code blocks, and structural information from raw markdown
to help subagents create CHAPTER_MAP.md and FORMATTING_PLAN.md efficiently.

Usage:
    python3 analyze_structure.py <project-directory>
    
Example:
    python3 analyze_structure.py books/effective-java
"""

import sys
import re
from pathlib import Path
from collections import defaultdict

def extract_headers(raw_file: Path) -> list[dict]:
    """Extract all headers with line numbers."""
    headers = []
    
    with open(raw_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            # Match markdown headers
            match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if match:
                level = len(match.group(1))
                title = match.group(2).strip()
                headers.append({
                    'line': line_num,
                    'level': level,
                    'title': title
                })
    
    return headers

def detect_issues(raw_file: Path, sample_size: int = 1000) -> dict:
    """Detect common formatting issues by sampling the file."""
    issues = defaultdict(int)
    in_code_block = False
    code_blocks = []
    current_code_block = None
    
    with open(raw_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            # Sample first N lines and every 100th line after that
            if line_num > sample_size and line_num % 100 != 0:
                continue
            
            # Track code blocks
            if line.strip().startswith('```'):
                if not in_code_block:
                    in_code_block = True
                    lang = line.strip()[3:].strip()
                    current_code_block = {
                        'line': line_num,
                        'language': lang if lang else 'none',
                        'lines': 1
                    }
                else:
                    in_code_block = False
                    if current_code_block:
                        current_code_block['lines'] = line_num - current_code_block['line']
                        code_blocks.append(current_code_block)
                    current_code_block = None
                continue
            
            if in_code_block:
                # Check for backslash continuations in code
                if line.rstrip().endswith('\\'):
                    issues['backslash_continuations'] += 1
                # Check for array bracket corruption
                if re.search(r'\w+\*\d+\*', line):
                    issues['array_bracket_corruption'] += 1
                continue
            
            # Not in code block - check text issues
            
            # Bold headers (likely should be # headers)
            if re.match(r'^\*\*[A-Z][^*]+\*\*$', line.strip()):
                issues['bold_headers'] += 1
            
            # Emphasis artifacts [word]
            if re.search(r'\[[a-z]+\]', line):
                issues['emphasis_artifacts'] += 1
            
            # Corrupted footnotes
            if re.search(r'\^\*\*\[\d+', line):
                issues['corrupted_footnotes'] += 1
            
            # Broken PDF links
            if re.search(r'\]\(#[A-Za-z_]+\.html', line):
                issues['broken_pdf_links'] += 1
            
            # Excessive blockquote nesting
            if line.strip().startswith('> > >'):
                issues['excessive_blockquotes'] += 1
            
            # Split paragraph indicators (short lines that don't look like headers/lists)
            stripped = line.strip()
            if stripped and not stripped.startswith(('#', '-', '*', '>', '```', '|')):
                if len(stripped) < 60 and not stripped.endswith(('.', ':', '?', '!')):
                    issues['potential_split_paragraphs'] += 1
    
    # Analyze code blocks
    code_stats = {
        'total': len(code_blocks),
        'no_language': sum(1 for cb in code_blocks if cb['language'] == 'none'),
        'languages': defaultdict(int)
    }
    
    for cb in code_blocks:
        if cb['language'] != 'none':
            code_stats['languages'][cb['language']] += 1
    
    return {
        'issues': dict(issues),
        'code_stats': {
            'total': code_stats['total'],
            'no_language': code_stats['no_language'],
            'languages': dict(code_stats['languages'])
        }
    }

def generate_structure_report(project_dir: Path) -> str:
    """Generate a comprehensive structure report for subagent analysis."""
    raw_file = project_dir / "raw" / "book-parsed.md"
    
    if not raw_file.exists():
        return f"Error: Raw file not found at {raw_file}"
    
    # Count total lines
    with open(raw_file, 'r', encoding='utf-8') as f:
        total_lines = sum(1 for _ in f)
    
    # Extract headers
    print("Extracting headers...")
    headers = extract_headers(raw_file)
    
    # Detect issues
    print("Detecting formatting issues...")
    analysis = detect_issues(raw_file)
    
    # Build report
    report = []
    report.append("# Book Structure Analysis Report")
    report.append("")
    report.append(f"**Project**: {project_dir.name}")
    report.append(f"**Source File**: raw/book-parsed.md")
    report.append(f"**Total Lines**: {total_lines:,}")
    report.append(f"**Headers Found**: {len(headers)}")
    report.append("")
    report.append("---")
    report.append("")
    
    # Header structure
    report.append("## Header Structure")
    report.append("")
    report.append("This shows all headers found in the book with their line numbers.")
    report.append("Use this to identify chapter boundaries and create CHAPTER_MAP.md.")
    report.append("")
    report.append("| Line | Level | Title |")
    report.append("|------|-------|-------|")
    
    for h in headers:
        report.append(f"| {h['line']} | H{h['level']} | {h['title']} |")
    
    report.append("")
    report.append("---")
    report.append("")
    
    # Suggested chapters
    report.append("## Suggested Chapter Boundaries")
    report.append("")
    report.append("Based on H1 headers, here are likely chapter boundaries:")
    report.append("")
    
    h1_headers = [h for h in headers if h['level'] == 1]
    for i, h in enumerate(h1_headers):
        end_line = h1_headers[i + 1]['line'] - 1 if i + 1 < len(h1_headers) else total_lines
        slug = re.sub(r'[^\w\s-]', '', h['title'].lower())
        slug = re.sub(r'\s+', '-', slug)
        
        report.append(f"- **{h['title']}**")
        report.append(f"  - Lines: {h['line']} to {end_line}")
        report.append(f"  - Suggested filename: `{slug}.md`")
        report.append("")
    
    report.append("---")
    report.append("")
    
    # Formatting issues
    report.append("## Formatting Issues Detected")
    report.append("")
    report.append("These issues were found by sampling the file:")
    report.append("")
    report.append("| Issue | Count | Priority |")
    report.append("|-------|-------|----------|")
    
    issue_priority = {
        'bold_headers': ('High', 1),
        'no_language': ('High', 1),
        'potential_split_paragraphs': ('High', 2),
        'backslash_continuations': ('Medium', 2),
        'emphasis_artifacts': ('Medium', 3),
        'corrupted_footnotes': ('Medium', 3),
        'array_bracket_corruption': ('Medium', 3),
        'broken_pdf_links': ('Low', 4),
        'excessive_blockquotes': ('Low', 4),
    }
    
    issues = analysis['issues']
    if issues.get('bold_headers', 0) > 0:
        report.append(f"| Bold headers (should be #) | {issues['bold_headers']} | High |")
    
    if analysis['code_stats']['no_language'] > 0:
        report.append(f"| Code blocks missing language | {analysis['code_stats']['no_language']} | High |")
    
    if issues.get('potential_split_paragraphs', 0) > 0:
        report.append(f"| Potential split paragraphs | {issues['potential_split_paragraphs']} | High |")
    
    if issues.get('backslash_continuations', 0) > 0:
        report.append(f"| Backslash line continuations | {issues['backslash_continuations']} | Medium |")
    
    if issues.get('emphasis_artifacts', 0) > 0:
        report.append(f"| Emphasis artifacts [word] | {issues['emphasis_artifacts']} | Medium |")
    
    if issues.get('corrupted_footnotes', 0) > 0:
        report.append(f"| Corrupted footnotes | {issues['corrupted_footnotes']} | Medium |")
    
    if issues.get('array_bracket_corruption', 0) > 0:
        report.append(f"| Array bracket corruption | {issues['array_bracket_corruption']} | Medium |")
    
    if issues.get('broken_pdf_links', 0) > 0:
        report.append(f"| Broken PDF links | {issues['broken_pdf_links']} | Low |")
    
    if issues.get('excessive_blockquotes', 0) > 0:
        report.append(f"| Excessive blockquote nesting | {issues['excessive_blockquotes']} | Low |")
    
    report.append("")
    report.append("---")
    report.append("")
    
    # Code statistics
    report.append("## Code Block Statistics")
    report.append("")
    report.append(f"**Total code blocks**: {analysis['code_stats']['total']}")
    report.append(f"**Missing language identifier**: {analysis['code_stats']['no_language']}")
    report.append("")
    
    if analysis['code_stats']['languages']:
        report.append("**Languages detected**:")
        report.append("")
        for lang, count in sorted(analysis['code_stats']['languages'].items(), key=lambda x: x[1], reverse=True):
            report.append(f"- {lang}: {count} blocks")
        report.append("")
    
    report.append("---")
    report.append("")
    
    # Instructions
    report.append("## Next Steps for Subagent")
    report.append("")
    report.append("1. **Create CHAPTER_MAP.md**:")
    report.append("   - Use the 'Suggested Chapter Boundaries' above")
    report.append("   - Copy template from references/chapter-map-template.md")
    report.append("   - Fill in the line ranges and filenames")
    report.append("   - Adjust boundaries as needed based on content")
    report.append("")
    report.append("2. **Create FORMATTING_PLAN.md**:")
    report.append("   - Use the 'Formatting Issues Detected' above")
    report.append("   - Copy template from references/formatting-plan-template.md")
    report.append("   - Fill in issue counts and examples")
    report.append("   - Add book-specific notes")
    report.append("")
    report.append("3. **Spot-check a few sections**:")
    report.append("   - Read 50-100 lines from 2-3 different chapters")
    report.append("   - Verify issue types and severity")
    report.append("   - Note any special formatting requirements")
    report.append("")
    
    return '\n'.join(report)

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 analyze_structure.py <project-directory>")
        print("\nExample:")
        print("  python3 analyze_structure.py books/effective-java")
        sys.exit(1)
    
    project_dir = Path(sys.argv[1])
    
    if not project_dir.exists():
        print(f"✗ Error: Project directory not found: {project_dir}")
        sys.exit(1)
    
    raw_file = project_dir / "raw" / "book-parsed.md"
    if not raw_file.exists():
        print(f"✗ Error: Raw file not found: {raw_file}")
        print("  Run Phase 1 (convert_book.py) first.")
        sys.exit(1)
    
    print("=" * 60)
    print("Book Structure Analyzer - Phase 2 Helper")
    print("=" * 60)
    print(f"\nProject: {project_dir.name}")
    print(f"Analyzing: {raw_file}")
    print("")
    
    # Generate report
    report = generate_structure_report(project_dir)
    
    # Save report
    output_file = project_dir / "STRUCTURE_ANALYSIS.md"
    output_file.write_text(report)
    
    print("\n" + "=" * 60)
    print("Analysis Complete!")
    print("=" * 60)
    print(f"\nReport saved to: {output_file}")
    print(f"Report size: {len(report)} characters")
    print("\n✓ Use this report to create CHAPTER_MAP.md and FORMATTING_PLAN.md")
    print("\nNext: Launch subagent with:")
    print(f'  "Read {output_file} and create CHAPTER_MAP.md and FORMATTING_PLAN.md"')

if __name__ == "__main__":
    main()
