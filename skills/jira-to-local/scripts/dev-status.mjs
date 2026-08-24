/**
 * dev-status.mjs — the development panel: pull requests, commits, builds, deployments.
 *
 * A library, like adf.mjs and confluence-format.mjs. No CLI.
 *
 * The panel is not part of the issue. A repository integration writes it, and Jira
 * republishes it over `/rest/dev-status/1.0/`, an endpoint Atlassian does not
 * document. Two consequences run through this whole file:
 *
 *   1. `applicationType` must be the instance key the summary itself reports, from
 *      `byInstanceType`. A readable name like "GitHub" returns an empty detail, and
 *      omitting the parameter returns 500. The key cannot be guessed.
 *   2. Every request is soft. A panel that could not be read is a thinner document,
 *      never a failed pull — see `degraded` below.
 *
 * The issue's own `development` custom field carries a build and deployment rollup
 * but no pull requests at all, which is why `content.md`'s Git row can report
 * builds while showing nothing of the merged pull requests. That field stays where
 * it is; this module is the detail beside it, not a replacement.
 */

import { apiGetSoft, graphqlSoft } from './jira-api.mjs';

/**
 * The deployment list, which `dev-status` does not serve.
 *
 * Every REST spelling of it returns an empty list — `deployment`,
 * `deployment-environment`, `deployments`, under every instance key — and the issue
 * property behind Jira's Deployments tab holds unlinked lists of distinct values
 * rather than records. The tab itself runs this query, and it answers to an API
 * token, so it is the one deployment source there is.
 *
 * Undocumented, like the rest of this panel: read softly, and a null answer costs
 * the section its rows rather than failing the part.
 */
const DEPLOYMENTS_QUERY = `query DevDetailsDialog($issueId: ID!) {
  developmentInformation(issueId: $issueId) {
    details {
      deploymentProviders {
        id
        name
        deployments {
          displayName
          url
          state
          lastUpdated
          pipelineId
          pipelineDisplayName
          pipelineUrl
          environment { id type displayName }
        }
      }
    }
  }
}`;

/** Data types worth a detail call, and the summary key that says whether to make it. */
const DETAIL_TYPES = [
  { dataType: 'pullrequest', summaryKey: 'pullrequest' },
  { dataType: 'repository', summaryKey: 'repository' },
  { dataType: 'build', summaryKey: 'build' },
];

/**
 * The instance key for one data type, read from the summary's own `byInstanceType`.
 *
 * Not a guess and not a constant: the git types answer to something like
 * `oAuth-com.<provider>.integration.production` while builds answer to a different
 * key again, and both differ per site and per integration.
 */
function instanceKeyFor(summary, summaryKey) {
  const byInstance = summary?.[summaryKey]?.byInstanceType || {};
  const keys = Object.keys(byInstance);
  return keys.length ? keys[0] : null;
}

/** The count the summary claims for one data type, or 0. */
function summaryCount(summary, summaryKey) {
  const n = summary?.[summaryKey]?.overall?.count;
  return typeof n === 'number' ? n : 0;
}

/** The repository slug out of any github URL — `owner/repo` from a tree or actions path. */
function repoFromUrl(url) {
  const m = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)/.exec(String(url || ''));
  return m ? m[1] : null;
}

/** `2026-08-19T10:17:03Z` → `2026-08-19 10:17`, and a bare date stays a date. */
function stamp(iso) {
  const s = String(iso || '');
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s);
  if (m) return `${m[1]} ${m[2]}`;
  return s.slice(0, 10) || null;
}

/**
 * One pull request, flattened.
 *
 * `author` is dropped deliberately: this payload returns the literal "User " for
 * every author on every site tried, and a column of non-names is worse than no
 * column. Real names come from the commits.
 */
function mapPullRequest(pr) {
  return {
    id: pr.id || null,
    title: pr.name || null,
    url: pr.url || null,
    status: pr.status || null,
    sourceBranch: pr.source?.branch || null,
    targetBranch: pr.destination?.branch || null,
    reviewers: (pr.reviewers || []).map((r) => ({
      name: String(r.name || '').trim() || null,
      approved: !!r.approved,
    })),
    commentCount: typeof pr.commentCount === 'number' ? pr.commentCount : null,
    updated: stamp(pr.lastUpdate),
    repository: repoFromUrl(pr.source?.url) || repoFromUrl(pr.url),
  };
}

/** One commit, flattened. The message keeps its first line only. */
function mapCommit(commit, repository) {
  return {
    id: commit.displayId || String(commit.id || '').slice(0, 7) || null,
    message: String(commit.message || '').split('\n')[0].trim() || null,
    author: String(commit.author?.name || '').trim() || null,
    url: commit.url || null,
    when: stamp(commit.authorTimestamp || commit.timestamp),
    files: Array.isArray(commit.files) ? commit.files.length : null,
    repository,
  };
}

/** One build, flattened. */
function mapBuild(build) {
  return {
    pipeline: build.displayName || build.pipelineId || null,
    number: build.buildNumber ?? null,
    state: build.state || null,
    url: build.url || null,
    when: stamp(build.lastUpdated || build.createdAt),
    repository: repoFromUrl(build.url),
  };
}

/**
 * The environment type for a name, so the document can group the way Jira's tab
 * groups: Production, Staging, Testing, Development.
 *
 * By name, because there is nothing to join on. The summary's environment entries
 * carry no type at all, and the issue property's two lists cannot be paired —
 * the two lists differ in length and several names map to the same type, so a
 * positional join would silently mislabel them.
 *
 * An unrecognised name returns null and the renderer groups it under its own
 * heading rather than guessing it into one of these.
 */
function environmentType(name) {
  const n = String(name || '').toLowerCase();
  if (/^(prod|production|live)/.test(n)) return 'Production';
  if (/^(stag|stage|pre-?prod)/.test(n)) return 'Staging';
  if (/^(test|qa|uat|sit)/.test(n)) return 'Testing';
  if (/^(dev|develop|local)/.test(n)) return 'Development';
  return null;
}

/**
 * The environments as the summary sees them: one row each, current state only.
 *
 * The fallback for when the deployment query returns nothing. The summary's entries
 * carry no environment type, so the type is classified from the name.
 */
function environmentsFromSummary(summary) {
  const tops = summary?.['deployment-environment']?.overall?.topEnvironments || [];
  return tops.map((env) => ({
    name: env.title || null,
    type: environmentType(env.title),
    status: env.status || null,
    when: stamp(env.lastUpdated),
  }));
}

/** Title-case the API's SHOUTING environment type: `PRODUCTION` becomes `Production`. */
function titleCaseType(type) {
  const t = String(type || '');
  if (!t) return null;
  return t[0] + t.slice(1).toLowerCase();
}

/**
 * Every deployment on the issue, grouped the way Jira's Deployments tab groups them.
 *
 * The list is GraphQL-only. No REST spelling serves it — `deployment`,
 * `deployment-environment` and `deployments` all return an empty detail under every
 * instance key, and the issue property behind the tab holds three parallel unlinked
 * lists of distinct values rather than records (its sibling builds property proves
 * that by naming a handful of pipelines for far more builds). The tab's own query answers to
 * an API token, so this reads it.
 *
 * Returns null when the query gives nothing, and the caller then falls back to the
 * summary's one row per environment.
 */
async function fetchDeployments(cred, issueId) {
  const data = await graphqlSoft(cred, 'DevDetailsDialog', DEPLOYMENTS_QUERY, { issueId: String(issueId) });
  const providers = data?.developmentInformation?.details?.deploymentProviders;
  if (!Array.isArray(providers) || !providers.length) return null;

  const deployments = providers.flatMap((p) => (p.deployments || []).map((d) => ({
    provider: p.name || null,
    // The display name is the commit message that triggered the deploy, so it
    // arrives multi-line; the first line is the part that identifies it.
    name: String(d.displayName || '').split('\n')[0].trim() || null,
    url: d.url || null,
    state: d.state || null,
    pipeline: d.pipelineDisplayName || d.pipelineId || null,
    environment: d.environment?.displayName || d.environment?.id || null,
    environmentType: titleCaseType(d.environment?.type),
    when: stamp(d.lastUpdated),
  })));
  if (!deployments.length) return null;

  deployments.sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));
  return deployments;
}

/**
 * One row per environment, rolled up from the deployments themselves.
 *
 * Preferred over the summary's `topEnvironments`, which reports a single row on a
 * story deployed to more than one environment, and dates it from the newest
 * deployment anywhere, so a row's state and its timestamp can belong to different
 * environments. Rolling up the real records gives every environment, its own
 * latest state, and its own count.
 *
 * Order: by type as Jira lists them, then most recently deployed first.
 */
const TYPE_ORDER = ['Production', 'Staging', 'Testing', 'Development', 'Other'];

function environmentsFromDeployments(deployments) {
  const byEnv = new Map();
  for (const d of deployments) {
    const key = d.environment;
    if (!byEnv.has(key)) {
      byEnv.set(key, { name: key, type: d.environmentType, status: null, when: null, deployments: 0 });
    }
    const row = byEnv.get(key);
    row.deployments += 1;
    // `deployments` arrives newest first, so the first sighting of an environment is
    // its latest state.
    if (row.when === null) {
      row.status = d.state;
      row.when = d.when;
    }
  }

  return [...byEnv.values()].sort((a, b) => {
    const ta = TYPE_ORDER.indexOf(a.type || 'Other');
    const tb = TYPE_ORDER.indexOf(b.type || 'Other');
    if (ta !== tb) return (ta < 0 ? TYPE_ORDER.length : ta) - (tb < 0 ? TYPE_ORDER.length : tb);
    return String(b.when || '').localeCompare(String(a.when || ''));
  });
}

/**
 * The whole development panel for one issue, or null when it has none.
 *
 * `issueId` is the numeric id, not the key — dev-status takes no key. It is already
 * on the issue payload the caller holds.
 *
 * One request when the issue has no development activity, up to five when it has
 * all of it. `branch` is deliberately not fetched: it returns the same pull-request
 * payload as `pullrequest`, so it would be a second request for data already in
 * hand, and branch names are on each pull request anyway.
 *
 * `degraded` names any detail the summary promised and the endpoint would not
 * return. A caller writes those names into the document; it does not fail the part.
 */
export async function fetchDevStatus(cred, issueId) {
  const summaryResponse = await apiGetSoft(cred, `/rest/dev-status/1.0/issue/summary?issueId=${issueId}`);
  const summary = summaryResponse?.summary;
  if (!summary) return null;

  const counts = {
    pullRequests: summaryCount(summary, 'pullrequest'),
    commits: summaryCount(summary, 'repository'),
    builds: summaryCount(summary, 'build'),
  };
  const environments = environmentsFromSummary(summary);

  if (!counts.pullRequests && !counts.commits && !counts.builds && !environments.length) {
    return null;
  }

  const result = {
    counts: { ...counts, repositories: 0, environments: environments.length, deployments: 0 },
    buildStates: {},
    deploymentStates: {},
    pullRequests: [],
    repositories: [],
    builds: [],
    environments,
    deployments: [],
    degraded: [],
  };

  // The deployment list, which REST will not serve. Attempted whenever the summary
  // saw any environment at all; a null answer leaves the summary's rows standing.
  if (environments.length) {
    const deployments = await fetchDeployments(cred, issueId);
    if (deployments) {
      result.deployments = deployments;
      result.counts.deployments = deployments.length;
      for (const d of deployments) {
        if (d.state) result.deploymentStates[d.state] = (result.deploymentStates[d.state] || 0) + 1;
      }
      // Every environment the deployments touched, which the summary rollup
      // under-reports — a single row on a story deployed to several environments.
      result.environments = environmentsFromDeployments(deployments);
      result.counts.environments = result.environments.length;
    } else {
      result.degraded.push('deployment list unavailable, so only the current state per environment is shown');
    }
  }

  for (const { dataType, summaryKey } of DETAIL_TYPES) {
    if (!summaryCount(summary, summaryKey)) continue;

    const applicationType = instanceKeyFor(summary, summaryKey);
    if (!applicationType) {
      result.degraded.push(`${dataType} detail unavailable: the summary named no instance for it`);
      continue;
    }

    const detail = await apiGetSoft(
      cred,
      `/rest/dev-status/1.0/issue/detail?issueId=${issueId}`
      + `&applicationType=${encodeURIComponent(applicationType)}&dataType=${dataType}`
    );
    const rows = detail?.detail;
    if (!Array.isArray(rows) || !rows.length) {
      result.degraded.push(`${dataType} detail unavailable`);
      continue;
    }

    if (dataType === 'pullrequest') {
      result.pullRequests = rows.flatMap((r) => r.pullRequests || []).map(mapPullRequest);
    } else if (dataType === 'repository') {
      result.repositories = rows.flatMap((r) => r.repositories || []).map((repo) => ({
        name: repo.name || null,
        url: repo.url || null,
        commits: (repo.commits || []).map((c) => mapCommit(c, repo.name || null)),
      }));
    } else {
      result.builds = rows
        .flatMap((r) => r.jswddBuildsData || [])
        .flatMap((g) => g.builds || [])
        .map(mapBuild);
    }
  }

  // The real counts, from what was read rather than what the summary promised. The
  // two disagree on builds by design: the summary reports the latest build per
  // pipeline, which is what Jira's panel shows, while the detail is full history
  // across every repository. Both are true about different things, so both are
  // reported and the document says which is which.
  result.counts.pullRequests = result.pullRequests.length || counts.pullRequests;
  result.counts.commits = result.repositories.reduce((n, r) => n + r.commits.length, 0) || counts.commits;
  result.counts.repositories = result.repositories.length;
  result.counts.builds = result.builds.length || counts.builds;
  result.summaryBuildCount = counts.builds;

  for (const b of result.builds) {
    if (!b.state) continue;
    result.buildStates[b.state] = (result.buildStates[b.state] || 0) + 1;
  }

  return result;
}

/**
 * Every repository the panel mentions, each with the records that belong to it.
 *
 * Repository is the grouping Jira's own panel uses — it nests every tab under
 * `owner/repo` — so the document follows it. Only commits arrive grouped; pull
 * requests and builds carry a URL that names their repository and have to be
 * bucketed by it. A record whose repository cannot be read goes under a null key,
 * which the renderer writes as its own trailing section rather than dropping it.
 */
export function groupByRepository(dev) {
  const groups = new Map();
  const bucket = (name) => {
    if (!groups.has(name)) {
      groups.set(name, { name, url: null, pullRequests: [], commits: [], builds: [] });
    }
    return groups.get(name);
  };

  for (const repo of dev.repositories) {
    const g = bucket(repo.name);
    g.url = repo.url;
    g.commits = repo.commits;
  }
  for (const pr of dev.pullRequests) bucket(pr.repository).pullRequests.push(pr);
  for (const b of dev.builds) bucket(b.repository).builds.push(b);

  // Named repositories first, alphabetically; the unattributable bucket last.
  return [...groups.values()].sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    return a.name.localeCompare(b.name);
  });
}
