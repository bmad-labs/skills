# PO question card

The page a PO or PPO reads is a decision page. Each open item on it is a **card** with these parts, in this order:

| Part | What it holds |
| --- | --- |
| **ID · Topic** | Stable ID, then 2–6 plain words (`Q3 · Reminders outside pilot offices`). |
| **Source** | Story key + AC, comment date, or document name. Its own line, never inside the text. |
| **Today** | What the story says or the system does now, in 1–3 short sentences with real values. A conflict quotes both sides. |
| **Why it matters** | One sentence: what a customer, a user, or the business gets wrong if we choose wrongly or guess. |
| **Question** | One closed question of at most 25 words: yes / no, or "which option". It names one decision; "when … and what …" is two cards. A long proposed rule sits in Our recommendation, and the question asks to accept it. |
| **Options** | Only when the answer is not yes / no. Each option, then **→** its effect for the user or the business. Option (a) is our proposal. |
| **Our recommendation** | A label, then one reason. The label compares with what users get from the system **now**, not with the story text: **Keep as today** = users notice no change · **Change** = users get something different from now, also when the story asks for it (a new check, a new label, a new email) · **Your choice** = no proposal fits; the PO decides. |
| **Your answer** | Empty. |

## Page shape

1. **Summary first.** A table: what the PO must do, and how many items each action has: Answer · Confirm our proposal · Approve AC change · For information. Then one line: **Answer first:** the IDs that block design or the vote.
2. **Cards**, blocking items first, grouped by the summary actions.
3. **Change tables** (AC changes, new rules, stories not built) after the cards.
4. A section with no items is left out. The summary row says "None".
5. A card is a `>` quote. Markdown joins quote lines that touch, so put an empty `>` line between card parts and give each option its own `> - ` line, as in the example.

## Words

The PO reads every word. A word passes when the PO would use it in a meeting.

- Write what the user sees: "sent and waiting for the customer", not the status code. "The email service fails", not the vendor or API name.
- File names, code names, status codes, flag keys, versions, servers, and copies of a service stay in the developer documents.
- A card whose answer only changes how the system works inside (retries, locks, duplicates, timeouts) is a tech-lead item. Move it to the tech-lead list. If the user would notice the effect, the card keeps that effect in user words ("a customer can get the same reminder twice") and the cause goes to the tech lead.
- Define each business term once, under the summary. Then use that same word every time: not "member" in one card and "loyalty customer" in the next.

## Sentences

Each sentence is short (about 20 words), holds one idea, and names who acts: the customer, the agent, support, the system. Present tense for what happens today.

| Part | Write it like this |
| --- | --- |
| **Today** | Real values and a small scene: "An order placed on Friday gets its first reminder on Saturday." Two texts that disagree are quoted word for word, side by side. |
| **Why it matters** | Who is hurt, and how: a customer gets an extra email, an agent works twice, support gets a call, an order ships wrong, data reaches the wrong person. |
| **Question** | Asked in the positive ("Do stores outside the pilot keep sending reminders?"), never "should … not". No "please clarify", "confirm scope", or "TBD". When the PO already answered and newer story text disagrees, Today quotes both, and the question asks the PO to confirm the earlier answer: "Your answer of 12 Oct still holds: gift cards get no discount. Correct?" |
| **Options** | Each effect starts from what the user notices: "the customer sees one name on every email", not "the system reads another table". |
| **Our recommendation** | One reason that points to evidence the PO trusts: the story text, what users get today, or the goal of the story. |

## Rewrites

| Weak | Easy for the PO |
| --- | --- |
| "Reminders cover PAY_PENDING and PAY_RETRY. Does PAY_RETRY restart the count?" | "Today a reminder goes while the customer has not paid, also after a failed card payment. Does a failed payment start a new set of 2 reminders?" |
| "Please clarify the scope of the pilot list." | "AC3 says reminders go only to stores in the pilot list. Today every store sends reminders. Do stores outside the list keep sending them?" |
| "When does the virus check run, and what happens to a file that fails?" | Two cards: "When does the virus check run?" and "When one file fails, can the customer still send the other files?" |
| Why it matters: "AC2 and AC4 conflict." | Why it matters: "With AC2 a customer can get a reminder every day for weeks; with AC4 the customer gets 2." |
| Option: "(b) The system must read the contact from another data source." | Option: "(b) The store contact of the order **→** the customer sees one name for every message about the order." |
| "Should guest customers not get no reminder?" | "Do customers without an account get reminders?" |

## Example

> **Q4 · New return after a closed one** — 🔴 answer first
>
> **Source:** SHOP-123 AC2
>
> **Today:** AC2 says "one open return request per order". After a return is refunded or canceled, the order page hides the "Return item" button, but the system still accepts a new return.
>
> **Why it matters:** A customer whose return was canceled by mistake cannot ask again from the page, and support gets the call.
>
> **Question:** May a customer open a new return after the last one was refunded or canceled?
>
> **Options:**
> - **(a)** Yes, after canceled only **→** the customer can fix a mistake; a refunded order stays closed.
> - **(b)** Yes, always **→** the same order can be refunded twice.
> - **(c)** No, never **→** support must handle every repeat return.
>
> **Our recommendation:** **Change** to (a): it fixes the mistake case and keeps a refunded order closed.
>
> **Your answer:**

The same item written for a developer, which the PO cannot use: "`validateReturnRequest` gate is `!canCreate && !canView`; CANCELED/REFUNDED bypass — confirm. Searched: AC2, code facts."
