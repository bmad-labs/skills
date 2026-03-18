# Approach: Search Company Knowledge About Authentication System (Without Skill)

## Task

Search company knowledge about authentication system - login, OAuth, known issues.

## Approach Taken

Without the atlassian-rest skill, the Atlassian MCP plugin tools were used directly to search across Confluence and Jira for authentication-related content. The following searches were executed:

### Step 1: Identify Accessible Resources

Called `getAccessibleAtlassianResources` to determine the correct cloud ID. The site is `oneline.atlassian.net` with cloud ID `983cd706-e88f-407a-88c0-75f957a662d7`.

### Step 2: Broad Rovo Search (Confluence + Jira combined)

Used `searchAtlassian` (Rovo Search) with two queries:
1. `"authentication system login OAuth"` -- returned 10 Confluence pages and several Jira issues
2. `"authentication known issues bugs login failure"` -- returned known-errors pages and OWASP security training pages
3. `"SSO SAML single sign-on token refresh session"` -- returned SSO integration docs, session management policies, and GitHub SAML config pages

### Step 3: Targeted Jira Search (JQL)

Searched Jira using JQL: `text ~ "authentication" OR text ~ "OAuth" OR summary ~ "login" ORDER BY updated DESC`. This returned 15 issues, predominantly from the EFIN (ONE Finance) project related to Partner Access authentication.

Note: A search specifically scoped to project "DO" returned 0 results, as "DO" is a reserved JQL keyword and the project may not contain authentication-related issues.

### Step 4: Fetch Full Content from Top Results

Retrieved full page content (in markdown format) for the 7 most relevant Confluence pages:

1. **NA-LDF-API Authentication Module: Technical Documentation** (page 2984017922, space Z)
2. **Common System Issues and Known Errors** (page 3264381137, space GEO)
3. **OPA User Authentication & Authorization** (page 3568533516, space BTH)
4. **[CAM] APIGee OAuth2 login** (page 3158048769, space BTH)
5. **Chorus Manual Login Guide in the local dev environment** (page 2732687394, space BTH)
6. **Session Management Policy** (page 3186950985, space NE)
7. **SSO Integration** (page 1625325593, space NE)

## Synthesized Findings

### 1. How Login Works

The company operates multiple authentication systems across different products:

**Chorus Platform (Internal Apps - SAML SSO):**
- Default login uses **Google IDP-based SAML 2.0 SSO**
- Users authenticate through Google's identity provider
- For local dev environments, a manual login feature is provided at `/chorus/manual-login` since SSO is not available locally
- Source: [Chorus Manual Login Guide](https://oneline.atlassian.net/wiki/spaces/BTH/pages/2732687394)

**NA-LDF-API (NestJS Locally Developed Functions):**
- Centralized NestJS Auth Module manages authentication for multiple Next.js LDF applications
- Login flow: User -> LDF Middleware -> Google OAuth -> NestJS Auth callback -> JWT issued -> stored as `zkl-token` httpOnly cookie
- JWT contains `ldf_id`, `email`, `permissions`, `exp` claims
- Token auto-refresh when less than 10 minutes remain before expiry, via `/auth/token` endpoint
- Source: [NA-LDF-API Authentication Module](https://oneline.atlassian.net/wiki/spaces/Z/pages/2984017922)

**Chorus OPA-based Authentication (VRM and other products):**
- Uses **OPA (Open Policy Agent)** as a sidecar container for authentication and authorization
- Sessions managed via `__Secure-next-auth.session-token` HttpOnly cookie
- OPA validates session and returns user data (roles, permissions, attributes like office, products)
- Frontend uses `useGetMe` React hook to fetch authenticated user info via API route proxy pattern
- Source: [OPA User Authentication & Authorization](https://oneline.atlassian.net/wiki/spaces/BTH/pages/3568533516)

**ONE Finance Partner Access (External Partners):**
- Partners authenticate via **email + access code + OTP** flow
- Token refresh with rotation (access_token and refresh_token cookies updated, session_id unchanged)
- Source: Multiple EFIN Jira issues (EFIN-11268, EFIN-11075, EFIN-11070, etc.)

### 2. OAuth Providers Supported

- **Google OAuth 2.0**: Primary OAuth provider for internal apps via NA-LDF-API. Configured with `GOOGLE_OAUTH_ID`, `GOOGLE_OAUTH_SECRET`, `GOOGLE_OAUTH_CALLBACK` environment variables. Restricted to `one-line.com` email domain. Source: [NA-LDF-API Auth Module](https://oneline.atlassian.net/wiki/spaces/Z/pages/2984017922)

- **APIGee OAuth2**: Used by the CAM (OM-CAM) application. OAuth2 client credentials flow via `https://apis-test.one-line.com/v1/oauth/accesstoken`. Source: [CAM APIGee OAuth2 login](https://oneline.atlassian.net/wiki/spaces/BTH/pages/3158048769)

- **ONE CIAM (OpenID Connect)**: Used for eCommerce SSO integration. Uses **Authorization Code Flow + PKCE** protocol. Source: [SSO Integration](https://oneline.atlassian.net/wiki/spaces/NE/pages/1625325593)

- **GitHub SSO**: Primary authentication method for the engineering organization via DevEx Portal. Source: [DevEx Portal Guideline](https://oneline.atlassian.net/wiki/spaces/BTH/pages/3169485163)

### 3. Known Issues

**Authentication & Access Issues (from Known Errors page):**
- **Login Failure or Session Timeout**: Caused by expired tokens/session cookies, incorrect credentials, SSO integration failure. Workaround: Clear browser cache, verify permissions, reauthenticate through IdP. Source: [Common System Issues and Known Errors](https://oneline.atlassian.net/wiki/spaces/GEO/pages/3264381137)
- **ERR-101 "Invalid Token Format"**: Root cause is token encryption mismatch. Workaround: Regenerate API token. Source: Same page.

**Active Jira Issues:**
- **EFIN-11269** (In Progress): Login page UI issues for SAP Chile - missing text, incorrect font colors, missing placeholders, missing red borders on invalid input
- **EFIN-11075** (TO DO): Partner login - user cannot process OTP due to system error
- **MOM-10190**: First Approver username not captured when logging in with username/password instead of email login
- **COM-6938**: Investigation request about authentication & authorization details in Chorus

**Session Management Policy (mandatory controls):**
- Access tokens MUST expire after 15 minutes
- ID tokens MUST expire after 1 hour
- Refresh tokens expire after 2 hours idle, 1 day absolute
- Absolute session timeout after 2 hours of inactivity
- Refresh token rotation is mandatory (Auth0 platform)
- Source: [Session Management Policy](https://oneline.atlassian.net/wiki/spaces/NE/pages/3186950985)

**Security Training Documentation (OWASP-related):**
- Multiple pages on identification and authentication failures (A07 OWASP)
- CWE-287 Improper Authentication documentation
- Improper Authentication checklist and meeting notes
- Sources: Pages in BTH and NE spaces

### 4. Key Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `GOOGLE_OAUTH_ID` | NA-LDF-API | Google OAuth Client ID |
| `GOOGLE_OAUTH_SECRET` | NA-LDF-API | Google OAuth Client Secret |
| `GOOGLE_OAUTH_CALLBACK` | NA-LDF-API | OAuth callback URL |
| `JWT_SECRET` | NA-LDF-API + LDFs | JWT signing/verification (shared) |
| `LDF_AUTH_BASE_URL` | LDFs | Auth module base URL |
| `LDF_ID` | LDFs | Unique LDF identifier |
| `OPA_GET_ME_ENDPOINT` | VRM Frontend | OPA service endpoint |

## Limitations of This Approach (Without Skill)

- **No helper scripts**: Could not use `confluence.mjs` or `jira.mjs` helper scripts for structured CQL/JQL searches
- **No search-patterns.md reference**: Did not have access to the skill's query optimization patterns
- **Manual query construction**: Had to construct CQL/JQL manually, encountered the "DO" reserved word issue
- **No automated synthesis**: The skill's search-company-knowledge workflow would have automated the parallel search and synthesis process
- **Broader search scope**: Without the skill's guidance, searches were not as targeted as they could have been with reference to `query-languages.md`

Despite these limitations, the MCP plugin tools provided direct access to the Atlassian APIs, enabling comprehensive search and content retrieval across both Confluence and Jira.
