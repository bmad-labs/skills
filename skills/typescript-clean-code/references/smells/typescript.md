# TypeScript-Native Smells (TS1-TS10)

The catalog in `rules.md` comes from a Java-shaped book. Most of it transfers, but
it is blind to the failure modes that only exist in a gradually-typed structural
language. This file covers those.

The governing question for every entry here: **does the type say what is true?**
Most TS-specific smells are some form of the type system being told a lie that the
runtime will later discover.

Entry shape matches `rules.md`: what it is · why it hurts · how to fix · severity ·
when NOT to fix · mechanically detected by.

---

### TS1: `any` Leakage

**What it is**: `any` entering at one point and spreading. Every value derived from
an `any` is `any`, so a single untyped boundary silently disables checking across a
whole call path.

**Why it hurts**: type checking is not partially disabled, it is disabled along the
entire path. The failure appears far from the `any` that caused it, which is the
worst possible debugging shape.

**How to fix**: `unknown` at boundaries, then narrow. `unknown` forces a check
before use; `any` forces nothing. For external data, parse rather than assert (see
TS3).

```typescript
// Bad — any spreads
const data: any = await res.json();
const total = data.items.reduce((a, b) => a + b.price, 0); // no checking at all

// Good — unknown forces narrowing
const data: unknown = await res.json();
const parsed = OrderSchema.parse(data); // now typed, and validated
```

**Severity**: `issue (blocking)` at a system boundary; `suggestion` internally.

**When NOT to fix**: genuinely dynamic code where the type is unknowable at compile
time (a deep-equality helper, a generic serializer), and third-party types you do
not control — contain the `any` behind one typed wrapper rather than chasing it.

**Mechanically detected by**: `@typescript-eslint/no-explicit-any` plus the whole
`no-unsafe-*` family. **Do not report individual instances by hand** — see
`tooling.md`.

---

### TS2: Non-null Assertion as Proof

**What it is**: `!` used to silence the compiler where the author believes a value
is present.

**Why it hurts**: `!` is an assertion with no runtime check. If the belief is wrong
the failure is a `TypeError` at a distance, and the `!` documented the wrong belief
in a way that reads like it was verified.

**How to fix**: narrow instead — an early return, a guard, or restructuring so the
value cannot be absent. Where the invariant is real but the compiler cannot see it,
assert it *at runtime* with a message:

```typescript
// Bad
const user = users.find(u => u.id === id)!;

// Good — the failure says what went wrong
const user = users.find(u => u.id === id);
if (!user) throw new Error(`No user with id ${id}`);
```

**Severity**: `suggestion (non-blocking)` generally; `issue (blocking)` where the
value comes from outside the module and the invariant is not enforced.

**When NOT to fix**: test code where the assertion is the test's own precondition
and a failure is a clear test failure; and immediately after a check the compiler
cannot follow (e.g. across a `Map.has` / `Map.get` pair) — though that case is often
better rewritten.

**Mechanically detected by**: `@typescript-eslint/no-non-null-assertion`.

---

### TS3: Assertion Instead of Validation

**What it is**: `as SomeType` used on data from outside the program — HTTP
responses, `JSON.parse`, `localStorage`, environment variables, database rows.

**Why it hurts**: `as` changes what the compiler believes and nothing else. It is
the exact point where the type system stops describing reality, and the mismatch
surfaces as a confusing error deep inside business logic.

**How to fix**: parse at the boundary with a schema validator (Zod, Valibot,
ArkType, io-ts) and let the validated type flow inward. Inside the program, prefer
type guards and discriminated unions over assertions.

```typescript
// Bad — a claim, not a check
const config = JSON.parse(raw) as Config;

// Good — a check that produces the type
const config = ConfigSchema.parse(JSON.parse(raw));
```

**Severity**: `issue (blocking)` at a boundary. Internal `as` between compatible
shapes is `nitpick`.

**When NOT to fix**: `as const`, which narrows rather than widens and is not this
smell. Test fixtures and stubs where writing a full object is noise —
`as Partial<X>` in a test is usually fine. Narrowing within a union where the guard
is directly above.

**Mechanically detected by**: `@typescript-eslint/no-unsafe-type-assertion` —
**but note this rule is in no shipped preset, not even `strict-type-checked`.** It
must be enabled explicitly. See `tooling.md`.

---

### TS4: Stringly-Typed Domain

**What it is**: domain concepts carried as bare `string` or `number` — ids, codes,
statuses, currencies, units.

**Why it hurts**: every same-typed value is interchangeable to the compiler.
`transfer(accountId, userId)` compiles when the arguments are swapped, and the bug
is found in production.

**How to fix**: pick the cheapest tool that makes the wrong value fail to compile:

- **Union of literals** for closed sets — `type Status = 'draft' | 'published'`.
  Also gives exhaustiveness checking (TS5) for free.
- **Branded types** for identifiers:
  ```typescript
  type UserId = string & { readonly __brand: 'UserId' };
  const toUserId = (s: string): UserId => s as UserId; // one sanctioned entry point
  ```
  Zero runtime cost. The brand is erased at compile time.
- **A class** only when the concept carries behavior *and* invariants (`Money` with
  arithmetic and a currency rule).

**Severity**: `suggestion (non-blocking)`, escalating to `issue` where two
same-typed domain values are adjacent in a signature and swapping them is silent.

**When NOT to fix**: genuine primitives; values whose only lifecycle is
read-from-store then write-back-to-store; and open sets that would need updating in
lockstep with an external system.

**Mechanically detected by**: nothing. This is judgment. See also Fowler
**Primitive Obsession** in `fowler.md`.

---

### TS5: Non-exhaustive Union Handling

**What it is**: a `switch` or `if`-chain over a union that will silently do nothing
when a new member is added.

**Why it hurts**: the union grows, and every un-updated handler becomes a silent
wrong answer instead of a compile error. This is the mechanism that turns a union
into Shotgun Surgery.

**How to fix**: exhaustiveness-check with `never`.

```typescript
const assertNever = (x: never): never => {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
};

switch (shape.kind) {
  case 'circle': return Math.PI * shape.r ** 2;
  case 'square': return shape.side ** 2;
  default: return assertNever(shape); // adding a member breaks the build here
}
```

A `Record<Kind, Handler>` map achieves the same and is often better when the
handlers are large — the map's type forces every key to be present.

**Severity**: `issue (blocking)` when the union is owned by this codebase and will
grow. `suggestion` when it is fixed by an external contract.

**When NOT to fix**: unions from a third-party type that may add members outside
your release cycle, where a hard failure is worse than a default — handle the
default deliberately and say why.

**Mechanically detected by**: `@typescript-eslint/switch-exhaustiveness-check`.

---

### TS6: `enum` Where a Union Belongs

**What it is**: TypeScript `enum` used for a simple set of values.

**Why it hurts**: `enum` emits runtime code (unlike the rest of the type system),
numeric enums accept any number without complaint, and `const enum` interacts badly
with `isolatedModules` and bundlers. A union of string literals is erased entirely,
narrows better, and serializes as itself.

**How to fix**:

```typescript
// Prefer
type Role = 'admin' | 'editor' | 'viewer';

// Or, when a runtime value list is needed
const ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = typeof ROLES[number];
```

**Severity**: `nitpick` in existing code, `suggestion` in new code.

**When NOT to fix**: existing enums with wide usage — the churn is not worth it.
Enums mirroring an external numeric protocol. Codebases with a settled convention;
consistency (`rules.md` G11) beats this preference.

**Mechanically detected by**: `@typescript-eslint/no-unsafe-enum-comparison` for one
failure mode; the `enum`-vs-union choice itself is not linted by default.

---

### TS7: Strictness Assumed but Not Enabled

**What it is**: reviewing or writing code as if `strict` covered everything it does
not.

**Why it hurts**: two of the highest-value flags are **not** in `strict`, so a
codebase can be "fully strict" and still have the two most common silent-`undefined`
holes:

- `noUncheckedIndexedAccess` — without it, `arr[10]` and `record[key]` are typed as
  present. This is the single largest source of runtime `undefined` in
  "strict" codebases.
- `exactOptionalPropertyTypes` — without it, `{ a?: string }` accepts
  `{ a: undefined }`, erasing the distinction between absent and explicitly-undefined.

Also outside `strict`: `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`noFallthroughCasesInSwitch`.

**How to fix**: enable them. `noUncheckedIndexedAccess` first — it will produce a
large number of errors in an existing codebase, which is the point; each one is a
place that assumed presence.

**Severity**: `suggestion (non-blocking)` as a project-level finding. Report it once
against `tsconfig.json`, never per-instance.

**When NOT to fix**: mid-migration codebases where the error count would stall
delivery — ratchet instead (enable per-directory, or enable and baseline).

**Mechanically detected by**: reading `tsconfig.json`. Check it before claiming any
strictness property in a review.

---

### TS8: Interface Bloat by Optionality

**What it is**: one interface with many optional properties standing in for several
distinct shapes.

**Why it hurts**: `{ a?: X; b?: Y; c?: Z }` says every combination is legal,
including the impossible ones. Every consumer then writes defensive checks for
states that cannot actually occur, and the real invariants live in comments or
nowhere.

**How to fix**: a discriminated union naming the states that genuinely exist.

```typescript
// Bad — 8 combinations, 3 of them real
interface Result { loading?: boolean; data?: Data; error?: Error }

// Good — exactly the 3 real states
type Result =
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: Error };
```

**Severity**: `suggestion (non-blocking)`; `issue (blocking)` when consumers are
already writing impossible-state guards.

**When NOT to fix**: configuration objects where optionality genuinely means
"use the default" and the combinations really are independent.

**Mechanically detected by**: nothing. See also Fowler **Large Class** in
`fowler.md`.

---

### TS9: Structural Types Where Nominal Was Meant

**What it is**: relying on TypeScript's structural typing where two unrelated
concepts happen to have the same shape.

**Why it hurts**: `type Celsius = number` and `type Fahrenheit = number` are the
same type. So are `{ id: string }` for a User and for an Order. The compiler will
not object to a mix-up because there is nothing to object to.

**How to fix**: brand the types (see TS4), or give the concepts a distinguishing
field. Aliasing a primitive (`type UserId = string`) is documentation only — it
provides zero enforcement, and it reads as if it does, which is worse than nothing.

**Severity**: `suggestion (non-blocking)`.

**When NOT to fix**: where structural compatibility is the point — duck-typed
interfaces, adapters, and anywhere you want any conforming object to work.

**Mechanically detected by**: nothing.

---

### TS10: Type-Level Speculative Generality

**What it is**: generics, conditional types, and mapped types used beyond what the
code needs.

**Why it hurts**: type-level complexity costs the same as runtime complexity —
every reader has to hold it — but it is harder to debug, it degrades editor
performance and error message quality, and unlike runtime code it has no tests.

**How to fix**: a type parameter used at exactly one instantiation should be that
concrete type. Prefer overloads over a conditional return type. Prefer an explicit
union over a clever mapped type when the union has few members.

**Severity**: `suggestion (non-blocking)`.

**When NOT to fix**: library code, where the generality is the product; and where
the alternative is a genuine combinatorial explosion of overloads.

**Mechanically detected by**: nothing directly; an unexplained slow `tsc` and
unreadable error messages are the signal.

---

## The G23 tension — resolved

`rules.md` **G23** says "Prefer Polymorphism to If/Else or Switch/Case" with the ONE
SWITCH rule. Read literally, that rule flags idiomatic TypeScript as a smell, and
it is wrong to apply it that way.

**An exhaustive `switch` over a discriminated union, with a `never` default, is good
TypeScript design.** It is the language's own answer to type-based dispatch: the
compiler proves every case is handled, the logic is in one readable place, and
adding a member breaks the build at every site that must change. Class polymorphism
gives up that proof and scatters the behavior across files. Refactoring such a
switch into a class hierarchy makes TypeScript worse.

What G23 is actually pointing at, and what to flag:

- **The same union switched on in many different modules.** That is Shotgun Surgery
  (see `fowler.md`) — one new member means edits everywhere. The fix is to co-locate
  the union with its behavior, not to build a class hierarchy.
- **Switching on a runtime type tag where the type system could have proved it** —
  `typeof x === 'object'` chains, string tags with no union type behind them.
- **Branching on a boolean flag parameter**, which is `rules.md` F3/G15, not this.

So: one exhaustive switch over a union that this module owns — fine, do not flag.
Several switches over the same union in unrelated modules — flag as Shotgun
Surgery and fix by co-location.

## Provenance

The failure modes and fixes here are this skill's synthesis of TypeScript practice,
not a citation of a primary text. Two claims are sourced to typescript-eslint's own
documentation: the `no-unsafe-*` family membership, and that
`no-unsafe-type-assertion` ships in no preset. The `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes` claims (that they sit outside `strict`) should be
re-checked against the current TypeScript release notes before being quoted as fact
to a user.
