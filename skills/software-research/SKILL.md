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
6. **Gate 1 — confirm scope (one pause).** Show a compact block and wait for the
   user to confirm or redirect before spawning any agents:
   ```
   Mode:        <mode_id> — <one-line why this mode>
   Question:    <your one-line interpretation>
   Reader:      <developer | tech-lead | architect>
   Lenses:      <the N lens names about to run in parallel>
   Outputs:     <primary + secondary format, e.g. HTML briefing + MD>
   Then:        adversarial verification against primary sources.
   Proceed? (or correct the mode / scope)
   ```
   This is the one place to catch a wrong mode or misread scope cheaply — before
   spending ~9-12 agents. Once confirmed, run Phases 1–3 autonomously (no more
   pauses until Gate 2).

## Phase 1: Parallel expert lenses

Open `references/modes/{mode_id}.md` — it contains the exact lens prompts for
this mode. Spawn that mode's lenses as **`general-purpose` agents in a single
message** so they run concurrently. Give every agent the SAME question frame plus:
- its lens prompt (from the mode file),
- the source hierarchy + verification expectations from
  `references/source-hierarchy.md` (paste the tier list + all 7 rules — including
  Rule 7: load-bearing claims must resolve to Tier 1–3, never a blog/Q&A),
- the instruction to return EXACTLY: (1) CORE POSITION in 2 sentences;
  (2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete data point + a
  **primary-source URL** and **the version/date the claim applies to**;
  (3) THE ONE THING only this lens would say. Under 400 words. Real fetched
  sources only — no invented studies, numbers, or URLs.

As each lens returns, append its brief to a working scratch file
`software-research-reports/{topic-slug}.work.md` (create it now) under a
`## Lens: <name>` heading. Writing briefs as they land means a crash mid-run
loses nothing — the run is resumable from what's already on disk. Set the
run-state block at the top of that file: `stepsCompleted: [0, 1]`.

When all return, post a 2-3 line note in chat: convergence + sharpest
disagreement. Keep raw briefs out of chat.

❌ **Common failures here:**
- Citing a blog / SO answer / model memory *as proof* instead of climbing to the
  primary source behind it (Rule 3 + Rule 7). The blog locates the fact; the
  primary *is* the fact.
- Presenting an unversioned claim as current — "X does Y" with no version is
  unverified (Rule 1).
- Letting one loud lens set the narrative before the others return; wait for all N.

## Phase 2: Map the contradictions (inline, no agents)

From the briefs only, determine:
1. **Direct conflicts** — name the specific clashing claims.
2. **Strongest vs weakest evidence** — rank by source tier (Tier 1 primary/spec >
   Tier 2 security/aggregator > Tier 3 registry > Tier 4 benchmark > Tier 5 survey).
3. **The resolving question** — the single empirical test that settles the biggest conflict.
4. **Universal agreement** — what every lens confirms (load-bearing finding).
5. **The blind spot** — what NO lens addressed (missing 6th lens → frontier question).

Append this map to the scratch file under `## Contradiction map` and bump the
run-state to `stepsCompleted: [0, 1, 2]`. The map is the raw material for the
synthesis; not a separate deliverable.

## Phase 3: Synthesize the output(s)

Read the mode's `primary_output` and `secondary_output` from `data/modes.csv`.

**Before writing any output, load `references/report-structure.md`.** It defines the
**concreteness contract** (specific > generic: exact versions, real commands/config/
code, real numbers, tied to THE READER's stack — and a ban list of filler phrases) and
the **12-section deep spine**. Detail is not optional padding: a report earns its length
by being practical and about the reader's situation, not a survey of the topic.

- For `html`: clone `assets/briefing-template.html`; do not rebuild the CSS.
  Fill every `{{TOKEN}}`. It has two layers: (a) the **fast-scan layer** up top —
  verdict scoreboard, key findings, and (for option-comparison modes) the Side-by-Side
  table — so the answer lands in five seconds; then (b) the **12-section deep body**
  (sections 06–16) that carries the full spine. Fill the deep sections per the
  concreteness contract; render comparisons/numbers/flows with widgets, not prose.
- For `md`: the full **12-section spine** from `references/report-structure.md` —
  introduction/methodology, landscape, implementation how-to, stack, integration,
  performance, security, recommendation, roadmap, risks, methodology, and a closing
  References appendix. This is the detailed report; make each section concrete. In the
  References appendix every source is a clickable `[title — version/date](url)` Markdown
  link (never a bare URL in a table cell — those don't reliably render as links).
- For `adr`: clone `assets/adr-template.md`; fill the MADR sections (Context,
  Decision Drivers, Considered Options, Decision Outcome, Consequences, Pros/Cons
  per option, More Information) and the closing **References** section. Document
  rejected options + why. The ADR stays a lean decision record — no 12-section spine —
  but the concreteness contract still applies (name versions, cite specifics).

**Write for a busy engineer, not a journal.** Short sentences, plain words, lead
with the answer. Define any unavoidable term inline. If a reader needs a
dictionary to parse a finding, rewrite it.

**Add a visualization when it earns its place.** `assets/widgets/` holds ~45 drop-in,
zero-dependency visual blocks (inline SVG / CSS / a little vanilla JS). **Read
`assets/widgets/README.md`** — it has the full catalog grouped by job (compare &
decide, numbers & evidence, explain how it works, sequence over time, org &
management, inline accents) plus a numbered "which visual to use" decision order.
Pick by what the content is, not by novelty; copy the file, replace its `FILL:`
markers. A few high-use anchors: `comparison-matrix` (options × criteria),
`weighted-decision-matrix` (ADR scoring), `metric-bars` (benchmark/cost/size),
`evidence-confidence` (per-finding trust), `callout` (gotchas/warnings),
`verdict-card` (the recommendation), and `slider-metric` (the one interactive
"drag it" widget — at most one per report).

Default to the zero-dependency widgets: they render instantly, work offline, print,
and can't be blanked by a CDN outage or a runtime handshake failing. For any
tree/graph/diagram the widgets use **hand-placed coordinates** — don't auto-layout.
Reach for a library only for what bespoke SVG is bad at: a standard flow/sequence/ER
diagram easier written as text → Mermaid (pinned, `securityLevel:'strict'`); real
quantitative data at scale → Chart.js; **code snippets that need syntax coloring →
`code-compare` (it loads highlight.js pinned+SRI — include that block once per report,
set `class="language-…"` per snippet)**. Then pin the version + prefer SRI/inline over
a bare CDN `<script>`. **If you let the model generate arbitrary widget JS rather than
filling a template, sandbox it** (iframe `sandbox="allow-scripts"` without
`allow-same-origin`, CSP blocking `connect-src`) — generated markup is untrusted code
in the report's origin; SRI does not help there. Full rules in `assets/widgets/README.md`.

Write outputs to `software-research-reports/` (create if needed):
- HTML → `{topic-slug}-briefing.html`
- MD → `{topic-slug}.md`; ADR → `ADR-{topic-slug}.md`

❌ **Common failures here:**
- Burying the recommendation under prose — the scoreboard and Bottom Line exist
  so the reader gets the answer before the detail.
- Academic / oblique phrasing that reads as clever but doesn't inform.
- For an X-vs-Y question, skipping the comparison table (the reader wants the
  side-by-side).

## Phase 4: Adversarial verification (mandatory)

**Gate 2 — confirm findings before verifying (one pause).** With the draft
synthesized, post a tight list in chat: the recommendation, the 3–5 key findings,
and which claims are **load-bearing** (the recommendation rests on them). Ask the
user to confirm the finding set / flag anything to scrutinize harder. This is the
last cheap moment to redirect before spending verifier agents. Then run 4a–4c.

`verify_depth` comes from `data/modes.csv` (`full` = every citation; `load-bearing`
= the claims the recommendation rests on — still mandatory).

**4a. Self-review (inline).** Score each finding 1-10 for reliability (by source
tier, not confidence) and justify. Identify the weakest link + what would verify
it. Bias check: which lens dominated, what got underweighted. Name the missing
6th lens. Assign an honest overall grade.

**4b. Verify citations (parallel agents).** Spawn `general-purpose` agents in one
message, one per citation cluster (~4-6). Each prompt: independently verify the
claim against its PRIMARY source, applying all **7 rules** in
`references/source-hierarchy.md` (version-bind; check current-version validity;
climb to primary; date-stamp; security via OSV/GHSA + version range; benchmarks
need reproducible methodology; **load-bearing claims must resolve to Tier 1–3**).
Return VERDICT = CONFIRMED / PARTIALLY CONFIRMED (list corrections) / UNVERIFIED /
FALSE / VERSION-STALE / **UNVERIFIED-LOWTIER** (a load-bearing claim backed only by
Tier 5–6 — no primary found), the corrected one-line citation with version+date,
and 2-4 specifics with the primary URL. Under 280 words.

**4c. Apply corrections.** Fix wrong figures/titles/dates/versions. Downgrade
confidence where evidence is thin; demote contested/preprint/version-stale AND
`UNVERIFIED-LOWTIER` claims into the contested sidebar (a load-bearing claim with no
primary backing must not stand as a finding). Fill the verification banner
(`N checked · X corrected · Y demoted · Z version-stale`) and per-citation status
tags. Populate the claim-safety guide (assert / caveat / avoid), the version-currency
note, and confirm every source appears in the References section. Bump the run-state
to `stepsCompleted: [0, 1, 2, 3, 4]`.

❌ **Common failures here:**
- Skipping verification because the findings "look plausible" — plausible-but-wrong
  is exactly what an LLM panel produces; the verifier is the guard.
- Leaving a load-bearing claim backed only by a blog/SO answer in the main findings
  instead of demoting it (Rule 7 → `UNVERIFIED-LOWTIER`).
- Verifier "confirming" from memory instead of fetching the primary source.

## Output

1. Deliverables: the post-verification HTML + MD/ADR in `software-research-reports/`.
2. Open the HTML with the platform opener: macOS `open <path>`, Linux
   `xdg-open <path>`, Windows `start "" <path>`. If unclear, print the path.
3. Chat summary: file paths; verification tally; the one universal finding; the
   recommendation + its load-bearing claim; the frontier question; the
   claim-safety summary (safe to assert vs avoid). Keep it tight.

## Notes & guardrails

- **Web search is required.** The lenses and verifiers depend on fetching live
  primary sources. If web search/fetch is unavailable inside the agents, abort and
  tell the user — never answer version- or security-sensitive software questions
  from training data alone; a model's memory is Tier 6 and goes stale.
- **Real research only.** Every lens and citation traces to a real, fetched
  primary source with a version/date. If a figure can't be verified, demote or
  cut it; never paper over it.
- **Prefer official docs over Q&A.** A load-bearing claim must resolve to Tier 1–3
  (official docs/specs, security DBs, registries). Blogs, Stack Overflow, Medium,
  and model memory are signposts to find the primary — never proof on their own.
- **Specific and practical, never generic.** Name exact versions; show real commands/
  config/code; use real numbers; tie every recommendation to the reader's stack, team,
  and scale. Cut any sentence that describes a category instead of stating a fact
  ("offers robust support for…", "is widely used…", "can help improve performance…").
  If a sentence wouldn't change what the reader does, delete it. Full contract +
  good/bad example in `references/report-structure.md`.
- **Scratch file.** `{topic-slug}.work.md` holds lens briefs + the contradiction
  map for resumability; it is a working artifact, not a deliverable. Leave it in
  place (a resumed or re-run pass can reuse it); the deliverables are the HTML/MD/ADR.
- **Version-aware.** "X does Y" is only valid as "…in version N". Flag deprecated
  or version-stale claims; never present stale info as current.
- **The panel is author-built.** Disclose it. Lens agreement is a strong
  hypothesis, not field consensus.
- **Reliability = source-tier evidence quality**, not confidence.
- **Cost.** ~9-12 agents per run (lenses + verifiers). Expected. Don't fan wider
  than the mode's lenses / one verifier per citation cluster.
- **Design.** Keep the HTML template CSS verbatim (clean white, Montserrat /
  Roboto Mono, blue accent).
