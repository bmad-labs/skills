# Guide — Package root

Templates: [`README.md`](README.md) (canon). Each folder has its own `GUIDE.md`. Sample names in machine files
(`order-service`, `ORD101`, `order.v1`) show a filled shape; replace them. Replace every `<placeholder>` in md.

## README.md — the canon

**Purpose.** The one place that names everything: folders, ids, topics, event codes, methods, transitions,
decisions, open items. Every other file uses its names.

**Rules (must).**
- Write it first, before any folder. Update it first when a name changes, then every folder that uses the name.
- Every code, topic, method, and status in the package appears here once.
- Every decision has an id (D1…) and says who decided (user + date, or agent default). Every open item has an id
  (DQ-1…), an owner who must answer, and the current `[ASSUMPTION]`.
- Precedence is stated: upstream architecture > canon > folder.
- The status transition table lives in one file: here, or in the upstream architecture, never both. The other
  links to it.
- A term the business and the contract use with different meanings (for example "mandatory" versus schema
  `required`) gets one line in a Terms table here.
- Latest state only. No history, no "changed from" notes; git holds history.

**How to fill.**
1. List the sources you read, one path each.
2. Fill Identifiers from the upstream architecture and the user's naming rules (topic pattern, error range).
3. Fill the Event catalog and API list as names only; the detail comes later in the folders.
4. Fill Status transitions from the requirements' state list.
5. Add each decision the user makes while reviewing folders.

**Best practices.**
- Keep rows short; link to the folder that holds the detail.
- Use the user's own terms (their ERD names, their sheet codes) before inventing new ones.
- Delete a folder row the level does not need; write why in "Adaptation".

**Check.**
- Every D-id and DQ-id cited anywhere in the package exists here (`grep -rhoE 'D[0-9]+|DQ-[0-9]+'`).
- Every event code in `02-domain-events/` and every method in `03-ingress-api/` is listed here.
