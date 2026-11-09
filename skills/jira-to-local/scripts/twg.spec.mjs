import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRequest, parseOutput, reshape, wrapRows, collectRows, twgGet, twgDownload } from './twg.mjs';

const KEY = 'PROJ-1';

// -- planRequest: which twg command serves each REST path -------------------

const PLANS = [
  ['a full issue read', `/rest/api/3/issue/${KEY}?fields=*all`,
    { shape: 'issue', args: ['jira', 'workitem', 'get', KEY, '--full'], names: false }],
  ['a full issue read with names', `/rest/api/3/issue/${KEY}?fields=*all&expand=names`,
    { shape: 'issue', args: ['jira', 'workitem', 'get', KEY, '--full'], names: true }],
  ['a field subset', `/rest/api/3/issue/${KEY}?fields=summary,description`,
    { shape: 'issue', args: ['jira', 'workitem', 'get', KEY, '--fields', 'summary,description'], names: false }],
  ['the comment thread', `/rest/api/3/issue/${KEY}/comment?startAt=0&maxResults=100`,
    { shape: 'list', rowsKey: 'comments', args: ['jira', 'workitem', 'comment', 'query', '--issue-id', KEY] }],
  ['the worklog', `/rest/api/3/issue/${KEY}/worklog?startAt=0&maxResults=100`,
    { shape: 'list', rowsKey: 'worklogs', args: ['jira', 'workitem', 'worklog', 'query', '--issue-id', KEY] }],
  ['the changelog', `/rest/api/3/issue/${KEY}/changelog?startAt=0&maxResults=100`,
    { shape: 'list', rowsKey: 'values', args: ['jira', 'workitem', 'changelog', 'query', '--issue-id', KEY] }],
  ['an issue property', `/rest/api/3/issue/${KEY}/properties/checklist`,
    { shape: 'data', args: ['jira', 'workitem', 'property', 'get', '--issue-id', KEY, '--property-key', 'checklist'] }],
  ['the remote links', `/rest/api/3/issue/${KEY}/remotelink`,
    { shape: 'remoteLinks', args: ['jira', 'workitem', 'get', KEY, '--remote-links'] }],
  ['the current user', '/rest/api/3/myself',
    { shape: 'myself', args: ['whoami'] }],
  ['a JQL search', '/rest/api/3/search/jql?jql=project%20%3D%20PROJ&maxResults=100&fields=key,summary',
    { shape: 'search', args: ['jira', 'workitem', 'query', '--jql', 'project = PROJ', '--fields', 'key,summary', '--first', '100'] }],
  ['the next page of a JQL search', '/rest/api/3/search/jql?jql=project%20%3D%20PROJ&maxResults=1&nextPageToken=c%3D1',
    { shape: 'search', args: ['jira', 'workitem', 'query', '--jql', 'project = PROJ', '--first', '1', '--after', 'c=1'] }],
  ['the development summary', '/rest/dev-status/1.0/issue/summary?issueId=1001',
    { shape: 'devSummary', args: ['jira', 'workitem', 'get', '1001', '--full'] }],
  ['a Confluence page', '/wiki/api/v2/pages/42?body-format=storage&include-version=true',
    { shape: 'page', args: ['confluence', 'content', 'get', '42', '--detail', 'full', '--format', 'md', '--include-metadata'] }],
  ['the child pages', '/wiki/api/v2/pages/42/children?limit=50',
    { shape: 'children', args: ['confluence', 'tree', '--target', '42', '--depth', '1'] }],
  ['the page attachments', '/wiki/rest/api/content/42/child/attachment?limit=100',
    { shape: 'attachments', args: ['confluence', 'content', 'attachments', 'list', '--id', '42', '--limit', '100'] }],
];

for (const [what, path, expected] of PLANS) {
  test(`Should plan the matching twg command When the path asks for ${what}`, () => {
    // Arrange
    const input = path;

    // Act
    const plan = planRequest(input);

    // Assert
    assert.deepEqual(plan, expected);
  });
}

for (const [what, path] of [
  ['the rendered v2 comment thread', `/rest/api/2/issue/${KEY}/comment?expand=renderedBody`],
  // Setup creates the config through REST only, so its reads have no twg route.
  ['the global field list', '/rest/api/3/field'],
  ['the edit metadata', `/rest/api/3/issue/${KEY}/editmeta`],
  ['the project list', '/rest/api/3/project/search?maxResults=100'],
  ['one project', '/rest/api/3/project/PROJ'],
  ['the issue types of a project', '/rest/api/3/issue/createmeta/PROJ/issuetypes?maxResults=100'],
  ['the create screen of one type', '/rest/api/3/issue/createmeta/PROJ/issuetypes/10001?maxResults=200'],
  ['the boards of a project', '/rest/agile/1.0/board?projectKeyOrId=PROJ&maxResults=100'],
  ['the active sprints of a board', '/rest/agile/1.0/board/7/sprint?state=active'],
  ['a development detail', '/rest/dev-status/1.0/issue/detail?issueId=1001&applicationType=x&dataType=pullrequest'],
]) {
  test(`Should plan nothing When the path asks for ${what}`, () => {
    // Arrange
    const input = path;

    // Act
    const plan = planRequest(input);

    // Assert
    assert.equal(plan, null);
  });
}

// -- parseOutput: twg prints notes before its JSON ---------------------------

test('Should return the envelope When notes precede the JSON', () => {
  // Arrange
  const text = 'Body is 14,879 bytes; read data.body.outputFile.\n{\n  "data": {"id": "42"}\n}\n';

  // Act
  const envelope = parseOutput(text);

  // Assert
  assert.deepEqual(envelope.data, { id: '42' });
});

test('Should throw the twg message When the envelope reports a failure', () => {
  // Arrange
  const text = '{"ok": false, "error": {"message": "The property checklist does not exist.", "statusCode": 404}}';

  // Act
  const act = () => parseOutput(text);

  // Assert
  assert.throws(act, { message: 'The property checklist does not exist.', status: 404 });
});

// -- reshape: twg payload back into the REST response the caller expects ----

test('Should nest the flat twg fields under fields When reshaping an issue', () => {
  // Arrange
  const plan = { shape: 'issue' };
  const data = [{
    expand: 'x', id: '1001', key: KEY, self: 'https://api/x', url: 'https://site/browse/PROJ-1',
    summary: 'Title', customfield_10001: 3, comments: [], remoteLinks: [],
  }];

  // Act
  const issue = reshape(plan, data);

  // Assert
  assert.deepEqual(issue, {
    id: '1001', key: KEY, self: 'https://api/x', fields: { summary: 'Title', customfield_10001: 3 },
  });
});

test('Should map each field id to its name When reshaping edit metadata', () => {
  // Arrange
  const plan = { shape: 'editmeta' };
  const data = { fields: [{ id: 'customfield_10001', key: 'customfield_10001', name: 'Team', required: false, schema: { type: 'string' }, operations: ['set'] }] };

  // Act
  const meta = reshape(plan, data);

  // Assert
  assert.deepEqual(meta.fields.customfield_10001, {
    key: 'customfield_10001', name: 'Team', required: false, schema: { type: 'string' }, operations: ['set'],
  });
});

test('Should rename the profile keys When reshaping the current user', () => {
  // Arrange
  const plan = { shape: 'myself' };
  const data = { accountId: 'a1', email: 'me@example.com', name: 'Me' };

  // Act
  const me = reshape(plan, data);

  // Assert
  assert.deepEqual(me, { accountId: 'a1', emailAddress: 'me@example.com', displayName: 'Me' });
});

test('Should read the summary inside the development field When reshaping the development summary', () => {
  // Arrange
  const plan = { shape: 'devSummary', devField: 'customfield_10000' };
  const summary = { pullrequest: { overall: { count: 3 } } };
  const data = [{
    id: '1001', key: KEY,
    customfield_10000: `{pullrequest={dataType=pullrequest, stateCount=3}, json=${JSON.stringify({ cachedValue: { errors: [], summary } })}}`,
  }];

  // Act
  const response = reshape(plan, data);

  // Assert
  assert.deepEqual(response, { summary });
});

test('Should report no summary When the development field is empty', () => {
  // Arrange
  const plan = { shape: 'devSummary', devField: 'customfield_10000' };
  const data = [{ id: '1001', key: KEY, customfield_10000: '{}' }];

  // Act
  const response = reshape(plan, data);

  // Assert
  assert.deepEqual(response, { summary: null });
});

test('Should turn file placeholders into image links When reshaping a Confluence page', () => {
  // Arrange
  const plan = { shape: 'page' };
  const data = {
    id: '42', title: 'Policy', status: 'current', spaceId: '9',
    metadata: { version: { number: 2 } },
    body: { format: 'markdown', value: '# Intro\n\n[file: a1_Flow chart.avif]\n\nText' },
  };

  // Act
  const page = reshape(plan, data);

  // Assert
  assert.deepEqual(page, {
    id: '42', title: 'Policy', status: 'current', spaceId: '9', version: { number: 2 },
    _links: { webui: '/pages/viewpage.action?pageId=42' },
    body: { markdown: { value: '# Intro\n\n![a1_Flow chart.avif](a1_Flow chart.avif)\n\nText' } },
  });
});

for (const [shape, data, expected] of [
  ['remoteLinks', { remoteLinks: [{ id: 1 }] }, [{ id: 1 }]],
  ['data', { key: 'checklist', value: { items: [] } }, { key: 'checklist', value: { items: [] } }],
  ['children', { root: { id: '42' }, descendants: [{ id: '43', title: 'Child' }] }, { results: [{ id: '43', title: 'Child' }] }],
  ['attachments', { results: [{ id: 'att1', title: 'a.png' }] }, { results: [{ id: 'att1', title: 'a.png' }] }],
]) {
  test(`Should return the REST response shape When reshaping ${shape}`, () => {
    // Arrange
    const plan = { shape };

    // Act
    const response = reshape(plan, data);

    // Assert
    assert.deepEqual(response, expected);
  });
}

// -- wrapRows: a complete list in the paged REST envelope --------------------

test('Should report the collected rows as the whole list When wrapping a list', () => {
  // Arrange
  const plan = { shape: 'list', rowsKey: 'comments' };
  const rows = [{ id: '1' }, { id: '2' }];

  // Act
  const response = wrapRows(plan, rows);

  // Assert
  assert.deepEqual(response, { startAt: 0, maxResults: 2, total: 2, isLast: true, comments: rows });
});

test('Should nest each issue under fields and pass on the cursor When reshaping a JQL search page', () => {
  // Arrange
  const plan = { shape: 'search' };
  const page = { data: { issues: [{ id: '1001', key: KEY, self: 's', summary: 'Title' }] }, pageInfo: { hasNextPage: true, nextCursor: 'c2' } };

  // Act
  const response = reshape(plan, page.data, page.pageInfo);

  // Assert
  assert.deepEqual(response, {
    issues: [{ id: '1001', key: KEY, self: 's', fields: { summary: 'Title' } }], isLast: false, nextPageToken: 'c2',
  });
});

test('Should mark the last page When a JQL search has no next page', () => {
  // Arrange
  const plan = { shape: 'search' };
  const page = { data: { issues: [] }, pageInfo: { hasNextPage: false, nextCursor: null } };

  // Act
  const response = reshape(plan, page.data, page.pageInfo);

  // Assert
  assert.deepEqual(response, { issues: [], isLast: true });
});

// -- collectRows: every page, or an error -----------------------------------

function pager(pages) {
  const asked = [];
  const fetchPage = async (cursor) => {
    asked.push(cursor);
    return pages[asked.length - 1];
  };
  return { asked, fetchPage };
}

test('Should follow the cursor to the last page When the list spans pages', async () => {
  // Arrange
  const { asked, fetchPage } = pager([
    { data: [{ id: '1' }], pageInfo: { hasNextPage: true, nextCursor: 'c1' } },
    { data: [{ id: '2' }], pageInfo: { hasNextPage: false, nextCursor: null } },
  ]);

  // Act
  const rows = await collectRows(fetchPage);

  // Assert
  assert.deepEqual([rows.map((r) => r.id), asked], [['1', '2'], [null, 'c1']]);
});

test('Should throw When the server repeats a cursor', async () => {
  // Arrange
  const { fetchPage } = pager([
    { data: [{ id: '1' }], pageInfo: { hasNextPage: true, nextCursor: 'c1' } },
    { data: [{ id: '2' }], pageInfo: { hasNextPage: true, nextCursor: 'c1' } },
  ]);

  // Act
  const act = () => collectRows(fetchPage);

  // Assert
  await assert.rejects(act, /repeated cursor/);
});

test('Should throw When two pages return the same row', async () => {
  // Arrange
  const { fetchPage } = pager([
    { data: [{ id: '1' }], pageInfo: { hasNextPage: true, nextCursor: 'c1' } },
    { data: [{ id: '1' }], pageInfo: { hasNextPage: false } },
  ]);

  // Act
  const act = () => collectRows(fetchPage);

  // Assert
  await assert.rejects(act, /distinct id/);
});

// -- twgGet: one REST path, served through an injected twg runner ------------

function recorder(answers) {
  const calls = [];
  const run = async (args, site) => {
    calls.push({ args, site });
    return answers[calls.length - 1];
  };
  return { calls, run };
}

test('Should ask for pages of 100 and pass the cursor When reading a list', async () => {
  // Arrange
  const { calls, run } = recorder([
    { data: [{ id: '1' }], pageInfo: { hasNextPage: true, nextCursor: 'c1' } },
    { data: [{ id: '2' }], pageInfo: { hasNextPage: false } },
  ]);

  // Act
  const response = await twgGet(`/rest/api/3/issue/${KEY}/comment?startAt=0&maxResults=100`, { site: 'x.atlassian.net', run });

  // Assert
  assert.deepEqual(
    [calls.map((c) => c.args.slice(-4)), response.total, calls[0].site],
    [[['--issue-id', KEY, '--first', '100'], ['--first', '100', '--after', 'c1']], 2, 'x.atlassian.net'],
  );
});

test('Should add the field names from edit metadata When the path expands names', async () => {
  // Arrange
  const { run } = recorder([
    { data: [{ id: '1001', key: KEY, summary: 'Title' }] },
    { data: { fields: [{ id: 'summary', key: 'summary', name: 'Summary' }] } },
  ]);

  // Act
  const issue = await twgGet(`/rest/api/3/issue/${KEY}?fields=*all&expand=names`, { site: 's', run });

  // Assert
  assert.deepEqual(issue.names, { summary: 'Summary' });
});

test('Should pass the development field id to the reshape When reading the development summary', async () => {
  // Arrange
  const summary = { pullrequest: { overall: { count: 2 } }, build: { overall: { count: 1 } } };
  const { run } = recorder([{ data: [{ id: '1001', cf: `{json=${JSON.stringify({ cachedValue: { summary } })}}` }] }]);

  // Act
  const response = await twgGet('/rest/dev-status/1.0/issue/summary?issueId=1001', { site: 's', devField: 'cf', run });

  // Assert
  assert.deepEqual(response, { summary });
});

test('Should throw status 501 When twg has no equivalent for the path', async () => {
  // Arrange
  const { run } = recorder([]);

  // Act
  const act = () => twgGet('/rest/dev-status/1.0/issue/detail?issueId=1001&dataType=pullrequest', { site: 's', run });

  // Assert
  await assert.rejects(act, (err) => err.status === 501);
});

test('Should call the Confluence download command When saving a page attachment', async () => {
  // Arrange
  const { calls, run } = recorder([{ data: {} }]);

  // Act
  await twgDownload('confluence', 'att9', '/tmp/a.png', { site: 's', run });

  // Assert
  assert.deepEqual(calls[0].args, ['confluence', 'content', 'attachments', 'download', '--attachment-id', 'att9', '--out', '/tmp/a.png', '--force']);
});

test('Should call the Jira download command When saving an issue attachment', async () => {
  // Arrange
  const { calls, run } = recorder([{ data: {} }]);

  // Act
  await twgDownload('jira', '539481', '/tmp/a.png', { site: 's', run });

  // Assert
  assert.deepEqual(calls[0].args, ['jira', 'workitem', 'attachment', 'download', '--attachment-id', '539481', '--output-path', '/tmp/a.png']);
});

test('Should count the linked pull requests from the graph When the development field omits them', async () => {
  // Arrange
  const summary = { repository: { overall: { count: 9 } } };
  const { calls, run } = recorder([
    { data: [{ id: '1001', cf: `{json=${JSON.stringify({ cachedValue: { summary } })}}` }] },
    { data: { relationshipSummary: [{ relationshipName: 'jira_work_item_links_external_pull_request', count: 3 }] } },
  ]);

  // Act
  const response = await twgGet('/rest/dev-status/1.0/issue/summary?issueId=1001', { site: 's', devField: 'cf', run });

  // Assert
  assert.deepEqual(
    [response.summary.pullrequest.overall.count, calls[1].args],
    [3, ['context', 'jira', 'workitem', '--issue', '1001', '--since', '3650d',
      '--relationships', 'jira_work_item_links_external_pull_request', '--first', '200']],
  );
});

test('Should run one twg page When a JQL search asks for one row', async () => {
  // Arrange
  const { calls, run } = recorder([{ data: { issues: [{ id: '1', key: KEY }] }, pageInfo: { hasNextPage: true, nextCursor: 'c2' } }]);

  // Act
  const response = await twgGet('/rest/api/3/search/jql?jql=project%20%3D%20PROJ&maxResults=1', { site: 's', run });

  // Assert
  assert.deepEqual([calls.length, response.nextPageToken], [1, 'c2']);
});
