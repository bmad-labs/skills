"""Consistency checks for an intent document set.

Usage: python3 check_intent.py <doc-folder>
Exit 0 when clean, 1 when any finding is printed.
"""
import re
import sys
from pathlib import Path

ALLOWED_STATUS = {
    "Open", "Answered", "Partly answered", "Confirm with PO",
    "Confirm with tech lead", "Story ignored",
}
TECH_WORDS = [
    "idempot", "retry", "transaction", "unique index", "cache", "partition",
    "FIFO", "schema", "optimistic lock", "mutex", "Kafka", "gRPC", "endpoint",
]

findings = []


def find(message):
    findings.append(message)


def read(folder, name):
    path = folder / name
    return path.read_text(encoding="utf-8") if path.exists() else None


def table_rows(text, first_cell_pattern):
    rows = []
    for line in text.splitlines():
        if re.match(r"^\| " + first_cell_pattern + r" \|", line):
            rows.append([cell.strip() for cell in line.strip().strip("|").split(" | ")])
    return rows


def check_memlog(memlog, docs):
    if "\n=> " in "\n" + memlog or memlog.startswith("=> "):
        find("memlog.md: '=>' answer lines left; move them into the Answer column")
    question_rows = table_rows(memlog, r"Q\d+")
    widths = {len(row) for row in question_rows}
    if len(widths) > 1:
        find(f"memlog.md: question rows have different cell counts {sorted(widths)}")
    open_ids = []
    for row in question_rows:
        status = row[-1]
        if len(row) >= 5 and status not in ALLOWED_STATUS:
            find(f"memlog.md: {row[0]} has unknown status '{status}'")
        if status in {"Open", "Confirm with PO", "Confirm with tech lead", "Partly answered"}:
            open_ids.append(row[0])
    confirm_text = (docs.get("confirm-po.md") or "") + (docs.get("confirm-tech.md") or "")
    if confirm_text:
        for question_id in open_ids:
            if not re.search(r"\b" + question_id + r"\b", confirm_text):
                find(f"{question_id} is open in memlog.md but missing from confirm-po.md / confirm-tech.md")
    return {row[0] for row in question_rows}


def check_sources(memlog, docs):
    source_rows = table_rows(memlog, r"\d+")
    keys = {row[1] for row in source_rows if len(row) > 1}
    for key in sorted(keys):
        for name in ("intent.md", "fr.md"):
            if docs.get(name) is not None and key not in docs[name]:
                find(f"{name}: source {key} is in the reading log but not mentioned")


def check_ids(docs, prefix, owner):
    owner_text = docs.get(owner)
    fr_text = docs.get("fr.md") or ""
    if owner_text is None:
        return
    defined = {row[0] for row in table_rows(owner_text, prefix + r"\d+")}
    used = set(re.findall(r"\((" + prefix + r"\d+)\)", fr_text))
    for item in sorted(used - defined, key=lambda x: int(x[1:])):
        find(f"fr.md links {item} but {owner} does not define it")
    for item in sorted(defined - used, key=lambda x: int(x[1:])):
        find(f"{owner} defines {item} but fr.md never links it")


def check_question_refs(docs, question_ids):
    if not question_ids:
        return
    for name, text in docs.items():
        if name == "memlog.md" or text is None:
            continue
        for ref in set(re.findall(r"\b(Q\d+)\b", text)):
            if ref not in question_ids:
                find(f"{name}: {ref} is referenced but not defined in memlog.md")


def check_po_language(docs):
    text = docs.get("confirm-po.md")
    if text is None:
        return
    for word in TECH_WORDS:
        if re.search(re.escape(word), text, re.IGNORECASE):
            find(f"confirm-po.md: technical word '{word}' — move the item to confirm-tech.md or reword")


def check_ac_format(docs):
    text = docs.get("fr.md") or ""
    for number, line in enumerate(text.splitlines(), start=1):
        if re.match(r"^(\*\*)?(Given|When|Then)(\*\*)?\b", line.strip()) and not line.lstrip().startswith("-"):
            find(f"fr.md:{number}: Given/When/Then on a plain line; use '- **Given** …' bullets")


def check_duplicate_headings(docs):
    for name, text in docs.items():
        if text is None:
            continue
        seen = set()
        for line in text.splitlines():
            if re.match(r"^#{1,2} ", line):
                if line in seen:
                    find(f"{name}: duplicate heading '{line}'")
                seen.add(line)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    folder = Path(sys.argv[1])
    names = ["intent.md", "fr.md", "nfr.md", "memlog.md", "confirm-po.md", "confirm-tech.md", "states.md"]
    docs = {name: read(folder, name) for name in names}
    for required in ("intent.md", "fr.md", "nfr.md", "memlog.md"):
        if docs[required] is None:
            find(f"missing core document {required}")
    if docs["memlog.md"]:
        question_ids = check_memlog(docs["memlog.md"], docs)
        check_sources(docs["memlog.md"], docs)
        check_question_refs(docs, question_ids)
    check_ids(docs, "G", "confirm-po.md")
    check_ids(docs, "T", "confirm-tech.md")
    check_po_language(docs)
    check_ac_format(docs)
    check_duplicate_headings(docs)
    for message in findings:
        print("FINDING:", message)
    print(f"{len(findings)} finding(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
