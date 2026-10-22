# Guide — 05-<vendor>-integration

Level: High. One folder per two-way exchange with an outside party (request + answers). Sample: fraud vendor.

## _catalog.json + payload schemas — Messages both ways

**Rules (must).**
- Same catalog shape as `02-domain-events/`; rendered by the same `tools/render_events.py`.
- Every answer carries the attempt id and the message key copied from the request.
- One code per answer kind (completed, failed, status update). No "status" field that makes one code mean many things.
- The request carries only what the vendor needs. Config the vendor needs (score thresholds, rule set) is sent as its
  public subset; internal flags stay in our config.

**How to fill.** Agree the codes and topics with the vendor; draft request from the vendor's input needs; draft
answers from what our next step needs.

**Best practices.** Reserve a status-update message now if the vendor may send one later, but state that it is ignored today.

**Check.** Generator runs; examples valid; `asyncapi.yml` valid; negative test (answer without attempt id) fails.

## README.md — Integration contract

**Rules (must).** Message table, phase note (what the vendor must support now), flow block, rules table (ordering,
first answer wins, schema check, timeout, what the vendor reads, outage), files table.

**Best practices.** Write the rules as the vendor's checklist: each row is one thing their team must build or confirm.
Add every vendor question as a DQ item in the canon.

## asyncapi.yml — Both directions

**Rules (must).** One channel per topic; `send` for the request, `receive` for the answers; payloads `$ref` the
generated schemas.

**Check.** `npx -y @asyncapi/cli validate asyncapi.yml`.
