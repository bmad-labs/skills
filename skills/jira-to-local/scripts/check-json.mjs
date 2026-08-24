#!/usr/bin/env node
/**
 * check-json.mjs — Validate a written JSON document against its own schema.
 *
 * Every document this skill writes in JSON declares its layout in `$schema`.
 * This script resolves that value to a file in ../schemas and checks the
 * document against it. A document that fails is a failed pull, not a pull with
 * a caveat, so the exit code is what callers act on.
 *
 * Usage: check-json.mjs <file.json> [more.json ...]
 * Exit code 0 when every file is clean, 1 when any finding is reported.
 *
 * Zero dependencies. Supports the JSON Schema subset the schemas here use:
 * type (including union arrays), required, properties, additionalProperties,
 * items, enum, const, minimum, minItems.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const SCHEMA_DIR = resolve(SCRIPT_DIR, '../schemas');

/**
 * Index the schema directory by each schema's `$id`, so a document's `$schema`
 * value is matched against what the schema actually claims to be rather than
 * against a filename. A renamed file therefore cannot silently stop matching.
 */
function loadSchemas() {
  const byId = new Map();
  if (!existsSync(SCHEMA_DIR)) return byId;
  for (const name of readdirSync(SCHEMA_DIR)) {
    if (!name.endsWith('.schema.json')) continue;
    const path = join(SCHEMA_DIR, name);
    let schema;
    try {
      schema = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      console.error(`Schema ${name} is not valid JSON: ${err.message}`);
      process.exit(1);
    }
    if (schema.$id) byId.set(schema.$id, { schema, file: name });
  }
  return byId;
}

/** The JSON type name, with null and array distinguished from object. */
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return t;
}

/**
 * A schema `type` of "integer" accepts an integer; "number" accepts both. Every
 * other name matches exactly. Union arrays pass when any member matches.
 */
function typeMatches(actual, expected) {
  const names = Array.isArray(expected) ? expected : [expected];
  return names.some((name) => {
    if (name === 'number') return actual === 'number' || actual === 'integer';
    return name === actual;
  });
}

function validate(value, schema, path, findings) {
  const add = (msg) => findings.push({ path: path || '(root)', msg });

  if (schema.const !== undefined) {
    if (value !== schema.const) {
      add(`must be ${JSON.stringify(schema.const)}, found ${JSON.stringify(value)}`);
      // A wrong const is usually a wrong version, which makes every other
      // finding in this branch noise. Stop descending.
      return;
    }
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    add(`must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}, found ${JSON.stringify(value)}`);
    return;
  }

  if (schema.type !== undefined) {
    const actual = typeOf(value);
    if (!typeMatches(actual, schema.type)) {
      const want = Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type;
      add(`expected ${want}, found ${actual}`);
      // Descending into a value of the wrong type only produces consequences
      // of this one finding, so report it and stop.
      return;
    }
  }

  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    add(`must be at least ${schema.minimum}, found ${value}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      add(`must hold at least ${schema.minItems} item(s), found ${value.length}`);
    }
    if (schema.items) {
      value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, findings));
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) add(`required property "${key}" is missing`);
    }

    const props = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (props[key]) {
        validate(child, props[key], childPath, findings);
      } else if (schema.additionalProperties === false) {
        findings.push({ path: childPath, msg: 'unknown property; not allowed by the schema' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validate(child, schema.additionalProperties, childPath, findings);
      }
    }
  }
}

function checkFile(path, schemas) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.log(`${path}`);
    console.log(`  (root)  not valid JSON: ${err.message}`);
    return 1;
  }

  const id = doc && typeof doc === 'object' ? doc.$schema : undefined;

  // An unversioned document is a finding in itself: nothing downstream can know
  // which layout it follows, so it must not pass.
  if (!id) {
    console.log(`${path}`);
    console.log('  (root)  no "$schema" — every document must declare its version');
    return 1;
  }

  const entry = schemas.get(id);
  if (!entry) {
    const known = [...schemas.keys()].sort();
    console.log(`${path}`);
    console.log(`  (root)  unknown "$schema" ${JSON.stringify(id)}`);
    console.log(`          known versions: ${known.length ? known.join(', ') : 'none found in schemas/'}`);
    return 1;
  }

  const findings = [];
  validate(doc, entry.schema, '', findings);

  if (!findings.length) return 0;

  console.log(`${path}  (${entry.file})`);
  for (const f of findings) console.log(`  ${f.path}  ${f.msg}`);
  return findings.length;
}

const files = process.argv.slice(2).filter((a) => a !== '--help' && a !== '-h');

if (!files.length || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: check-json.mjs <file.json> [more.json ...]');
  console.log('');
  console.log('Validates each file against the schema named in its own "$schema" key.');
  console.log('Exit 0 when every file is clean, 1 when anything fails.');
  console.log('');
  const schemas = loadSchemas();
  console.log(`Schemas in ${SCHEMA_DIR}:`);
  for (const id of [...schemas.keys()].sort()) console.log(`  ${id}`);
  process.exit(files.length ? 0 : 1);
}

const schemas = loadSchemas();
if (!schemas.size) {
  console.error(`No schemas found in ${SCHEMA_DIR}.`);
  process.exit(1);
}

let total = 0;
let bad = 0;
for (const f of files) {
  if (!existsSync(f)) {
    console.log(`${f}`);
    console.log('  (root)  file does not exist');
    total += 1;
    bad += 1;
    continue;
  }
  const n = checkFile(f, schemas);
  total += n;
  if (n) bad += 1;
}

if (total) {
  console.log('');
  console.log(`${total} finding(s) in ${bad} of ${files.length} file(s).`);
  process.exit(1);
}

console.log(`${files.length} file(s) valid: ${files.map((f) => basename(f)).join(', ')}`);
