#!/usr/bin/env node
/**
 * fetch-issue.mjs — Fetch ONE part of a Jira issue into the issue's local folder.
 *
 * One part per run, on purpose. The pull workflow fetches a part, formats what it
 * wrote, checks it, and only then moves on; a single call that wrote everything
 * would make that impossible and would put an unread wall of text in front of
 * whoever has to check it.
 *
 * Usage:
 *   fetch-issue.mjs <ISSUE-KEY> --part content|comments|tasks|worklogs|development
 *
 * Options:
 *   --out DIR         Override the output folder (default: from the config)
 *   --mode M          markdown | json | both (default: from the config)
 *   --max-asset-mb N  Override the attachment size limit
 *   --all-assets      Download non-image attachments too
 *   --no-assets       Download nothing; still list every attachment
 *   --page-size N     Rows per API request. Lower it to exercise paging
 *   --quiet           Report only the summary line
 *
 * Every list is read through getAllPages, which pages to the server's own total
 * and refuses to return fewer rows. A part that cannot be read completely exits
 * non-zero instead of writing a short file.
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { connect, apiGet, apiGetSoft, getAllPages } from './jira-api.mjs';
import { issueTypeConfig, outputDirFor, outputModes } from './config.mjs';
import { adfToMarkdown, renderValue, parseDevelopment, formatSeconds, cell } from './adf.mjs';
import { fetchDevStatus, groupByRepository } from './dev-status.mjs';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);

const PARTS = ['content', 'comments', 'tasks', 'worklogs', 'development'];
const IMAGE_TYPES = /^image\//;

/** File types nothing in this workspace should ever run. Listed, never fetched. */
const EXECUTABLE_EXT = /\.(exe|sh|bash|zsh|bat|cmd|com|msi|app|dmg|deb|rpm|jar|ps1|scr|vbs|pkg)$/i;

/**
 * The metadata rows that a custom field can fill. Jira assigns a different
 * `customfield_NNNNN` id to each of these on every site, so the ids cannot live
 * here — they come from `project.metaFields` in the config, which setup detects by
 * display name. A role the config does not map is written `—`, never guessed.
 */
const META_ROLES = ['team', 'sprint', 'storyPoints', 'roughStoryPoints', 'dueDate', 'development'];

/**
 * Fields the document already renders without a section of their own: `summary` is
 * the H1 title, and the rest are rows of the fixed metadata table.
 *
 * Setup ticks these on every type, because a config should record that the title
 * and the status matter. But a tick means "give this prominence", and the table
 * already does — so writing a `## Status` section holding the one word the table
 * shows two lines above is noise, not prominence. The tick is honoured by the
 * table; only fields the table cannot show get a section.
 */
const RENDERED_WITHOUT_SECTION = new Set([
  'summary',    // the H1 title
  'issuetype',  // Type row
  'status',
  'priority',
  'assignee',
  'reporter',
  'creator',    // no row of its own; a name with no context is not a section
  'project',    // implied by the issue key
  'labels',
  'components',
  'created',
  'updated',
  'duedate',
  'parent',
  'fixVersions',
]);

/**
 * Roles that fill no row of their own but are still already reported: a mapped
 * Epic Link duplicates the Parent row.
 */
const SUPPRESS_ONLY_ROLES = ['epicLink'];

/** The field id this site uses for a metadata role, or undefined when unmapped. */
function metaFieldId(config, role) {
  return config?.project?.metaFields?.[role];
}

/** The value of a mapped metadata field, or undefined when the role is unmapped. */
function metaField(fields, config, role) {
  const id = metaFieldId(config, role);
  return id ? fields?.[id] : undefined;
}

/**
 * Custom fields already reported elsewhere in the document, so writing them a
 * second time as an ordinary field would be noise.
 *
 * Derived from the config rather than hard-coded: every id here is one this site
 * mapped to a metadata row, so it is already in the table above. A hard-coded list
 * would suppress nine arbitrary ids on a site that never mapped them — hiding a
 * field the user ticked, which is worse than showing it twice.
 */
function suppressedFields(config) {
  const ids = new Set();
  for (const role of [...META_ROLES, ...SUPPRESS_ONLY_ROLES]) {
    const id = metaFieldId(config, role);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * The three fields a Checklist app writes into, as this site's config names them.
 *
 * Site-specific like every custom field id, so the config maps them and an
 * unmapped project simply has no checklist section. The YAML field carries the
 * item text, the text field carries names alone, and the completed field is one
 * word. None carries the live state — see `fetchChecklistProgress`. Rebuilt
 * together, they make one readable list.
 */
function checklistFieldIds(config) {
  const cf = config?.project?.checklistFields || {};
  return new Set([cf.contentYaml, cf.text, cf.completed].filter(Boolean));
}

/**
 * The checklist items, read out of the Checklist app's YAML field.
 *
 * The field is ADF holding YAML-ish text: a `text:` value per item, each followed
 * by `checked:` and `status:`. Parsed rather than printed, because printed it is
 * hundreds of lines that render as loose text.
 *
 * A long item uses YAML's folded form, `text: >-` with the words on the lines
 * below, so the value is taken as everything up to the item's own `checked:`
 * rather than to the end of the line. Reading only the first line silently drops
 * every long item — on the first ticket this was tried on, several were dropped.
 *
 * An item whose text starts with `---` is the app's own group separator, not a
 * task, so it is returned as a heading instead of a checkbox.
 *
 * `checked` is read but is always false: the field is written once, when the issue
 * is created, and never updated again. The `status:` line that follows it — open,
 * done or skipped — is deliberately not captured, because it comes from the same
 * frozen blob and is therefore just as stale; requiring it in the pattern would
 * also drop any item whose app omitted it. The true count comes from
 * `fetchChecklistProgress`.
 */
function parseChecklist(adfValue) {
  if (!adfValue) return [];
  const text = adfToMarkdown(adfValue, null);
  const items = [];
  const re = /text:\s*(>-|\|-)?\s*([\s\S]*?)\s*\n\s*checked:\s*(true|false)/g;
  for (const m of text.matchAll(re)) {
    const label = m[2].replace(/\s+/g, ' ').replace(/^['"]|['"]$/g, '').trim();
    if (!label) continue;
    items.push({
      text: label.replace(/^-+/, '').trim() || label,
      checked: m[3] === 'true',
      group: label.startsWith('---'),
    });
  }
  return items;
}

/**
 * The checklist's real progress, from the issue property the Checklist app keeps.
 *
 * The YAML field `parseChecklist` reads is a create-time snapshot: on a ticket with
 * some items ticked, every entry still read `checked: false`, and
 * the changelog showed the field written once, at creation. This property is the
 * only live source — and it carries totals only, with no per-item breakdown, so it
 * corrects the count and cannot correct the boxes.
 *
 * Soft, and null rather than partial: a subtask has no such property, nor has a
 * project without the app, and a line reading "— of N" is worse than no line.
 */
async function fetchChecklistProgress(cred, key) {
  const prop = await apiGetSoft(cred, `/rest/api/3/issue/${key}/properties/checklist`);
  const v = prop?.value;
  if (!v || typeof v.allItems !== 'number') return null;
  return { done: v.allItems - (v.uncheckedItems ?? 0), total: v.allItems };
}

const today = () => new Date().toISOString().slice(0, 10);
const browseUrl = (cred, key) => `https://${cred.domain}/browse/${key}`;

/** A timestamp a reader can place: date, time, and the offset Jira returned. */
function formatDateTime(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}[.\d]*([+-]\d{4}|Z)?$/.exec(iso || '');
  if (!m) return (iso || '').slice(0, 10);
  return `${m[1]} ${m[2]}${m[3] && m[3] !== 'Z' ? ` ${m[3]}` : ''}`;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** Filesystem-safe name that keeps the original extension. */
function safeAssetName(filename) {
  const ext = extname(filename);
  const stem = basename(filename, ext).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (stem || 'attachment') + ext;
}

/**
 * The filename behind each media-services UUID, read from the rendered thread.
 *
 * A comment's ADF media node carries only a UUID — no `alt`, no attachment id —
 * so nothing in the comment itself says which file it is, and the reader gets a
 * placeholder. Jira's own rendered HTML resolves the same node for display, and
 * pairs `data-media-services-id` with `data-attachment-name`; this reads that
 * pairing back out.
 *
 * Soft: a site that cannot render the thread simply resolves fewer nodes.
 */
async function commentMediaNames(cred, key) {
  const map = new Map();
  const page = await apiGetSoft(cred, `/rest/api/2/issue/${key}/comment?expand=renderedBody`);
  for (const c of page?.comments || []) {
    const html = c.renderedBody || '';
    for (const m of html.matchAll(/<a\b[^>]*>/g)) {
      const id = /data-media-services-id="([^"]+)"/.exec(m[0]);
      const name = /data-attachment-name="([^"]+)"/.exec(m[0]);
      if (id && name) map.set(id[1], name[1]);
    }
  }
  return map;
}

/**
 * Download the attachments worth embedding, and return a resolver plus a report.
 *
 * An ADF media node carries a media-services UUID, never the attachment id, so
 * the reliable join back to the attachment list is the filename, which ADF keeps
 * in `alt`. Both keys are indexed so either side resolves.
 */
async function downloadAssets(cred, attachments, assetsDir, opts) {
  const byName = new Map();
  const byId = new Map();
  const report = [];

  for (const att of attachments) {
    const isImage = IMAGE_TYPES.test(att.mimeType || '');
    const sizeMb = (att.size || 0) / (1024 * 1024);
    const tooBig = sizeMb > opts.maxAssetMb;
    const executable = EXECUTABLE_EXT.test(att.filename || '');
    // A ticket's evidence is often a spreadsheet, a PDF or a log, so everything
    // comes down except the file types nothing here should ever run. The
    // blocklist keeps a runnable file off the disk; it is not a security control,
    // and every downloaded file is still untrusted input that is stored, never
    // executed.
    const wanted = opts.allAssets || (!executable && (isImage || !opts.imagesOnly));

    if (opts.noAssets || !wanted || tooBig) {
      report.push({
        filename: att.filename,
        size: att.size || 0,
        mimeType: att.mimeType || '',
        skipped: opts.noAssets
          ? 'assets disabled'
          : executable
            ? 'executable file type'
            : !wanted
              ? 'not an image'
              : `${sizeMb.toFixed(1)} MB over the ${opts.maxAssetMb} MB limit`,
      });
      continue;
    }

    const res = await fetch(`https://${cred.domain}/rest/api/3/attachment/content/${att.id}`, {
      headers: { Authorization: cred.auth },
      redirect: 'follow',
    });
    if (!res.ok) {
      report.push({
        filename: att.filename,
        size: att.size || 0,
        mimeType: att.mimeType || '',
        skipped: `download failed with ${res.status}`,
      });
      continue;
    }

    mkdirSync(assetsDir, { recursive: true });
    const name = safeAssetName(att.filename);
    writeFileSync(join(assetsDir, name), Buffer.from(await res.arrayBuffer()));
    const rel = `assets/${name}`;

    byName.set(att.filename, rel);
    byId.set(String(att.id), rel);

    // Jira sometimes stores an attachment as "name (<media-uuid>).png" while the
    // ADF node keeps the original "name.png" in alt and the uuid in attrs.id.
    // Index both the uuid and the stripped name so either side resolves.
    const uuid = att.filename.match(/\(([0-9a-f-]{36})\)/i)?.[1];
    if (uuid) {
      byId.set(uuid, rel);
      byName.set(att.filename.replace(/\s*\([0-9a-f-]{36}\)/i, ''), rel);
    }

    report.push({ filename: att.filename, size: att.size || 0, mimeType: att.mimeType || '', saved: rel });
  }

  // A media UUID resolves through the filename the rendered thread gave it.
  for (const [uuid, filename] of opts.mediaNames || []) {
    if (byName.has(filename)) byId.set(uuid, byName.get(filename));
  }

  const resolver = (attrs) => {
    if (!attrs) return null;
    if (attrs.alt && byName.has(attrs.alt)) return byName.get(attrs.alt);
    if (attrs.id && byId.has(String(attrs.id))) return byId.get(String(attrs.id));
    return null;
  };

  return { resolver, report };
}

// ---------------------------------------------------------------------------
// Metadata, shared by content.md and the JSON
// ---------------------------------------------------------------------------

/**
 * The fixed metadata block. Every key is always present: a field Jira has no
 * value for is null, so an empty field is visibly empty rather than
 * indistinguishable from one the fetch missed.
 */
function buildMeta(cred, issue, config, devStatus = null) {
  const f = issue.fields || {};

  const devRaw = metaField(f, config, 'development');
  const dev = devRaw === undefined ? null : parseDevelopment(devRaw);

  // Every environment the issue deployed to. The development field carries only
  // Jira's `topEnvironments` rollup, which under-reports — a single row on a story
  // deployed to several — so the live deployment list wins when it is
  // there, and the cached rollup stands in when it is not.
  const deployedTo = devStatus?.environments?.length
    ? devStatus.environments.map((e) => e.name).filter(Boolean)
    : [];

  // A sprint field is an array of objects on a scrum board and a scalar elsewhere.
  const sprintRaw = metaField(f, config, 'sprint');
  const sprints = Array.isArray(sprintRaw)
    ? sprintRaw.map((s) => (typeof s === 'object' ? s.name : String(s))).filter(Boolean).join(', ')
    : renderValue(sprintRaw);

  const points = metaField(f, config, 'storyPoints');
  const roughPoints = metaField(f, config, 'roughStoryPoints');

  // The built-in `duedate` is the reliable one; a mapped custom field only fills
  // the row when Jira's own is empty. The reverse order let a foreign field on
  // another site shadow the real due date.
  const mappedDue = metaField(f, config, 'dueDate');

  const tt = f.timetracking || {};
  const timeTracking = tt.timeSpent || tt.originalEstimate
    ? `${tt.timeSpent || '0m'} of ${tt.originalEstimate || '—'}`
    : null;

  return {
    type: f.issuetype?.name || null,
    status: f.status?.name || null,
    priority: f.priority?.name || null,
    assignee: f.assignee?.displayName || null,
    reporter: f.reporter?.displayName || null,
    team: renderValue(metaField(f, config, 'team')) || null,
    sprint: sprints || null,
    storyPoints: typeof points === 'number' ? points : null,
    roughStoryPoints: typeof roughPoints === 'number' ? roughPoints : null,
    dueDate: f.duedate || mappedDue || null,
    originalEstimate: tt.originalEstimate || null,
    timeTracking,
    parent: f.parent
      ? {
          key: f.parent.key,
          summary: f.parent.fields?.summary || '',
          url: browseUrl(cred, f.parent.key),
        }
      : null,
    labels: f.labels || [],
    components: (f.components || []).map((c) => c.name),
    fixVersions: (f.fixVersions || []).map((v) => v.name),
    git: dev?.git || null,
    deployments: deployedTo.length ? deployedTo : dev?.deployments || [],
    created: (f.created || '').slice(0, 10) || null,
    updated: (f.updated || '').slice(0, 10) || null,
  };
}

/**
 * Split the fields the config named into the ones that earn a section and the
 * ones that belong in the metadata table, both in config order.
 *
 * The config decides what is written at all. A field nobody ticked is not
 * reported: the decision file lists every field on the type's screen, so an
 * unticked field is a field the project looked at and passed over.
 *
 * Where a value lands follows its shape, not its id. Prose needs a heading to
 * read under; a single line reads better as a table row than as a heading with
 * one line beneath it.
 */
function splitFields(issue, typeCfg, names, resolver, config) {
  const f = issue.fields || {};
  const suppressed = suppressedFields(config);
  const checklistIds = checklistFieldIds(config);

  const chosen = [];
  const rows = [];
  for (const spec of typeCfg?.fields || []) {
    // The title and the metadata rows are ticked on every type, and the document
    // already renders them. A section here would repeat the table.
    if (RENDERED_WITHOUT_SECTION.has(spec.id)) continue;
    // buildContentMarkdown emits the description as its own section, under the
    // heading the config chose. A second copy here would repeat the whole body.
    if (spec.id === 'description') continue;
    // The checklist is rebuilt as one section with real checkboxes; its raw
    // fields would repeat it, one of them as unreadable YAML.
    if (checklistIds.has(spec.id)) continue;
    if (suppressed.has(spec.id)) continue;
    const value = renderValue(f[spec.id], resolver);
    if (value === null) continue;

    const name = spec.name || names[spec.id] || spec.id;
    // A prose field gets a section even when today's value happens to fit on one
    // line: what it is decides where it goes, not what one ticket put in it.
    // Routing on the value alone moves a prose field into the table whenever one
    // ticket's value happens to be a single line.
    if (spec.type === 'adf' || String(value).includes('\n')) {
      chosen.push({ id: spec.id, name, heading: spec.heading || name, value });
    } else {
      const text = String(value).trim();
      rows.push({
        id: spec.id,
        name,
        // A raw ISO string in a one-line row is unreadable; the same instant
        // written out is not. Only whole timestamps match, so a date stays a date.
        value: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ? formatDateTime(text) : text,
      });
    }
  }

  return { chosen, rows };
}

// ---------------------------------------------------------------------------
// content
// ---------------------------------------------------------------------------

function frontmatter(lines) {
  return ['---', ...lines, '---', ''].join('\n');
}

function yamlValue(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  const s = String(v);
  return /[:#]|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
}

/** A frontmatter key from a field's display name: `Impact Level` -> `impactLevel`. */
function yamlKey(name) {
  const parts = String(name).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/);
  if (!parts.length || !parts[0]) return null;
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join('');
}

function buildContentMarkdown(cred, issue, meta, description, chosen, extraRows, checklist, checklistProgress, assetReport, linkedDocs, commentCount, devStatus) {
  const key = issue.key;
  const url = browseUrl(cred, key);
  const f = issue.fields || {};
  const out = [];

  // The table and the frontmatter carry the same rows, so a reader and a script
  // see the same facts. Fixed keys first, then whatever this type ticked.
  const seenKeys = new Set([
    'schema', 'jiraKey', 'jiraUrl', 'summary', 'type', 'status', 'priority',
    'assignee', 'reporter', 'team', 'sprint', 'storyPoints', 'roughStoryPoints',
    'dueDate', 'originalEstimate', 'timeTracking', 'parent', 'labels',
    'components', 'fixVersions', 'git', 'deployments', 'created', 'updated', 'fetched',
  ]);
  const extraYaml = [];
  for (const r of extraRows) {
    const k = yamlKey(r.name);
    if (!k || seenKeys.has(k)) continue;
    seenKeys.add(k);
    extraYaml.push(`${k}: ${yamlValue(r.value)}`);
  }

  out.push(frontmatter([
    'schema: jira-to-local/content-v3',
    `jira_key: ${key}`,
    `jira_url: ${url}`,
    `summary: ${JSON.stringify(f.summary || '')}`,
    `type: ${yamlValue(meta.type)}`,
    `status: ${yamlValue(meta.status)}`,
    `priority: ${yamlValue(meta.priority)}`,
    `assignee: ${yamlValue(meta.assignee)}`,
    `reporter: ${yamlValue(meta.reporter)}`,
    `team: ${yamlValue(meta.team)}`,
    `sprint: ${yamlValue(meta.sprint)}`,
    `storyPoints: ${yamlValue(meta.storyPoints)}`,
    `roughStoryPoints: ${yamlValue(meta.roughStoryPoints)}`,
    `dueDate: ${yamlValue(meta.dueDate)}`,
    `originalEstimate: ${yamlValue(meta.originalEstimate)}`,
    `timeTracking: ${yamlValue(meta.timeTracking)}`,
    `parent: ${yamlValue(meta.parent?.key)}`,
    `labels: ${yamlValue(meta.labels)}`,
    `components: ${yamlValue(meta.components)}`,
    `fixVersions: ${yamlValue(meta.fixVersions)}`,
    `git: ${yamlValue(meta.git)}`,
    `deployments: ${yamlValue(meta.deployments.length ? meta.deployments.join(', ') : null)}`,
    `created: ${yamlValue(meta.created)}`,
    `updated: ${yamlValue(meta.updated)}`,
    `fetched: ${today()}`,
    ...extraYaml,
  ]));

  out.push(`# ${key}: ${f.summary || ''}`, '');
  out.push(`**Jira**: [${key}](${url})`, '');

  const parentCell = meta.parent
    ? `[${meta.parent.key}](${meta.parent.url}) — ${cell(meta.parent.summary)}`
    : '—';

  out.push('| Field | Value |', '| --- | --- |');
  const rows = [
    ['Type', meta.type], ['Status', meta.status], ['Priority', meta.priority],
    ['Assignee', meta.assignee], ['Reporter', meta.reporter], ['Team', meta.team],
    ['Sprint', meta.sprint], ['Story Points', meta.storyPoints],
    ['Rough Story Points', meta.roughStoryPoints], ['Due Date', meta.dueDate],
    ['Original Estimate', meta.originalEstimate], ['Time Tracking', meta.timeTracking],
    ['Parent', parentCell], ['Labels', meta.labels.join(', ')],
    ['Components', meta.components.join(', ')], ['Fix Versions', meta.fixVersions.join(', ')],
    ['Git', meta.git], ['Deployments', meta.deployments.length ? meta.deployments.join(', ') : null],
    ['Created', meta.created], ['Updated', meta.updated],
  ];
  for (const [label, value] of rows) out.push(`| **${label}** | ${cell(value)} |`);
  // Every other ticked field that fits on one line. A heading holding a single
  // word buries the prose underneath it, so these join the table instead.
  for (const r of extraRows) out.push(`| **${r.name}** | ${cell(r.value)} |`);
  out.push('');

  if (description) {
    out.push(`## ${description.heading}`, '', description.body.trim(), '');
  }

  for (const fieldEntry of chosen) {
    out.push(`## ${fieldEntry.heading}`, '', String(fieldEntry.value).trim(), '');
  }

  // The count alone is worth a section: the YAML field is written once at issue
  // creation and is empty on many issues whose Checklist app still holds real
  // progress. Writing nothing there hid a live "N of M done" on 26 of 80 issues
  // in one bulk run, and the reader had no way to tell a checklist existed.
  if (checklist.length || checklistProgress) {
    out.push('## Checklist', '');
    // Above the list, not below it: a caveat under a long list of boxes is read too
    // late to stop anyone trusting them.
    if (checklistProgress) {
      out.push(
        `**${checklistProgress.done} of ${checklistProgress.total} done** in Jira. `
        + (checklist.length
          ? 'Jira does not expose which ones, so every box below is drawn unticked.'
          : 'Jira exposes only the totals, and this issue carries no item text, so no boxes are drawn.'),
        ''
      );
    }
    for (const item of checklist) {
      if (item.group) out.push('', `**${item.text}**`, '');
      else out.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
    }
    out.push('');
  }

  if (assetReport.length) {
    out.push('## Attachments', '');
    out.push('| File | Type | Size | Local copy |', '| --- | --- | --- | --- |');
    for (const a of assetReport) {
      const mb = (a.size / (1024 * 1024)).toFixed(1);
      const local = a.saved ? `[${a.filename}](${a.saved})` : `_not downloaded: ${a.skipped}_`;
      out.push(`| ${cell(a.filename)} | ${cell(a.mimeType)} | ${mb} MB | ${local} |`);
    }
    out.push('');
    if (assetReport.some((a) => !a.saved)) {
      out.push(`Skipped files are listed above with the reason. [${key}](${url})`, '');
    }
  }

  const subtasks = f.subtasks || [];
  if (subtasks.length) {
    out.push('## Subtasks', '');
    out.push(`${subtasks.length} subtask(s). Full detail in [tasks.md](tasks.md).`, '');
    out.push('| Subtask | Type | Status | Summary |', '| --- | --- | --- | --- |');
    for (const s of subtasks) {
      out.push(`| [${s.key}](${browseUrl(cred, s.key)}) | ${cell(s.fields?.issuetype?.name)} | ${cell(s.fields?.status?.name)} | ${cell(s.fields?.summary)} |`);
    }
    out.push('');
  }

  const links = f.issuelinks || [];
  if (links.length) {
    out.push('## Linked Issues', '');
    out.push('| Link | Issue | Status | Summary |', '| --- | --- | --- | --- |');
    for (const l of links) {
      const other2 = l.outwardIssue || l.inwardIssue;
      if (!other2) continue;
      const label = l.outwardIssue ? l.type?.outward : l.type?.inward;
      out.push(`| ${cell(label)} | [${other2.key}](${browseUrl(cred, other2.key)}) | ${cell(other2.fields?.status?.name)} | ${cell(other2.fields?.summary)} |`);
    }
    out.push('');
  }

  if (devStatus) {
    const c = devStatus.counts;
    const states = Object.entries(devStatus.buildStates)
      .map(([state, n]) => `${n} ${state.replace(/_/g, ' ')}`)
      .join(', ');

    if (c.pullRequests || c.commits || c.builds) {
      out.push('## Development', '');
      out.push(
        `${c.pullRequests} pull request(s), ${c.commits} commit(s) in `
        + `${c.repositories} repositor(ies), ${c.builds} build(s). Written by the `
        + 'repository integration, not by anyone editing the issue.',
        ''
      );
      out.push('| What | Count | Detail |', '| --- | --- | --- |');
      out.push(`| Pull requests | ${c.pullRequests} | [development.md](development.md) |`);
      out.push(`| Commits | ${c.commits} | [development.md](development.md) |`);
      out.push(`| Builds | ${c.builds}${states ? `: ${states}` : ''} | [development.md](development.md) |`);
      out.push('');
      // The panel and the detail disagree by design, so say which is which rather
      // than letting a reader think one of them is broken.
      if (devStatus.summaryBuildCount && devStatus.summaryBuildCount !== c.builds) {
        out.push(
          `Jira's own panel reports ${devStatus.summaryBuildCount} build(s) — the latest per `
          + `pipeline. The ${c.builds} above is the full history across every repository.`,
          ''
        );
      }
      for (const gap of devStatus.degraded) {
        out.push(`_Jira reports this activity but the ${gap}. Open the ticket for the panel._`, '');
      }
    }

    if (devStatus.environments.length) {
      const listed = devStatus.deployments.length;
      out.push('## Deployment', '');
      // The deployment count per environment is worth a column: it is the difference
      // between "deployed to prod once" and "deployed to prod three times".
      if (listed) {
        out.push(
          '| Environment | Type | Latest state | When | Deployments |',
          '| --- | --- | --- | --- | --- |'
        );
        for (const env of devStatus.environments) {
          out.push(
            `| ${cell(env.name)} | ${cell(env.type)} | ${cell(env.status)} `
            + `| ${cell(env.when)} | ${env.deployments ?? '—'} |`
          );
        }
        out.push('');
        out.push(
          `${listed} deployment(s) across ${devStatus.environments.length} environment(s), `
          + 'newest first per environment. Full listing in [development.md](development.md).',
          ''
        );
      } else {
        out.push('| Environment | Type | State | When |', '| --- | --- | --- | --- |');
        for (const env of devStatus.environments) {
          out.push(`| ${cell(env.name)} | ${cell(env.type)} | ${cell(env.status)} | ${cell(env.when)} |`);
        }
        out.push('');
        out.push(
          'The current state per environment, as Jira summarises it. The deployment '
          + 'list behind it could not be read, so this is a state and not a log, and '
          + 'an environment Jira did not summarise is missing from it.',
          ''
        );
      }
    }
  }

  if (linkedDocs.length) {
    out.push('## Linked Documents', '');
    for (const d of linkedDocs) {
      const local = d.localPath ? `[${d.title}](${d.localPath})` : d.title;
      out.push(`- ${local} — [open in Confluence](${d.url})`);
    }
    out.push('');
  }

  out.push('---', '', '## More', '');
  out.push(`- [Comments](comments.md) — ${commentCount}`);
  if (subtasks.length) out.push(`- [Subtasks](tasks.md) — ${subtasks.length}`);
  out.push('- [Worklogs](worklogs.md)');
  out.push('');

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

function buildCommentsMarkdown(cred, issue, comments, total, resolver) {
  const key = issue.key;
  const url = browseUrl(cred, key);
  const out = [];

  out.push(frontmatter([
    'schema: jira-to-local/comments-v2',
    `jira_key: ${key}`,
    `jira_url: ${url}`,
    `total: ${total}`,
    `fetched: ${today()}`,
  ]));

  out.push(`# ${key} — Comments`, '');
  out.push(`**Jira**: [${key}](${url}) — ${issue.fields?.summary || ''}`, '');

  if (!comments.length) {
    out.push('_No comments._', '');
    return out.join('\n');
  }

  out.push(`${total} comment(s), oldest first.`, '');
  for (const c of comments) {
    const author = c.author?.displayName || 'Unknown';
    // Several comments a day is normal, and the order carries meaning a date
    // alone loses. The offset is Jira's own, so a reader elsewhere can convert.
    const when = formatDateTime(c.created);
    const body = c.body ? adfToMarkdown(c.body, resolver).trim() : '';
    out.push('---', '', `## ${author} — ${when}`, '', body || '_(empty)_', '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

/**
 * The shared header of tasks.md and worklogs.md: what the file is, and the
 * tickets it covers. These documents record what Jira says, so nothing is
 * written here about them except the facts they hold.
 */
function documentHeader(cred, issue, title) {
  const key = issue.key;
  const parent = issue.fields?.parent;
  const out = [
    `# ${key} — ${title}`,
    '',
    `**Ticket**: [${key}](${browseUrl(cred, key)}) — ${issue.fields?.summary || ''}`,
    '',
  ];
  if (parent) {
    out.push(`**Parent**: [${parent.key}](${browseUrl(cred, parent.key)}) — ${parent.fields?.summary || ''}`, '');
  }
  return out;
}

function buildTasksMarkdown(cred, issue, subtasks) {
  const out = [];
  out.push(frontmatter([
    'schema: jira-to-local/tasks-v2',
    `jira_key: ${issue.key}`,
    `jira_url: ${browseUrl(cred, issue.key)}`,
    `total: ${subtasks.length}`,
    `fetched: ${today()}`,
  ]));
  out.push(...documentHeader(cred, issue, 'Subtasks'));

  out.push(`${subtasks.length} subtask(s), in Jira order.`, '');
  out.push(
    '| Subtask | Title | Type | Status | Assignee | Original Estimate | Time Spent |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const s of subtasks) {
    const f = s.fields || {};
    out.push(`| [${s.key}](${browseUrl(cred, s.key)}) | ${cell(f.summary)} | ${cell(f.issuetype?.name)} | ${cell(f.status?.name)} | ${cell(f.assignee?.displayName || 'Unassigned')} | ${cell(f.timetracking?.originalEstimate)} | ${cell(f.timetracking?.timeSpent)} |`);
  }
  out.push('');

  for (const s of subtasks) {
    const f = s.fields || {};
    out.push('---', '', `## ${s.key} — ${f.summary || ''}`, '');

    if (!s.readable) {
      out.push(`_Could not be read; only the parent's summary is available. Open [${s.key}](${browseUrl(cred, s.key)}) in Jira._`, '');
      continue;
    }

    out.push('| Field | Value |', '| --- | --- |');
    const rows = [
      ['Type', f.issuetype?.name], ['Status', f.status?.name], ['Priority', f.priority?.name],
      ['Assignee', f.assignee?.displayName || 'Unassigned'], ['Reporter', f.reporter?.displayName],
      ['Original Estimate', f.timetracking?.originalEstimate], ['Time Spent', f.timetracking?.timeSpent],
      ['Created', (f.created || '').slice(0, 10)], ['Updated', (f.updated || '').slice(0, 10)],
    ];
    for (const [label, value] of rows) out.push(`| **${label}** | ${cell(value)} |`);
    out.push('');

    const desc = f.description ? adfToMarkdown(f.description, null).trim() : '';
    if (desc) out.push(desc, '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// development
// ---------------------------------------------------------------------------

/**
 * The development panel in full, grouped by repository.
 *
 * Repository is the top-level grouping because that is how Jira's own panel is
 * organised — every tab nests under `owner/repo` — so a reader comparing the two
 * sees the same shape. Within a repository the order is pull requests, then the
 * commits they carried, then the builds that ran: the unit of review first.
 *
 * A repository contributes only the subsections it has records for, so a config
 * repository with commits and no pull requests gets a Commits heading alone.
 */
function buildDevelopmentMarkdown(cred, issue, dev) {
  const key = issue.key;
  const url = browseUrl(cred, key);
  const c = dev.counts;
  const groups = groupByRepository(dev);
  const out = [];

  out.push(frontmatter([
    'schema: jira-to-local/development-v1',
    `jira_key: ${key}`,
    `jira_url: ${url}`,
    `repositories: ${c.repositories}`,
    `pullRequests: ${c.pullRequests}`,
    `commits: ${c.commits}`,
    `builds: ${c.builds}`,
    `deployments: ${c.deployments}`,
    `fetched: ${today()}`,
  ]));

  out.push(`# ${key} — Development`, '');
  out.push(`**Jira**: [${key}](${url}) — ${cell(issue.fields?.summary)}`, '');
  out.push(
    `${c.repositories} repositor(ies): ${c.pullRequests} pull request(s), `
    + `${c.commits} commit(s), ${c.builds} build(s).`,
    ''
  );

  if (dev.summaryBuildCount && dev.summaryBuildCount !== c.builds) {
    out.push(
      `Jira's panel reports ${dev.summaryBuildCount} build(s), the latest per pipeline. `
      + `The ${c.builds} here is the full history.`,
      ''
    );
  }
  for (const gap of dev.degraded) {
    out.push(`_Jira reports this activity but the ${gap}. Open the ticket for the panel._`, '');
  }

  // An index, because a reader of a four-repository file should not have to scroll
  // to learn which repositories are involved.
  if (groups.length > 1) {
    out.push('| Repository | Pull requests | Commits | Builds |', '| --- | --- | --- | --- |');
    for (const g of groups) {
      out.push(
        `| ${cell(g.name || 'Unattributed')} | ${g.pullRequests.length} `
        + `| ${g.commits.length} | ${g.builds.length} |`
      );
    }
    out.push('');
  }

  for (const g of groups) {
    out.push(`## ${g.name || 'Unattributed'}`, '');
    if (g.name && g.url) out.push(`[${g.name}](${g.url}) — GitHub`, '');
    else if (!g.name) {
      out.push('Records whose repository the panel did not name.', '');
    }

    if (g.pullRequests.length) {
      out.push('### Pull Requests', '');
      out.push(
        '| PR | Summary | Branch | Status | Reviewers | Comments | Updated |',
        '| --- | --- | --- | --- | --- | --- | --- |'
      );
      for (const pr of g.pullRequests) {
        const id = pr.url ? `[${pr.id}](${pr.url})` : cell(pr.id);
        const branch = pr.sourceBranch
          ? `\`${pr.sourceBranch}\` → \`${pr.targetBranch || '?'}\``
          : '—';
        // Only reviewers the payload actually named: it returns the literal "User"
        // for an account it cannot resolve, and a list of non-names helps nobody.
        const reviewers = pr.reviewers
          .filter((r) => r.name && r.name !== 'User')
          .map((r) => `${r.name}${r.approved ? ' (approved)' : ''}`)
          .join(', ');
        out.push(
          `| ${id} | ${cell(pr.title)} | ${branch} | ${cell(pr.status)} `
          + `| ${cell(reviewers)} | ${pr.commentCount ?? '—'} | ${cell(pr.updated)} |`
        );
      }
      out.push('');
    }

    if (g.commits.length) {
      out.push('### Commits', '');
      out.push('| Commit | Message | Author | When | Files |', '| --- | --- | --- | --- | --- |');
      for (const commit of g.commits) {
        const id = commit.url ? `[\`${commit.id}\`](${commit.url})` : `\`${commit.id}\``;
        out.push(
          `| ${id} | ${cell(commit.message)} | ${cell(commit.author)} `
          + `| ${cell(commit.when)} | ${commit.files ?? '—'} |`
        );
      }
      out.push('');
    }

    if (g.builds.length) {
      const states = {};
      for (const b of g.builds) if (b.state) states[b.state] = (states[b.state] || 0) + 1;
      const summary = Object.entries(states)
        .map(([state, n]) => `${n} ${state.replace(/_/g, ' ')}`)
        .join(', ');

      out.push('### Builds', '');
      out.push(`${g.builds.length} build(s)${summary ? `: ${summary}` : ''}.`, '');
      out.push('| Pipeline | # | State | When |', '| --- | --- | --- | --- |');
      for (const b of g.builds) {
        const pipeline = b.url ? `[${b.pipeline}](${b.url})` : cell(b.pipeline);
        out.push(`| ${pipeline} | ${b.number ?? '—'} | ${cell(b.state)} | ${cell(b.when)} |`);
      }
      out.push('');
    }
  }

  if (dev.environments.length) {
    const order = ['Production', 'Staging', 'Testing', 'Development', 'Other'];
    out.push('## Deployments', '');

    if (dev.deployments.length) {
      const states = Object.entries(dev.deploymentStates)
        .map(([state, n]) => `${n} ${state.toLowerCase()}`)
        .join(', ');
      out.push(
        `${dev.deployments.length} deployment(s)${states ? `: ${states}` : ''}. Grouped by `
        + "environment type, as Jira's own Deployments tab groups them.",
        ''
      );

      const byType = new Map();
      for (const d of dev.deployments) {
        const t = d.environmentType || 'Other';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(d);
      }
      for (const type of order) {
        const rows = byType.get(type);
        if (!rows) continue;
        out.push(`### ${type}`, '');
        out.push('| Pipeline | Environment | Deployment | State | When |', '| --- | --- | --- | --- | --- |');
        for (const d of rows) {
          const name = d.url ? `[${cell(d.name)}](${d.url})` : cell(d.name);
          out.push(
            `| ${cell(d.pipeline)} | ${cell(d.environment)} | ${name} `
            + `| ${cell(d.state)} | ${cell(d.when)} |`
          );
        }
        out.push('');
      }
    } else {
      // The fallback: the summary's one row per environment, when the deployment
      // query gave nothing. Said plainly, so a one-row table is not read as
      // "this issue was deployed once".
      out.push(
        'The current state per environment. The deployment list behind it could not '
        + 'be read, so this is a state and not a log.',
        ''
      );
      const byType = new Map();
      for (const env of dev.environments) {
        const t = env.type || 'Other';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(env);
      }
      for (const type of order) {
        const envs = byType.get(type);
        if (!envs) continue;
        out.push(`### ${type}`, '');
        out.push('| Environment | State | When |', '| --- | --- | --- |');
        for (const env of envs) {
          out.push(`| ${cell(env.name)} | ${cell(env.status)} | ${cell(env.when)} |`);
        }
        out.push('');
      }
    }
  }

  out.push('---', '', `Summary in [content.md](content.md).`, '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// worklogs
// ---------------------------------------------------------------------------

function buildWorklogsMarkdown(cred, issue, entries, hasSubtasks) {
  const out = [];
  const totalSeconds = entries.reduce((a, e) => a + e.seconds, 0);

  out.push(frontmatter([
    'schema: jira-to-local/worklogs-v2',
    `jira_key: ${issue.key}`,
    `jira_url: ${browseUrl(cred, issue.key)}`,
    `total: ${entries.length}`,
    `totalSeconds: ${totalSeconds}`,
    `fetched: ${today()}`,
  ]));
  out.push(...documentHeader(cred, issue, 'Worklogs'));

  if (!entries.length) {
    out.push(`_No time logged on this ticket${hasSubtasks ? ' or its subtasks' : ''}._`, '');
    return out.join('\n');
  }

  const scope = hasSubtasks ? ' across this ticket and its subtasks' : '';
  out.push(
    `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}${scope}. ` +
    `**Total logged: ${formatSeconds(totalSeconds)}** (${(totalSeconds / 3600).toFixed(2)}h).`,
    ''
  );

  out.push('| Date | Ticket | Author | Time | Comment |', '| --- | --- | --- | --- | --- |');
  for (const e of entries) {
    const date = (e.started || '').slice(0, 10);
    const comment = e.comment ? adfToMarkdown(e.comment, null).trim() : '';
    const ticket = e.issueSummary
      ? `[${e.issueKey}](${browseUrl(cred, e.issueKey)}) — ${cell(e.issueSummary)}`
      : `[${e.issueKey}](${browseUrl(cred, e.issueKey)})`;
    out.push(`| ${date} | ${ticket} | ${cell(e.author)} | ${cell(e.timeSpent)} | ${cell(comment)} |`);
  }
  out.push('');

  const sumBy = (keyFn) => {
    const m = new Map();
    for (const e of entries) m.set(keyFn(e), (m.get(keyFn(e)) || 0) + e.seconds);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  out.push('---', '', '## Total by person', '');
  out.push('| Author | Time | Hours |', '| --- | --- | --- |');
  for (const [author, secs] of sumBy((e) => e.author)) {
    out.push(`| ${cell(author)} | ${formatSeconds(secs)} | ${(secs / 3600).toFixed(2)} |`);
  }
  out.push('');

  const byIssue = sumBy((e) => e.issueKey);
  // With one issue this table only restates the header total.
  if (byIssue.length > 1) {
    out.push('---', '', '## Total by ticket', '');
    out.push('| Ticket | Time | Hours |', '| --- | --- | --- |');
    const summaryOf = new Map(entries.map((e) => [e.issueKey, e.issueSummary]));
    for (const [k, secs] of byIssue) {
      const title = summaryOf.get(k) ? ` — ${cell(summaryOf.get(k))}` : '';
      out.push(`| [${k}](${browseUrl(cred, k)})${title} | ${formatSeconds(secs)} | ${(secs / 3600).toFixed(2)} |`);
    }
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Every subtask in full. A parent returns only summary, status, priority and
 * issuetype for each child, so a description, assignee or logged time needs one
 * request per subtask. A subtask the account cannot read comes back as a stub
 * marked unreadable, so the count always matches Jira.
 */
async function fetchSubtasks(cred, issue) {
  const out = [];
  for (const stub of issue.fields?.subtasks || []) {
    const full = await apiGetSoft(cred, `/rest/api/3/issue/${stub.key}?fields=*all`);
    out.push(full
      ? { key: stub.key, fields: full.fields, readable: true }
      : { key: stub.key, fields: stub.fields || {}, readable: false });
  }
  return out;
}

/**
 * Every worklog entry on the issue and on each subtask, paged to each issue's own
 * total.
 *
 * Both halves matter. People log work against the subtask they are working on, so
 * reading only the parent reports no time on a story where work plainly happened —
 * a story routinely reports `timetracking: {}` while its subtasks hold the hours.
 * And reading one page of each loses whatever did not fit in it.
 */
async function fetchWorklogs(cred, issue, subtasks, pageSize) {
  const entries = [];
  const sources = [];
  // A bare key says nothing about what the time went on, and the summary is
  // already in hand here — the caller listed the subtasks to get here at all.
  const summaries = new Map([
    [issue.key, issue.fields?.summary || ''],
    ...subtasks.map((s) => [s.key, s.summary || '']),
  ]);

  for (const key of [issue.key, ...subtasks.map((s) => s.key)]) {
    const { rows, total, unreadable } = await getAllPages(
      cred, `/rest/api/3/issue/${key}/worklog`, 'worklogs', { pageSize, soft: true }
    );
    if (unreadable) continue;
    sources.push({ issueKey: key, total });
    for (const w of rows) {
      entries.push({
        issueKey: key,
        issueSummary: summaries.get(key) || '',
        author: w.author?.displayName || 'Unknown',
        started: w.started || '',
        seconds: w.timeSpentSeconds || 0,
        timeSpent: w.timeSpent || '',
        comment: w.comment || null,
      });
    }
  }

  // Oldest first, so the table reads as the history of the work.
  entries.sort((a, b) => (a.started < b.started ? -1 : a.started > b.started ? 1 : 0));
  return { entries, sources };
}

/** Validate a JSON file we just wrote, so an invalid file never outlives its run. */
function validateJson(path) {
  try {
    execFileSync('node', [join(SCRIPT_DIR, 'check-json.mjs'), path], { encoding: 'utf8' });
    return true;
  } catch (err) {
    console.error((err.stdout || '') + (err.stderr || ''));
    console.error(`${path} does not match its schema. The part is not complete.`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BOOLEAN_FLAGS = new Set(['all-assets', 'no-assets', 'quiet', 'help']);

/**
 * Parse positionals and flags. The boolean allowlist matters: without it,
 * `--no-assets KEY` would swallow the issue key as the flag's value and leave no
 * positional argument.
 */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (BOOLEAN_FLAGS.has(name)) { flags[name] = true; continue; }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { flags[name] = true; continue; }
      flags[name] = next;
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function usage() {
  console.log(`Usage: fetch-issue.mjs <ISSUE-KEY> --part ${PARTS.join('|')}`);
  console.log('');
  console.log('Fetches ONE part of an issue into its own folder, so the part can be');
  console.log('formatted and checked before the next is fetched.');
  console.log('');
  console.log('  --out DIR         Override the output folder');
  console.log('  --mode M          markdown | json | both');
  console.log('  --max-asset-mb N  Attachment size limit');
  console.log('  --all-assets      Download non-image attachments too');
  console.log('  --no-assets       Download nothing; still list every attachment');
  console.log('  --page-size N     Rows per API request; lower it to exercise paging');
  console.log('  --quiet           Report only the summary line');
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const key = (positional[0] || '').toUpperCase();

  if (flags.help || !key) {
    usage();
    process.exit(flags.help ? 0 : 1);
  }

  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
    console.error(`Not an issue key: ${positional[0]}`);
    console.error('The issue key must come first, before any flags.');
    process.exit(1);
  }

  const part = flags.part;
  if (!part || part === true) {
    console.error(`Required: --part ${PARTS.join('|')}`);
    process.exit(1);
  }
  if (!PARTS.includes(part)) {
    console.error(`Unknown part "${part}". Use one of: ${PARTS.join(', ')}`);
    console.error('Confluence pages are pulled by fetch-confluence.mjs.');
    process.exit(1);
  }

  let pageSize;
  if (flags['page-size'] !== undefined && flags['page-size'] !== true) {
    pageSize = Number(flags['page-size']);
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      console.error(`--page-size needs a positive number, got: ${flags['page-size']}`);
      process.exit(1);
    }
  }

  const { config, root, cred } = connect();
  const modes = outputModes(config);
  if (flags.mode && flags.mode !== true) {
    if (!['markdown', 'json', 'both'].includes(flags.mode)) {
      console.error(`--mode must be markdown, json or both, got: ${flags.mode}`);
      process.exit(1);
    }
    modes.markdown = flags.mode !== 'json';
    modes.json = flags.mode !== 'markdown';
    modes.mode = flags.mode;
  }

  // An unparseable size would be NaN, and every "size > NaN" test is false, so
  // the limit would silently vanish and pull down every attachment.
  let maxAssetMb = config.output?.assets?.maxMb ?? 10;
  if (flags['max-asset-mb'] !== undefined && flags['max-asset-mb'] !== true) {
    maxAssetMb = Number(flags['max-asset-mb']);
    if (!Number.isFinite(maxAssetMb) || maxAssetMb < 0) {
      console.error(`--max-asset-mb needs a number, got: ${flags['max-asset-mb']}`);
      process.exit(1);
    }
  }

  const outDir = flags.out && flags.out !== true
    ? resolve(String(flags.out))
    : outputDirFor(config, key, root);

  const issue = await apiGet(cred, `/rest/api/3/issue/${key}?fields=*all&expand=names`);
  const typeName = issue.fields?.issuetype?.name || 'Unknown';
  const typeCfg = issueTypeConfig(config, typeName);
  const names = issue.names || {};
  const log = (msg) => { if (!flags.quiet) console.log(msg); };

  if (!typeCfg) {
    console.error(`Issue type "${typeName}" is not configured in .jira.config.json.`);
    console.error('');
    console.error('Add it, so its fields are chosen deliberately rather than guessed:');
    console.error(`  node ${join(SCRIPT_DIR, 'inspect.mjs')} fields ${config.project?.key || '<PROJECT>'} --type ${JSON.stringify(typeName)}`);
    console.error('');
    console.error('Then add an entry under "issueTypes" and re-run. See workflows/setup.md step 6.');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const written = [];
  const wroteJson = [];

  const write = (name, body) => {
    const path = join(outDir, name);
    writeFileSync(path, body.replace(/\n*$/, '\n'), 'utf8');
    written.push(name);
    return path;
  };
  const writeJson = (name, obj) => {
    const path = write(name, JSON.stringify(obj, null, 2));
    wroteJson.push(path);
    return path;
  };

  // -------------------------------------------------------------------------
  if (part === 'content') {
    const attachments = issue.fields?.attachment || [];
    const { resolver, report } = await downloadAssets(cred, attachments, join(outDir, 'assets'), {
      maxAssetMb,
      allAssets: !!flags['all-assets'],
      noAssets: !!flags['no-assets'],
      imagesOnly: config.output?.assets?.imagesOnly !== false,
    });

    // The summary counts only; the full listing is its own part. Soft throughout,
    // so an unreachable panel thins this document rather than failing the part.
    // Read before the metadata block, which names the environments it found.
    const devStatus = await fetchDevStatus(cred, issue.id);

    const meta = buildMeta(cred, issue, config, devStatus);
    const { chosen, rows } = splitFields(issue, typeCfg, names, resolver, config);
    const checklist = parseChecklist(
      issue.fields?.[config?.project?.checklistFields?.contentYaml]
    );
    // Gated on the project mapping the field at all, so a project with no
    // checklist app pays no request for it. Not gated on the YAML parsing to
    // items: that field is written once at creation and is empty on many issues
    // whose Checklist app still holds real progress. Gating on it dropped the
    // section entirely — count and all — on 26 of 80 issues in one bulk run.
    const checklistProgress = config?.project?.checklistFields?.contentYaml
      ? await fetchChecklistProgress(cred, key)
      : null;

    // The description heading follows the config, so a project that calls it
    // "User Story" gets that heading rather than a generic one.
    const descSpec = (typeCfg.fields || []).find((x) => x.id === 'description');
    const descBody = issue.fields?.description
      ? adfToMarkdown(issue.fields.description, resolver).trim()
      : '';
    const description = descBody
      ? { heading: descSpec?.heading || 'Description', body: descBody }
      : null;

    const commentCount = await (async () => {
      const page = await apiGetSoft(cred, `/rest/api/3/issue/${key}/comment?startAt=0&maxResults=0`);
      return page && typeof page.total === 'number' ? page.total : (issue.fields?.comment?.total ?? 0);
    })();

    if (modes.markdown) {
      write('content.md', buildContentMarkdown(
        cred, issue, meta, description, chosen, rows, checklist, checklistProgress, report, [], commentCount, devStatus
      ));
    }
    if (modes.json) {
      writeJson('content.json', {
        $schema: 'jira-to-local/content-v3',
        key,
        url: browseUrl(cred, key),
        summary: issue.fields?.summary || '',
        fetchedAt: today(),
        meta,
        description,
        fields: chosen,
        metaRows: rows,
        checklist,
        checklistProgress,
        attachments: report.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.size,
          downloaded: !!a.saved,
          localPath: a.saved || null,
          skippedReason: a.skipped || null,
        })),
        subtasks: (issue.fields?.subtasks || []).map((s) => ({
          key: s.key,
          summary: s.fields?.summary || '',
          url: browseUrl(cred, s.key),
          status: s.fields?.status?.name || null,
          type: s.fields?.issuetype?.name || null,
        })),
        links: (issue.fields?.issuelinks || []).map((l) => {
          const o = l.outwardIssue || l.inwardIssue;
          if (!o) return null;
          return {
            type: (l.outwardIssue ? l.type?.outward : l.type?.inward) || 'relates to',
            key: o.key,
            summary: o.fields?.summary || null,
            url: browseUrl(cred, o.key),
            status: o.fields?.status?.name || null,
          };
        }).filter(Boolean),
        linkedDocuments: [],
        development: devStatus
          ? {
              counts: devStatus.counts,
              buildStates: devStatus.buildStates,
              summaryBuildCount: devStatus.summaryBuildCount ?? null,
              degraded: devStatus.degraded,
            }
          : null,
        deployment: devStatus?.environments?.length
          ? {
              environments: devStatus.environments,
              deploymentCount: devStatus.deployments.length,
              deploymentStates: devStatus.deploymentStates,
            }
          : null,
        commentCount,
      });
    }

    const saved = report.filter((r) => r.saved).length;
    const skipped = report.filter((r) => !r.saved).length;
    log(`${key} content — type ${typeName}, mapping "${typeCfg.name}"`);
    log(`  fields: ${chosen.length} section(s), ${rows.length} metadata row(s), ${checklist.length} checklist item(s)${checklistProgress ? `, ${checklistProgress.done}/${checklistProgress.total} done` : ''}`);
    if (devStatus) {
      const c = devStatus.counts;
      log(
        `  development: ${c.pullRequests} PR(s), ${c.commits} commit(s), ${c.builds} build(s), `
        + `${c.deployments} deployment(s)`
        + `${devStatus.degraded.length ? ` — ${devStatus.degraded.join('; ')}` : ''}`
        + ' (fetch with --part development)'
      );
    }
    log(`  assets: ${saved} downloaded, ${skipped} listed but not downloaded`);
    log(`  comments: ${commentCount} (fetch with --part comments)`);
  }

  // -------------------------------------------------------------------------
  if (part === 'comments') {
    // Read the thread from its own endpoint, never from fields=*all. That
    // response is capped, and a caller that trusts it writes a short file.
    const { rows, total } = await getAllPages(
      cred, `/rest/api/3/issue/${key}/comment`, 'comments', { pageSize }
    );

    // Comment bodies carry inline images as often as descriptions do, so the
    // attachments are indexed again here to resolve them.
    const { resolver } = await downloadAssets(cred, issue.fields?.attachment || [], join(outDir, 'assets'), {
      maxAssetMb,
      allAssets: !!flags['all-assets'],
      noAssets: !!flags['no-assets'],
      imagesOnly: config.output?.assets?.imagesOnly !== false,
      mediaNames: await commentMediaNames(cred, key),
    });

    if (modes.markdown) write('comments.md', buildCommentsMarkdown(cred, issue, rows, total, resolver));
    if (modes.json) {
      writeJson('comments.json', {
        $schema: 'jira-to-local/comments-v2',
        key,
        url: browseUrl(cred, key),
        summary: issue.fields?.summary || null,
        total,
        comments: rows.map((c) => {
          const body = c.body ? adfToMarkdown(c.body, resolver).trim() : '';
          return {
            id: String(c.id),
            author: c.author?.displayName || 'Unknown',
            created: c.created || '',
            updated: c.updated || null,
            body,
            // Every asset the comment references, not only the embedded images:
            // a spreadsheet or a PDF is attached to a comment as often as a
            // screenshot is, and it renders as a plain link rather than an
            // embed. Both markdown forms are matched, and the same file linked
            // twice is listed once.
            attachments: [...new Set(
              [...body.matchAll(/!?\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1])
            )],
          };
        }),
      });
    }

    log(`${key} comments — ${rows.length} of ${total} written`);
  }

  // -------------------------------------------------------------------------
  if (part === 'tasks') {
    const stubs = issue.fields?.subtasks || [];
    if (!stubs.length) {
      log(`${key} tasks — no subtasks; nothing written`);
      log('');
      log(`Wrote nothing to ${outDir}`);
      return;
    }

    const subtasks = await fetchSubtasks(cred, issue);

    if (modes.markdown) write('tasks.md', buildTasksMarkdown(cred, issue, subtasks));
    if (modes.json) {
      writeJson('tasks.json', {
        $schema: 'jira-to-local/tasks-v2',
        key,
        url: browseUrl(cred, key),
        summary: issue.fields?.summary || null,
        parent: issue.fields?.parent
          ? {
              key: issue.fields.parent.key,
              summary: issue.fields.parent.fields?.summary || '',
              url: browseUrl(cred, issue.fields.parent.key),
            }
          : null,
        readOnly: true,
        total: subtasks.length,
        subtasks: subtasks.map((s) => ({
          key: s.key,
          url: browseUrl(cred, s.key),
          summary: s.fields?.summary || '',
          readable: s.readable,
          type: s.fields?.issuetype?.name || null,
          status: s.fields?.status?.name || null,
          assignee: s.fields?.assignee?.displayName || null,
          originalEstimate: s.fields?.timetracking?.originalEstimate || null,
          // Jira's own second counts, alongside its display strings. "7h" hides
          // that Jira's working day is 8 hours, so summing the strings gives the
          // wrong answer; the seconds add up correctly.
          originalEstimateSeconds: s.fields?.timetracking?.originalEstimateSeconds ?? null,
          timeSpent: s.fields?.timetracking?.timeSpent || null,
          timeSpentSeconds: s.fields?.timetracking?.timeSpentSeconds ?? null,
          description: s.fields?.description ? adfToMarkdown(s.fields.description, null).trim() : null,
        })),
      });
    }

    const unreadable = subtasks.filter((s) => !s.readable).length;
    log(`${key} tasks — ${subtasks.length} of ${stubs.length} subtask(s)${unreadable ? `, ${unreadable} unreadable` : ''}`);
  }

  // -------------------------------------------------------------------------
  if (part === 'development') {
    const dev = await fetchDevStatus(cred, issue.id);
    if (!dev) {
      log(`${key} development — no development activity; nothing written`);
      log('');
      log(`Wrote nothing to ${outDir}`);
      return;
    }

    if (modes.markdown) write('development.md', buildDevelopmentMarkdown(cred, issue, dev));
    if (modes.json) {
      writeJson('development.json', {
        $schema: 'jira-to-local/development-v1',
        key,
        url: browseUrl(cred, key),
        summary: issue.fields?.summary || null,
        readOnly: true,
        counts: dev.counts,
        buildStates: dev.buildStates,
        summaryBuildCount: dev.summaryBuildCount ?? null,
        degraded: dev.degraded,
        repositories: groupByRepository(dev).map((g) => ({
          name: g.name,
          url: g.url,
          pullRequests: g.pullRequests,
          commits: g.commits,
          builds: g.builds,
        })),
        environments: dev.environments,
        deployments: dev.deployments,
        deploymentStates: dev.deploymentStates,
      });
    }

    const c = dev.counts;
    log(
      `${key} development — ${c.pullRequests} PR(s), ${c.commits} commit(s) in `
      + `${c.repositories} repositor(ies), ${c.builds} build(s), `
      + `${c.deployments} deployment(s) across ${c.environments} environment(s)`
    );
    for (const gap of dev.degraded) log(`  degraded: ${gap}`);
    if (dev.summaryBuildCount && dev.summaryBuildCount !== c.builds) {
      log(`  note: Jira's panel reports ${dev.summaryBuildCount} build(s), the latest per pipeline`);
    }
  }

  // -------------------------------------------------------------------------
  if (part === 'worklogs') {
    const subtaskRefs = (issue.fields?.subtasks || [])
      .map((s) => ({ key: s.key, summary: s.fields?.summary || '' }));
    const subtaskKeys = subtaskRefs.map((s) => s.key);
    const { entries, sources } = await fetchWorklogs(cred, issue, subtaskRefs, pageSize);
    const totalSeconds = entries.reduce((a, e) => a + e.seconds, 0);

    if (modes.markdown) write('worklogs.md', buildWorklogsMarkdown(cred, issue, entries, subtaskKeys.length > 0));
    if (modes.json) {
      const sumBy = (keyFn) => {
        const m = new Map();
        for (const e of entries) m.set(keyFn(e), (m.get(keyFn(e)) || 0) + e.seconds);
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      };
      const byIssue = sumBy((e) => e.issueKey);

      writeJson('worklogs.json', {
        $schema: 'jira-to-local/worklogs-v2',
        key,
        url: browseUrl(cred, key),
        summary: issue.fields?.summary || null,
        parent: issue.fields?.parent
          ? {
              key: issue.fields.parent.key,
              summary: issue.fields.parent.fields?.summary || '',
              url: browseUrl(cred, issue.fields.parent.key),
            }
          : null,
        readOnly: true,
        scope: subtaskKeys.length ? 'issue-and-subtasks' : 'issue',
        total: entries.length,
        totalSeconds,
        entries: entries.map((e) => ({
          issueKey: e.issueKey,
          author: e.author,
          started: e.started,
          seconds: e.seconds,
          timeSpent: e.timeSpent,
          // An empty comment is null, not "": no comment and a blank comment are
          // the same fact, and null says it without inviting a reader to wonder.
          comment: (e.comment ? adfToMarkdown(e.comment, null).trim() : '') || null,
        })),
        byPerson: sumBy((e) => e.author).map(([author, secs]) => ({
          author, seconds: secs, timeSpent: formatSeconds(secs),
        })),
        // With one issue this only restates the header total.
        ...(byIssue.length > 1
          ? { byIssue: byIssue.map(([k, secs]) => ({ issueKey: k, seconds: secs, timeSpent: formatSeconds(secs) })) }
          : {}),
        sources,
      });
    }

    const carrying = sources.filter((s) => s.total > 0).map((s) => `${s.issueKey}:${s.total}`);
    log(`${key} worklogs — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, ${formatSeconds(totalSeconds) || '0m'}`);
    log(`  read ${sources.length} issue(s); time on: ${carrying.length ? carrying.join(' ') : 'none'}`);
  }

  // Validate every JSON file before claiming the part is done, so an invalid
  // document never outlives the run that produced it.
  for (const path of wroteJson) {
    if (!validateJson(path)) process.exit(1);
  }

  log('');
  if (written.length) {
    console.log(`Wrote ${outDir}/`);
    for (const name of written) console.log(`  ${name}`);
    if (existsSync(join(outDir, 'assets'))) console.log('  assets/');
  }
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
