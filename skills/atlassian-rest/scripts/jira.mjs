#!/usr/bin/env node

// Jira REST API v3 CLI — Node.js 18+ (zero dependencies)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkEnv() {
  const required = ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_DOMAIN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\n` +
        'Set them before running this script:\n' +
        '  export ATLASSIAN_EMAIL="you@example.com"\n' +
        '  export ATLASSIAN_API_TOKEN="your-api-token"\n' +
        '  export ATLASSIAN_DOMAIN="yoursite.atlassian.net"'
    );
    process.exit(1);
  }
}

function baseUrl() {
  return `https://${process.env.ATLASSIAN_DOMAIN}/rest/api/3`;
}

function authHeader() {
  const cred = Buffer.from(
    `${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`
  ).toString('base64');
  return `Basic ${cred}`;
}

async function request(path, { method = 'GET', body, query } = {}) {
  let url = `${baseUrl()}${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const opts = {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    console.error(`HTTP ${res.status} ${res.statusText} — ${method} ${url}`);
    if (detail) console.error(detail);
    process.exit(1);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

function textToAdf(text) {
  const paragraphs = (text || '').split(/\n\n+/).filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p.trim() }],
    })),
  };
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
        i += 1;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { positional, flags };
}

function requirePositional(positional, index, label) {
  if (positional[index] === undefined) {
    console.error(`Missing required argument: <${label}>`);
    process.exit(1);
  }
  return positional[index];
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdSearch(positional, flags) {
  const jql = requirePositional(positional, 0, 'JQL');
  const maxResults = parseInt(flags.max, 10) || 50;

  const data = await request('/search', {
    method: 'POST',
    body: { jql, maxResults, fields: ['summary', 'status', 'assignee', 'priority'] },
  });

  const issues = (data.issues || []).map((i) => ({
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status?.name,
    assignee: i.fields.assignee?.displayName || null,
    priority: i.fields.priority?.name,
  }));

  console.log(JSON.stringify({ total: data.total, issues }, null, 2));
}

async function cmdGet(positional, flags) {
  const key = requirePositional(positional, 0, 'issueKey');
  const query = {};
  if (flags.fields) {
    query.fields = flags.fields;
  }

  const data = await request(`/issue/${key}`, { query });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdCreate(_positional, flags) {
  const project = flags.project;
  const type = flags.type;
  const summary = flags.summary;

  if (!project || !type || !summary) {
    console.error('Required flags: --project, --type, --summary');
    process.exit(1);
  }

  const fields = {
    project: { key: project },
    issuetype: { name: type },
    summary,
  };

  if (flags.description) {
    fields.description = textToAdf(flags.description);
  }
  if (flags.priority) {
    fields.priority = { name: flags.priority };
  }
  if (flags.assignee) {
    fields.assignee = { id: flags.assignee };
  }
  if (flags.parent) {
    fields.parent = { key: flags.parent };
  }
  if (flags.labels) {
    fields.labels = flags.labels.split(',').map((l) => l.trim());
  }
  if (flags.components) {
    fields.components = flags.components.split(',').map((c) => ({ name: c.trim() }));
  }

  const data = await request('/issue', { method: 'POST', body: { fields } });
  console.log(JSON.stringify({ key: data.key, self: data.self }, null, 2));
}

async function cmdEdit(positional, flags) {
  const key = requirePositional(positional, 0, 'issueKey');

  const fields = {};
  if (flags.summary) fields.summary = flags.summary;
  if (flags.description) fields.description = textToAdf(flags.description);
  if (flags.priority) fields.priority = { name: flags.priority };
  if (flags.assignee) fields.assignee = { id: flags.assignee };
  if (flags.labels) fields.labels = flags.labels.split(',').map((l) => l.trim());
  if (flags.components) fields.components = flags.components.split(',').map((c) => ({ name: c.trim() }));

  if (Object.keys(fields).length === 0) {
    console.error('Provide at least one field to update: --summary, --description, --priority, --assignee, --labels, --components');
    process.exit(1);
  }

  await request(`/issue/${key}`, { method: 'PUT', body: { fields } });
  console.log(JSON.stringify({ updated: key }, null, 2));
}

async function cmdComment(positional, _flags) {
  const key = requirePositional(positional, 0, 'issueKey');
  const body = requirePositional(positional, 1, 'body');

  const data = await request(`/issue/${key}/comment`, {
    method: 'POST',
    body: { body: textToAdf(body) },
  });

  console.log(JSON.stringify({ id: data.id, created: data.created }, null, 2));
}

async function cmdTransitions(positional, _flags) {
  const key = requirePositional(positional, 0, 'issueKey');
  const data = await request(`/issue/${key}/transitions`);
  console.log(JSON.stringify(data.transitions, null, 2));
}

async function cmdTransition(positional, _flags) {
  const key = requirePositional(positional, 0, 'issueKey');
  const transitionId = requirePositional(positional, 1, 'transitionId');

  await request(`/issue/${key}/transitions`, {
    method: 'POST',
    body: { transition: { id: transitionId } },
  });

  console.log(JSON.stringify({ transitioned: key, transitionId }, null, 2));
}

async function cmdProjects(_positional, _flags) {
  const data = await request('/project/search');
  console.log(JSON.stringify(data.values, null, 2));
}

async function cmdIssueTypes(positional, _flags) {
  const projectKey = requirePositional(positional, 0, 'projectKey');
  const data = await request(`/issue/createmeta/${projectKey}/issuetypes`);
  console.log(JSON.stringify(data.values || data, null, 2));
}

async function cmdLink(positional, flags) {
  const fromKey = requirePositional(positional, 0, 'fromKey');
  const toKey = requirePositional(positional, 1, 'toKey');
  const type = flags.type;

  if (!type) {
    console.error('Required flag: --type (link type name)');
    process.exit(1);
  }

  await request('/issueLink', {
    method: 'POST',
    body: {
      type: { name: type },
      inwardIssue: { key: fromKey },
      outwardIssue: { key: toKey },
    },
  });

  console.log(JSON.stringify({ linked: `${fromKey} -> ${toKey}`, type }, null, 2));
}

async function cmdLinkTypes(_positional, _flags) {
  const data = await request('/issueLinkType');
  console.log(JSON.stringify(data.issueLinkTypes, null, 2));
}

async function cmdLookupUser(positional, _flags) {
  const query = requirePositional(positional, 0, 'query');
  const data = await request('/user/search', { query: { query } });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdWorklog(positional, flags) {
  const key = requirePositional(positional, 0, 'issueKey');
  const timeSpent = flags.time;

  if (!timeSpent) {
    console.error('Required flag: --time (e.g. "2h", "30m", "1d")');
    process.exit(1);
  }

  const body = { timeSpent };
  if (flags.comment) {
    body.comment = textToAdf(flags.comment);
  }

  const data = await request(`/issue/${key}/worklog`, { method: 'POST', body });
  console.log(JSON.stringify({ id: data.id, timeSpent: data.timeSpent }, null, 2));
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage: jira.mjs <command> [args] [--flags]

Commands:
  search <JQL> [--max N]                         Search issues via JQL
  get <issueKey> [--fields f1,f2]                Get issue details
  create --project P --type T --summary S        Create issue
         [--description D] [--priority P]
         [--assignee A] [--parent EPIC]
         [--labels L1,L2] [--components C1,C2]
  edit <issueKey> [--summary S] [--description D]
       [--priority P] [--assignee A]
       [--labels L1,L2] [--components C1,C2]     Update issue
  comment <issueKey> <body>                      Add comment
  transitions <issueKey>                         List available transitions
  transition <issueKey> <transitionId>           Transition issue
  projects                                       List visible projects
  issue-types <projectKey>                       Get issue types for project
  link <fromKey> <toKey> --type T                Link two issues
  link-types                                     Get available link types
  lookup-user <query>                            Find user account ID
  worklog <issueKey> --time T [--comment C]      Add worklog entry

Environment variables (required):
  ATLASSIAN_EMAIL    Your Atlassian account email
  ATLASSIAN_API_TOKEN  API token from https://id.atlassian.com/manage-profile/security/api-tokens
  ATLASSIAN_DOMAIN   e.g. yoursite.atlassian.net`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const COMMANDS = {
  search: cmdSearch,
  get: cmdGet,
  create: cmdCreate,
  edit: cmdEdit,
  comment: cmdComment,
  transitions: cmdTransitions,
  transition: cmdTransition,
  projects: cmdProjects,
  'issue-types': cmdIssueTypes,
  link: cmdLink,
  'link-types': cmdLinkTypes,
  'lookup-user': cmdLookupUser,
  worklog: cmdWorklog,
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const handler = COMMANDS[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  checkEnv();

  const { positional, flags } = parseArgs(args.slice(1));
  await handler(positional, flags);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
