# Checklists

Run the folder checklist before you report a folder. Answer each line yes or no. A "no" is fixed or reported.

## Every folder

- [ ] Every name, code, topic, and id matches the canon.
- [ ] Every protocol file passes its validator (table below). The command and its result are in the report.
- [ ] One negative test ran: a bad message or document that the schema must reject, and it did.
- [ ] Generated files were produced by the generator, not edited by hand.
- [ ] No implementation detail: no function bodies, no algorithms in code, no framework boilerplate.
- [ ] Each unknown is `[ASSUMPTION]` and has a DQ item with an owner.
- [ ] Each difference from the user's reference is marked (`NEW`, or a delta table).
- [ ] Every link in the md resolves to a file.
- [ ] Every after-commit step names what re-runs it if the process dies first. No record can wait forever.
- [ ] Every table or rule appears in one file; the others link to it.
- [ ] Every event code has one producer and one meaning.

## After a change (propagation proof)

- [ ] Retired-name list written (old fields, codes, commands, config keys, file and workflow names).
- [ ] `grep -rn '<old name>'` over the package and the upstream docs, history files excluded: zero hits or fixed.
- [ ] Generated files re-rendered from their sources; one generated file re-read for leftovers.
- [ ] Each changed diagram rendered alone.
- [ ] Every validator re-run. The report lists the sweep and its result.

## By design kind

Each folder's `GUIDE.md` (under `templates/`) ends every document section with a **Check** list. Run it for each
document you wrote.

## Validators

| File | Command |
| --- | --- |
| `*.schema.json` + `*.example(s).json`, `*.jsonc` | `python3 scripts/validate_json.py <folder> <design-root>` |
| `*.proto` | `protoc --proto_path=<dir> --descriptor_set_out=/dev/null <file>.proto` |
| `openapi.yml` | `npx -y @redocly/cli lint openapi.yml` |
| `asyncapi.yml` | `npx -y @asyncapi/cli validate asyncapi.yml` |
| `*.puml` | `plantuml -tsvg -failfast2 *.puml` |
| activation balance | `for f in *.puml; do echo "$f $(grep -cE '^\s*activate ' $f) $(grep -cE '^\s*deactivate ' $f)"; done` |
| `*.svg` | `xmllint --noout <file>.svg` |
| SQL in md | `python3 -c "import sqlglot; sqlglot.parse_one(open('q.sql').read(), read='postgres')"`, then check each column against the DDL |

## Known tool traps

| Symptom | Fix |
| --- | --- |
| PlantUML crashes on `{}` inside an entity or class body | Write parentheses instead |
| Markdown table breaks on `\|` between enum values | Separate values with commas |
| Validator cannot find a bare `$ref` name | Use a relative file path (`../06-data-modeling/_common.schema.json#/$defs/x`) |
| AsyncAPI rejects a circular `$ref` | Add a non-recursive sub-schema for the inner level |
| Redocly rejects a YAML flow value with commas | Quote the string |
| Named XML entities (`&mdash;`) break an SVG | Use numeric entities (`&#8212;`) |
| PlantUML says "No diagram found" on a one-line `skinparam x { … }` | Put each skinparam block on several lines |
| A diagram renders to an odd file name | Name the diagram: `@startuml <file-stem>` |
| "No diagram found" after a script edited a `.puml` | A real newline landed inside a message line. Write the two characters `\n` |
| A batch `plantuml *.puml` fails, file unknown | Render each changed file alone |
| AsyncAPI fails after a message rename | Rename it in `components.messages`, `channels.*.messages`, and every `operations` `$ref` |

## Report shape (per folder)

1. What the folder holds: one table, file group → content → check result.
2. Fixes found during validation, one line each.
3. New open items and assumptions.
4. What the checks do not prove (for example: flow correctness, naming across folders).
5. The next folder, and a request to review this one.
