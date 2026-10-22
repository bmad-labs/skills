# Guide — 08-class-diagrams

Level: Low. Recipe: skill `references/plantuml-recipes.md` §Class.

## NN-<module>.puml — One module

**Purpose.** The classes of one module, their public signatures, and the control flow between them.

**Rules (must).**
- Two packages: "Interface adapters" (controller, models) and "Application layer" (use cases, commands, handlers,
  events). Package titles carry the source path.
- Stereotype on every class; colours from `_style.iuml`; `!include _legend.iuml` at the end.
- Signatures only: `+execute(req: X, scope): Promise<Y>`. No bodies, no private members.
- Inside each use case box: `..uses..`, `..publishes..`, `..sends..` sections. Arrows only for control flow:
  controller → use case, command send (dashed, `CommandBus`), handler → use case.
- A class of another module is drawn once, labelled `"<module>\n<Class>"`.

**How to fill.** Copy the module's rows from `modules.md`: every use case, command owned, command sent, event.

**Best practices.** Split a module past ~12 classes into read and action diagrams. Put a note only where a
design decision is not visible (for example "no outbox: each result is saved at once").

**Check.** Renders. Every class name exists in `modules.md` or `shared-domain.md`.

## Shared domain diagrams

**Rules (must).** Split by concern: services + rules, ports + adapters (with the DI module that wires them), model
(entities). Each port shows its implementation class.

## _style.iuml, _legend.iuml

**Rules (must).** Multi-line `skinparam class<<role>>` blocks (a one-line `{ … }` block does not render). The legend
lists every stereotype colour used.

## README.md — Diagram index

**Rules (must).** One row per file. A table mapping each architecture-guide rule to how the diagrams show it. State
every exception to the guide and why.
