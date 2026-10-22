# Where questions come from

Check every source for each pattern. Each hit becomes one question (ID, source, both sides, proposal, audience).

| Pattern | Look for | Example question |
| --- | --- | --- |
| Internal contradiction | A table row and an AC that disagree; a title and a body that disagree | "Scenario 4 says 'refund to the original card'. AC6 says 'refund as store credit'. Which is right? Proposal: card when possible, else store credit." |
| Pattern vs example | Format `000001` but examples `100000` | "Which format is correct?" |
| Missing case | Values listed for 3 of 4 levels; a branch with no result | "AC1 covers `Gold`, AC3 covers `Bronze`. `Silver` is not covered. Free shipping or not?" |
| Cross-story conflict | Same field with different names or values; one story moves an item, another says it stays | "STORY-12 says 'Fulfilment Status', STORY-15 says 'Shipping Status'. Same field?" |
| Undefined term or screen | A tab, stage, or role that no story defines | "AC2 names a 'Review' tab. No story defines it. Full menu list?" |
| Reference to outside material | "same as screen X", "refer to sheet", Figma with no link | Pull it, trace code, or ask for a local copy |
| Duplicate or placeholder story | Near-same title and AC; title only, no AC | "Does STORY-31 replace STORY-07?" / "Story has no AC. Intent?" |
| Author note left in text | "Pending review?", "TBD", notes in another language | "What does the note mean?" (quote it, translate the meaning, never change the story text) |
| UI text defects | Typos, three versions of one message | "Exact text: A, B, or C?" |
| Unit of work | Per request vs per item; partial success | "Some succeed, some fail: partial or all-or-nothing? Proposal: partial." |
| Boundary with other systems | Who creates, who owns, who is notified | "Does Order Service create the shipment, or another service?" |
| Edge and failure paths | Timeout, retry, duplicate, concurrent edit, empty list, zero items | Usually technical → `confirm-tech.md` |
| Scope and data exposure | Visibility, roles, personal data retention | Business → PO, even when technical in shape |

## Audience test

- Does the answer change what a user sees, does, or is allowed to do, or a business rule or target? → **PO** (`confirm-po.md`).
- Does the answer change only how the system does it (queues, locks, keys, timeouts, retries, caching)? → **Tech lead** (`confirm-tech.md`).
- Both → split into two rows.

## Answer handling

- Keep the answer verbatim in the Answer column. Write your reading in a separate Decisions table ("How we read the answers — correct any row we read wrong").
- Partly answered → status `Partly answered`; list the rest under "Still open".
- An answer that changes a story AC → a row in the AC change table of `confirm-po.md`.
- An answer that sends an item to another person ("need to confirm with PO") → move it to that person's file with a new ID; keep a pointer.
