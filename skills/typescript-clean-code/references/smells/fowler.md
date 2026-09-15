# Change-Shape Smells (Fowler)

A second smell layer, distinct from the Martin catalog in `rules.md`.

## Why this layer exists

The catalog in `rules.md` is organized **per line and per function**: is this name
good, is this function small, is this argument a flag. It reads one place in the
code at a time.

Fowler's catalog is organized by **change shape** — what hurts when you modify the
code. Its unit is not a line, it is a *modification*: which files you have to open
together, which knowledge is spread where.

The consequence: a diff can satisfy every rule in `rules.md` and still be badly
shaped. Every function is five lines, every name reveals intent, and adding one
field still forces edits in eleven files. `rules.md` is blind to that by
construction. Use both layers — they look at different things.

## How to use it

The value here is the *names*, not the definitions. Without a name, a diff "looks
fine". With the name in hand you go looking for the shape, and shapes are what you
find. Run these twelve as questions against the change, not against the file.

The detection questions below are written to be answerable from a diff or a small
reading pass. Where a smell is **not** visible in a single diff, that is stated —
do not claim to have detected it when you have not.

## Severity default

Change-shape smells are **`suggestion (non-blocking)`** by default. They describe
future cost, not present defect. Two exceptions escalate to `issue (blocking)`:

- The change *currently being reviewed* is itself an instance of the smell being
  paid for — e.g. the diff touches nine files to add one field, demonstrating
  Shotgun Surgery rather than predicting it.
- Dead Code that is reachable-looking and misleading — it costs every future
  reader.

See `references/smells/rules.md` → "Severity vocabulary" for the labels.

---

## The twelve

Each entry: what shape it is · the question that detects it · the paired
refactoring · TypeScript note · when NOT to fix.

---

### Shotgun Surgery

**Shape**: one conceptual change forces small edits across many files. The inverse
of Divergent Change.

**Detection question**: *"To add one more of these, how many files do I open?"*
Count them. If adding a payment method means touching the enum, the switch in the
formatter, the switch in the validator, the DTO, the fixture factory, and three
tests, the concept is smeared across the codebase.

**Refactoring**: Move Function / Move Field to pull the scattered pieces into one
place; Combine Functions into Class when the pieces share data; Inline a premature
abstraction that split them.

**TypeScript note**: The most common TS form is a union type whose members are
each handled by a separate `switch` in a different module. The fix is usually a
single module owning the union plus its per-member behavior — a record keyed by the
discriminant, or one module exporting both the type and its handlers. See also
`rules.md` G23.

**Not visible in a single diff** unless the diff itself is the multi-file edit.
Otherwise it shows in version history — files that keep changing together. There is
no established tool in this skill's toolchain that detects change-coupling from git
history; `dependency-cruiser` (see `tooling.md`) detects module coupling, which is a
proxy, not the thing.

**When NOT to fix**: when the scattered edits are mechanical and type-checked —
adding a union member and letting `never`-exhaustiveness errors point at each site
is a *working* safety net, not a smell. The pain is real only when the compiler
cannot find the sites for you.

---

### Divergent Change

**Shape**: one file changes for many unrelated reasons. The inverse of Shotgun
Surgery.

**Detection question**: *"If I list the last several reasons this file changed, do
they belong to the same subject?"* A module edited for tax rules, for HTTP retry
policy, and for date formatting is three modules wearing one filename.

**Refactoring**: Extract Class / Extract Module along the reason-for-change seam;
Split Phase when the file is doing sequential unrelated stages.

**TypeScript note**: Common in `utils.ts`, `helpers.ts`, `index.ts` barrel files,
and in service classes that accumulate every new endpoint. A barrel file changing
often is expected and not this smell — check the implementation files.

**When NOT to fix**: a file with one reason to change that is simply *large* is
Large Class, not this. Do not split a cohesive module just for size.

---

### Long Function

*(Called **Long Method** in the 1999 edition and in most people's memory — same
smell. `SKILL.md` lists it under that name because that is what people type.)*

**Shape**: a function doing too much to hold in your head at once.

**Detection question**: *"Can I name each section of this function?"* If yes, those
names are the functions that want to exist.

**Refactoring**: Extract Function; Replace Temp with Query; Introduce Parameter
Object; Replace Conditional with Polymorphism when the length is a branching tree.

**TypeScript note**: Long async functions that interleave I/O and pure logic are
the frequent case — extracting the pure logic makes it testable without mocks.

**Contested — read this before citing a number.** `rules.md` and
`references/functions/rules.md` carry a "2-5 lines ideal" target. That number is a
position, not a measurement. See `references/functions/rules.md` → "Rule 1" for the
counter-position (Ousterhout, deep modules) and the failure mode of over-extraction.
Detect this smell by *"can I name the sections"*, never by a line count alone.

**When NOT to fix**: a long function that is a flat, linear, un-branching sequence
(a builder, a config literal, an exhaustive mapping table) is readable at any
length. Splitting it produces shallow functions and hurts.

---

### Large Class

**Shape**: a class or module holding too many responsibilities or too much state.

**Detection question**: *"Do all the fields get used by all the methods?"* Cluster
the methods by which fields they touch. Distinct clusters are distinct classes.

**Refactoring**: Extract Class; Extract Superclass; Replace Type Code with
Subclasses.

**TypeScript note**: The class-free form matters more in TS — a module with
fifteen exports where each export touches a different subset of module-level state
is the same smell. Also watch interfaces with many optional properties: that is
usually several shapes union'd by accident, better expressed as a discriminated
union.

**When NOT to fix**: a class that is large because it is a faithful model of a
genuinely large domain concept, where every split would need to be re-joined by
callers.

---

### Long Parameter List

**Shape**: a call site you cannot read without checking the signature.

**Detection question**: *"At a call site, can I tell what each argument means?"*
Consecutive same-typed parameters (`string, string, boolean, boolean`) are the
strongest signal — they are also the ones that silently swap.

**Refactoring**: Introduce Parameter Object; Preserve Whole Object; Replace
Parameter with Query; Combine Functions into Class.

**TypeScript note**: The idiomatic TS fix is a named options object, which also
buys optional properties and defaults. Two further TS-specific points: consecutive
same-typed parameters can be made unswappable with branded types rather than
grouped; and a boolean parameter is a Flag Argument (`rules.md` F3) regardless of
list length.

**When NOT to fix**: mathematical or geometric signatures where positional order is
the domain convention (`clamp(value, min, max)`), and internal helpers called from
one place.

---

### Data Clumps

**Shape**: the same group of values travels together everywhere.

**Detection question**: *"Do these fields always appear together — and would
deleting one of them leave the rest meaningless?"* The second half is the real test;
it separates a true clump from coincidence.

**Refactoring**: Extract Class; Introduce Parameter Object; Preserve Whole Object.

**TypeScript note**: `{ startDate, endDate }`, `{ street, city, postcode }`,
`{ value, currency }`. In TS the extracted concept is often a `type` plus a small
set of functions rather than a class, and that is a complete fix — do not insist on
a class. Money and DateRange are the two clumps almost every codebase has.

**When NOT to fix**: when the fields co-occur in exactly one place. A clump needs
repetition to be a clump.

---

### Primitive Obsession

**Shape**: domain concepts represented as `string`, `number`, `boolean` instead of
as themselves.

**Detection question**: *"Could I pass the wrong one of these and have it compile?"*
If `getUser(orderId)` type-checks, the type is not modelling the concept.

**Refactoring**: Replace Primitive with Object; Replace Type Code with Subclasses;
Replace Type Code with State/Strategy.

**TypeScript note**: **The TS answer is not Fowler's.** Fowler's Replace Primitive
with Object assumes classes; TypeScript has cheaper, stronger options:

- **Branded / nominal types** for identifiers: `type UserId = string & { readonly __brand: 'UserId' }`. Zero runtime cost, prevents the swap.
- **Union of literals** instead of an open `string` for closed sets: `type Status = 'draft' | 'published'` beats `status: string`.
- **Schema-validated types** (Zod, Valibot, ArkType) at system boundaries, where the
  parse both validates and produces the narrowed type.
- **`satisfies`** to keep a literal's narrow type while checking it against a wider
  contract.

A class is the right answer only when the concept carries behavior *and* invariants
(`Money` with arithmetic). For a pure identifier, a brand is better.

**When NOT to fix**: genuine primitives (a line count, a retry delay in ms) and
values that cross a serialization boundary where the wrapper would be stripped
anyway. Branding an ID that is only ever read from and written back to one
repository buys little.

---

### Feature Envy

**Shape**: a function more interested in another module's data than its own.

**Detection question**: *"Count the references to this module's own data versus
another's."* If a method reaches into `order.customer.address.*` four times and
touches its own fields once, it wants to live on the other side.

**Refactoring**: Move Function; Extract Function then Move Function when only part
of the body is envious.

**TypeScript note**: Overlaps with `rules.md` G14 and G36 (Law of Demeter).
Distinguish from the legitimate case: in TS, functions that transform data
structures they do not own are normal and fine (selectors, mappers, reducers). Envy
is about *behavior that belongs elsewhere*, not about reading data.

**When NOT to fix**: presentation and serialization layers, which exist precisely to
read another layer's data. Moving formatting into the domain model to satisfy this
smell makes things worse.

---

### Duplicated Code

**Shape**: the same knowledge expressed in more than one place.

**Detection question**: *"If this rule changed, would I have to remember to change
it in more than one place?"* The test is about *knowledge*, not about characters.

**Refactoring**: Extract Function; Pull Up Method; Form Template Method; Slide
Statements first when the duplicates are nearly-but-not-quite aligned.

**TypeScript note**: **Mechanically detectable** — `jscpd` does token-based clone
detection. See `tooling.md`. Do not spend review reasoning finding literal clones;
spend it on the duplicates a tokenizer misses (same rule, different shape).

**When NOT to fix**: **coincidental duplication** — two blocks that look identical
today but answer to different owners and will diverge. De-duplicating these couples
two things that should be free to change apart, and that coupling is harder to
undo than the duplication was. Prefer duplication over the wrong abstraction. Also
leave test code duplication alone more readily than production duplication;
explicit repetition in tests is often clearer than a shared fixture helper.

---

### Message Chains

**Shape**: a client navigating a structure to reach what it wants —
`a.getB().getC().doSomething()`.

**Detection question**: *"How many objects does this line need to know about?"*
Each link is a thing the caller is now coupled to.

**Refactoring**: Hide Delegate; Extract Function then Move Function.

**TypeScript note**: Overlaps `rules.md` G36. Two TS-specific carve-outs:
optional chaining (`a?.b?.c`) is a null-safety idiom, not automatically this smell;
and fluent builder APIs (query builders, test builders, RxJS pipes) are chains by
design and are not the smell.

**When NOT to fix**: navigating a plain data structure you own — `config.server.port`
is data access, not a message chain. The smell is about chaining through *behavior*
and thereby coupling to a structure you do not control.

---

### Dead Code

**Shape**: code no path reaches, or exports nothing imports.

**Detection question**: does anything call it? Do not answer by eye.

**Refactoring**: Remove Dead Code. Source control remembers.

**TypeScript note**: **Mechanically detectable — do not reason about this.** Use
`knip` for unused files, exports, dependencies, and (with `--exports`) enum and
namespace members. `ts-prune` is archived; its own project status points at knip.
See `tooling.md`. Also note: unused *locals* and unreachable branches are caught by
`noUnusedLocals` and ESLint, not by knip.

**When NOT to fix**: public API surface of a published library (nothing in *this*
repo imports it by design — configure knip's entry points rather than deleting);
code reached only by reflection, dynamic import, or framework convention; and
deliberately-kept reference implementations, which should be commented as such or
deleted.

---

### Speculative Generality

**Shape**: machinery built for a requirement that never arrived. Abstract classes
with one implementation, hooks nothing calls, type parameters used once, options
nothing sets.

**Detection question**: *"Who is the second caller?"* If the answer is "someday",
the abstraction is speculative. One implementation is not a pattern.

**Refactoring**: Collapse Hierarchy; Inline Function; Inline Class; Remove Dead
Code; Change Function Declaration to drop unused parameters.

**TypeScript note**: The TS forms are specific and worth naming — a generic
`<T>` that every call site instantiates as the same type; an interface with exactly
one implementing class, existing "for testability" where the class would mock fine;
a `BaseXService` with one subclass; config objects whose every field has a default
nobody overrides. Type-level speculation costs the same as runtime speculation:
every reader has to hold the generality in their head.

**When NOT to fix**: the second caller is in the same change set or a committed
near-term plan; the seam exists to cross a real boundary (ports/adapters at an
integration edge) even at one implementation today.

---

## Quick checklist

Run against the change, not against the file. Pass/flag each.

| # | Smell | The question |
|---|-------|--------------|
| 1 | Shotgun Surgery | To add one more of these, how many files do I open? |
| 2 | Divergent Change | Do this file's recent reasons-to-change share a subject? |
| 3 | Long Function | Can I name each section of this function? |
| 4 | Large Class | Do all the fields get used by all the methods? |
| 5 | Long Parameter List | At the call site, can I tell what each argument means? |
| 6 | Data Clumps | Do these fields always travel together, and is one meaningless alone? |
| 7 | Primitive Obsession | Could I pass the wrong one of these and have it compile? |
| 8 | Feature Envy | Does this touch another module's data more than its own? |
| 9 | Duplicated Code | If this rule changed, would I change it in more than one place? |
| 10 | Message Chains | How many objects does this line need to know about? |
| 11 | Dead Code | Does anything call it? (ask `knip`, not your eye) |
| 12 | Speculative Generality | Who is the second caller? |

## Provenance

The twelve names and their paired refactorings come from Martin Fowler,
*Refactoring* (2nd ed., 2018, JavaScript examples). Second-edition naming is used
where it differs from the 1999 edition — "Long Function" not "Long Method",
"Extract Function" not "Extract Method". The detection questions, TypeScript notes,
and "when NOT to fix" guidance in this file are this skill's adaptation, not
Fowler's text. The refactoring pairings were not verified against the primary text
in the research run that produced this file; treat the *names* as reliable and
verify a specific pairing before making it a hard rule.
