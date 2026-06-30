---
name: software-research
description: >
  Use when someone asks to research a software-engineering question through a
  verified, multi-perspective lens — "should we use X vs Y", "evaluate
  library/framework/database Z", "research whether we should adopt …",
  "write an ADR for …", "spike on …", or "migrate from X to Y / upgrade path".
  Runs a STORM-style pipeline specialized for software: auto-detects one of five
  research modes (library-eval, deep-research, architecture, spike, migration),
  spawns that mode's expert lenses in parallel, maps their contradictions,
  synthesizes an HTML briefing and a Markdown/ADR record, then adversarially
  verifies every claim against PRIMARY software sources (official docs, RFCs,
  GitHub releases, OSV/CVE, OpenSSF Scorecard, benchmarks) with version-awareness.
  Best for decisions where multiple viewpoints and version-correct, fact-checked
  claims matter; overkill for a quick API lookup. For non-software topics use
  deep-research; for a pure scored decision matrix use trade-off-analysis.
argument-hint: "[software question / X vs Y / ADR topic / spike / migration]"
---

# Software Research

## What this does

Turns one software-engineering question into a verified, multi-perspective
deliverable. It picks a research mode, simulates that mode's expert lenses,
maps where they contradict, synthesizes an HTML briefing plus a Markdown or ADR
record, then adversarially verifies every claim against its primary source —
version-aware — before delivering. Run the full pipeline; do not shortcut a phase.

## Portability

Self-contained. Built-in tools only (`Agent` general-purpose, `Write`, web
search/fetch inside agents) plus the files in this folder. Drop the folder into
any `.claude/skills/` directory and it works.

## Phase 0: Scope & detect the mode

1. If `$ARGUMENTS` has the question, use it; else ask what to research.
2. Read `data/modes.csv`. Match the question against each row's `signals`
   (semicolon-delimited cues). Pick the best-matching `mode_id`.
   - If two+ modes match with similar confidence, **ask the user which mode**
     (offer the matching modes + one-line descriptions). Otherwise proceed.
   - If nothing matches, use `deep-research` (the fallback).
3. State the chosen mode + your one-line interpretation of the question. The
   user may override the mode.
4. Identify the **reader role** (developer / tech-lead / architect) from context;
   default `tech-lead`.
5. Derive a kebab-case `topic-slug` for filenames.
6. Tell the user the pipeline is running (mode, N lenses, then verify). One line.

## Phase 1: Parallel expert lenses

Open `references/modes/{mode_id}.md` — it contains the exact lens prompts for
this mode. Spawn that mode's lenses as **`general-purpose` agents in a single
message** so they run concurrently. Give every agent the SAME question frame plus:
- its lens prompt (from the mode file),
- the source hierarchy + verification expectations from
  `references/source-hierarchy.md` (paste the tier list + the 6 rules),
- the instruction to return EXACTLY: (1) CORE POSITION in 2 sentences;
  (2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete data point + a
  **primary-source URL** and **the version/date the claim applies to**;
  (3) THE ONE THING only this lens would say. Under 400 words. Real fetched
  sources only — no invented studies, numbers, or URLs.

When all return, post a 2-3 line note in chat: convergence + sharpest
disagreement. Keep raw briefs out of chat.

## Phase 2: Map the contradictions (inline, no agents)

From the briefs only, determine:
1. **Direct conflicts** — name the specific clashing claims.
2. **Strongest vs weakest evidence** — rank by source tier (Tier 1 primary/spec >
   Tier 2 security/aggregator > Tier 3 registry > Tier 4 benchmark > Tier 5 survey).
3. **The resolving question** — the single empirical test that settles the biggest conflict.
4. **Universal agreement** — what every lens confirms (load-bearing finding).
5. **The blind spot** — what NO lens addressed (missing 6th lens → frontier question).

This map is the raw material for the synthesis; not a separate deliverable.

## Phase 3: Synthesize the output(s)

Read the mode's `primary_output` and `secondary_output` from `data/modes.csv`.
- For `html`: clone `assets/briefing-template.html`; do not rebuild the CSS.
  Fill every `{{TOKEN}}`. Findings ranked by reliability, each with a 1-10
  confidence score (set in Phase 4) and Supported-by / Challenged-by chips from
  the contradiction map. Include the version-currency note.
- For `adr`: clone `assets/adr-template.md`; fill the MADR sections (Context,
  Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros/Cons
  per option, More Information). Document rejected options + why.
- For `md`: a focused report/spike summary — findings, recommendation + its
  load-bearing claim, risks/gotchas, references with version/date.

Write outputs to `software-research-reports/` (create if needed):
- HTML → `{topic-slug}-briefing.html`
- MD → `{topic-slug}.md`; ADR → `ADR-{topic-slug}.md`

## Phase 4: Adversarial verification (mandatory)

`verify_depth` comes from `data/modes.csv` (`full` = every citation; `load-bearing`
= the claims the recommendation rests on — still mandatory).

**4a. Self-review (inline).** Score each finding 1-10 for reliability (by source
tier, not confidence) and justify. Identify the weakest link + what would verify
it. Bias check: which lens dominated, what got underweighted. Name the missing
6th lens. Assign an honest overall grade.

**4b. Verify citations (parallel agents).** Spawn `general-purpose` agents in one
message, one per citation cluster (~4-6). Each prompt: independently verify the
claim against its PRIMARY source, applying the 6 rules in
`references/source-hierarchy.md` (version-bind; check current-version validity;
climb to primary; date-stamp; security via OSV/GHSA + version range; benchmarks
need reproducible methodology). Return VERDICT = CONFIRMED / PARTIALLY CONFIRMED
(list corrections) / UNVERIFIED / FALSE / VERSION-STALE, the corrected one-line
citation with version+date, and 2-4 specifics with the primary URL. Under 280 words.

**4c. Apply corrections.** Fix wrong figures/titles/dates/versions. Downgrade
confidence where evidence is thin; demote contested/preprint/version-stale claims
into the contested sidebar. Fill the verification banner
(`N checked · X corrected · Y demoted · Z version-stale`) and per-citation status
tags. Populate the claim-safety guide (assert / caveat / avoid) and version-currency note.

## Output

1. Deliverables: the post-verification HTML + MD/ADR in `software-research-reports/`.
2. Open the HTML with the platform opener: macOS `open <path>`, Linux
   `xdg-open <path>`, Windows `start "" <path>`. If unclear, print the path.
3. Chat summary: file paths; verification tally; the one universal finding; the
   recommendation + its load-bearing claim; the frontier question; the
   claim-safety summary (safe to assert vs avoid). Keep it tight.

## Notes & guardrails

- **Real research only.** Every lens and citation traces to a real, fetched
  primary source with a version/date. If a figure can't be verified, demote or
  cut it; never paper over it.
- **Version-aware.** "X does Y" is only valid as "…in version N". Flag deprecated
  or version-stale claims; never present stale info as current.
- **The panel is author-built.** Disclose it. Lens agreement is a strong
  hypothesis, not field consensus.
- **Reliability = source-tier evidence quality**, not confidence.
- **Cost.** ~9-12 agents per run (lenses + verifiers). Expected. Don't fan wider
  than the mode's lenses / one verifier per citation cluster.
- **Design.** Keep the HTML template CSS verbatim (clean white, Montserrat /
  Roboto Mono, blue accent).
