/**
 * history.mjs — Read an issue's change history, and diff the long text edits in it.
 *
 * Library, no command line. `fetch-issue.mjs --part history` calls it.
 *
 * The changelog stores every edit of a rich-text field as the whole value before
 * and after. Acceptance Criteria on a real story run to 5,000 characters and are
 * edited a dozen times, so writing both values per edit would bury the one line
 * that changed. A unified diff keeps only that line and its context, and loses
 * nothing: applied in reverse from the current value, the chain of diffs rebuilds
 * every earlier version.
 */

import { getAllPages } from './jira-api.mjs';

/**
 * Above this length a value stops fitting a table cell and is written as a diff.
 * 120 keeps a status, a sprint name, a summary or an attachment name inline — the
 * longest summary on the project is 183 characters, and it reads fine as a diff of
 * one line.
 */
const TEXT_EDIT_CHARS = 120;

export function isTextEdit(value) {
  if (value === null || value === undefined) return false;
  const s = String(value);
  return s.includes('\n') || s.length > TEXT_EDIT_CHARS;
}

function splitLines(text) {
  if (text === null || text === undefined || text === '') return [];
  return String(text).replace(/\r\n?/g, '\n').split('\n');
}

/**
 * Unified diff of two values, line by line, as the lines of each hunk with its
 * `@@` header. `context` unchanged lines are kept on each side of a change.
 */
export function lineDiff(from, to, context = 2) {
  const a = splitLines(from);
  const b = splitLines(to);
  const n = a.length;
  const m = b.length;

  // Longest common subsequence, filled from the end so the walk below goes forward.
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Each op records how many old (i) and new (j) lines precede it, for the headers.
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ mark: ' ', text: a[i], i, j });
      i++; j++;
    } else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      ops.push({ mark: '-', text: a[i], i, j });
      i++;
    } else {
      ops.push({ mark: '+', text: b[j], i, j });
      j++;
    }
  }

  const changed = ops.flatMap((op, k) => (op.mark === ' ' ? [] : [k]));
  const out = [];
  for (let c = 0; c < changed.length; c++) {
    const first = changed[c];
    // Changes closer than two contexts share their context lines, so one hunk.
    while (c + 1 < changed.length && changed[c + 1] - changed[c] - 1 <= 2 * context) c++;
    const last = changed[c];

    const span = ops.slice(Math.max(0, first - context), Math.min(ops.length, last + context + 1));
    const oldCount = span.filter((op) => op.mark !== '+').length;
    const newCount = span.filter((op) => op.mark !== '-').length;
    // An empty side names the line before it, as `diff -u` does: `-0,0` for a new value.
    const oldStart = oldCount ? span[0].i + 1 : span[0].i;
    const newStart = newCount ? span[0].j + 1 : span[0].j;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of span) out.push(op.mark + op.text);
  }
  return out;
}

/** A code fence longer than any backtick run in the text, so the text cannot close it. */
export function fenceFor(text) {
  const runs = String(text).match(/`{3,}/g) || [];
  return '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
}

// A changelog item is parsed JSON, so `toString` is an own property when present.
// Read it through hasOwn: on an item without one, `item.toString` is Object's method.
const own = (obj, name) => (Object.hasOwn(obj, name) ? obj[name] : undefined);

/**
 * Changelog rows as the history document needs them: oldest first, one display
 * value per side. The display string is what Jira's History tab shows; the raw
 * value is an id, used only when no display string exists.
 */
export function toChanges(rows) {
  return rows
    .map((r) => ({
      id: String(r.id),
      author: r.author?.displayName || 'Unknown',
      created: r.created || '',
      items: (r.items || []).map((it) => ({
        field: it.field,
        from: own(it, 'fromString') ?? own(it, 'from') ?? null,
        to: own(it, 'toString') ?? own(it, 'to') ?? null,
      })),
    }))
    .sort((x, y) => Date.parse(x.created) - Date.parse(y.created));
}

/**
 * The change history of the issue and of each subtask, each paged to its own total.
 * A subtask the account cannot read is kept as unreadable, so the document still
 * names every subtask the issue has.
 */
export async function fetchHistory(cred, issue, subtaskRefs, pageSize) {
  const refs = [{ key: issue.key, summary: issue.fields?.summary || '' }, ...subtaskRefs];
  const out = [];
  for (const ref of refs) {
    const { rows, total, unreadable } = await getAllPages(
      cred, `/rest/api/3/issue/${ref.key}/changelog`, 'values', { pageSize, soft: true }
    );
    out.push({ key: ref.key, summary: ref.summary, readable: !unreadable, total, changes: toChanges(rows) });
  }
  return out;
}
