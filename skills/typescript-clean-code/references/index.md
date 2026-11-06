# Symptom Index

Map what you notice to the reference file that covers it. For task → workflow, see the Workflows table in `SKILL.md`.

## Code symptoms

| If you notice... | Load these files |
|------------------|------------------|
| A function with nameable sections | `references/functions/rules.md` (Rule 1 — read the contested note; length alone is not a finding) |
| Arguments unreadable at the call site | `references/functions/rules.md`, `references/smells/fowler.md` (Long Parameter List) |
| Unclear variable name | `references/naming/rules.md` |
| Class doing too much | `references/classes/rules.md` (SRP), `references/smells/fowler.md` (Large Class) |
| Duplicate code blocks | `references/smells/rules.md` (G5) — check the "when NOT to fix" first |
| Commented-out code | `references/smells/rules.md` (C5) |
| Null checks everywhere | `references/error-handling/rules.md` |
| Hard-to-read tests | `references/unit-tests/rules.md` |
| Inconsistent formatting | `references/formatting/rules.md` |
| Feature envy | `references/smells/rules.md` (G14), `references/smells/fowler.md` |
| God class | `references/classes/rules.md`, `references/smells/fowler.md` (Large Class) |
| **One change touching many files** | `references/smells/fowler.md` (Shotgun Surgery) |
| **One file changing for unrelated reasons** | `references/smells/fowler.md` (Divergent Change) |
| **Fields that always travel together** | `references/smells/fowler.md` (Data Clumps) |
| **Ids and codes typed as bare `string`** | `references/smells/typescript.md` (TS4), `references/smells/fowler.md` (Primitive Obsession) |
| **Abstraction with one implementation** | `references/smells/fowler.md` (Speculative Generality), `references/smells/typescript.md` (TS10) |
| **`any`, `as`, or `!` in the diff** | `references/smells/typescript.md` (TS1, TS2, TS3) |
| **A `switch` over a union** | `references/smells/typescript.md` (TS5 and "The G23 tension") — an exhaustive one is not a smell |
| **Interface with many optional fields** | `references/smells/typescript.md` (TS8) |
| **Unused exports / dead code** | `references/smells/tooling.md` — run `knip`, do not hand-check |
| **About to claim "the project is strict"** | `references/smells/typescript.md` (TS7) — read `tsconfig.json` first; `noUncheckedIndexedAccess` is not in `strict` |

## Professional situations

| If you're facing... | Load these files |
|---------------------|------------------|
| Unrealistic deadline | `references/saying-no/rules.md`, `references/estimation/rules.md` |
| Pressure to cut corners | `references/pressure/rules.md`, `references/professionalism/rules.md` |
| Estimate treated as commitment | `references/estimation/rules.md` |
| Too much in meetings | `references/time-management/rules.md` |
| Stuck in a mess/swamp | `references/time-management/rules.md` (messes section) |
| Code ownership conflict | `references/collaboration/rules.md` |
| Not improving skills | `references/practicing/rules.md` |
