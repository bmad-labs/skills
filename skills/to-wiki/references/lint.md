# Lint one-liners and tooling pitfalls

Run from `docs/wiki/`. These are checks, not generators. Do not commit them inside the wiki.

```bash
# counts
echo "files: $(find . -name '*.md' | wc -l)  pages: $(find sources concepts entities syntheses -name '*.md' | wc -l)"

# broken relative links
for f in $(find . -name '*.md' ! -name AGENTS.md); do d=$(dirname "$f"); grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//; s/#.*//' | grep -v '^$' | grep -vE '^https?:' | while read -r p; do [ -e "$d/$p" ] || echo "BROKEN $f -> $p"; done; done

# raw anchors resolve (heading slug or <a id>)
grep -rhoE '\]\(\.\./\.\./references/<source-folder>/[^)#]+#[^)]+\)' */*.md | sed -E 's/^\]\(//; s/\)$//' | sort -u | while IFS='#' read -r p a; do file="../${p#../../}"; grep -q "id=\"$a\"" "$file" 2>/dev/null || grep -E '^#{1,4} ' "$file" | sed -E 's/^#+ //' | tr 'A-Z' 'a-z' | sed -E 's/[^a-z0-9 _-]//g; s/ /-/g' | grep -qx "$a" || echo "MISSING $p#$a"; done

# frontmatter, type/folder, min 3 wiki links, index once, title match, Not-covered on concepts
for f in $(find sources concepts entities syntheses -name '*.md'); do head -1 "$f" | grep -q '^---$' || echo "no fm $f"; t=$(grep -m1 '^type:' "$f" | awk '{print $2}'); case "$f" in sources/*) e=source;; concepts/*) e=concept;; entities/*) e=entity;; syntheses/*) e=synthesis;; esac; [ "$t" = "$e" ] || echo "type $f"; n=$(grep -oE '\]\((\.\./)?(sources|concepts|entities|syntheses)/[a-z0-9-]+\.md|\]\([a-z0-9-]+\.md' "$f" | wc -l); [ "$n" -ge 3 ] || echo "links<3 $f"; [ "$(grep -c "]($f)" index.md)" -eq 1 ] || echo "index $f"; ti=$(grep -m1 '^title:' "$f" | sed -E 's/^title: *//; s/^"//; s/"$//'); grep -qF "[$ti]($f)" index.md || echo "title $f"; done; for f in concepts/*.md; do grep -q '^## Not covered by the source' "$f" || echo "nocov $f"; done

# encoding damage from shell edits. Exclude AGENTS.md: it documents the pattern and self-matches.
grep -rl --exclude=AGENTS.md 'Â\|Ï\|â€' . | wc -l          # must be 0

# arrows outside entity pages (entity "Every mention" bullets may use →)
grep -c '→' concepts/*.md sources/*.md syntheses/*.md index.md | grep -v ':0'

# equations byte-equal to raw. FIRST look at how the source writes them:
#   multi-line block   $$ \n ... \n \tag{n} \n $$      -> ext_block
#   single line        $$ ... \tag{n} $$              -> ext_line
# The wrong extractor captures the prose between equations and reports a false pass.
# Prove the extractor on one equation you break on purpose before trusting an empty diff.
ext_block() { awk '/^ *\$\$.*\$\$ *$/{next} /^ *\$\$/{if(in_){print blk; in_=0; blk=""} else {in_=1}; next} in_{gsub(/[ \t]+/,""); blk=blk $0}' "$1"; }
ext_line()  { grep -E '^ *\$\$.*\$\$ *$' "$1" | tr -d ' \t'; }   # tr, not sed: macOS sed reads [ \t] as space, backslash, t
ext() { ext_block "$1"; ext_line "$1"; }
for r in ../references/<source-folder>/0*.md; do ext "$r"; done | sort -u > /tmp/raw_eq.txt
for f in */*.md; do ext "$f"; done | sort -u > /tmp/wiki_eq.txt
comm -13 /tmp/raw_eq.txt /tmp/wiki_eq.txt     # must be empty

# every copy of a source table: grep a distinctive cell, count rows per file
grep -l '<distinctive cell value>' */*.md | while read f; do grep -c '<cell1>\|<cell2>\|<cell3>' "$f" | xargs printf "  %s %s\n" "$f"; done

# key numbers still present after edits (absolute presence guard)
for n in "<number 1>" "<number 2>" "<value with unit>"; do printf "%-10s %s\n" "$n" "$(grep -rl -- "$n" . | wc -l)"; done
```

## Pitfalls seen in practice

- **`perl -CSD -pi` without `-Mutf8`** double-encodes every non-ASCII character in the replacement
  text (`§ ± τ —`) into `Â§`, `Â±`, `Ï`. Use `perl -CSD -Mutf8 -pi -e '...'` or the Edit tool.
  A repair regex that rejects results in U+0080–U+00FF skips legitimate `§` and `±`; map those
  two explicitly.
- **macOS `sed` does not understand `\t` inside `[ ]`.** `[ \t]` strips spaces, backslashes, and the letter t, so `\tag` becomes `ag`. Use `tr -d ' \t'` or `awk`.
- **`sort` fails with "Illegal byte sequence"** on UTF-8 under a C locale; use `LC_ALL=C sort`.
- **Subagent reports truncate** at a few thousand characters. The tail holds the counts and the
  last checks. Message the agent for the missing checks only, with a line budget.
- **Large `cat` output is saved to a file**, not shown. Read that file with the Read tool; do not
  re-run the `cat`.
- **Long-sentence detectors over-count**: colon lead-ins merge with the list or equation that
  follows; quoted source sentences are long by nature. Read every flagged sentence before splitting.
- **A shared shell `cd` persists across calls.** Use absolute paths or re-`cd` in each command.
