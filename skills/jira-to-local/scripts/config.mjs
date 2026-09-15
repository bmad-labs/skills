#!/usr/bin/env node
/**
 * config.mjs — Find, read and validate .jira.config.json.
 *
 * Every other script in this skill gets its settings from here, so the search
 * rule and the validation live in one place. Also usable directly:
 *
 *   config.mjs path              Print the config file's location
 *   config.mjs validate          Check it against schemas/config.schema.json
 *   config.mjs instructions [T]  Print the instructions an agent should read,
 *                                for issue type T when given
 *   config.mjs types             Every configured issue type, one per line
 *   config.mjs type <TYPE>       One type: its docType and its fields, in order
 *   config.mjs meta              metaFields and checklistFields, role to field id
 *   config.mjs where [KEY]       The output directory and mode, and KEY's folder
 *   config.mjs show              Print the whole config — thousands of lines on a
 *                                real project, so prefer types, type, meta or where
 */

import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);

export const CONFIG_NAME = '.jira.config.json';

/**
 * Walk up from the working directory looking for the config, and stop at the
 * workspace root. `.ai-artifacts` is preferred over `.git` for the same reason
 * the fetch prefers it: inside a git submodule the nearest `.git` belongs to the
 * submodule, and stopping there would find the wrong project's config.
 */
export function findConfigPath(startDir = process.cwd()) {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    const candidate = join(dir, CONFIG_NAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** The workspace root, used as the base for a relative `output.dir`. */
export function findWorkspaceRoot(startDir = process.cwd()) {
  for (const marker of ['.ai-artifacts', '.git']) {
    let dir = startDir;
    for (let i = 0; i < 30; i++) {
      if (existsSync(join(dir, marker))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return startDir;
}

/**
 * Validate a config file by handing it to check-json.mjs, so the config is held
 * to the same schema and the same reporting as every document this skill writes.
 * Returns the checker's output rather than throwing, so callers can decide.
 */
export function validateConfigFile(path) {
  try {
    const out = execFileSync('node', [join(SCRIPT_DIR, 'check-json.mjs'), path], {
      encoding: 'utf8',
    });
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: (err.stdout || '') + (err.stderr || '') };
  }
}

/**
 * Read the config, or exit with the setup instruction. Every caller needs a
 * valid config to do anything, so a missing or invalid one is fatal here rather
 * than a value the caller has to keep checking.
 */
export function loadConfig({ startDir = process.cwd(), validate = true } = {}) {
  const path = findConfigPath(startDir);
  if (!path) {
    console.error(`No ${CONFIG_NAME} found in this directory or any parent.`);
    console.error('Run the setup workflow first: workflows/setup.md');
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`${path} is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  if (validate) {
    const result = validateConfigFile(path);
    if (!result.ok) {
      console.error(result.output.trim());
      console.error('');
      console.error(`${path} does not match schemas/config.schema.json. Fix it before pulling.`);
      process.exit(1);
    }
  }

  return { config, path, root: dirname(path) };
}

/**
 * The settings for one Jira issue type, by the type's own name. Returns null
 * when the type is not configured — the caller reports that and offers to add
 * it, rather than guessing a field list.
 */
export function issueTypeConfig(config, typeName) {
  const types = config.issueTypes || {};
  if (types[typeName]) return { name: typeName, ...types[typeName] };

  // Jira type names are stable but their casing is not worth relying on.
  const hit = Object.keys(types).find((k) => k.toLowerCase() === String(typeName).toLowerCase());
  return hit ? { name: hit, ...types[hit] } : null;
}

/**
 * The instructions an agent should read before it fetches anything: the
 * project-wide text, then this issue type's own text. Assembled here so every
 * caller assembles it the same way.
 */
export function instructionsFor(config, typeName) {
  const parts = [];
  if (config.instructions) parts.push(config.instructions.trim());
  if (typeName) {
    const t = issueTypeConfig(config, typeName);
    if (t && t.instructions) parts.push(t.instructions.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}

/** Where this issue's folder goes. Relative `output.dir` is workspace-relative. */
export function outputDirFor(config, key, root) {
  const dir = config.output?.dir || '.ai-artifacts/jira';
  const base = dir.startsWith('/') ? dir : join(root || findWorkspaceRoot(), dir);
  return join(base, key);
}

/** Which files a mode writes. `both` writes markdown and JSON side by side. */
export function outputModes(config) {
  const mode = config.output?.mode || 'markdown';
  return { markdown: mode !== 'json', json: mode !== 'markdown', mode };
}

/** Pad to a column so a printed table lines up without a formatting dependency. */
const pad = (s, n) => String(s ?? '').padEnd(n);

/**
 * Every configured issue type, with the size of its field list.
 *
 * The field count is the useful part: it says at a glance which types the project
 * actually invested in, and `issueTypes` is almost the whole config's bulk.
 */
function cmdTypes(config) {
  const types = config.issueTypes || {};
  const names = Object.keys(types);
  if (!names.length) {
    console.log('No issue types configured. Run workflows/setup.md.');
    return;
  }
  const width = Math.max(...names.map((n) => n.length));
  console.log(`${names.length} configured issue type(s):`);
  for (const name of names) {
    const t = types[name] || {};
    console.log(`  ${pad(name, width)}  ${pad(t.docType || '—', 12)}  ${(t.fields || []).length} field(s)`);
  }
}

/**
 * One issue type in full: what it is called, what it writes, and the fields it
 * ticked in the order they are written.
 *
 * Closes with what the order means, because a bare list of dozens of fields does
 * not tell a reader why the document has only a handful of sections.
 */
function cmdType(config, typeName) {
  if (!typeName) {
    console.error('Which type? Usage: config.mjs type <TYPE>');
    console.error('List them with: config.mjs types');
    process.exit(1);
  }

  const t = issueTypeConfig(config, typeName);
  if (!t) {
    // The same message fetch-issue.mjs prints, so one error text serves both.
    console.error(`Issue type "${typeName}" is not configured.`);
    console.error('');
    console.error('Add it, or check the spelling with: config.mjs types');
    console.error(`Read its screen fields with: inspect.mjs fields --type "${typeName}"`);
    process.exit(1);
  }

  const fields = t.fields || [];
  console.log(`${t.name} — docType ${t.docType || '—'}, ${fields.length} field(s)`);
  console.log('');
  console.log(`Instructions: ${t.instructions ? t.instructions.trim() : '(none recorded for this type)'}`);
  console.log('');

  if (!fields.length) {
    console.log('No fields ticked for this type.');
    return;
  }

  const nameWidth = Math.max(4, ...fields.map((f) => String(f.name || '').length));
  const idWidth = Math.max(2, ...fields.map((f) => String(f.id || '').length));
  console.log(`  #  ${pad('Field', nameWidth + 1)}  ${pad('Id', idWidth)}  ${pad('Type', 7)}  Heading`);
  fields.forEach((f, i) => {
    console.log(
      `  ${pad(i + 1, 2)} ${pad(f.name, nameWidth + 1)}  ${pad(f.id, idWidth)}  `
      + `${pad(f.type || '—', 7)}  ${f.heading || '—'}`
    );
  });
  console.log('');
  console.log('Written in this order. A field typed adf is prose and always gets its own');
  console.log('section; everything else follows its value — multi-line gets a section, a');
  console.log('single line gets a metadata row instead. So a ticked field is not always a');
  console.log('heading, and the count above is not the number of sections.');
}

/**
 * This site's field mapping: which custom field fills which role.
 *
 * Every role is printed, mapped or not. An absent line reads as "I forgot to
 * look"; a line saying "not mapped" is an answer, and it names the consequence.
 */
function cmdMeta(config) {
  const project = config.project || {};
  console.log(`project ${project.key || '—'}${project.name ? ` (${project.name})` : ''}`);
  console.log('');

  const metaRoles = [
    ['team', 'the Team row'],
    ['sprint', 'the Sprint row'],
    ['storyPoints', 'the Story Points row'],
    ['roughStoryPoints', 'the Rough Story Points row'],
    ['dueDate', 'the Due Date row'],
    ['development', 'the Git and Deployments rows'],
    ['epicLink', 'nothing — mapping it only stops the field being written twice'],
  ];
  const meta = project.metaFields || {};
  const roleWidth = Math.max(...metaRoles.map(([r]) => r.length));
  console.log('metaFields — which custom field fills each metadata row:');
  for (const [role, fills] of metaRoles) {
    const id = meta[role];
    console.log(`  ${pad(role, roleWidth)}  ${id || `—  not mapped, so ${fills} reads —`}`);
  }
  console.log('');

  const checklist = project.checklistFields || {};
  const checklistRoles = [
    ['contentYaml', 'the item text; its checked values are frozen at issue creation'],
    ['text', 'the item names, no state'],
    ['completed', 'a one-word completion summary'],
  ];
  console.log('checklistFields — the fields the Checklist app writes into:');
  if (!Object.keys(checklist).length) {
    console.log('  not mapped, so no Checklist section is written');
  } else {
    const width = Math.max(...checklistRoles.map(([r]) => r.length));
    for (const [role, holds] of checklistRoles) {
      console.log(`  ${pad(role, width)}  ${checklist[role] || '—  not mapped'}  ${holds}`);
    }
    console.log('');
    console.log('None of the three carries the live per-item state; the real count comes');
    console.log("from the issue's checklist property instead.");
  }
}

/** Where a pull lands, and what it writes there. */
function cmdWhere(config, key) {
  const root = findWorkspaceRoot();
  const dir = config.output?.dir || '.ai-artifacts/jira';
  const modes = outputModes(config);
  const writes = modes.mode === 'both'
    ? 'writes markdown and JSON side by side'
    : modes.mode === 'json'
      ? 'writes content.json, no content.md'
      : 'writes content.md, no content.json';

  console.log(`dir     ${dir}${dir.startsWith('/') ? '' : `   (relative to ${root})`}`);
  console.log(`mode    ${modes.mode}   (${writes})`);
  if (key) console.log(`folder  ${outputDirFor(config, key, root)}`);
  else console.log('folder  pass an issue key to see one issue\'s folder');
}

function main() {
  const [command, arg] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    console.log('Usage: config.mjs <command> [argument]');
    console.log('');
    console.log('  path              Print the config file\'s location');
    console.log('  validate          Check it against schemas/config.schema.json');
    console.log('  instructions [T]  The instructions to read, for issue type T when given');
    console.log('  types             Every configured issue type, one per line');
    console.log('  type <TYPE>       One type: its docType and its fields, in order');
    console.log('  meta              metaFields and checklistFields, role to field id');
    console.log('  where [KEY]       The output directory and mode, and KEY\'s folder');
    console.log('  show              The whole config — thousands of lines on a real');
    console.log('                    project, so prefer types, type, meta or where');
    process.exit(command ? 0 : 1);
  }

  if (command === 'path') {
    const p = findConfigPath();
    if (!p) {
      console.error(`No ${CONFIG_NAME} found. Run workflows/setup.md.`);
      process.exit(1);
    }
    console.log(p);
    return;
  }

  if (command === 'validate') {
    const p = findConfigPath();
    if (!p) {
      console.error(`No ${CONFIG_NAME} found. Run workflows/setup.md.`);
      process.exit(1);
    }
    const result = validateConfigFile(p);
    process.stdout.write(result.output);
    process.exit(result.ok ? 0 : 1);
  }

  if (command === 'types') {
    cmdTypes(loadConfig().config);
    return;
  }

  if (command === 'type') {
    cmdType(loadConfig().config, arg);
    return;
  }

  if (command === 'meta') {
    cmdMeta(loadConfig().config);
    return;
  }

  if (command === 'where') {
    cmdWhere(loadConfig().config, arg);
    return;
  }

  if (command === 'show') {
    const { config } = loadConfig();
    // On stderr, so anything piping the JSON is unaffected by the advice.
    console.error('config.mjs show prints the whole config. For one answer, try: types, type <TYPE>, meta, where');
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (command === 'instructions') {
    const { config } = loadConfig();
    const text = instructionsFor(config, arg);
    if (text) console.log(text);
    else console.log('(no instructions recorded in the config)');
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

// Only run the CLI when invoked directly, so importing this module is free of
// side effects.
// realpathSync on both sides, because a symlinked skill directory makes the raw
// paths disagree: the file would then load as a library and do nothing, printing
// no output and exiting 0 — which reads as success.
function isMainScript(selfPath) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  return real(process.argv[1]) === real(selfPath);
}

if (process.argv[1] && isMainScript(new URL(import.meta.url).pathname)) {
  main();
}
