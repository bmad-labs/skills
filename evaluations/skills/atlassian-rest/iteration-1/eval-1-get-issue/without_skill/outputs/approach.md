# Approach: Get Jira Issue Status (Without Atlassian Skill)

## Task

Retrieve the current status, assignee, and priority of PROJ-123 from Jira.

## Outcome

**I cannot complete this task.** Without specialized Atlassian tooling, I have no way to authenticate with or query a Jira instance.

## What I Would Try

### 1. Direct API Call via curl

The most straightforward approach would be to use the Jira REST API directly:

```bash
curl -s -H "Authorization: Basic <base64-encoded-credentials>" \
     -H "Content-Type: application/json" \
     "https://<instance>.atlassian.net/rest/api/3/issue/PROJ-123?fields=status,assignee,priority"
```

**Blockers:**
- I do not know the Jira instance URL (e.g., `https://mycompany.atlassian.net`).
- I have no authentication credentials (API token, OAuth token, or username/password).
- Even if I had these, storing or using credentials in plain text is a security concern.

### 2. Jira CLI Tools

Tools like `jira-cli` or `go-jira` could be used if installed:

```bash
jira issue view PROJ-123
```

**Blockers:**
- No Jira CLI tool is installed or configured in this environment.
- These tools still require prior authentication setup.

### 3. MCP Atlassian Plugin

The environment has MCP Atlassian tools available (e.g., `mcp__plugin_atlassian_atlassian__getJiraIssue`), which would be the ideal way to fetch this data. However, the task explicitly states I should NOT use any skill, so these are off-limits for this baseline test.

### 4. Browser / Web Search

I could attempt a web search or web fetch, but Jira issues are behind authentication and would not be accessible via public URLs.

## How I Would Interact With Jira (If I Could)

1. **Authenticate** using an API token or OAuth2 flow against the Jira Cloud REST API v3.
2. **GET** `/rest/api/3/issue/PROJ-123` with query parameter `fields=status,assignee,priority` to minimize payload.
3. **Parse** the JSON response:
   - `response.fields.status.name` for the current status (e.g., "In Progress")
   - `response.fields.assignee.displayName` for the assignee
   - `response.fields.priority.name` for the priority (e.g., "High")

## Assumptions and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | I have no Jira API token, OAuth token, or session cookie. |
| **No instance URL known** | I do not know which Jira Cloud (or Server) instance hosts PROJ-123. |
| **No CLI tools installed** | No `jira-cli`, `go-jira`, or similar tools are present. |
| **No skill/plugin allowed** | The MCP Atlassian plugin tools are explicitly excluded for this baseline test. |
| **Security** | Even if credentials were provided ad-hoc, embedding them in shell commands is not ideal. |

## Conclusion

Without at least one of the following, this task cannot be completed:
1. A configured Atlassian MCP plugin (skill) with stored authentication
2. A Jira CLI tool with pre-configured credentials
3. A valid Jira instance URL and API token provided by the user

This baseline test demonstrates that querying Jira programmatically requires both **network access to the instance** and **valid authentication** -- neither of which is available in a bare environment without specialized tooling.
