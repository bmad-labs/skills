# <Product / Feature> — Items for PO

For: PO of <epic / product>.
From: <team>, <YYYY-MM-DD>.

We read <N> stories and listed open questions. <Who> answered part of them. This page has the business items left for you. The tech lead handles the technical items.

## Summary

| What we need from you | Items |
| --- | --- |
| [Answer a question](#1-questions-with-no-answer-yet) | <n, or "None"> |
| [Confirm our proposal](#2-please-confirm-our-proposal) | <n> |
| [Approve AC changes](#3-ac-changes-from-our-decisions), then we update Jira | <n> |
| [Add new rules to Jira](#4-new-rules-not-in-any-story) | <n> |
| [Stories we will not build](#5-stories-we-will-not-build) — for information | <n> |

**Answer first:** <IDs that block design, for example Q2, Q5 — or "nothing blocks design">.

Reply under "Your answer" on each card, or reply with the ID (`Q`, `G`, `A`, `N`).

Attached files (send with this page): <files the PO cannot open in the repo, or delete this line>.

Terms used here:
- **<term>** = <definition>. <Mark values that are not final: "proposed (see Q#)".>

<!-- Every card follows references/po-question-card.md. Blocking cards first in each section.
     Leave out a section with no items; its summary row says "None". -->

## 1. Questions with no answer yet

<!-- Cards where we have no proposal, or the PO must choose. Recommendation label: Your choice. -->

> **Q<n> · <topic in 2–6 words>** — <🔴 answer first, or delete>
>
> **Source:** [<KEY>](<url>) AC<n>
>
> **Today:** <what the story says or the system does now; both sides of a conflict quoted>
>
> **Why it matters:** <what a customer, a user, or the business gets wrong if we choose wrongly>
>
> **Question:** <one closed question>
>
> **Options:**
> - **(a)** <option> **→** <effect for the user>.
> - **(b)** <option> **→** <effect>.
>
> **Our recommendation:** **Your choice** — <why no option is clearly better>
>
> **Your answer:**

## 2. Please confirm our proposal

<!-- Cards with a real proposal. Gaps found in review (G#) are cards here too. -->

> **Q<n> · <topic>**
>
> **Source:** [<KEY>](<url>) AC<n>
>
> **Today:** <what the story says or the system does now>
>
> **Why it matters:** <effect of a wrong guess>
>
> **Question:** <yes / no question about our proposal>
>
> **Our recommendation:** **Keep as today** | **Change** — <proposal and one reason>
>
> **Your answer:**

## 3. AC changes from our decisions

| # | Story, AC | Current text (Jira) | New text | Q |
| --- | --- | --- | --- | --- |
| A1 | [<KEY>](<url>) AC<n> | "<quote>" | <new rule> | Q<n> |

## 4. New rules not in any story

| # | Rule | Suggested story | Q |
| --- | --- | --- | --- |
| N1 | <rule a user or PO would notice> | [<KEY>](<url>) | Q<n> |

## 5. Stories we will not build

| Story | Title | Reason | Q |
| --- | --- | --- | --- |
| [<KEY>](<url>) | <title> | <reason> | Q<n> |
