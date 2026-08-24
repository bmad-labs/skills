#!/usr/bin/env node
/**
 * inspect.mjs — Read-only probes the setup workflow asks Jira before writing a
 * config. Nothing here changes anything in Jira.
 *
 * The field list is the reason this exists. A custom field id says nothing on its
 * own — `customfield_NNNNN` could be anything — so `fields` joins the global
 * field list, which has the display names, to one real issue of that type, which
 * shows what the type actually carries and what a value looks like. That is what
 * makes choosing fields an informed choice rather than a guess.
 *
 * Usage:
 *   inspect.mjs projects
 *   inspect.mjs issue-types <PROJECT-KEY>
 *   inspect.mjs sample <PROJECT-KEY> --type <TYPE>
 *   inspect.mjs fields <PROJECT-KEY> --type <TYPE> [--sample KEY] [--json]
 *   inspect.mjs board <PROJECT-KEY>
 *   inspect.mjs count-type <PROJECT-KEY> --type <TYPE>
 */

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, apiGet, apiGetSoft } from './jira-api.mjs';

/** Post a JQL search. Jira Cloud's newer endpoint is POST /search/jql. */
async function search(cred, jql, { fields = ['summary'], maxResults = 5 } = {}) {
  const res = await fetch(`https://${cred.domain}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: cred.auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jql, fields, maxResults }),
  });
  if (!res.ok) {
    console.error(`Search failed: ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(1);
  }
  return res.json();
}

/** Quote a value for JQL, so a type name containing a space still works. */
function jqlValue(v) {
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

/**
 * Shorten a field value to something readable in a chooser list. The point is to
 * show enough that the reader recognises the field, not to reproduce it.
 */
function preview(value, limit = 90) {
  if (value === null || value === undefined) return null;

  let text;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else if (Array.isArray(value)) {
    if (!value.length) return null;
    text = value.map((v) => (v && typeof v === 'object' ? v.name || v.value || v.displayName || v.key || '?' : String(v))).join(', ');
  } else if (typeof value === 'object') {
    // An ADF document: pull its text nodes out so the preview shows words rather
    // than a node tree.
    if (value.type === 'doc') {
      const parts = [];
      const walk = (n) => {
        if (!n) return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.text) parts.push(n.text);
        if (n.content) walk(n.content);
      };
      walk(value.content);
      text = parts.join(' ');
    } else {
      text = value.name || value.value || value.displayName || value.key || JSON.stringify(value);
    }
  } else {
    text = String(value);
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Guess the config's `type` for a field from its schema, so a chosen field
 * arrives in the config with a usable type rather than a blank.
 */
function configType(schema) {
  if (!schema) return 'string';
  if (schema.type === 'doc' || schema.custom?.endsWith('textarea')) return 'adf';
  if (schema.type === 'option' || schema.type === 'priority' || schema.type === 'status') return 'option';
  if (schema.type === 'array') return 'array';
  if (schema.type === 'number') return 'number';
  if (schema.type === 'date' || schema.type === 'datetime') return 'date';
  if (schema.type === 'user') return 'user';
  return 'string';
}

async function cmdProjects(cred) {
  const data = await apiGet(cred, '/rest/api/3/project/search?maxResults=100');
  const rows = (data.values || []).map((p) => ({
    key: p.key,
    name: p.name,
    type: p.projectTypeKey,
    lead: p.lead?.displayName || null,
  }));
  console.log(JSON.stringify(rows, null, 2));
}

async function cmdIssueTypes(cred, projectKey) {
  const data = await apiGet(cred, `/rest/api/3/issue/createmeta/${projectKey}/issuetypes?maxResults=100`);
  const rows = (data.values || data.issueTypes || []).map((t) => ({
    id: t.id,
    name: t.name,
    subtask: !!t.subtask,
    description: t.description || null,
  }));
  console.log(JSON.stringify(rows, null, 2));
}

/** One real issue of this type, newest first — the sample the field list joins to. */
async function findSample(cred, projectKey, typeName) {
  const jql = `project = ${jqlValue(projectKey)} AND issuetype = ${jqlValue(typeName)} ORDER BY updated DESC`;
  const data = await search(cred, jql, { fields: ['summary'], maxResults: 1 });
  const issue = (data.issues || [])[0];
  return issue ? issue.key : null;
}

async function cmdSample(cred, projectKey, typeName) {
  const key = await findSample(cred, projectKey, typeName);
  if (!key) {
    console.log(JSON.stringify({ projectKey, type: typeName, sample: null, found: 0 }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ projectKey, type: typeName, sample: key }, null, 2));
}

async function cmdCountType(cred, projectKey, typeName) {
  const jql = `project = ${jqlValue(projectKey)} AND issuetype = ${jqlValue(typeName)}`;
  const data = await search(cred, jql, { fields: ['summary'], maxResults: 1 });
  // The newer search endpoint does not always return a total, so report what it
  // gave rather than inventing a number.
  const total = typeof data.total === 'number' ? data.total : null;
  console.log(JSON.stringify({
    projectKey,
    type: typeName,
    total,
    foundAtLeastOne: (data.issues || []).length > 0,
  }, null, 2));
}

/**
 * Read-only fields Jira shows on an issue but no create or edit form can carry, so
 * they appear on no screen. They are the spine of a *reading* document — a fetched
 * issue that cannot say its own status or when it was last touched is not much use —
 * so they are allowed through alongside the screen's own fields.
 */
const OFF_SCREEN_ALLOWED = new Set([
  'created',
  'updated',
  'creator',
  'reporter',
  'status',
  'resolution',
  'resolutiondate',
  'lastViewed',
]);

/**
 * Extra off-screen fields allowed only on a subtask type.
 *
 * A subtask is where the estimate and the logged hours actually live — a parent
 * story routinely shows nothing while its children carry every hour — so the
 * original estimate is content on a subtask in a way it is not on a story.
 */
const OFF_SCREEN_ALLOWED_SUBTASK = new Set([
  'timeoriginalestimate',
]);

/**
 * A subtask type by naming convention: `Sub-Task`, `Sub Item`, `Subtask`.
 *
 * Only a fallback. Jira's own `subtask` flag is the fact, and this is a convention
 * teams happen to follow — used when the flag cannot be read, and to catch a type
 * whose name says subtask while the flag disagrees, since a type called `Sub-*`
 * carries a subtask's fields whatever the API thinks.
 */
function looksLikeSubtaskName(typeName) {
  // A separator is required — `Sub-Task`, `Sub Item` — or the whole word `subtask`.
  // Without it, `Submission` and `Subsidiary` match, and a plain word
  // beginning with "sub" is not a subtask type.
  const n = String(typeName).trim();
  return /^sub[\s_-]/i.test(n) || /^sub-?tasks?$/i.test(n);
}

/**
 * Whether this issue type is a subtask.
 *
 * `/project/{key}` is the only endpoint that reports the flag — `createmeta` omits
 * it. When the project cannot be read, or the type is not in its list, the name
 * convention decides rather than defaulting to "no": a `Sub-*` type silently treated
 * as a parent loses the estimate field, and a missing field is harder to notice than
 * an extra one.
 */
async function isSubtaskType(cred, projectKey, typeName) {
  const project = await apiGetSoft(cred, `/rest/api/3/project/${encodeURIComponent(projectKey)}`);
  const types = project?.issueTypes || [];
  const hit = types.find((t) => t.name === typeName)
    || types.find((t) => String(t.name).toLowerCase() === String(typeName).toLowerCase());
  if (hit && hit.subtask) return true;
  return looksLikeSubtaskName(typeName);
}

/**
 * The fields the issue type's screen shows, by field id.
 *
 * `createmeta` for one issue type is Jira's own answer to "what does this type's
 * form hold", which is the closest thing the API gives to the field list a person
 * sees. Returns null when the project or type cannot be read, so the caller can
 * fall back rather than silently offering nothing.
 */
async function screenFields(cred, projectKey, typeName) {
  const meta = await apiGetSoft(
    cred,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes?maxResults=200`,
  );
  const types = meta?.values || meta?.issueTypes || [];
  const hit = types.find((t) => t.name === typeName)
    || types.find((t) => String(t.name).toLowerCase() === String(typeName).toLowerCase());
  if (!hit) return null;

  const fields = await apiGetSoft(
    cred,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes/${hit.id}?maxResults=200`,
  );
  const rows = fields?.fields || fields?.values || [];
  if (!rows.length) return null;
  return new Set(rows.map((f) => f.fieldId).filter(Boolean));
}

/**
 * The field chooser. Four sources joined:
 *   /field                                    every field's id and display name
 *   /issue/createmeta/{proj}/issuetypes/{id}   the fields this type's screen shows
 *   /issue/{key}?fields=*all                   the values, from one real issue
 *   /issue/{key}/editmeta                      which of them are writable
 *
 * The screen list is the filter. A Jira project commonly defines 500+ fields, and
 * an issue carries dozens it never displays — offering all of them buries the
 * handful that matter. So a field is listed when the type's screen shows it, or when
 * it is one of the read-only rows on OFF_SCREEN_ALLOWED.
 *
 * A field with no value on the sample is still listed, marked empty, because a field
 * being empty on one ticket does not mean it is unused.
 */
async function cmdFields(cred, projectKey, typeName, sampleKey, asJson) {
  const key = sampleKey || (await findSample(cred, projectKey, typeName));
  if (!key) {
    console.error(`No ${typeName} found in ${projectKey}. Check the type name with: inspect.mjs issue-types ${projectKey}`);
    process.exit(1);
  }

  const [allFields, issue, editmeta, screen, isSubtask] = await Promise.all([
    apiGet(cred, '/rest/api/3/field'),
    apiGet(cred, `/rest/api/3/issue/${key}?fields=*all&expand=names`),
    apiGetSoft(cred, `/rest/api/3/issue/${key}/editmeta`),
    screenFields(cred, projectKey, typeName),
    isSubtaskType(cred, projectKey, typeName),
  ]);

  const allowed = new Set(OFF_SCREEN_ALLOWED);
  if (isSubtask) for (const id of OFF_SCREEN_ALLOWED_SUBTASK) allowed.add(id);

  // Without a screen list there is nothing to filter by, and offering 500 fields
  // is worse than offering the ones that carry a value. Say which happened.
  if (!screen) {
    console.error(`Note: could not read the screen field list for "${typeName}"; listing populated fields instead.`);
  }

  const nameById = new Map();
  const schemaById = new Map();
  for (const f of allFields) {
    nameById.set(f.id, f.name);
    if (f.schema) schemaById.set(f.id, f.schema);
  }
  // The issue's own `names` expansion is the most accurate source for this
  // project, so it wins where the two disagree.
  for (const [id, name] of Object.entries(issue.names || {})) nameById.set(id, name);

  const writable = new Set(Object.keys(editmeta?.fields || {}));
  const values = issue.fields || {};

  // A screen field the issue response omits still deserves a row — the user can
  // see it in Jira, so its absence here would look like the skill lost it.
  const candidates = screen
    ? [...new Set([
        ...Object.keys(values).filter((id) => screen.has(id) || allowed.has(id)),
        ...screen,
      ])]
    : Object.keys(values);

  const rows = candidates
    .map((id) => {
      const value = values[id];
      const empty = value === null || value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
      return {
        id,
        name: nameById.get(id) || id,
        custom: id.startsWith('customfield_'),
        writable: writable.has(id),
        onScreen: screen ? screen.has(id) : null,
        empty,
        valueType: jsonType(value),
        configType: configType(schemaById.get(id)),
        preview: preview(value),
      };
    })
    // Populated first, then custom before built-in, then by name: the fields
    // worth choosing rise to the top of the list.
    .sort((a, b) =>
      Number(a.empty) - Number(b.empty) ||
      Number(b.custom) - Number(a.custom) ||
      a.name.localeCompare(b.name));

  if (asJson) {
    console.log(JSON.stringify({ projectKey, type: typeName, sample: key, fields: rows }, null, 2));
    return;
  }

  console.log(`Fields on ${typeName}, sampled from ${key}`);
  console.log('');
  console.log('Choose by number. Only chosen fields are written, in the order you');
  console.log('give. A field you leave out is not reported anywhere, so choose every');
  console.log('field this type needs in a document.');
  console.log('');

  let n = 0;
  const populated = rows.filter((r) => !r.empty);
  const emptyRows = rows.filter((r) => r.empty);

  console.log(`--- Has a value on ${key} (${populated.length}) ---`);
  for (const r of populated) {
    n += 1;
    const flags = [r.custom ? 'custom' : 'built-in', r.writable ? 'writable' : 'read-only'].join(', ');
    console.log(`${String(n).padStart(3)}. ${r.name}`);
    console.log(`     ${r.id}  (${flags}, type ${r.configType})`);
    if (r.preview) console.log(`     ${r.preview}`);
  }

  console.log('');
  console.log(`--- Empty on ${key}, may still be used elsewhere (${emptyRows.length}) ---`);
  for (const r of emptyRows) {
    n += 1;
    console.log(`${String(n).padStart(3)}. ${r.name}  —  ${r.id} (${r.custom ? 'custom' : 'built-in'}, type ${r.configType})`);
  }
}

/**
 * The project's board and its active sprint. Optional metadata: a project with no
 * board is normal, and the agile API may be unavailable, so nothing here is fatal.
 */
async function cmdBoard(cred, projectKey) {
  const boards = await apiGetSoft(cred, `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`);
  if (!boards || !(boards.values || []).length) {
    console.log(JSON.stringify({ projectKey, board: null, note: 'No board found, or the agile API is unavailable. This is optional metadata.' }, null, 2));
    return;
  }

  const board = boards.values[0];
  const sprints = await apiGetSoft(cred, `/rest/agile/1.0/board/${board.id}/sprint?state=active`);
  const active = (sprints?.values || [])[0];

  console.log(JSON.stringify({
    projectKey,
    board: { id: board.id, name: board.name, type: board.type },
    activeSprint: active ? { id: active.id, name: active.name, endDate: active.endDate || null } : null,
    otherBoards: boards.values.slice(1).map((b) => ({ id: b.id, name: b.name })),
  }, null, 2));
}

function flagValue(args, name) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    console.log('Usage:');
    console.log('  inspect.mjs projects');
    console.log('  inspect.mjs issue-types <PROJECT-KEY>');
    console.log('  inspect.mjs sample <PROJECT-KEY> --type <TYPE>');
    console.log('  inspect.mjs fields <PROJECT-KEY> --type <TYPE> [--sample KEY] [--json]');
    console.log('  inspect.mjs board <PROJECT-KEY>');
    console.log('  inspect.mjs count-type <PROJECT-KEY> --type <TYPE>');
    process.exit(command ? 0 : 1);
  }

  const { cred } = connect();
  const projectKey = rest.find((a) => !a.startsWith('--')) || undefined;
  const type = flagValue(rest, '--type');

  const needsProject = ['issue-types', 'fields', 'board', 'sample', 'count-type'];
  if (needsProject.includes(command) && !projectKey) {
    console.error(`Required: a project key. Try: inspect.mjs projects`);
    process.exit(1);
  }
  if (['fields', 'sample', 'count-type'].includes(command) && !type) {
    console.error(`Required: --type <TYPE>. List them with: inspect.mjs issue-types ${projectKey}`);
    process.exit(1);
  }

  if (command === 'projects') return cmdProjects(cred);
  if (command === 'issue-types') return cmdIssueTypes(cred, projectKey);
  if (command === 'sample') return cmdSample(cred, projectKey, type);
  if (command === 'count-type') return cmdCountType(cred, projectKey, type);
  if (command === 'fields') return cmdFields(cred, projectKey, type, flagValue(rest, '--sample'), rest.includes('--json'));
  if (command === 'board') return cmdBoard(cred, projectKey);

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

// realpathSync on both sides, because a symlinked skill directory makes the raw
// paths disagree: the file would then load as a library and do nothing, printing
// no output and exiting 0 — which reads as success.
function isMainScript(selfPath) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  return real(process.argv[1]) === real(selfPath);
}

if (process.argv[1] && isMainScript(new URL(import.meta.url).pathname)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
