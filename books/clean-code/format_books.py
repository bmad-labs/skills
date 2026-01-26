#!/usr/bin/env python3
"""
Script to format and split the Clean Code collection markdown file into two separate books.
Version 7 - Better code detection, avoid false positives.
"""

import re
from pathlib import Path


def normalize_spaces(content: str) -> str:
    """Convert non-breaking spaces to regular spaces."""
    return content.replace('\xa0', ' ')


def fix_code_blocks(content: str) -> str:
    """Find and format code blocks."""
    lines = content.split('\n')
    result = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Skip lines that are clearly not code
        is_not_code = (
            not line.startswith('   ') or
            not stripped or
            stripped.startswith('>') or
            stripped.startswith('-') or
            stripped.startswith('*') or
            # Contact info patterns - NOT code
            '@' in stripped or
            stripped.startswith('(800)') or
            stripped.startswith('(617)') or
            'Sales' in stripped or
            'International' in stripped or
            'U.S.' in stripped
        )
        
        if is_not_code:
            result.append(line)
            i += 1
            continue
        
        # Now check if it looks like actual code
        is_code = (
            stripped.endswith('\\') or 
            re.match(r'^(public|private|protected|class|interface|if|for|while|return|try|catch|throw|new|import|package)\b', stripped) or
            re.match(r'^(int|long|short|byte|char|boolean|double|float|void|String)\b', stripped) or
            re.match(r'^@\w+', stripped) or
            re.match(r'^//|^/\*', stripped) or
            stripped.startswith('}') or
            re.match(r'^\w+\s*\([^)]*\)\s*[;{]', stripped) or
            re.match(r'^\w+\s*\.\w+\s*\(', stripped) or
            ('{' in stripped and ';' in stripped)
        )
        
        if not is_code:
            result.append(line)
            i += 1
            continue
        
        # Extract code block
        code_lines = []
        while i < len(lines):
            current = lines[i]
            curr_stripped = current.strip()
            
            # Stop conditions
            if not current.startswith('   '):
                break
            if curr_stripped.startswith('>'):
                break
            if not curr_stripped:
                # Empty line - check if more code follows
                if i + 1 < len(lines) and lines[i+1].startswith('   '):
                    next_stripped = lines[i+1].strip()
                    if next_stripped and not next_stripped.startswith('>'):
                        code_lines.append('')
                        i += 1
                        continue
                break
            
            code_lines.append(current)
            i += 1
        
        # Remove trailing empty lines
        while code_lines and not code_lines[-1].strip():
            code_lines.pop()
        
        if code_lines:
            result.append('')
            result.append('```java')
            
            for cl in code_lines:
                if not cl.strip():
                    result.append('')
                    continue
                
                cleaned = cl.lstrip()
                
                # Remove trailing backslash
                if cleaned.endswith('\\'):
                    cleaned = cleaned[:-1].rstrip()
                
                cleaned = clean_code_line(cleaned)
                result.append(cleaned)
            
            result.append('```')
            result.append('')
        continue
    
    return '\n'.join(result)


def clean_code_line(line: str) -> str:
    """Clean a single code line."""
    line = line.replace('\\[', '[').replace('\\]', ']')
    line = line.replace('\\"', '"')
    line = line.replace('\\<', '<').replace('\\>', '>')
    line = line.replace('\\*', '*')
    return line


def fix_headings(content: str) -> str:
    """Fix chapter and section headings."""
    # Chapter headings: **1 Clean Code**
    content = re.sub(
        r'\n\*\*(\d+)\s+([^*]+)\*\*\n',
        r'\n\n# Chapter \1: \2\n\n',
        content
    )
    
    # Clean Coder chapter format: **1. Professionalism**
    content = re.sub(
        r'\n\*\*(\d+)\.\s*([^*]+)\*\*\n',
        r'\n\n# Chapter \1: \2\n\n',
        content
    )
    
    # Chapter 16 special format: [[16 Refactoring\n]]**`SerialDate`**
    content = re.sub(
        r'\[\[(\d+)\s+([^\]]+)\n\]\]\*\*`([^`]+)`\*\*',
        r'\n\n# Chapter \1: \2 `\3`\n\n',
        content
    )
    
    # Appendix headings
    content = re.sub(
        r'\n\*\*Appendix\s+([A-Z])\*\*\\?\n',
        r'\n\n# Appendix \1\n\n',
        content
    )
    
    # Section headings: standalone **Title**
    def section_repl(m):
        title = m.group(1).strip()
        if any(x in title for x in ['Listing', 'Figure', 'Table', '`']):
            return m.group(0)
        return f'\n\n## {title}\n\n'
    
    content = re.sub(r'\n\*\*([A-Z][^*\n]{2,60})\*\*\n(?!\s*\n\*\*)', section_repl, content)
    
    return content


def fix_footnotes(content: str) -> str:
    """Clean up footnote references."""
    patterns = [
        (r'\^\*\*\[(\d+)\*\*\([^)]+\)\]\{\.small\}\^', r'[^\1]'),
        (r'\^\*\*\*(\d+)\*\*\([^)]+\)\*\^\]', r'[^\1]'),
        (r'\^\*\*\*(\d+)\*\*\([^)]+\)\*\^', r'[^\1]'),
        (r'\*\^(\d+)\*', r'[^\1]'),
        (r'\{\.small\}', ''),
    ]
    for pattern, repl in patterns:
        content = re.sub(pattern, repl, content)
    return content


def fix_blockquotes(content: str) -> str:
    """Reduce excessive blockquote depth."""
    lines = content.split('\n')
    result = []
    
    for line in lines:
        if line.startswith('>'):
            depth = 0
            pos = 0
            while pos < len(line) and (line[pos] == '>' or line[pos] == ' '):
                if line[pos] == '>':
                    depth += 1
                pos += 1
            
            rest = line[pos:].strip()
            
            if depth > 2:
                if rest.startswith('•'):
                    line = '- ' + rest[1:].strip()
                else:
                    line = rest
            elif depth == 2:
                if rest.startswith('•'):
                    line = '  - ' + rest[1:].strip()
        
        result.append(line)
    
    return '\n'.join(result)


def fix_lists(content: str) -> str:
    """Convert bullet points to standard markdown."""
    content = re.sub(r'^>\s*•\s*', '- ', content, flags=re.MULTILINE)
    content = re.sub(r'^•\s*', '- ', content, flags=re.MULTILINE)
    return content


def fix_emphasis(content: str) -> str:
    """Convert bracket emphasis."""
    content = re.sub(r'\[\[\[([^\]]+)\]\]\]', r'***\1***', content)
    content = re.sub(r'\[\[([^\]]+)\]\]', r'**\1**', content)
    # Single brackets (not links or images) -> italic
    # Pattern: [text] not followed by ( and not part of image ![]
    content = re.sub(r'(?<!!)\[([^\]\[\n]{1,80})\](?!\()', r'*\1*', content)
    return content


def fix_links(content: str) -> str:
    """Clean up internal links."""
    content = re.sub(r'\[([^\]]+)\]\(#[^)]*filepos[^)]*\)', r'\1', content)
    content = re.sub(r'\[([^\]]+)\]\(#The_Robert[^)]+\)', r'\1', content)
    return content


def fix_toc(content: str) -> str:
    """Clean up table of contents."""
    content = re.sub(r'\[\[([^\]]+)\]\]\(#[^)]+\)', r'- \1', content)
    content = re.sub(r'\*\*([^*]+)\*\*\(#[^)]+\)', r'- **\1**', content)
    return content


def cleanup(content: str) -> str:
    """Final cleanup."""
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    content = re.sub(r'</?small>', '', content)
    
    def fix_img(m):
        alt = m.group(1)
        path = m.group(2)
        if not alt or alt.isdigit():
            alt = Path(path).stem.replace('-', ' ').replace('_', ' ')
        return f'![{alt}]({path})'
    
    content = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', fix_img, content)
    
    # Remove stray backslashes at end of non-code lines
    lines = content.split('\n')
    result = []
    in_code = False
    for line in lines:
        if line.strip().startswith('```'):
            in_code = not in_code
        if not in_code and line.rstrip().endswith('\\'):
            # Keep backslash for addresses
            if not any(x in line for x in ['Sales', 'Fax', '@', 'Street', 'Boston', 'NJ', 'York']):
                line = line.rstrip()[:-1]
        result.append(line)
    
    return '\n'.join(result)


def format_book(content: str) -> str:
    """Apply all formatting fixes."""
    content = normalize_spaces(content)
    content = fix_code_blocks(content)
    content = fix_headings(content)
    content = fix_footnotes(content)
    content = fix_blockquotes(content)
    content = fix_lists(content)
    content = fix_emphasis(content)
    content = fix_links(content)
    content = fix_toc(content)
    content = cleanup(content)
    return content


def split_books(content: str) -> tuple:
    """Split into two books."""
    lines = content.split('\n')
    
    book2_start = None
    for i in range(25000, min(26000, len(lines))):
        if '**The Clean Coder**' in lines[i]:
            book2_start = i
            break
    
    if book2_start is None:
        print("ERROR: Could not find Book 2")
        return content, ""
    
    print(f"Book 2 starts at line {book2_start}")
    
    book1 = '\n'.join(lines[:book2_start])
    book2 = '\n'.join(lines[book2_start:])
    
    return book1, book2


def main():
    input_file = Path('/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/books/clean-code/clean-code-collection.md')
    output_dir = input_file.parent
    
    print(f"Reading {input_file}...")
    content = input_file.read_text(encoding='utf-8')
    print(f"Total lines: {len(content.splitlines())}")
    
    print("Splitting books...")
    book1_raw, book2_raw = split_books(content)
    print(f"Book 1: {len(book1_raw.splitlines())} lines")
    print(f"Book 2: {len(book2_raw.splitlines())} lines")
    
    print("Formatting Book 1...")
    book1 = format_book(book1_raw)
    
    print("Formatting Book 2...")
    book2 = format_book(book2_raw)
    
    book1_out = output_dir / 'clean-code.md'
    book2_out = output_dir / 'the-clean-coder.md'
    
    print(f"Writing {book1_out}...")
    book1_out.write_text(book1, encoding='utf-8')
    
    print(f"Writing {book2_out}...")
    book2_out.write_text(book2, encoding='utf-8')
    
    print("\nDone!")
    print(f"Book 1: {len(book1.splitlines())} lines")
    print(f"Book 2: {len(book2.splitlines())} lines")


if __name__ == '__main__':
    main()
