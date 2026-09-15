#!/usr/bin/env node
// Writes and reads the setup decision files.
//
// Setup has five decisions — project, issue types, fields (one file per type),
// board, output — and every one of them was, at some point, made by an agent that
// believed it was being helpful. The fix is not a stronger instruction; it is
// removing the agent's ability to make the decision at all. Each decision becomes
// a markdown file of checkboxes, generated from the API's own answer. The user
// ticks. `read` reports what they ticked. Nothing else is a choice.
//
// `project`, `issue-types`, `board` and `output` generate with every box unticked:
// there the options are few and the answer is genuinely open, so an empty file is an
// honest question.
//
// `fields` is different, and generates with every box TICKED. Its options are not
// arbitrary — inspect.mjs narrows them to the fields this issue type's screen shows,
// plus the read-only rows Jira displays that no form can carry. That is Jira's own
// answer to "what does this type hold", so keeping all of it is the sensible default
// and the user's job is to cut what they do not want. Reviewing a full list is a
// smaller job than building one from nothing, and dozens of empty boxes is not a question
// put to someone, it is data entry handed to them.
//
// Which makes an UNTICKED box the evidence a human has been through a fields file,
// and the tick the evidence everywhere else. The exit-4 guard tests accordingly.
//
//   generate <kind> [--type TYPE]   write the file (fields: all ticked)
//   read <kind> [--type TYPE]       report the ticked lines, or exit 2 if none
//   status                          which decisions are settled, which are not
//
// Exit codes: 0 settled, 2 nothing ticked, 3 file absent, 4 would erase a decision,
// 1 usage or API error.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { findConfigPath } from './config.mjs';
import { connect, apiGet, apiGetSoft } from './jira-api.mjs';

const KINDS = ['project', 'issue-types', 'fields', 'board', 'output'];

// Fields that already have a whole file of their own. Every one of these is
// written in full elsewhere in the pull — comments to comments.md, subtasks to
// tasks.md, worklog to worklogs.md — and content.md links out to each. Offering
// them as tickable headings invites a duplicate: the same content twice, once
// summarised badly. They are dropped from the fields file rather than explained
// in it, because an option that should never be ticked should not be on the page.
const COVERED_ELSEWHERE = new Map([
  ['comment', 'comments.md'],
  ['subtasks', 'tasks.md'],
  ['worklog', 'worklogs.md'],
  ['timetracking', 'worklogs.md'],
  ['aggregateprogress', 'worklogs.md'],
  ['progress', 'worklogs.md'],
  ['workratio', 'worklogs.md'],
  ['aggregatetimespent', 'worklogs.md'],
  ['aggregatetimeestimate', 'worklogs.md'],
  ['aggregatetimeoriginalestimate', 'worklogs.md'],
  ['timespent', 'worklogs.md'],
  ['timeestimate', 'worklogs.md'],
]);

// `timeoriginalestimate` is deliberately NOT in the list above. On a subtask it is
// the estimate for the work itself, which is content rather than a roll-up, so
// inspect.mjs offers it on subtask types and the user decides. `worklogs.md` still
// reports the hours logged against it; the two answer different questions — what was
// planned, and what was spent.

// ---------------------------------------------------------------------------

// Decisions live next to the config, in a folder the user can delete once setup
// is done. Not in the output dir: these are inputs to the config, not artifacts
// of a pull.
function choicesDir() {
  const cfgPath = findConfigPath();
  const root = cfgPath ? dirname(cfgPath) : process.cwd();
  const dir = join(root, '.jira-setup-choices');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(kind, type) {
  const slug = kind === 'fields' ? `fields-${String(type).replace(/[^A-Za-z0-9]+/g, '-')}` : kind;
  return join(choicesDir(), `${slug}.md`);
}

// A checkbox line carries the human-readable label AND the machine value, so
// `read` never has to guess which option a ticked line meant.
function checkbox(value, label) {
  return `- [ ] \`${value}\`  ${label}`;
}

function parseTicked(path) {
  if (!existsSync(path)) return null;
  const ticked = [];
  let total = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*-\s*\[( |x|X)\]\s*`([^`]+)`/.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1] !== ' ') ticked.push(m[2]);
  }
  return { ticked, total };
}

// Reads a flag's value out of argv, so generate can take --sample.
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

// The sample key a fields file recorded when it was written. Keeping the same
// sample across regenerates is what stops the option list from drifting.
function previousSample(path) {
  if (!existsSync(path)) return undefined;
  const m = /^sample:\s*(\S+)/m.exec(readFileSync(path, 'utf8'));
  return m?.[1];
}

// The issue type's own description, as Jira states it. Read out of the
// issue-types decision file rather than re-fetched: that file already holds every
// type's description, and it is the artifact the user ticked.
function typeDescription(config, type) {
  const path = fileFor('issue-types', undefined);
  if (!existsSync(path)) return undefined;
  const wanted = String(type).trim();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*-\s*\[[ xX]\]\s*`([^`]+)`\s*(.*)$/.exec(line);
    if (m && m[1].trim() === wanted) return m[2].trim() || undefined;
  }
  return undefined;
}

// `closing` overrides the default footer line. The fields file needs a different
// one: it arrives with every box ticked, so "nothing is chosen for you" would be a
// lie on the page it is printed on, and a footer contradicting the file is worse
// than none.
const header = (title, instruction, closing) =>
  `# ${title}\n\n${instruction}\n\n` +
  (closing ?? 'Tick with an `x`, like `- [x]`. Nothing is chosen for you.') +
  '\n\n';

async function generate(kind, type) {
  const path = fileFor(kind, type);

  // A regenerate would overwrite the file, and with it any decision already in it.
  // Losing that is worse than refusing to refresh the options, and it is silent, so
  // it fails loudly instead. --force is for the case where the options themselves
  // went stale and the user says redo it.
  //
  // What counts as a decision differs by kind, because the defaults do. A `fields`
  // file arrives with every box ticked, so a tick proves nothing about whether
  // anyone has read it — an **unticked** box is the evidence, since only a human
  // unticks. Every other kind arrives empty, so a tick is the evidence there.
  const existing = parseTicked(path);
  let decided = 0;
  let what = '';
  if (existing) {
    if (kind === 'fields') {
      decided = existing.total - existing.ticked.length;
      what = `${decided} box(es) unticked`;
    } else {
      decided = existing.ticked.length;
      what = `${decided} ticked box(es): ${existing.ticked.join(', ')}`;
    }
  }
  if (decided > 0 && !process.argv.includes('--force')) {
    process.stderr.write(
      `${path}\nalready carries a decision — ${what}\n\n` +
        `Regenerating would erase it. Read it instead:\n` +
        `  read ${kind}${type ? ` --type "${type}"` : ''}\n\n` +
        `Pass --force only when the user asks to start this decision over.\n`,
    );
    process.exit(4);
  }

  if (kind === 'project') {
    const { cred } = connect();
    const rows = await apiGet(cred, '/rest/api/3/project/search?maxResults=200');
    const lines = (rows.values ?? [])
      .map((p) => checkbox(p.key, `${p.name} (${p.projectTypeKey})`))
      .sort((a, b) => a.localeCompare(b));
    writeFileSync(
      path,
      header(
        'Which project?',
        `Every project the account can see — ${lines.length} of them. Tick exactly one.\nThe repository you are in does not decide this; only your tick does.`,
      ) + lines.join('\n') + '\n',
    );
    return { path, count: lines.length };
  }

  if (kind === 'issue-types') {
    const { config, cred } = connect();
    const key = config.project?.key;
    if (!key) fail('project.key is not set yet. Settle the project decision first.');
    const meta = await apiGet(cred, `/rest/api/3/project/${encodeURIComponent(key)}`);
    const types = meta.issueTypes ?? [];
    const parents = types.filter((t) => !t.subtask);
    const subs = types.filter((t) => t.subtask);
    const body = [
      `## Types you can pull directly (${parents.length})`,
      '',
      ...parents.map((t) => checkbox(t.name, t.description ? t.description.slice(0, 90) : '')),
      '',
      `## Subtask types (${subs.length})`,
      '',
      'These are reported by `--part tasks` whether or not you tick them. Tick one',
      'only if you also pull it as an issue in its own right.',
      '',
      ...subs.map((t) => checkbox(t.name, t.description ? t.description.slice(0, 90) : '')),
    ];
    writeFileSync(
      path,
      header(
        `Which issue types? (${types.length} exist)`,
        `Every type ${key} has. Tick each one you actually pull.\nA long list is normal. Do not tick a type because it sounds standard.`,
      ) + body.join('\n') + '\n',
    );
    return { path, count: types.length };
  }

  if (kind === 'fields') {
    if (!type) fail('--type is required for the fields decision.');
    const { config } = connect();
    const key = config.project?.key;
    if (!key) fail('project.key is not set yet. Settle the project decision first.');
    // The sample issue decides which fields count as populated, so an unpinned
    // sample makes the option list drift: regenerate, land on a different issue,
    // and a field the user already ticked can vanish because that one issue left
    // it blank. --sample pins it, and a regenerate reuses whatever the file
    // recorded unless the caller overrides it.
    const sampleFlag = argValue('--sample') ?? previousSample(path);
    const probe = spawnSync(
      process.execPath,
      [
        join(dirname(new URL(import.meta.url).pathname), 'inspect.mjs'),
        'fields',
        key,
        '--type',
        type,
        ...(sampleFlag ? ['--sample', sampleFlag] : []),
        '--json',
      ],
      { encoding: 'utf8' },
    );
    if (probe.status !== 0) fail(`field probe failed for "${type}": ${probe.stderr.trim()}`);
    const probed = JSON.parse(probe.stdout);
    // inspect.mjs has already narrowed this to the type's screen plus the
    // read-only rows no form can carry, so every row here is a field a person
    // actually sees on the issue. Empty ones stay: a field blank on one sample is
    // still on the screen, and dropping it would hide it from the decision.
    const offered = probed.fields.filter((f) => !COVERED_ELSEWHERE.has(f.id));
    const covered = probed.fields.filter((f) => COVERED_ELSEWHERE.has(f.id));
    const withValue = offered.filter((f) => !f.empty);

    // Populated first, so what the sample proves is real leads; then custom before
    // built-in, then by name. Every row is ticked, so this is reading order rather
    // than priority.
    const ordered = [...offered].sort((a, b) =>
      Number(a.empty) - Number(b.empty) ||
      Number(b.custom) - Number(a.custom) ||
      String(a.name).localeCompare(String(b.name)));

    // Everything arrives ticked. The screen list is Jira's own answer to what this
    // type shows, so the sensible default is "keep it all" and let the user cut
    // what they do not want — reviewing a full list is a smaller job than building
    // one from nothing.
    const lines = ordered.map((f) => {
      const preview = (f.preview ?? '').replace(/\s+/g, ' ').slice(0, 110);
      const flags = [f.configType, f.writable ? null : 'read-only', f.empty ? 'empty on this sample' : null]
        .filter(Boolean).join(', ');
      return `- [x] \`${f.id}\`  **${f.name}** — ${flags}\n      ${preview || '_(no preview)_'}`;
    });
    // Named, not silently dropped: a reader looking for "Comment" should find out
    // where it went rather than assume the pull loses it.
    const coveredNote = covered.length
      ? [
          '',
          '---',
          '',
          `## Not listed: ${covered.length} field(s) that get their own file`,
          '',
          'These are pulled in full, each into its own document, and `content.md` links',
          'to them. Giving them a heading here would duplicate that content, so they are',
          'not offered as options.',
          '',
          ...covered.map((f) => `- **${f.name}** \`${f.id}\` → \`${COVERED_ELSEWHERE.get(f.id)}\``),
        ].join('\n')
      : '';
    // The type's own description is what makes a field judgeable: a prose field
    // earns a heading on one type and not on another. It goes in the
    // file so the agent doing the pre-tick pass reads it here, next to the previews.
    const typeDoc = typeDescription(config, type);
    writeFileSync(
      path,
      `sample: ${probed.sample}\n` +
        header(
          `Which fields get their own heading on ${type}?`,
          [
            typeDoc ? `**${type}** — ${typeDoc}` : `**${type}**`,
            '',
            `${offered.length} field(s) — what this type's screen shows, plus the read-only`,
            `rows Jira displays but no form can carry. Sampled from ${probed.sample},`,
            `where ${withValue.length} of them hold a value.`,
            ...(covered.length
              ? [`Another ${covered.length} get their own file; they are listed at the end.`]
              : []),
            '',
            '**Every row arrives ticked.** That is the default, not a decision: this is the',
            'field list Jira itself shows for this type, so keeping it all is the sensible',
            'starting point. **Untick what you do not want.**',
            '',
            'Read the preview under each name — that is what the field actually holds.',
            'A preview reading `As a _______` or `<Insert Text>` is an unfilled template.',
            'A preview identical on every issue of every type is process boilerplate.',
            'A row marked `empty on this sample` is on the screen but blank on this one',
            'ticket; it may well be filled in on others.',
            '',
            '**Unticking a field drops it.** Only ticked fields are written, so a box you',
            'clear is content the pull will never report. Untick what this type does not',
            'need in a document, not merely what looks unimportant.',
            '',
            'A tick does not decide where the field goes. Prose gets its own section; a',
            'value that fits on one line becomes a row of the metadata table.',
          ].join('\n'),
          'Everything starts ticked. Untick with a space, like `- [ ]`.',
        ) + lines.join('\n') + '\n' + coveredNote + (coveredNote ? '\n' : ''),
    );
    return {
      path, count: offered.length, sample: probed.sample,
      covered: covered.length, ticked: offered.length,
    };
  }

  if (kind === 'board') {
    const { config, cred } = connect();
    const key = config.project?.key;
    if (!key) fail('project.key is not set yet. Settle the project decision first.');
    const res = await apiGetSoft(
      cred,
      `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(key)}&maxResults=100`,
    );
    const boards = res?.values ?? [];
    const lines = boards.map((b) => checkbox(String(b.id), `${b.name} (${b.type})`));
    lines.push(checkbox('none', 'No board. Leave `project.boards` out of the config.'));
    writeFileSync(
      path,
      header(
        'Which board?',
        [
          `${boards.length} board(s) match ${key}. Tick every board the team uses, or`,
          'tick "none". More than one is normal and is recorded as a list.',
          '',
          'The order here is the order the API returned. It carries no meaning:',
          'the first row is not a default and not a recommendation. Several boards',
          'usually mention the same team, and only you know which are yours.',
        ].join('\n'),
      ) + lines.join('\n') + '\n',
    );
    return { path, count: lines.length };
  }

  if (kind === 'output') {
    const body = [
      '## Mode — tick exactly one',
      '',
      checkbox('markdown', 'Markdown only. For a person to read.'),
      checkbox('json', 'JSON only. For a program to read.'),
      checkbox('both', 'Both. Doubles the files and adds schema validation per pull.'),
      '',
      '## Linked Confluence pages — tick exactly one',
      '',
      checkbox('confluence-yes', 'Pull pages the issue links (depth 0 — the page itself, not its children).'),
      checkbox('confluence-no', 'Do not pull linked pages.'),
      '',
      '## Destination folder',
      '',
      'Write the path on the line below, replacing the example. Relative to the',
      'workspace root. One subfolder per issue key is created inside it.',
      '',
      '    .ai-artifacts/jira',
      '',
      'Check whether that path is gitignored before you settle on it: pulled tickets',
      'are Jira content, and committing them duplicates the source of truth.',
    ];
    writeFileSync(path, header('Where do pulled issues go?', 'Three decisions here.') + body.join('\n') + '\n');
    return { path, count: 5 };
  }

  fail(`Unknown decision "${kind}". One of: ${KINDS.join(', ')}`);
}

function read(kind, type) {
  const path = fileFor(kind, type);
  const parsed = parseTicked(path);
  if (!parsed) {
    process.stderr.write(
      `No decision file at ${path}\nGenerate it, and let the user tick it, before recording this decision.\n`,
    );
    process.exit(3);
  }
  if (parsed.ticked.length === 0) {
    process.stderr.write(
      `Nothing ticked in ${path} (${parsed.total} options offered).\n` +
        `This decision is NOT made. Stop and ask the user — do not infer a default,\n` +
        `and do not tick a box on their behalf.\n`,
    );
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({ kind, type, path, ticked: parsed.ticked }, null, 2) + '\n');
}

function status() {
  const dir = choicesDir();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  if (files.length === 0) {
    process.stdout.write(`No decision files yet in ${dir}\n`);
    process.exit(0);
  }
  let unsettled = 0;
  for (const f of files.sort()) {
    const parsed = parseTicked(join(dir, f));
    const settled = parsed.ticked.length > 0;
    if (!settled) unsettled += 1;
    const mark = settled ? 'settled ' : 'WAITING ';
    const detail = settled ? parsed.ticked.join(', ') : `0 of ${parsed.total} ticked`;
    process.stdout.write(`${mark} ${f.padEnd(28)} ${detail}\n`);
  }
  process.stdout.write(
    unsettled === 0
      ? '\nEvery decision on disk is settled.\n'
      : `\n${unsettled} decision(s) still waiting on the user. Do not write the config.\n`,
  );
  process.exit(unsettled === 0 ? 0 : 2);
}

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

const [command, kind, ...rest] = process.argv.slice(2);
const typeFlag = rest.indexOf('--type');
const type = typeFlag === -1 ? undefined : rest[typeFlag + 1];

if (!command || command === '--help' || command === '-h') {
  process.stdout.write(
    `setup-choices.mjs — the setup decision files\n\n` +
      `  generate <kind> [--type TYPE]   write the file, every option unticked\n` +
      `  read <kind> [--type TYPE]       report ticked lines; exit 2 if none, 3 if absent\n` +
      `  generate ... --force            redo a decision that already has ticks (erases them)\n` +
      `  status                          which decisions are settled\n\n` +
      `  kind: ${KINDS.join(' | ')}   (--type required for "fields")\n`,
  );
  process.exit(0);
}

if (command === 'status') status();
else if (command === 'generate') {
  const r = await generate(kind, type);
  process.stdout.write(
    `Wrote ${r.path}\n${r.count} option(s), ${r.sample ? 'all ticked' : 'none ticked'}.\n`
  );
  if (r.sample) process.stdout.write(`Sampled from ${r.sample}\n`);
  process.stdout.write(
    r.sample
      ? `\nEvery box is ticked: this is the field list this issue type's screen shows,\n` +
          `so keeping it all is the default. Hand the path to the user and ask them to\n` +
          `untick what they do not want in a fetched document. Say plainly that\n` +
          `unticking DROPS the field — only ticked fields are written — so a cleared\n` +
          `box is content the pull will never report.\n`
      : `\nShow this file to the user. They tick it. Do not tick it for them.\n`,
  );
} else if (command === 'read') read(kind, type);
else fail(`Unknown command "${command}". Run --help.`);
