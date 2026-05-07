# Escalation & Researcher Use

The researcher (`tech-researcher`) shows up in two situations:

- **Planning-phase consultation** — the leader hits an unclear intent, architecture, approach, or library/pattern choice during story creation, quick-spec, or its own decision-making. Spawn the researcher freely as a one-shot consultant, get the answer, shut it down. No peer worker involved.
- **Worker-stuck escalation** — a sub-agent has failed to resolve a technical issue after 2 rounds of leader feedback. Spawn the researcher as a peer to the stuck worker; they collaborate via SendMessage; leader monitors.

Both paths use the same `Agent` spawn shape (below). They differ in what the researcher does after spawning.

## Quick check before spawning (sequence, not a gate)

These are fast lookups, not bureaucracy. Run through them in order, then spawn:

1. **Memory check.** Search `{MEMORY_SOURCES}` (vault, memory MCP, auto-loaded MEMORY index) and `{KNOWLEDGE_PATHS}` (project rules) for an existing answer. If the user has a prior decision on this exact topic, apply it and cite the source — no spawn needed.
2. **Is the question technical-research-shaped?** Researchers are good at: library/framework choice, design pattern selection, dependency conflicts, error decoding, API/SDK behavior, performance bottlenecks, idiomatic-code questions. Researchers cannot answer: scope decisions, PRD gaps, business priorities, "which feature first?", infrastructure the user controls (API keys, accounts). Those go to the user (Tier 3 / halt).
3. **Can you state the question concretely?** One specific paragraph. "Help me decide on observability" is too vague — "Choose between OpenTelemetry SDK and Pino+pino-http for a NestJS app that already exports Prometheus metrics; need backwards compatibility with existing Grafana dashboards" is concrete. If you can't be concrete yet, investigate one more round before researching.
4. **(Worker-stuck path only) Is the worker alive and able to collaborate?** Tier 2 is peer collaboration, not a handoff. If the worker has been shut down or is broken, respawn it first or skip to Tier 3.

If memory or project rules already answered it → apply that. If the question isn't research-shaped → halt to user (Tier 3). Otherwise → spawn the researcher.

This isn't a high bar to clear. It's a short pre-flight to avoid wasting a researcher on a question memory already answered or that the user needs to settle directly.

## Worker-stuck ladder (the original three tiers)

When a sub-agent gets stuck on a technical issue, follow:

1. **Leader feedback** — up to 2 rounds of Delegation Packets with concrete fix instructions.
2. **Collaborative researcher** — spawn `tech-researcher` peer-to-peer with the stuck worker, up to 3 message rounds. Leader monitors but does not relay.
3. **Halt for user** — shut down everyone, report full context, wait.

## Tier 1 — Leader feedback (up to 2 rounds)

The first response to any sub-agent issue. Leader sends a Delegation Packet (see `delegation-packet.md`) with:

- *Prior findings verbatim* — the agent's own report, copied unchanged.
- *Specific actions* — concrete fix instructions, file path + line.
- *Knowledge sources* — the project rule files relevant to the issue.
- *Success criteria* — what "fixed" looks like.
- Round number: "Round 1/2" or "Round 2/2".

If after 2 rounds the agent still can't resolve it, move to Tier 2.

---

## Planning-phase researcher (one-shot consultation)

Use when the leader hits an unclear intent, architecture, approach, library choice, or design pattern during story creation, quick-spec authoring, or its own decision-making. Memory was checked first and didn't have the answer; the question is technical-research-shaped; you can state it concretely. Spawn, get the answer, shut down.

This is NOT peer-to-worker — there's no worker yet (often the question comes up *before* developing). The researcher reports back to team-lead directly.

### Spawn prompt (planning-phase)

When you fill in `{AGENT_HEADER}`, the bmad-auto context block fields look like:
- Flow: <Phase 4 | Quick Flow>
- Mode: <whatever the session mode is>
- Your specific role: one-shot tech-researcher consulting the leader on a planning-phase question (e.g. library choice, design pattern, architecture approach). No peer worker — report findings directly to team-lead.
- What the leader will do with your output: read your recommendation, factor it into the story spec / tech-spec / architectural decision, then shut you down. The leader makes the final call.

```
Agent tool:
  name: "tech-researcher"
  team_name: "{TEAM_NAME}"   # or omit in main-mode one-shot use
  subagent_type: "general-purpose"
  model: "opus"
  effort: "xhigh"   # omit if {EFFORT_SUPPORTED}=false
  prompt: |
    {AGENT_HEADER with the four bracketed fields above filled in concretely}

    ## Task
    Research and recommend an approach for: <one-paragraph concrete question>

    ## Skill to invoke
    bmad-bmm-technical-research, args: "<research topic>"

    ## What I (team-lead) need from you
    1. Run the technical-research skill on the question above.
    2. Report back via SendMessage to "team-lead" with:
       - A specific recommendation (named library / pattern / approach, not a category)
       - The trade-offs (what you give up by choosing it)
       - What you ruled out and why (so I can sanity-check)
       - The research file path
       - Any caveats (compatibility, version pins, known gotchas)
    3. Wait for shutdown_request — do not start implementation.

    ## Project Context
    Knowledge sources: {KNOWLEDGE_PATHS}
    Architecture & PRD: _bmad-output/planning-artifacts/
    Existing prior decisions I already checked: <list any {MEMORY_SOURCES} entries that were
    related but didn't fully answer this question — saves duplicate research>

    ## Hard rules
    - Never commit to git.
    - Never make the decision yourself — I make the call from your recommendation.
    - Be specific. "Use OpenTelemetry" is too broad; "Use @opentelemetry/sdk-node v0.45 with
      the http auto-instrumentation; export to Prometheus via @opentelemetry/exporter-prometheus
      v0.45" is what I need.
    - When you receive shutdown_request, approve it.
```

After the researcher reports: leader applies the recommendation (or asks the user if it changes scope), then shuts the researcher down. Don't keep it alive across multiple unrelated questions — spawn a fresh one if a new planning question comes up later.

---

## Tier 2 — Worker-stuck collaborative escalation (up to 3 message rounds)

Leader spawns a `tech-researcher` sub-agent in the same team. The researcher and the stuck worker collaborate **peer-to-peer** via `SendMessage`. The leader does NOT relay messages — it monitors and only intervenes to shut down.

A "round" = one researcher message + one worker response + one fix attempt by the worker.

### Researcher spawn prompt

When you fill in `{AGENT_HEADER}`, the bmad-auto context block fields look like:
- Flow: <Phase 4 | Quick Flow>
- Mode: <whatever the session mode is>
- Your specific role: tech-researcher escalation peer for `<worker-name>`, who has been blocked through 2 leader-feedback rounds. You collaborate peer-to-peer with the worker; you do NOT report through team-lead for routine messages.
- What the leader will do with your output: monitor your collaboration via team channels. The leader intervenes only to shut down the researcher (resolved) or to halt to user (Tier 3). You report a final outcome to team-lead when the worker is unblocked or when you both agree it can't be resolved.

```
Agent tool:
  name: "tech-researcher"
  team_name: "{TEAM_NAME}"
  subagent_type: "general-purpose"
  model: "opus"
  effort: "xhigh"   # omit if {EFFORT_SUPPORTED}=false
  prompt: |
    {AGENT_HEADER with the four bracketed fields above filled in concretely}

    ## Task
    A teammate "<worker-name>" is blocked on: <blocker description from worker's reports>.

    ## Skill to invoke
    bmad-bmm-technical-research, args: "<research topic>"

    ## How to collaborate
    1. Run the technical-research skill. Read the resulting research file.
    2. Send your findings directly to "<worker-name>" via SendMessage. Include:
       - The research file path
       - A specific recommendation (not "try a different approach" — name the approach,
         the file path, the change to make, the trade-offs)
       - The reasoning so the worker can adapt if your suggestion misses an edge case
    3. The worker will attempt the fix and report back to you. Iterate up to 3 rounds.
    4. Report to "team-lead" when resolved or when both of you agree it can't be resolved.

    ## Hard rules
    - Never commit to git.
    - Never make scope decisions for the worker. Recommend, don't dictate.
    - Send specifics. "Try undici with cert pinning" beats "try a different HTTP library."
    - When you receive shutdown_request, approve it.

    ## Project Context
    Knowledge sources: {KNOWLEDGE_PATHS}
    Architecture & PRD: _bmad-output/planning-artifacts/
```

### Notify the worker

After spawning, send the worker a heads-up so they know who's about to message them:

```
SendMessage:
  recipient: "<worker-name>"
  type: "message"
  content: "A researcher 'tech-researcher' is investigating your blocker. They will message
    you directly with findings. Collaborate via SendMessage — I (team-lead) won't relay."
  summary: "Researcher assigned"
```

### Resolution

- **Resolved**: worker reports success → leader shuts down researcher → flow continues.
- **Not resolved after 3 rounds**: worker or researcher reports failure → leader shuts down both → Tier 3.

### Communication quality bar

All messages between researcher and worker must include:

- **Context** — what was investigated, current state, what's been tried.
- **Specifics** — exact file paths, line numbers, error messages, snippets.
- **Reasoning** — why this approach, what trade-offs, what could go wrong.
- **Actionable next step** — what exactly the recipient should do.

**Bad**: "I found some documentation about the issue. Try a different approach."

**Good**: "Researched the SQLAlchemy connection pooling issue. Root cause: `create_engine()` in `src/db/connection.py:23` uses `pool_size=5` but the app spawns 20 worker threads (`src/app.py:45`). Each thread needs its own connection, so the pool is exhausted. Fix: change `pool_size=20` and add `max_overflow=10` as buffer. Reference: SQLAlchemy docs confirm pool_size should be ≥ worker count. Full research at `_bmad-output/research/connection-pooling.md`."

If a researcher or worker sends a vague message, the leader steps in once to ask for specifics — then if quality stays poor, escalate to Tier 3.

## Tier 3 — Halt for user

Last resort. Leader:

1. Shuts down all alive sub-agents (sm, developer, tester, researcher, anyone else).
2. Reports the full picture to the user:
   - What story / spec was being worked on.
   - What the blocker is (root cause if known, symptoms otherwise).
   - All approaches tried (Tier 1 rounds + Tier 2 rounds).
   - The researcher's findings (if any).
   - The leader's recommendation, with trade-offs (e.g. "we could ship without this AC, file a follow-up; or we could pivot to approach X which the researcher flagged as a concern").
3. Waits for the user's decision.

The leader does not invent a path forward when both Tiers 1 and 2 have failed. That's the user's call.

## When the leader skips straight to Tier 3

Some problems are obviously not solvable by a sub-agent and shouldn't burn rounds:

- **Architectural decisions** (e.g., "should we add a new microservice?") — Tier 3 immediately. Optionally invoke `Skill: "bmad-bmm-correct-course"` first.
- **External dependencies the user controls** (e.g., "we need an API key from a third party") — Tier 3 immediately.
- **Spec ambiguity that requires the user's intent** (e.g., "the AC says X but the architecture implies Y; which?") — Tier 3 immediately.

Tier 1 and Tier 2 are for *technical* problems where more research or a fresh angle plausibly helps. Don't waste rounds on problems where the answer fundamentally lives outside the codebase.
