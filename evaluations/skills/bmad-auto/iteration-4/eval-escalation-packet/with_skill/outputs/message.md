## Task
Collaborate peer-to-peer with teammate `story-developer` (still alive in this team) to unblock story 3-1 — payment provider integration. The developer has exhausted 2 rounds of orchestrator feedback; both attempts failed with different root causes (verbatim below). You and the developer communicate directly via `SendMessage` — I (team-lead) will NOT relay. This is Tier 2 of the escalation ladder: you have up to 3 collaboration rounds (1 round = your message + developer's response + developer's fix attempt) before I shut you both down and halt for the user.

## Why this matters
Story 3-1 is on the critical path for Epic 3 (payment integration) and blocks 6 downstream stories. Every idle day compounds schedule risk across the whole epic. A workaround that compromises TLS verification (e.g., `NODE_TLS_REJECT_UNAUTHORIZED=0`, `rejectUnauthorized: false`, a custom agent that skips cert validation) is explicitly NOT acceptable — we are integrating with a payment provider and silent MITM exposure is a hard no. The correct fix must preserve full certificate chain validation.

The developer has already burned two plausible-looking paths (ESM upgrade, v2 pin). A third naive attempt will likely burn another round. Your job is to bring research depth the developer didn't have time for, decide the right architectural direction, and pair through the fix.

## Prior findings (developer's last 2 reports, verbatim)
> Round 1 attempt: upgraded `node-fetch` to v3 per suggestion. Failure: `ERR_REQUIRE_ESM` — our codebase is CJS and v3 is ESM-only.
>
> Round 2 attempt: pinned `node-fetch` at v2.7.0 and added `@types/node-fetch`. Failure: TLS handshake rejects the payment provider's cert chain. The provider's intermediate CA isn't in Node 18's default bundle.

Annotation: the two failures are independent — the module-system issue (CJS vs ESM) and the TLS trust-store issue (missing intermediate CA) are orthogonal. Any viable solution must address both simultaneously, not just one.

## Specific actions requested
1. Read the developer's full transcripts at `_bmad-output/implementation-artifacts/story-3-1-*.log` and the story file at `_bmad-output/implementation-artifacts/story-3-1.md` (including its AC).
2. Read `package.json` to confirm the module system (CJS), Node engine target, and current HTTP-client deps.
3. Read `_bmad-output/planning-artifacts/architecture.md` §External integrations for any constraint on HTTP client choice or TLS handling already decided at the architecture layer.
4. Evaluate at minimum these three options and pick one (or propose a better one with equivalent rigor):
   - **(a) Migrate just the payment integration file(s) to ESM** via dynamic `import()` from CJS, keeping the rest of the codebase CJS. Trade-off: ergonomic cost at the boundary, but leaves the rest of the codebase untouched.
   - **(b) Switch the HTTP client to `undici`** (CJS-compatible, built into Node 18+, modern TLS stack, supports a custom `Agent` with extended CA). Trade-off: new dependency surface; confirm it's actually CJS-importable on our Node version.
   - **(c) Keep `node-fetch@2` and extend the trust store** via `NODE_EXTRA_CA_CERTS` pointing at a file containing the provider's intermediate CA (checked into the repo under e.g. `certs/` or loaded from env), or via a per-request `https.Agent({ ca: [...] })`. Trade-off: operational — someone has to own CA rotation.
   Key research question for each: does it cleanly solve BOTH the module-system issue AND the missing-CA issue, without disabling cert validation anywhere?
5. `SendMessage` directly to `story-developer` with: your recommended option (a/b/c/other), the 2-3 line rationale, the concrete code/config changes to make (file path + snippet), and what to verify. Include the path to your full research file.
6. Pair with the developer through the fix: answer follow-ups, review their diff if they share it, suggest adjustments. Stay in the conversation until either the AC passes or you both agree the approach needs to change.
7. If after 3 collaboration rounds the issue is not resolved, report failure to team-lead with the full state.

## Knowledge sources to consult
- `CLAUDE.md` — project-wide rules (module system, dependency policy, any TLS conventions)
- `package.json` — confirm `"type"` field, Node engine, existing HTTP-client deps
- `_bmad-output/planning-artifacts/architecture.md` §External integrations — architectural constraints on how we integrate with external services
- Story file: `_bmad-output/implementation-artifacts/story-3-1.md` — AC you must satisfy (especially any AC about successful sandbox charge)
- Developer transcripts: `_bmad-output/implementation-artifacts/story-3-1-*.log` — exact error output, stack traces, what was tried at each layer
- Payment provider's integration/security docs — look specifically for their published CA chain, recommended clients, and whether they expect `NODE_EXTRA_CA_CERTS` or in-code `ca` injection
- Node.js 18 TLS docs — how `NODE_EXTRA_CA_CERTS` interacts with the default root store, `https.Agent` ca option semantics
- `undici` docs — CJS compatibility on Node 18, `Agent` / `Dispatcher` with custom CA

## Relevant skills
- Invoke `bmad-bmm-technical-research` with args describing the research topic (CJS-compatible Node HTTP client + custom CA handling for payment-provider TLS). Save the research output so the developer and reviewer can cite it.
- `claude-api` only if the payment provider ships an official SDK worth preferring over raw HTTP — check first; if so, it supersedes the fetch-client question entirely.
- `typescript-clean-code` for the resulting code shape (error handling, retry boundaries, where the HTTP-client abstraction lives).

## Success criteria
- Story 3-1's AC passes: a real (sandbox) auth + charge against the payment provider succeeds end-to-end.
- TLS certificate verification remains fully enabled — no `rejectUnauthorized: false`, no `NODE_TLS_REJECT_UNAUTHORIZED=0`, no custom agent that skips validation. Grepping the diff for those strings returns zero hits.
- The module-system issue is cleanly resolved — no new `ERR_REQUIRE_ESM` at runtime, build and tests pass under the project's existing CJS config.
- The chosen approach is documented in a short comment near the integration point (why this client, why this CA-handling strategy) so future reviewers don't relitigate.
- Resolution reached within 3 collaboration rounds.

## Report back with (to team-lead, once resolved or escalation-failed)
- The decision you and the developer landed on (option a/b/c/other) and a 2-line rationale.
- Verification evidence: the sandbox call succeeded (log excerpt or test output), cert validation still on (diff grep result).
- Path to the research artifact you produced via `bmad-bmm-technical-research`.
- Any project-context update worth persisting (e.g., "HTTP client is now `undici`; provider intermediate CA lives at `certs/provider-ca.pem` and is loaded via `NODE_EXTRA_CA_CERTS`").
- Round count used (1, 2, or 3) and any remaining risks.
