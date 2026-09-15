# software-research skill — Design

## Context

The repo has STORM-style source material (`storm-research-SKILL.md`) that runs Stanford's STORM method on *any* topic via five generic lenses (Practitioner, Academic, Skeptic, Economist, Historian) with mandatory primary-source verification. The user wants a version of this **specialized for the software-development industry**: the generic lenses and sources don't fit engineering questions, which need software-specific perspectives (maintainer health, operability, security) and a software-aware source hierarchy (official docs, RFCs, GitHub releases, OSV/CVE, benchmarks) that handles version staleness.

The skill must cover four+ use cases — library/tech evaluation, broad technical deep-research, architecture/design decisions, and pre-implementation spikes — driven by a CSV catalog so each use case adapts the lenses, sources, and output. Outcome: one self-contained, portable skill that produces verified, multi-perspective software-research briefings and decision records.

This design is grounded in web research (cited inline below): ThoughtWorks Technology Radar, OpenSSF Scorecard / OSV.dev / deps.dev / Snyk Advisor, MADR 4.x ADR format, ISO/IEC 25010:2023 quality attributes, ATAM, and a tiered software source hierarchy with version-binding verification.

## Goals / Non-goals

**Goals:** A standalone, dev-specialized, STORM-derived research skill; CSV-driven mode registry (5 modes); per-mode fixed lens sets; mandatory dev-source-aware verification; dual output (HTML briefing + Markdown/ADR). Self-contained — built-in tools only (`Agent` general-purpose, `Write`, web search/fetch inside agents), portable like STORM.

**Non-goals:** No dependency on `deep-research` or `trade-off-analysis` (mention as alternatives only). No new scripts/Python parsing — the CSV is read directly by the model. Not a replacement for actually building/spiking code; it researches and recommends.

## Positioning

Standalone skill `software-research`. The SKILL.md briefly notes: for general (non-software) topics use `deep-research`; for a pure scored decision matrix use `trade-off-analysis`. No runtime coupling.

**Trigger phrases:** "research whether we should use X vs Y", "software research on …", "should we adopt …", "evaluate library/framework/database …", "ADR for …", "spike on …", "migrate from X to Y / upgrade path".

## Research modes (CSV-driven)

`data/modes.csv` is the registry. Columns:
`mode_id, signals, lenses, source_tiers, primary_output, secondary_output, verify_depth, description`

- `signals` — semicolon-delimited keyword/intent cues for auto-detection.
- `lenses` — semicolon-delimited lens ids; full prompts live in `references/modes/<mode>.md`.
- `source_tiers` — which tiers from `source-hierarchy.md` are emphasized.
- `*_output` — `html` | `md` | `adr`.
- `verify_depth` — `full` (every citation) | `load-bearing` (only claims the recommendation rests on).

| mode_id | Lenses (fixed per mode) | Primary | Secondary | Verify |
|---|---|---|---|---|
| `library-eval` | Maintainer-Health · Production-Operator · Security · Performance · Cost/License | html | md (scored) | full |
| `deep-research` | Practitioner · Spec-Authority · Skeptic · Operator · Historian-Pattern | html | md | full |
| `architecture` | Scalability-Perf · Reliability-Operability · Security · Cost-TCO · Team-Fit-Risk | adr | html | full |
| `spike` | Feasibility · Gotchas-Edge-cases · Best-Practice-Pattern · Integration-Fit | md | html | load-bearing |
| `migration` | Breaking-Changes · Effort-Risk · Rollback-Safety · Compatibility-Interop | adr | html | full |

`deep-research` mode is the fallback when no mode confidently matches.

### Lens grounding (from research)
- **Maintainer-Health** → OpenSSF Scorecard checks (Maintained, Code-Review, Signed-Releases), Snyk Advisor health score, deps.dev, libraries.io, release cadence / bus-factor / changelog-quality heuristics.
- **Security** → OSV.dev + GitHub Advisory DB (not NVD alone), resolve affected version ranges, OpenSSF Scorecard vulnerabilities check.
- **Architecture lenses** → ISO/IEC 25010:2023 quality attributes (performance efficiency, reliability, security, maintainability, flexibility) surfaced as an ATAM-style utility tree; name trade-off points (improving one attribute degrades another).
- **Cost-TCO** → acquisition / operation / retirement buckets; hidden operability costs (egress, observability, on-call, exit cost).
- **Historian-Pattern / Best-Practice** → ThoughtWorks Radar evidence-of-use ring model (Adopt/Trial/Assess/Hold).

## Source hierarchy & verification

`references/source-hierarchy.md` — tiers (Tier 1 most authoritative):

1. **Primary / normative:** official versioned docs, IETF RFCs (rfc-editor.org / datatracker), W3C TR / WHATWG specs, TC39 & rust-lang RFC repos, GitHub Releases + CHANGELOG.
2. **Authoritative aggregators / security:** OSV.dev, GitHub Advisory DB, NVD, OpenSSF Scorecard (scorecard.dev), deps.dev, endoflife.date.
3. **Registries (what's current):** npm, PyPI, crates.io, Maven Central, libraries.io.
4. **Independent benchmarks:** TechEmpower (reproducible); vendor benchmarks = marketing until methodology/hardware/versions disclosed and reproducible.
5. **Sentiment surveys:** Stack Overflow Survey, State of JS/CSS, GitHub Octoverse — trend signal only; popularity ≠ correctness.
6. **Secondary commentary:** blogs, SO answers, tutorials, LLM memory — used only to *locate* a primary source, then cite the primary.

**6 verification rules (mandatory):**
1. Version-bind every claim — "X does Y in version N"; no version → unverified.
2. Check current-version validity — scan changelog between claimed version and `latest`; check registry deprecation flag.
3. Climb to the primary source — downgrade blog/SO-only claims to "reported, unverified".
4. Date-stamp volatile facts (versions, benchmarks, deprecations, security); reject undated sources for time-sensitive claims.
5. Security claims — cross-reference OSV/GHSA and resolve the specific version into the affected range; note patched release.
6. Benchmarks — accept only with disclosed, reproducible methodology; discount vendor self-benchmarks.

Verification banner: `N claims checked · X corrected · Y demoted · Z version-stale`.

## Pipeline (SKILL.md phases)

- **Phase 0 — Scope & mode-detect.** Match query against `modes.csv` `signals`. Auto-detect; **ask only if ambiguous** (multiple modes match with similar confidence). State chosen mode + one-line interpretation, derive kebab-case `topic-slug`, identify reader role (developer / tech-lead / architect; default tech-lead). User may override mode.
- **Phase 1 — Parallel lenses.** Spawn the mode's 4-5 `general-purpose` agents in ONE message. Each prompt = shared topic frame + its lens (from `references/modes/<mode>.md`) + the source hierarchy + verification expectations. Each returns: core position (2 sentences); 3-5 evidence bullets, each with a primary URL **and the version/date** it applies to; "the one thing only this lens would say". Post a 2-3 line convergence/disagreement note in chat; keep raw briefs out of chat.
- **Phase 2 — Contradiction map (inline, no agents).** Direct conflicts; strongest vs weakest evidence (rank by source tier); the resolving empirical question; universal agreement (load-bearing finding); the blind spot (missing 6th lens → frontier question).
- **Phase 3 — Synthesize output(s).** Read the mode's template(s); fill every section. Findings ranked by reliability with confidence scores + Supported-by / Challenged-by chips. ADR modes follow MADR 4.x (Context, Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros/Cons per option, More Information) and document rejected options + why.
- **Phase 4 — Adversarial verification (mandatory; `verify_depth` from CSV).** Self-review (score findings 1-10, bias check, weakest link, missing lens). Spawn parallel citation-verify agents (one per citation cluster) applying the 6 rules. Apply corrections; demote preprints/contested/version-stale; fill the verification banner; populate a **claim-safety guide** (assert / caveat / avoid) and a **version-currency note** (as-of date + versions checked).

## Output

- HTML briefing → `software-research-reports/{topic-slug}-briefing.html`.
- Markdown / ADR → same folder, `{topic-slug}.md` or `ADR-{topic-slug}.md`.
- Open the HTML with the platform opener (macOS `open`, Linux `xdg-open`, Windows `start`); otherwise print path.
- Chat summary: file paths, verification tally, the one universal finding, the recommendation + its load-bearing claim, frontier question, claim-safety summary.

## File structure

```
skills/software-research/
├── SKILL.md                       # frontmatter + 5-phase pipeline
├── data/
│   └── modes.csv                  # mode registry (5 rows)
├── references/
│   ├── source-hierarchy.md        # 6 tiers + 6 verification rules (with URLs)
│   └── modes/
│       ├── library-eval.md        # lens prompts + Scorecard/Snyk/OSV scoring dims
│       ├── deep-research.md
│       ├── architecture.md        # MADR 4.x + ISO 25010 + ATAM trade-off points
│       ├── spike.md
│       └── migration.md
└── assets/
    ├── briefing-template.html     # STORM template adapted, dev-themed
    └── adr-template.md            # MADR 4.x markdown skeleton
```

`SKILL.md` frontmatter: `name: software-research`; `description` lists what it does + trigger phrases (drives auto-invocation); optional `argument-hint: "[software question / X vs Y / ADR topic]"`.

Also add a README.md skills-table row: `[software-research](skills/software-research) | Verified multi-perspective software research & decision records (library eval, architecture/ADR, spikes, migration) | Development`.

## Verification (how to test end-to-end)

1. Install locally: add the skill path to `.claude/settings.json` `skills` array; restart; confirm it lists via "what skills are available?".
2. `claude plugin validate .` passes (frontmatter + structure).
3. Run each mode against a real query and confirm correct mode auto-detection + output type:
   - library-eval: "should we use Zod vs Yup" → HTML + scored MD, Scorecard/OSV-grounded.
   - architecture: "ADR: event sourcing vs CRUD for our orders service" → MADR ADR + HTML.
   - spike: "spike: is WebGPU viable for our in-browser chart rendering" → MD spike.
   - migration: "migrate from Express 4 to 5 — upgrade path" → ADR + HTML.
   - ambiguous query → skill asks which mode.
4. Confirm every citation in output resolves to a real fetched primary source with a version/date, and the verification banner tally is truthful (spot-check 2-3 citations).
5. Confirm no fabricated studies/numbers/URLs; version-stale claims are demoted, not hidden.

## Risks / mitigations

- **Cost:** ~9-12 agents/run (lenses + verifiers). Expected, like STORM; documented in SKILL.md guardrails. Don't fan wider than the mode's lenses / one verifier per citation cluster.
- **Stale facts:** mitigated by version-binding + date-stamp rules and the version-currency note.
- **Mode mis-detection:** mitigated by ask-if-ambiguous + user override.
