# software-research Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, dev-specialized, STORM-derived Claude skill that turns one software-engineering question into a verified, multi-perspective briefing + decision record, driven by a 5-mode CSV catalog with mandatory primary-source verification.

**Architecture:** A skill folder under `skills/software-research/`. A `SKILL.md` defines a 5-phase pipeline (scope/mode-detect → parallel lenses → contradiction map → synthesize → adversarial verify). A `data/modes.csv` registry maps each mode to its lenses/sources/output/verify-depth. Per-mode lens prompts live in `references/modes/*.md`; the tiered source hierarchy + verification rules live in `references/source-hierarchy.md`. Two output templates in `assets/` (HTML briefing adapted from the STORM template; MADR 4.x ADR markdown). The model reads the CSV directly — no scripts.

**Tech Stack:** Markdown, CSV (repo convention: header row, semicolon-delimited list cells), HTML/CSS (self-contained, Google Fonts). Built-in Claude Code tools only at runtime: `Agent` (general-purpose), `Write`, web search/fetch inside agents. No Python, no external deps.

## Global Constraints

- Skill name: `software-research` (lowercase, hyphenated, unique).
- Self-contained & portable: depend ONLY on built-in tools + files in this folder. No external scripts/APIs/paid services/other skills.
- CSV format follows repo convention (`skills/trade-off-analysis/data/dimension-guidance.csv`): row 1 = headers; multi-value cells are `;`-delimited; quote any cell containing commas.
- HTML template: keep the STORM `<style>` block's visual system (Montserrat / Roboto Mono, blue accent, clean white). Self-contained single file; Google Fonts via `<link>` is allowed (matches source template).
- All citations must trace to a real, fetched primary source with a version/date. No invented studies, numbers, or URLs. Verification (Phase 4) is mandatory unless mode `verify_depth=load-bearing`, which still verifies load-bearing claims.
- Reader-role default: `tech-lead`.
- Output folder at runtime: `software-research-reports/` relative to CWD.
- 5 modes only: `library-eval`, `deep-research`, `architecture`, `spike`, `migration`. `deep-research` is the fallback.
- No AI attribution in any committed file or commit message.

---

### Task 1: Skill scaffold + SKILL.md pipeline

**Files:**
- Create: `skills/software-research/SKILL.md`

**Interfaces:**
- Produces: the skill entry point. References (by relative path) `data/modes.csv`, `references/source-hierarchy.md`, `references/modes/<mode>.md`, `assets/briefing-template.html`, `assets/adr-template.md` — all created in later tasks.

- [ ] **Step 1: Write `skills/software-research/SKILL.md`**

````markdown
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
````

- [ ] **Step 2: Verify the file exists and frontmatter is well-formed**

Run: `head -5 skills/software-research/SKILL.md`
Expected: shows `---`, `name: software-research`, the `description:` line, etc.

- [ ] **Step 3: Commit**

```bash
git add skills/software-research/SKILL.md
git commit -m "feat(software-research): add skill pipeline (SKILL.md)"
```

---

### Task 2: Mode registry CSV

**Files:**
- Create: `skills/software-research/data/modes.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: 5 rows keyed by `mode_id` ∈ {library-eval, deep-research, architecture, spike, migration}. Columns: `mode_id, signals, lenses, source_tiers, primary_output, secondary_output, verify_depth, description`. `lenses` values must match the lens section headings created in Task 4 files. `source_tiers` references tier numbers defined in Task 3.

- [ ] **Step 1: Write `skills/software-research/data/modes.csv`**

```csv
mode_id,signals,lenses,source_tiers,primary_output,secondary_output,verify_depth,description
library-eval,"library,package,dependency,framework,SDK,npm,pypi,crate,gem,which one,X vs Y,compare,evaluate,should we use","Maintainer-Health;Production-Operator;Security;Performance;Cost-License","1;2;3;4",html,md,full,"Evaluate and compare libraries/frameworks/databases for adoption"
deep-research,"how does,why does,understand,explain,emerging,trend,deep dive,investigate,what is,research","Practitioner;Spec-Authority;Skeptic;Operator;Historian-Pattern","1;2;4;5;6",html,md,full,"Broad technical deep-research on any engineering question (fallback mode)"
architecture,"architecture,design,ADR,decision record,pattern,microservice,monolith,event-driven,scale,system design,trade-off","Scalability-Perf;Reliability-Operability;Security;Cost-TCO;Team-Fit-Risk","1;2;4",adr,html,full,"Architecture/design decision producing a MADR-style ADR"
spike,"spike,feasibility,proof of concept,POC,prototype,is it viable,can we,best practice,how to implement","Feasibility;Gotchas-Edge-cases;Best-Practice-Pattern;Integration-Fit","1;2;3;6",md,html,load-bearing,"Pre-implementation spike feeding a build/plan"
migration,"migrate,migration,upgrade,upgrade path,move from,replatform,port from,breaking change,deprecate,version bump","Breaking-Changes;Effort-Risk;Rollback-Safety;Compatibility-Interop","1;2;3",adr,html,full,"Migration/upgrade-path research producing an ADR"
```

- [ ] **Step 2: Verify row/column integrity**

Run: `awk -F',' 'NR==1{h=NF} {n=gsub(/"/,"&"); }' skills/software-research/data/modes.csv; column -s, -t < skills/software-research/data/modes.csv | head`
Expected: 6 data rows after the header, no obviously broken columns. (Quoting protects the comma-containing `signals`/`lenses` cells.)

Then sanity-check there are exactly 5 modes:
Run: `tail -n +2 skills/software-research/data/modes.csv | wc -l`
Expected: `5`

- [ ] **Step 3: Commit**

```bash
git add skills/software-research/data/modes.csv
git commit -m "feat(software-research): add 5-mode registry CSV"
```

---

### Task 3: Source hierarchy + verification rules

**Files:**
- Create: `skills/software-research/references/source-hierarchy.md`

**Interfaces:**
- Consumes: tier numbers referenced by `modes.csv` `source_tiers`.
- Produces: 6 named tiers (numbered 1-6) + 6 numbered verification rules. Phase 1 and Phase 4b paste from this file.

- [ ] **Step 1: Write `skills/software-research/references/source-hierarchy.md`**

````markdown
# Source Hierarchy & Verification Rules

Software facts go stale fast (versions, deprecations, benchmarks) and
blogs/Stack Overflow are often outdated. Cite the highest tier available, and
verify every claim against its primary source.

## Tiers (Tier 1 = most authoritative)

**Tier 1 — Primary / normative (the thing itself).** Cite over any commentary.
- Official versioned docs (e.g. nodejs.org/docs, docs.python.org/3, react.dev).
- Specs: IETF RFCs (rfc-editor.org, datatracker.ietf.org), W3C TR (w3.org/TR),
  WHATWG Living Standards (spec.whatwg.org).
- Proposal pipelines (future truth + maturity): TC39 proposals
  (github.com/tc39/proposals), rust-lang/rfcs.
- Maintainer release notes / CHANGELOG.md / GitHub Releases — where a claim's
  version validity lives.

**Tier 2 — Authoritative aggregators & security DBs (curated, machine-readable).**
- Vulnerabilities: OSV.dev (aggregates GHSA, RustSec, PyPA), GitHub Advisory DB
  (github.com/advisories), NVD (nvd.nist.gov), Snyk (security.snyk.io).
  OSV/GHSA are usually more timely and more precise on affected version ranges
  than NVD alone.
- Project posture: OpenSSF Scorecard (scorecard.dev) — 18 automated checks
  (Maintained, Code-Review, Signed-Releases, Vulnerabilities, …).
- Version/dependency graph: deps.dev (Google Open Source Insights).
- Lifecycle / EOL: endoflife.date.

**Tier 3 — Ecosystem registries (ground truth for "what's current").**
- Canonical latest-version + deprecation flags: npm, PyPI, crates.io,
  Maven Central, libraries.io.

**Tier 4 — Reputable independent benchmarks (scrutinize methodology).**
- TechEmpower Framework Benchmarks (open, reproducible test code on GitHub) —
  pin to a specific Round + hardware. Treat any *vendor* benchmark as marketing
  until methodology/hardware/versions/config are disclosed and reproducible.

**Tier 5 — Developer-sentiment surveys (popularity ≠ correctness).**
- Stack Overflow Developer Survey, State of JS/CSS, GitHub Octoverse. Trend
  signal only — never a technical fact.

**Tier 6 — Secondary commentary (lead, never proof).**
- Blogs, Stack Overflow answers, Medium, DEV, tutorials, LLM memory. Use to
  *locate* a primary source, then cite the primary.

## Verification Rules (apply to every claim)

1. **Version-bind every claim.** "X does Y" is valid only as "…in version N".
   No version → unverified.
2. **Check current-version validity.** Scan the changelog between the claimed
   version and `latest`; check the registry's deprecation flag.
3. **Climb to the primary source.** When a blog/SO answer asserts a fact, find
   and cite the Tier 1 source behind it. No primary backing → "reported, unverified".
4. **Date-stamp volatile facts.** Versions, benchmarks, deprecations, security
   status go stale fast — record each source's publish date; reject undated
   sources for time-sensitive claims.
5. **Security claims: cross-reference + resolve version ranges.** Verify in
   OSV/GHSA (not NVD alone); confirm the specific version is in the affected
   range and whether a patched release exists.
6. **Benchmarks require reproducible methodology.** Accept performance claims
   only with disclosed hardware/versions/workload/config and a re-runnable test;
   discount vendor self-benchmarks unless independently reproduced.

Verification banner format: `N claims checked · X corrected · Y demoted · Z version-stale`.
````

- [ ] **Step 2: Verify tiers and rules are present**

Run: `grep -cE '^\*\*Tier [1-6]' skills/software-research/references/source-hierarchy.md && grep -cE '^[1-6]\. \*\*' skills/software-research/references/source-hierarchy.md`
Expected: `6` then `6`.

- [ ] **Step 3: Commit**

```bash
git add skills/software-research/references/source-hierarchy.md
git commit -m "feat(software-research): add source hierarchy + verification rules"
```

---

### Task 4: Per-mode lens prompt files

**Files:**
- Create: `skills/software-research/references/modes/library-eval.md`
- Create: `skills/software-research/references/modes/deep-research.md`
- Create: `skills/software-research/references/modes/architecture.md`
- Create: `skills/software-research/references/modes/spike.md`
- Create: `skills/software-research/references/modes/migration.md`

**Interfaces:**
- Consumes: lens ids from `modes.csv` (each `## <Lens-Id>` heading must match a CSV `lenses` token).
- Produces: one `## <Lens-Id>` section per lens, each containing a ready-to-paste agent prompt. Phase 1 reads `references/modes/{mode_id}.md`.

Each lens section follows this shape (substituting `{QUESTION}` and `{FRAME}` at runtime):
`You are THE <LENS> for: {QUESTION} ({FRAME}). <lens stance>. Do real web research prioritizing <named sources>. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete data point + primary-source URL + the version/date it applies to. 3) THE ONE THING only this lens would say. Real fetched sources only. Under 400 words.`

- [ ] **Step 1: Write `references/modes/library-eval.md`**

````markdown
# library-eval lenses

Substitute `{QUESTION}` and a one-line `{FRAME}` into each prompt. Spawn all five
as parallel general-purpose agents.

## Maintainer-Health
You are THE MAINTAINER-HEALTH analyst for: {QUESTION} ({FRAME}). You judge whether
the project is alive and safe to depend on. Do real web research prioritizing
OpenSSF Scorecard (scorecard.dev — Maintained, Code-Review, Signed-Releases
checks), Snyk Advisor health score, deps.dev, libraries.io, and GitHub signals
(release cadence, last commit, open-issue/PR responsiveness, bus factor,
changelog quality, archived/deprecated status). Return EXACTLY: 1) CORE POSITION
in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete signal +
source URL + the date/version observed. 3) THE ONE THING only a maintenance
analyst would say. Real fetched sources only. Under 400 words.

## Production-Operator
You are THE PRODUCTION-OPERATOR for: {QUESTION} ({FRAME}). You run this in prod and
care about operability, not demos. Do real web research for real-world failure
modes, upgrade pain, observability, footprint, known gotchas (GitHub issues,
incident write-ups, practitioner threads). Return EXACTLY: 1) CORE POSITION in 2
sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete case + source
URL + version. 3) THE ONE THING only an operator would say. Real fetched sources
only. Under 400 words.

## Security
You are THE SECURITY analyst for: {QUESTION} ({FRAME}). Do real web research in
OSV.dev and the GitHub Advisory DB (not NVD alone); resolve affected version
ranges and patched releases; check OpenSSF Scorecard's vulnerabilities/SAST
checks and supply-chain posture. Return EXACTLY: 1) CORE POSITION in 2 sentences.
2) STRONGEST EVIDENCE, 3-5 bullets, each with a CVE/GHSA id or posture signal +
source URL + affected/patched versions. 3) THE ONE THING only a security analyst
would say. Real fetched sources only. Under 400 words.

## Performance
You are THE PERFORMANCE analyst for: {QUESTION} ({FRAME}). You distrust vendor
benchmarks. Do real web research for reproducible benchmarks (TechEmpower and
independent, methodology-disclosed tests), bundle size, runtime cost. Reject
performance claims without disclosed hardware/versions/workload. Return EXACTLY:
1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a
number + source URL + version/hardware. 3) THE ONE THING only a performance
analyst would say. Real fetched sources only. Under 400 words.

## Cost-License
You are THE COST-LICENSE analyst for: {QUESTION} ({FRAME}). You follow license
risk and total cost of ownership. Do real web research for the SPDX license and
its obligations (copyleft/attribution/commercial limits), pricing/hosting/egress,
and 3-5yr TCO (acquisition + operation + exit cost). Return EXACTLY: 1) CORE
POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a license
id or cost figure + source URL + date. 3) THE ONE THING only a cost/license
analyst would say. Real fetched sources only. Under 400 words.
````

- [ ] **Step 2: Write `references/modes/deep-research.md`**

````markdown
# deep-research lenses

Substitute `{QUESTION}` and a one-line `{FRAME}`. Spawn all five as parallel
general-purpose agents. This is the fallback mode for broad engineering questions.

## Practitioner
You are THE PRACTITIONER for: {QUESTION} ({FRAME}). You work with this daily. Do
real web research (recent practitioner threads, GitHub issues, operator write-ups,
case studies). Surface the gap between what hands-on engineers know and what
pundits miss. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST
EVIDENCE, 3-5 bullets, each with a concrete case + source URL + version/date.
3) THE ONE THING only a practitioner would say. Real fetched sources only. Under 400 words.

## Spec-Authority
You are THE SPEC-AUTHORITY for: {QUESTION} ({FRAME}). You cite the normative source,
not blogs. Do real web research in official docs, RFCs (IETF), W3C/WHATWG specs,
TC39/rust-lang proposals, and maintainer release notes. Answer what the
specification/official source ACTUALLY says vs folklore. Return EXACTLY: 1) CORE
POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each tied to a
normative source + URL + the version/spec-stage. 3) THE ONE THING only someone
reading the spec would say. Real fetched sources only. Under 400 words.

## Skeptic
You are THE SKEPTIC for: {QUESTION} ({FRAME}). You think the popular take is
overstated. Build the strongest steelman counter-case. Do real web research for
failures, backlash, deprecations, contradicting data. Return EXACTLY: 1) CORE
POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a source
URL + version/date. 3) THE ONE THING only a skeptic would say. Rigorous, not
contrarian for sport. Real fetched sources only. Under 400 words.

## Operator
You are THE OPERATOR for: {QUESTION} ({FRAME}). You care about running it in prod:
reliability, upgrade burden, observability, cost at scale. Do real web research
for incident reports, operability gotchas, TCO. Return EXACTLY: 1) CORE POSITION
in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a concrete signal +
source URL + version. 3) THE ONE THING only an operator would say. Real fetched
sources only. Under 400 words.

## Historian-Pattern
You are THE HISTORIAN-PATTERN analyst for: {QUESTION} ({FRAME}). You have seen
technology hype cycles before. Use the ThoughtWorks Radar evidence-of-use lens
(Adopt/Trial/Assess/Hold). Do real web research for genuine prior parallels (past
technologies, what won/lost and why). Return EXACTLY: 1) CORE POSITION in 2
sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each a specific case with
dates/outcomes + source URL. 3) THE ONE THING only a historian would say. Real
fetched sources only. Under 400 words.
````

- [ ] **Step 3: Write `references/modes/architecture.md`**

````markdown
# architecture lenses

Substitute `{QUESTION}` and a one-line `{FRAME}`. Spawn all five as parallel
general-purpose agents. Frame quality attributes with ISO/IEC 25010:2023 and name
ATAM trade-off points (improving one attribute degrades another).

## Scalability-Perf
You are THE SCALABILITY-PERFORMANCE architect for: {QUESTION} ({FRAME}). Assess
performance efficiency and scalability (ISO 25010). Do real web research for
reproducible benchmarks, scaling models, and capacity limits of each option.
Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5
bullets, each with a number/limit + source URL + version. 3) THE ONE THING only a
scalability architect would say (name a trade-off point). Real fetched sources
only. Under 400 words.

## Reliability-Operability
You are THE RELIABILITY-OPERABILITY architect for: {QUESTION} ({FRAME}). Assess
reliability, availability, fault tolerance, recoverability, and day-2 operability.
Do real web research for failure modes, blast radius, observability, upgrade
burden. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE,
3-5 bullets, each with a concrete signal + source URL + version. 3) THE ONE THING
only a reliability architect would say (name a trade-off point). Real fetched
sources only. Under 400 words.

## Security
You are THE SECURITY architect for: {QUESTION} ({FRAME}). Assess confidentiality,
integrity, authenticity, attack surface, and supply-chain risk of each option. Do
real web research in OSV/GHSA, OWASP guidance, and official security docs. Return
EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each
with a source URL + version/CVE. 3) THE ONE THING only a security architect would
say (name a trade-off point). Real fetched sources only. Under 400 words.

## Cost-TCO
You are THE COST-TCO architect for: {QUESTION} ({FRAME}). Follow 3-5yr total cost
of ownership: acquisition + operation (hosting, egress, observability, on-call) +
exit/migration cost. Do real web research for pricing models and hidden
operability costs. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST
EVIDENCE, 3-5 bullets, each with a cost figure + source URL + date. 3) THE ONE
THING only a cost architect would say (name a trade-off point). Real fetched
sources only. Under 400 words.

## Team-Fit-Risk
You are THE TEAM-FIT-RISK architect for: {QUESTION} ({FRAME}). Assess
maintainability, learning curve, hiring pool, lock-in, and delivery risk for each
option. Do real web research for adoption maturity (ThoughtWorks Radar ring),
ecosystem, and migration/exit risk. Return EXACTLY: 1) CORE POSITION in 2
sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each with a signal + source URL +
date. 3) THE ONE THING only a team/risk architect would say (name a trade-off
point). Real fetched sources only. Under 400 words.
````

- [ ] **Step 4: Write `references/modes/spike.md`**

````markdown
# spike lenses

Substitute `{QUESTION}` and a one-line `{FRAME}`. Spawn all four as parallel
general-purpose agents. Output feeds a build/plan — be concrete and actionable.

## Feasibility
You are THE FEASIBILITY analyst for: {QUESTION} ({FRAME}). Answer: can this be
done, with what, and what's the minimal viable path? Do real web research in
official docs, working examples, and GitHub repos that did it. Return EXACTLY:
1) CORE POSITION in 2 sentences (feasible? caveats?). 2) STRONGEST EVIDENCE, 3-5
bullets, each with a working example/doc + source URL + version. 3) THE ONE THING
only a feasibility analyst would say. Real fetched sources only. Under 400 words.

## Gotchas-Edge-cases
You are THE GOTCHAS analyst for: {QUESTION} ({FRAME}). Find what bites people in
practice. Do real web research in GitHub issues, bug trackers, and practitioner
threads for edge cases, footguns, and platform limits. Return EXACTLY: 1) CORE
POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each a concrete
gotcha + source URL + version it affects. 3) THE ONE THING only someone who hit
these would say. Real fetched sources only. Under 400 words.

## Best-Practice-Pattern
You are THE BEST-PRACTICE-PATTERN analyst for: {QUESTION} ({FRAME}). Find the
current recommended way to do this. Do real web research in official docs/guides
and maintainer recommendations (prefer normative over blog). Return EXACTLY: 1)
CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each a
recommended pattern + source URL + version. 3) THE ONE THING only an expert
practitioner would say. Real fetched sources only. Under 400 words.

## Integration-Fit
You are THE INTEGRATION-FIT analyst for: {QUESTION} ({FRAME}). Assess how cleanly
this fits a typical existing stack: APIs, compatibility, build/tooling, migration
surface. Do real web research for integration guides and compatibility notes.
Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5
bullets, each with a compatibility fact + source URL + version. 3) THE ONE THING
only an integrator would say. Real fetched sources only. Under 400 words.
````

- [ ] **Step 5: Write `references/modes/migration.md`**

````markdown
# migration lenses

Substitute `{QUESTION}` and a one-line `{FRAME}`. Spawn all four as parallel
general-purpose agents. Output is an ADR for the upgrade/migration path.

## Breaking-Changes
You are THE BREAKING-CHANGES analyst for: {QUESTION} ({FRAME}). Enumerate what
breaks between source and target. Do real web research in official migration
guides, release notes/CHANGELOGs, and the deprecation timeline. Return EXACTLY:
1) CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each a
specific breaking change + source URL + the versions it spans. 3) THE ONE THING
only someone who read the changelog would say. Real fetched sources only. Under 400 words.

## Effort-Risk
You are THE EFFORT-RISK analyst for: {QUESTION} ({FRAME}). Estimate migration
effort and risk: scope of code change, automation (codemods/tools), data risk,
phasing. Do real web research for migration tooling and reported real-world
migration effort/incidents. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2)
STRONGEST EVIDENCE, 3-5 bullets, each with a concrete effort/risk signal + source
URL + version. 3) THE ONE THING only someone who did this migration would say.
Real fetched sources only. Under 400 words.

## Rollback-Safety
You are THE ROLLBACK-SAFETY analyst for: {QUESTION} ({FRAME}). Answer: if the
migration goes wrong, can you reverse it, and how? Do real web research for
rollback/backward-compat guidance, dual-running strategies, and data
reversibility. Return EXACTLY: 1) CORE POSITION in 2 sentences. 2) STRONGEST
EVIDENCE, 3-5 bullets, each a rollback/compat fact + source URL + version. 3) THE
ONE THING only a release-safety engineer would say. Real fetched sources only.
Under 400 words.

## Compatibility-Interop
You are THE COMPATIBILITY-INTEROP analyst for: {QUESTION} ({FRAME}). Assess what
must coexist during the migration: API/protocol/data-format compatibility, version
support windows, dependency conflicts. Do real web research in compatibility
matrices and official support policies (incl. endoflife.date). Return EXACTLY: 1)
CORE POSITION in 2 sentences. 2) STRONGEST EVIDENCE, 3-5 bullets, each a
compatibility fact + source URL + version. 3) THE ONE THING only an interop
engineer would say. Real fetched sources only. Under 400 words.
````

- [ ] **Step 6: Verify every lens id in the CSV has a matching heading**

Run:
```bash
cd skills/software-research
for m in library-eval deep-research architecture spike migration; do
  csv=$(awk -F',' -v m="$m" '$1==m{print $3}' data/modes.csv | tr -d '"' | tr ';' '\n')
  for lens in $csv; do grep -q "^## $lens$" references/modes/$m.md || echo "MISSING: $m / $lens"; done
done; echo done
cd ../..
```
Expected: prints only `done` (no `MISSING:` lines).

- [ ] **Step 7: Commit**

```bash
git add skills/software-research/references/modes/
git commit -m "feat(software-research): add per-mode lens prompts"
```

---

### Task 5: HTML briefing template

**Files:**
- Create: `skills/software-research/assets/briefing-template.html`
- Reference (read-only, do not modify): `/Users/tannt/Downloads/Stanford_s Method Turns Claude Into a PHD Level Research Team/storm-research-report-template.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a self-contained HTML file with the STORM `<style>` block verbatim and `{{TOKEN}}` placeholders the Phase 3 synthesis fills. Tokens used: `{{TOPIC_TITLE}}`, `{{DATE}}`, `{{MODE}}`, `{{AUDIENCE}}`, `{{N}}/{{X}}/{{Y}}/{{Z}}`, `{{CEO_SUMMARY}}`, finding tokens (`{{FINDING_TITLE}}`, `{{RELCLASS}}`, `{{RELIABILITY_LABEL}}`, `{{SCORE}}`, `{{FINDING_BODY}}`, chips), `{{PRIMARY_URL}}`, version-currency tokens.

- [ ] **Step 1: Copy the STORM template as the starting point**

```bash
cp "/Users/tannt/Downloads/Stanford_s Method Turns Claude Into a PHD Level Research Team/storm-research-report-template.html" skills/software-research/assets/briefing-template.html
```

- [ ] **Step 2: Re-theme the copy for software research (text only; keep all CSS verbatim)**

Edit `skills/software-research/assets/briefing-template.html` — change ONLY the
prose/labels below; do NOT touch the `<style>` block:

- `<title>`: `Software Research: {{TOPIC_TITLE}}`.
- Top comment block: replace "STORM RESEARCH REPORT TEMPLATE" wording with
  "SOFTWARE RESEARCH BRIEFING TEMPLATE — clone, fill every {{TOKEN}}, keep the
  <style> block verbatim (clean white, Montserrat / Roboto Mono, blue accent)."
- `.eyebrow`: `Software Research · {{MODE}} · v2 (verified)`.
- `.lede`: `A multi-lens engineering synthesis. Every claim independently checked against its primary source — version-aware — before publication.`
- `.meta-row` `Method` span: `{{N_LENSES}} expert lenses ({{MODE}}) + contradiction map`.
- `.verify-banner` text: `All {{N}} citations independently checked against primary sources on {{DATE}}. Result: {{X}} corrected, {{Y}} demoted, {{Z}} version-stale. Confidence = source-tier evidence quality.`
- `.howto` bullets: replace the three with software-appropriate guidance:
  1. `The lens panel is author-constructed. Where lenses agree, treat it as a strong hypothesis, not field consensus.`
  2. `Confidence is scored 1-10 on source tier: primary docs/specs > security DBs (OSV/GHSA) > registries > reproducible benchmarks > sentiment surveys.`
  3. `Every claim is version-bound. A high score means the fact is verified for the stated version, not that it is the right choice for you.`
- Add a one-line version-currency note inside the `.howto` block or just under the
  verify-banner: `<p style="margin-top:10px;font-family:'Roboto Mono',monospace;font-size:12px;color:var(--muted);">Version currency: verified against {{VERSIONS_CHECKED}} as of {{DATE}}.</p>`
- Footer: `Software Research v2 · {{N}}/{{N}} citations verified against primary sources, {{DATE}} · {{X}} corrected, {{Y}} demoted, {{Z}} version-stale · Reliability = source-tier evidence quality`.

Leave all section structure (CEO summary, findings, hidden connection, missing
6th lens, actionable, claim-safety guide, frontier, references) intact — the
software synthesis maps onto these directly.

- [ ] **Step 3: Verify the style block is unchanged and tokens are present**

Run:
```bash
grep -c "Roboto Mono" skills/software-research/assets/briefing-template.html
grep -c "{{TOPIC_TITLE}}" skills/software-research/assets/briefing-template.html
grep -ci "storm" skills/software-research/assets/briefing-template.html
```
Expected: first ≥1 (fonts preserved), second ≥1 (token present), third `0` (no STORM branding left in the software template).

- [ ] **Step 4: Commit**

```bash
git add skills/software-research/assets/briefing-template.html
git commit -m "feat(software-research): add HTML briefing template"
```

---

### Task 6: ADR (MADR 4.x) markdown template

**Files:**
- Create: `skills/software-research/assets/adr-template.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a MADR 4.x skeleton the Phase 3 synthesis fills for `architecture` and `migration` modes.

- [ ] **Step 1: Write `skills/software-research/assets/adr-template.md`**

````markdown
# ADR-{{NNNN}}: {{DECISION_TITLE}}

- **Status:** {{Proposed | Accepted | Deprecated | Superseded by ADR-XXXX}}
- **Date:** {{YYYY-MM-DD}}
- **Deciders:** {{names / roles — default: tech-lead}}
- **Mode:** software-research / {{MODE}}

## Context and Problem Statement

{{Value-neutral facts, forces, and constraints. What problem motivates this
decision? Keep it factual; no recommendation yet.}}

## Decision Drivers

{{The quality attributes / NFRs that weigh on the choice — drawn from the lens
panel. e.g. scalability, reliability/operability, security, cost/TCO,
team-fit/risk. One bullet each.}}

## Considered Options

1. {{Option A}}
2. {{Option B}}
3. {{Option C}}

## Decision Outcome

Chosen option: **{{X}}**, because {{justification tied to the decision drivers and
the load-bearing verified finding}}.

### Consequences

- **Positive:** {{what becomes easier}}
- **Negative / trade-offs:** {{what becomes harder; the ATAM trade-off point —
  which attribute we sacrificed for which}}
- **Version currency:** {{verified against <versions> as of <date>}}

## Pros and Cons of the Options

### {{Option A}}
- Good: {{…}}
- Bad: {{…}}
- Evidence: {{primary-source URL + version}}

### {{Option B}}
- Good: {{…}}
- Bad: {{…}}
- Evidence: {{primary-source URL + version}}

{{repeat per option; always state why a rejected option was rejected}}

## Verification

- Claims checked: {{N}} · corrected: {{X}} · demoted: {{Y}} · version-stale: {{Z}}
- **Safe to assert:** {{verified claims}}
- **Assert with caveat:** {{attributed/qualified claims}}
- **Do not assert:** {{contested/unverified/version-stale claims}}

## More Information

{{Related ADRs, the HTML briefing path, spikes, RFCs, and the full reference list
with per-citation verification status + version/date.}}
````

- [ ] **Step 2: Verify the MADR sections are present**

Run: `grep -cE '^## (Context and Problem Statement|Decision Drivers|Considered Options|Decision Outcome|Pros and Cons of the Options|More Information)' skills/software-research/assets/adr-template.md`
Expected: `6`.

- [ ] **Step 3: Commit**

```bash
git add skills/software-research/assets/adr-template.md
git commit -m "feat(software-research): add MADR ADR template"
```

---

### Task 7: README row + plugin validation

**Files:**
- Modify: `README.md` (skills table, the rows between the `| Skill | Description | Category |` header and the section that follows — around lines 163-189).

**Interfaces:**
- Consumes: the completed skill folder.
- Produces: a discoverable table row + a green `claude plugin validate .`.

- [ ] **Step 1: Add the skills-table row**

In `README.md`, inside the skills table (after an existing `Development` row such
as the `mcp-builder` row), add:

```markdown
| [software-research](skills/software-research) | STORM-style, dev-specialized research: auto-detects a mode (library-eval, deep-research, architecture/ADR, spike, migration), runs expert lenses in parallel, and verifies every claim against primary sources (docs, RFCs, OSV/CVE, benchmarks) version-aware | Development |
```

- [ ] **Step 2: Validate plugin structure**

Run: `claude plugin validate .`
Expected: validation passes with no errors for `software-research` (frontmatter
`name`/`description` present, structure valid).

- [ ] **Step 3: Verify the skill folder is complete**

Run:
```bash
find skills/software-research -type f | sort
```
Expected (9 files):
```
skills/software-research/SKILL.md
skills/software-research/assets/adr-template.md
skills/software-research/assets/briefing-template.html
skills/software-research/data/modes.csv
skills/software-research/references/modes/architecture.md
skills/software-research/references/modes/deep-research.md
skills/software-research/references/modes/library-eval.md
skills/software-research/references/modes/migration.md
skills/software-research/references/modes/spike.md
skills/software-research/references/source-hierarchy.md
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(software-research): add skill to README table"
```

---

### Task 8: End-to-end smoke test (real run)

**Files:** none created — this is a runtime verification task.

**Interfaces:**
- Consumes: the installed skill.

- [ ] **Step 1: Install the skill locally**

Add `"<abs-path>/skills/software-research"` to the `skills` array in
`.claude/settings.json` (create the key if missing), then restart Claude Code.

Run (to confirm path): `pwd && ls skills/software-research/SKILL.md`
Expected: prints the repo path and the SKILL.md path.

- [ ] **Step 2: Run library-eval mode**

In Claude Code, ask: `should we use Zod vs Yup for schema validation?`
Expected: skill activates, auto-detects `library-eval`, states mode + interpretation
in one line, spawns 5 lenses, then verifies. Produces
`software-research-reports/zod-vs-yup-briefing.html` + `…-.md`. Spot-check that
2-3 citations resolve to real primary sources (OSV/GitHub/docs) WITH versions, and
the verification banner tally is truthful.

- [ ] **Step 3: Run architecture mode**

Ask: `write an ADR for event sourcing vs CRUD for our orders service`.
Expected: auto-detects `architecture`; produces `ADR-…md` (MADR sections present:
Context, Decision Drivers, Considered Options, Decision Outcome, Consequences,
Pros/Cons, More Information) + HTML. Rejected option has a stated reason.

- [ ] **Step 4: Run the ambiguity path**

Ask something matching multiple modes, e.g. `research upgrading and re-architecting
our GraphQL layer`. Expected: skill asks which mode (migration vs architecture)
rather than silently guessing.

- [ ] **Step 5: Confirm no fabrication / version-awareness**

Inspect one report's references: every entry has a primary URL + version/date; any
unverifiable claim is in the contested sidebar / "do not assert" column, not stated
as fact.

- [ ] **Step 6: Final commit (only if any fix was needed during smoke test)**

```bash
git add -A
git commit -m "fix(software-research): smoke-test corrections"
```

---

## Self-Review

**Spec coverage:**
- Standalone/dev-specialized positioning → Task 1 (SKILL.md description + "for non-software use deep-research" note). ✓
- 5 modes incl. migration, CSV-driven → Task 2. ✓
- Per-mode fixed lenses → Task 4 (verified against CSV in Step 6). ✓
- Source hierarchy (6 tiers) + 6 verification rules → Task 3. ✓
- Mandatory dev-source-aware verification, version-binding → Task 1 Phase 4 + Task 3. ✓
- Dual output HTML + MD/ADR → Tasks 5, 6; mode decides primary/secondary via CSV. ✓
- Auto-detect, ask-if-ambiguous → Task 1 Phase 0 + Task 8 Step 4. ✓
- File structure → Tasks 1-6 (verified in Task 7 Step 3). ✓
- README row + validation → Task 7. ✓
- End-to-end verification → Task 8. ✓

**Placeholder scan:** Template `{{TOKEN}}`s are intentional (filled at runtime), not plan placeholders. No "TBD/TODO/implement later". ✓

**Type consistency:** CSV `lenses` tokens match `## <Lens-Id>` headings (enforced by Task 4 Step 6 check). `mode_id` set identical across Tasks 1, 2, 4, 8. Output types (`html`/`md`/`adr`) consistent between CSV (Task 2) and synthesis (Task 1 Phase 3) and templates (Tasks 5, 6). ✓
