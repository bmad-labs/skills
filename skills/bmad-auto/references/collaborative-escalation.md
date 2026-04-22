# Collaborative Escalation Pattern

When a worker sub-agent cannot resolve an issue after 2 rounds of orchestrator feedback,
escalate by spawning a **researcher sub-agent** that collaborates directly with the stuck worker.
This preserves the worker's full implementation context while bringing in fresh research capability.

## Escalation Flow

1. **Orchestrator detects persistent blocker** — worker has failed to resolve after 2 feedback rounds.

2. **Orchestrator spawns researcher** in the same team:
```
Agent tool:
  name: "tech-researcher"
  team_name: "{TEAM_NAME}"  # use the same unique name generated at session startup
  prompt: |
    You are a BMAD team sub-agent. Do NOT make any git commits.
    After completing your work, report results to the team lead via SendMessage.
    If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
    You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
    When you receive a shutdown_request, approve it.

    ## Task: Technical Research for Blocker

    A teammate "<worker-name>" is blocked on: <blocker description>

    1. Invoke the Skill tool with:
       - skill: "bmad-bmm-technical-research"
       - args: "<research topic>"
    2. Read the research output file.
    3. Send findings directly to "<worker-name>" via SendMessage,
       including the file path and a summary of key findings.
    4. Collaborate with "<worker-name>" to resolve the issue via SendMessage —
       discuss approaches, answer questions, suggest alternatives.
    5. Report to the team lead when resolved or when you both agree it cannot be resolved.
```

3. **Orchestrator notifies the worker:**
```
SendMessage: {
  type: "message",
  recipient: "<worker-name>",
  content: "A researcher 'tech-researcher' is investigating your blocker.
    They will send you findings shortly. Collaborate directly via SendMessage.",
  summary: "Researcher assigned to help"
}
```

4. **Researcher and worker collaborate** — they exchange messages directly via `SendMessage`.
   The orchestrator monitors via idle notifications but does not relay messages.

5. **Resolution or timeout:**
   - **Resolved**: Worker reports success → orchestrator shuts down researcher → continue.
   - **Not resolved after 3 rounds** (1 round = researcher message + worker response + fix attempt):
     Worker or researcher reports failure → orchestrator shuts down both → reports to user and pauses.

## Key Principles

- The orchestrator does NOT relay messages between sub-agents. Researcher and worker communicate
  **peer-to-peer** via `SendMessage`.
- Always shut down the researcher after resolution or escalation failure.
- A "collaboration round" is defined as: one message from researcher + one response from worker +
  one fix attempt by the worker.

## Communication Quality

All messages between researcher and worker must be **specific and detailed** — not vague
hand-waving. Each message must include:

- **Context**: What was investigated, what the current state is, what has been tried.
- **Specifics**: Exact file paths, line numbers, error messages, code snippets.
- **Reasoning**: Why an approach is recommended, what trade-offs exist, what could go wrong.
- **Actionable next step**: What exactly the recipient should do with this information.

**Bad**: "I found some documentation about the issue. Try a different approach."

**Good**: "I researched the SQLAlchemy connection pooling issue. The root cause is that
`create_engine()` in `src/db/connection.py:23` uses `pool_size=5` but the app spawns 20
worker threads (see `src/app.py:45`). Each thread needs its own connection, so the pool is
exhausted. Fix: change `pool_size=20` and add `max_overflow=10` as a buffer. Reference:
SQLAlchemy docs confirm pool_size should be >= worker count. I've saved the full research
to `_bmad-output/research/connection-pooling.md`."
