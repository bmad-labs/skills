# Guide — 07-sequences

Level: Low (Medium: `00-overview` only). Recipe: skill `references/plantuml-recipes.md` §Sequence.

## 00-overview.puml — Overview

**Purpose.** One unit of work end to end in ≤ 10 steps, so a reader knows which detail diagram to open.

**Rules (must).** One `== N · Phase (see NN) ==` divider per phase; each names its detail file. Modules as
participants, not classes. Only the main path; exits live in the detail diagrams.

## NN-<workflow>.puml — One workflow

**Purpose.** Who calls whom, in what order, inside and across transactions, for one situation.

**Rules (must).**
- File name = situation (`01-place-order`). `@startuml` name = file stem. Title has the requirement ids.
- Participants are the real classes and ports from `modules.md` and `shared-domain.md`; names match exactly.
- Manual `activate`/`deactivate`, balanced. Colours by role from `_style.iuml`.
- `group one transaction` around what commits together; events after the group.
- Each message after the group has a note "If lost:" naming what re-runs it (redelivery, timer, re-check).
- One note per step for refusals (error codes) or the rule that decides the branch.
- `alt`/`opt` for branches, `par` for concurrency, `loop` only for real repetition.

**How to fill.**
1. Pick the situation from the canon's workflows and the requirements.
2. Walk the use case: entry → checks → transaction → publish → response.
3. Add each external call with its contract name (method, topic, code).
4. Add refusal notes from the API doc's error table.

**Best practices.**
- Split when past ~12 participants or ~40 messages: one diagram per branch of the situation.
- Show the edge cases (timeout, repeat, stale version) in their own diagram, not as notes on the happy path.
- Label messages with payload highlights `{orderId, version}`, not full shapes.

**Check.** Renders. Bars balanced (the loop in README). Every error code in a note exists in `error-codes.md`.

## _style.iuml — Shared style

**Rules (must).** One style file for the folder. No colour inside a diagram except activation variables and zone boxes.

## README.md — Situation index

**Rules (must).** One row per diagram keyed by situation, with main use cases, governing decision, requirements.
Conventions table. Render and check commands, and what they do not prove.
