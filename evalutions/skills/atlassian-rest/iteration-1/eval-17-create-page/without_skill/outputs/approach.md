# Approach: Create Confluence Page - Architecture Decision Record (Without Skill)

## Task Summary

Create a new Confluence page in the TEAM space titled "Architecture Decision Record - Microservices Migration" with a structured ADR template containing sections for Context, Decision, Consequences, and Status.

## Desired Page Content

The page would use the following structured ADR template:

### Title: Architecture Decision Record - Microservices Migration

**Status:** Proposed

---

#### Context

_What is the issue that we are seeing that is motivating this decision or change?_

(To be filled in by the team)

#### Decision

_What is the change that we are proposing and/or doing?_

(To be filled in by the team)

#### Consequences

_What becomes easier or more difficult to do because of this change?_

**Positive:**
- (To be filled in)

**Negative:**
- (To be filled in)

**Risks:**
- (To be filled in)

#### Status

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-03-18 |
| Deciders | (To be filled in) |
| Supersedes | N/A |

---

## What I Would Need to Do (Without Specialized Tooling)

### Step 1: Identify the Confluence Instance and Space

Without an Atlassian skill or MCP plugin, I have no way to:
- Discover the Confluence cloud instance URL
- Authenticate against the Confluence REST API
- Verify the TEAM space exists or retrieve its ID

### Step 2: Construct the Page Body in Atlassian Document Format (ADF)

Confluence Cloud REST API v2 requires the page body in Atlassian Document Format. The payload would look like:

```json
{
  "spaceId": "<TEAM-space-id>",
  "status": "current",
  "title": "Architecture Decision Record - Microservices Migration",
  "body": {
    "representation": "storage",
    "value": "<h2>Status</h2><p><strong>Proposed</strong></p><hr/><h2>Context</h2><p><em>What is the issue that we are seeing that is motivating this decision or change?</em></p><p>(To be filled in by the team)</p><h2>Decision</h2><p><em>What is the change that we are proposing and/or doing?</em></p><p>(To be filled in by the team)</p><h2>Consequences</h2><p><em>What becomes easier or more difficult to do because of this change?</em></p><p><strong>Positive:</strong></p><ul><li>(To be filled in)</li></ul><p><strong>Negative:</strong></p><ul><li>(To be filled in)</li></ul><p><strong>Risks:</strong></p><ul><li>(To be filled in)</li></ul><h2>Status</h2><table><tr><th>Field</th><th>Value</th></tr><tr><td>Status</td><td>Proposed</td></tr><tr><td>Date</td><td>2026-03-18</td></tr><tr><td>Deciders</td><td>(To be filled in)</td></tr><tr><td>Supersedes</td><td>N/A</td></tr></table>"
  }
}
```

### Step 3: Create the Page via REST API

I would need to call: `POST /wiki/api/v2/pages` (Confluence Cloud v2 API) or `POST /wiki/rest/api/content` (v1 API) with the payload above and proper authentication headers.

### Step 4: What Is Actually Blocked

Without the Atlassian MCP plugin or any REST client with stored credentials, I **cannot execute any of these steps**. Specifically:

1. **No authentication** -- I have no Confluence API token, OAuth credentials, or session cookie.
2. **No instance URL** -- I do not know which Confluence cloud site to target (e.g., `https://yourcompany.atlassian.net`).
3. **No space lookup** -- I cannot confirm the TEAM space exists or retrieve its space ID (required by the v2 API).
4. **No parent page information** -- I do not know where in the TEAM space hierarchy this page should be placed.
5. **No HTTP client with auth** -- Even if I had credentials, making raw `curl` calls requires manual token management and is error-prone.

## What the Atlassian Skill Would Provide

If the Atlassian MCP plugin were available, I could:

- `getAccessibleAtlassianResources` -- discover the Confluence instance
- `getConfluenceSpaces` -- confirm the TEAM space exists and get its ID
- `getPagesInConfluenceSpace` -- find potential parent pages or verify the space structure
- `createConfluencePage` -- create the page with the structured ADR content in the TEAM space
- `getConfluencePage` -- verify the page was created successfully and retrieve its URL

## Conclusion

Without the Atlassian skill/plugin, this task **cannot be completed**. The best I can do is define the exact page content and structure (done above) and document the API calls that would be needed. A human would need to manually create this page in Confluence, or the Atlassian MCP plugin would need to be enabled.
