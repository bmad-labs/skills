# ADR-{{NNNN}}: {{DECISION_TITLE}}

- **Status:** {{Proposed | Accepted | Deprecated | Superseded by ADR-XXXX}}
- **Date:** {{YYYY-MM-DD}}
- **Deciders:** {{names / roles — default: tech-lead}}
- **Mode:** software-research / {{MODE}}

> **At a glance** — Decision: **{{the pick, in a few words}}**. Confidence:
> {{N}}/10 (source-tier). Main trade-off: {{one line}}. Decide-by / next check:
> {{the one thing to confirm, or "ready"}}.

<!-- Concreteness: name exact versions, cite specifics, tie to this team's stack/scale.
     No generic filler ("offers robust support for…"). See references/report-structure.md. -->

## Context and Problem Statement

{{Plain facts, forces, and constraints — short sentences with real specifics (versions,
scale numbers, the actual stack). What problem motivates this decision? Keep it factual;
no recommendation yet.}}

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

{{Related ADRs, the HTML briefing path, spikes, and any follow-up work. The full
source list lives in References below.}}

## References

Every source this decision rests on, with the version/date it applies to and its
verification status. Prefer primary sources (official docs, specs, changelogs,
security DBs) — a claim backed only by a blog or Q&A answer is not load-bearing.

<!-- one bullet per source. Status: Confirmed | Corrected | Contested | VersionStale.
     Make the source a real clickable Markdown link: [title](url) — NOT a bare URL,
     so it's clickable in every renderer. One link per URL (don't cram two in one). -->
- **[Confirmed]** [{{Source title}} — {{version / date}}]({{PRIMARY_URL}}) — {{the fact it supports}}.
- **[Corrected]** [{{Source title}} — {{version / date}}]({{PRIMARY_URL}}) — {{what changed on verification}}.
