# Code Smells Knowledge

Core concepts and foundational understanding for identifying and addressing code smells.

## Overview

Code smells are indicators of deeper problems in code. They are not bugs - the code may work correctly - but they suggest weaknesses in design that may slow development or increase the risk of bugs or failures in the future. This chapter compiles heuristics for recognizing and eliminating common smells.

## Key Concepts

### Code Smell

**Definition**: A surface indication that usually corresponds to a deeper problem in the system.

Code smells are warning signs, not definitive rules. They require judgment to evaluate - some smells may be acceptable in certain contexts while being problematic in others.

**Key points**:
- Smells indicate potential problems, not guaranteed defects
- Each smell suggests specific refactoring techniques
- Multiple smells often compound each other

### Heuristic

**Definition**: A practical approach to problem-solving that may not be optimal but is sufficient for finding satisfactory solutions.

The smells in this chapter are heuristics - they guide decision-making but don't mandate specific actions. Use them to question your code, not as absolute rules.

### The DRY Principle

**Definition**: Don't Repeat Yourself - every piece of knowledge should have a single, unambiguous representation in a system.

Duplication is the root of many smells. When you find duplication, you've found an opportunity for abstraction.

## Change shape vs. per-line

The distinction worth internalizing: Martin's catalog (`rules.md`) asks *"is this
code well written?"*; Fowler's (`fowler.md`) asks *"what will hurt when I change
it?"* The second is answered by counting files, not by reading lines. Neither
subsumes the other. `SKILL.md` lists all four catalog layers and when each loads.

## Smell Categories (rules.md)

| Category | Focus Area | Count |
|----------|------------|-------|
| Comments (C) | Comment quality and necessity | 5 |
| Environment (E) | Build and test processes | 2 |
| Functions (F) | Function design issues | 4 |
| General (G) | Broad design heuristics | 36 |
| Names (N) | Naming conventions | 7 |
| Tests (T) | Testing practices | 9 |

## Category Overview

### Comments (C1-C5)
Problems with comments including inappropriate information, obsolete content, redundancy, poor writing, and commented-out code. Comments should explain *why*, not *what*.

### Environment (E1-E2)
Build and test execution should be simple one-step operations. Complexity here slows the entire development cycle.

### Functions (F1-F4)
Function design issues: too many arguments, output arguments, flag arguments, and dead functions. Functions should be small, focused, and intuitive.

### General (G1-G36)
The largest category covering design principles, abstraction levels, coupling, precision, and code organization. These are universal heuristics applicable to any codebase.

### Names (N1-N7)
Naming should be descriptive, unambiguous, and follow conventions. Names are the primary way code communicates intent.

### Tests (T1-T9)
Tests should be comprehensive, fast, and easy to run. They are the safety net that enables refactoring and continuous improvement.

## Terminology

| Term | Definition |
|------|------------|
| Refactoring | Restructuring code without changing external behavior |
| Abstraction | Hiding implementation details behind an interface |
| Coupling | Degree of interdependence between modules |
| Cohesion | Degree to which elements of a module belong together |
| Polymorphism | Ability to process objects differently based on type |

## How It Relates To

- **Clean Functions**: Many smells (F1-F4, G30) directly address function design
- **Meaningful Names**: The naming smells (N1-N7) expand on naming principles
- **Comments**: C1-C5 reinforce when comments are harmful vs. helpful
- **Error Handling**: G3 (boundary conditions), G4 (overridden safeties) relate to robustness
- **Testing**: T1-T9 connect to TDD and test-first development

## Reporting economics — the part most reviews get wrong

Finding smells is cheap. Reporting them is not.

Google's Tricorder platform holds analyzers to **under 10% effective false
positives**, on this definition: an issue is an effective false positive *if
developers did not take some positive action after seeing it*. Correctness is not
the test — action is. A catalog that emits sixty correct-but-unactioned findings is a
false-positive generator by that standard, and each unactioned finding spends the
reader trust that decides whether the next one gets read.

So the discipline is: **scan broadly, report selectively.** Three actionable findings
beat twenty true ones. This is why every full catalog entry carries a "when NOT to
fix" field — an entry without one will be applied where it does not belong.

## Common Misconceptions

- **Myth**: Eliminating all smells guarantees clean code
  **Reality**: Smells are heuristics, not absolute rules. Context matters.

- **Myth**: Code that works doesn't need smell checking
  **Reality**: Smells affect maintainability, not just correctness.

- **Myth**: Fixing smells always improves code
  **Reality**: Over-engineering to avoid smells can be worse than the smell itself.

- **Myth**: A correct finding is worth reporting
  **Reality**: A correct finding nobody acts on is a false positive by the
  operational definition above, and it costs the credibility of the findings that
  do matter.

- **Myth**: Thresholds (line counts, parameter counts) decide smells
  **Reality**: Thresholds are triggers to look. The finding is the design problem
  the threshold pointed at — report that, not the number.

## Quick Reference

| Concept | One-Line Summary |
|---------|-----------------|
| Code Smell | Surface indicator of deeper design problems |
| DRY | Don't Repeat Yourself - eliminate duplication |
| Law of Demeter | Only talk to immediate collaborators |
| Single Responsibility | Each module should have one reason to change |
| Least Surprise | Code should behave as readers expect |
