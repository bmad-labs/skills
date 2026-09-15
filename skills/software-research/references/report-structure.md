# Deep report structure & the concreteness contract

The MD report and the HTML briefing both carry a full 12-section spine (adapted from
the BMAD technical-research workflow) so a report is exhaustive, not a sketch. But a
complete outline full of vague prose is still a bad report. The rule that makes it
useful is the **concreteness contract** below — apply it to every sentence you write.

The ADR is exempt from the 12-section spine (it stays a lean decision record) but the
concreteness contract applies to it too.

---

## The concreteness contract (applies to every format)

A research report earns its length by being **specific, practical, and about the
reader's situation** — not a survey of the topic. Before writing any section, load the
contract:

1. **Name the exact thing, with a version/date.** Not "the library has good TypeScript
   support" → "Zod 3.23 ships its own types; `z.infer<typeof schema>` gives you the
   static type with no codegen step (zod.dev, v3.23, 2024-04)."
2. **Show, don't describe.** Where a claim is about how to *do* something, include the
   real artifact: a command, a config snippet, a code sample, an env var, a file path,
   an actual API call. A section that explains a mechanism without showing it is generic.
3. **Use real numbers.** Not "it's fast" / "it scales well" → "p99 42 ms at 10k req/s on
   the disclosed 4-vCPU box (TechEmpower Round 22)". If you don't have a number, say so
   and mark it unverified — don't paper over it with an adjective.
4. **Answer for THIS reader.** The scope captured the reader's stack, team size, scale,
   and constraints. Tie each recommendation to them: "for your 4-person team already on
   Postgres, …". A recommendation that would read identically for any reader is generic.
5. **Prefer the decision-useful over the encyclopedic.** Every paragraph should change
   what the reader does. If a sentence wouldn't alter a decision, cut it.
6. **Keep the source discipline.** Every load-bearing claim still resolves to a Tier 1–3
   primary source with a version/date (see `source-hierarchy.md`). Specific + wrong is
   worse than generic.

### Ban list — filler that signals a generic report

Delete sentences built from these. They describe a *category* instead of stating a *fact*:
- "X offers robust/powerful/comprehensive support for …"
- "X provides a wide range of features …"
- "It is important to consider …" / "There are several factors …"
- "X is widely adopted in the industry …" (unless you cite the adoption number)
- "X can help improve performance/scalability/security …" (say by how much, measured how)
- "Best practices suggest …" (whose? cite the normative source and the actual practice)

### One good vs generic example

> **Generic (cut it):** "Redis is a popular in-memory data store that offers high
> performance and is widely used for caching. It supports various data structures and
> provides good scalability for demanding applications."
>
> **Concrete (keep it):** "Redis 7.2 gives you sub-millisecond GET/SET because the
> dataset lives in RAM; for your session-cache use case, a single `cache-aside` pattern
> (`GET key` → miss → read Postgres → `SET key val EX 3600`) covers it. One caveat for
> your 4-person team: persistence defaults to RDB snapshots, so an unclean restart can
> lose up to `save`-interval seconds of writes — set `appendonly yes` if the sessions
> must survive a crash (redis.io/docs/management/persistence, v7.2, 2024)."

---

## The 12-section spine (MD report + HTML briefing)

Fill each section with concrete content per the contract. Omit a section only if it is
genuinely N/A for the mode (say why in one line rather than padding it). Order is fixed
so reports are navigable; depth varies by what the research found.

Note: the HTML briefing leads with its **fast-scan layer** (scoreboard → key findings →
Side-by-Side table). The 12 sections come *after* that, as the deep body — a reader can
stop at the scan or read on. The MD report is the 12 sections directly.

1. **Introduction & methodology** — why this question matters *now* for the reader;
   what was researched, over what sources, what the reader asked (`{research_goals}`),
   and what the research concluded against those goals. Name the modes/lenses run.
2. **Landscape & current state** — the specific players/versions/patterns in play as of
   the research date. Name them. State what's current vs deprecated (with the version
   where it changed).
3. **Implementation approach (how to actually do it)** — the practical core. Real setup
   steps, commands, config, minimal code, file layout. This is where "practical" is won
   or lost — show the reader the actual path, not "an overview of implementation."
4. **Technology/stack detail** — exact languages/frameworks/versions/tools involved,
   with why each is chosen for the reader's case. Pin versions.
5. **Integration & interoperability** — how it connects to what the reader already runs:
   APIs, protocols, data formats, compatibility windows. Cite the compat matrix.
6. **Performance & scalability** — real numbers with disclosed methodology; the scaling
   model and where it saturates; the reader's expected load vs that ceiling.
7. **Security & compliance** — concrete: specific CVEs/GHSA + affected/patched versions,
   the SPDX license + obligations, the attack surface, required hardening steps.
8. **Recommendations (tied to the reader)** — the decision and why, referencing the
   reader's stack/team/scale/constraints by name. State what you'd NOT do and why.
9. **Implementation roadmap** — phased, estimable steps (effort S/M/L, sequence,
   what unblocks what). Concrete enough to hand to the team on Monday.
10. **Risks & mitigations** — named risks with likelihood/impact and a specific mitigation
    each; the rollback/exit path. No "there are risks" — enumerate them.
11. **Methodology & sources** — how claims were verified; the verification tally
    (`N checked · X corrected · Y demoted · Z version-stale`); confidence by source tier.
12. **Appendix & references** — the full source list plus any supporting data tables.
    This is the References section that every output must end with. **Make every source a
    real clickable link:** in Markdown/ADR use `[title — version/date](url)` (not a bare
    URL in a cell — bare URLs don't reliably link); in HTML use `<a href>`. One link per
    URL. Each entry carries its verification status (Confirmed / Corrected / Contested /
    VersionStale).

### Visualize the sections (use the widgets)

Wherever a section states a comparison, a number, a flow, or a decision, render it with a
widget from `assets/widgets/` instead of prose (see `assets/widgets/README.md`):
- §3 implementation → `code-compare`, `deployment-pipeline`, `annotated-diagram`
- §4/§5 stack/integration → `comparison-matrix`, `feature grid`, `c4-container-view`
- §6 performance → `metric-bars`, `range-bar`, `capacity-scaling-curve`
- §7 security → `severity-summary`
- §8 recommendation → `weighted-decision-matrix`, `verdict-card`
- §9 roadmap → `phasing-roadmap`, `migration-checklist`
- §10 risk → `risk-heatmap`
- §11 methodology → the verification banner + `evidence-confidence`
