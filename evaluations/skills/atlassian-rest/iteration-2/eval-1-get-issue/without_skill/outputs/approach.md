# Approach: Get Jira Issue Details (Without Atlassian Skill)

## Task

Retrieve the current status, assignee, and priority of DO-123 from the Jira project DO at https://wnesolutions.atlassian.net.

## Outcome

**I cannot complete this task.** I have no way to authenticate with the Jira instance without specialized Atlassian tooling or pre-configured credentials.

## Detailed Step-by-Step Approach

### Step 1: Identify the Correct API Endpoint

The Jira Cloud REST API v3 endpoint for fetching a single issue is:

```
GET https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123
```

To minimize the response payload, I would restrict the returned fields to only what is needed:

```
GET https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123?fields=status,assignee,priority
```

### Step 2: Authenticate and Make the API Call

Using `curl` with Basic Auth (email + API token):

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:JIRA_API_TOKEN' | base64)" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123?fields=status,assignee,priority"
```

Alternatively, using the `-u` shorthand:

```bash
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123?fields=status,assignee,priority"
```

**Blockers:**
- I do not have a Jira API token or user email with access to this instance.
- Storing or passing credentials in plain text on the command line is a security concern.

### Step 3: Parse the JSON Response

The response would be a JSON object. I would extract the three requested fields:

```bash
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123?fields=status,assignee,priority" \
  | jq '{
    status: .fields.status.name,
    assignee: .fields.assignee.displayName,
    priority: .fields.priority.name
  }'
```

Expected response structure:

```json
{
  "status": "In Progress",
  "assignee": "Jane Doe",
  "priority": "High"
}
```

The specific JSON paths are:
- **Status:** `.fields.status.name` (e.g., "To Do", "In Progress", "Done")
- **Assignee:** `.fields.assignee.displayName` (e.g., "Jane Doe") -- note: `.fields.assignee` may be `null` if unassigned
- **Priority:** `.fields.priority.name` (e.g., "Highest", "High", "Medium", "Low", "Lowest")

### Step 4: Present the Results

I would format the extracted data into a clear summary for the user:

```
Issue: DO-123
Status: In Progress
Assignee: Jane Doe
Priority: High
```

## Alternative Approaches Considered

### Jira CLI Tools

If a tool like `jira-cli` or `go-jira` were installed and configured:

```bash
jira issue view DO-123 --plain
```

**Blocker:** No Jira CLI tool is installed or configured in this environment.

### MCP Atlassian Plugin

The environment lists MCP Atlassian tools (e.g., `mcp__plugin_atlassian_atlassian__getJiraIssue`) which could fetch this data directly with pre-configured authentication. However, this baseline evaluation explicitly excludes using any skill or plugin.

### Web Fetch / Web Search

Jira issues sit behind authentication, so fetching `https://wnesolutions.atlassian.net/browse/DO-123` via a web fetch tool would not return useful data without a valid session.

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | No Jira API token, OAuth token, or session cookie is available. |
| **Instance URL is known** | The task provides `https://wnesolutions.atlassian.net`, so the endpoint is clear. |
| **No CLI tools installed** | No `jira-cli`, `go-jira`, or similar tools are present in the environment. |
| **No skill/plugin allowed** | MCP Atlassian plugin tools are explicitly excluded for this baseline test. |
| **Security concern** | Ad-hoc credential passing via shell commands is not a secure practice. |

## Conclusion

The API endpoint and required fields are straightforward -- a single GET request to `/rest/api/3/issue/DO-123?fields=status,assignee,priority` would return all the needed information. However, without valid authentication credentials (a Jira API token paired with an authorized email address), the request cannot be executed. This task requires either:

1. A configured Atlassian MCP plugin with stored OAuth/API credentials
2. A Jira CLI tool with pre-configured authentication
3. A valid API token provided directly by the user
