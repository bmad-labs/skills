# Approach: Spec to Backlog — User Profile Enhancement

## 1. Sub-Skill Loaded

Loaded the **Spec to Backlog** sub-skill from `skills/spec-to-backlog.md`. This workflow has 7 steps:

1. Get Spec
2. Analyze Spec
3. Create Breakdown
4. Present Plan
5. Create Epic
6. Create Child Tickets
7. Report

## 2. Handling Inline Spec (No Confluence Fetch Needed)

The standard Step 1 of the spec-to-backlog workflow asks for a **Confluence page ID or URL** and fetches the spec via:

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId>
```

In this case, the specification was provided **inline** as part of the user's request rather than as a Confluence page. This means:

- **Skip the Confluence fetch entirely.** The spec content is already available in the conversation.
- Proceed directly to **Step 2: Analyze Spec** using the inline requirements document.
- The Epic description will note that the spec was provided inline (no Confluence link to reference back to).

This is a valid adaptation of the workflow — the sub-skill's purpose is to convert a spec into backlog items, regardless of where the spec originates.

## 3. Command to Check Issue Types for FRONTEND

Before creating any tickets, we need to know what issue types are available in the FRONTEND project:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types FRONTEND
```

This returns the list of valid issue types (e.g., Epic, Story, Task, Bug, Sub-task) so we can map requirements to the correct types.

## 4. Issue Type Mapping

Based on analyzing the 6 requirements and consulting `references/breakdown-examples.md` for sizing guidance and `references/ticket-writing-guide.md` for classification:

| # | Requirement | Issue Type | Rationale |
|---|-------------|------------|-----------|
| 1 | Upload profile avatar (max 5MB, jpg/png) | **Story** | New user-facing feature — vertical slice of functionality |
| 2 | Add bio field (max 500 chars) | **Story** | New user-facing feature — adds a capability to the profile |
| 3 | Fix profile changes not saving on mobile Safari | **Bug** | Defect in existing functionality on a specific platform |
| 4 | Add profile completion percentage indicator | **Story** | New user-facing feature — computed display component |
| 5 | Allow users to link social media accounts | **Story** | New user-facing feature — new integration capability |
| 6 | Update API documentation for new profile endpoints | **Task** | Non-feature work — documentation maintenance |

**Key decisions:**
- Stories for requirements 1, 2, 4, 5 because they are **user-facing features** that deliver value and can be described with acceptance criteria in Given/When/Then or checklist format.
- Bug for requirement 3 because it describes a **defect** in existing behavior on a specific platform (mobile Safari). Per `references/bug-report-templates.md`, this follows the standard bug template with steps to reproduce, expected vs actual behavior, and environment details.
- Task for requirement 6 because it is **supporting work** (documentation) that does not deliver direct user-facing functionality but is necessary for completeness.

## 5. Epic Description and Child Ticket Details

### Epic

**Summary:** Enhance user profile with avatar, bio, social links, and completion indicator

**Description** (following `references/epic-templates.md` structure):

```
## Goal
Improve the user profile experience by adding avatar uploads, bio field, social media linking, and a completion indicator, while fixing a critical mobile Safari save bug.

## Scope
- Profile avatar upload (max 5MB, jpg/png)
- Bio text field (max 500 characters)
- Fix mobile Safari profile save bug
- Profile completion percentage indicator
- Social media account linking
- API documentation updates for new endpoints

## Out of Scope
- Profile privacy settings
- Profile page redesign / layout changes
- Third-party avatar services (Gravatar, etc.)

## Success Criteria
- [ ] Users can upload and display a profile avatar
- [ ] Users can write and save a bio on their profile
- [ ] Profile changes save correctly on mobile Safari
- [ ] Users see a profile completion percentage
- [ ] Users can link at least 3 social media platforms
- [ ] API docs cover all new profile endpoints

## Dependencies
- None identified (self-contained profile feature set)

## Risks
- Mobile Safari bug may have deeper root cause affecting other save operations
- Social media OAuth integrations may require per-platform API keys
```

### Child Tickets

**Ticket 1 — Story: Add profile avatar upload**
- **Summary:** Add profile avatar upload supporting jpg/png up to 5MB
- **Priority:** Medium
- **Description:**
  ```
  ## Context
  Users currently have no way to personalize their profile with a photo. This story adds avatar upload capability.

  ## Requirements
  - Accept jpg and png file formats only
  - Maximum file size: 5MB
  - Display uploaded avatar on profile page and in navigation header
  - Provide image cropping/resizing before upload
  - Store avatars in object storage with CDN delivery

  ## Acceptance Criteria
  - [ ] User can upload a jpg or png image as their avatar
  - [ ] Files exceeding 5MB are rejected with a clear error message
  - [ ] Non-jpg/png formats are rejected with a clear error message
  - [ ] Uploaded avatar displays on the profile page
  - [ ] Avatar displays in the navigation header/user menu
  - [ ] User can replace an existing avatar
  - [ ] User can remove their avatar (reverts to default)

  ## Technical Notes
  - Consider using presigned URLs for direct-to-storage uploads
  - Resize server-side to standard dimensions (e.g., 200x200, 48x48)
  ```
- **Estimated points:** 5

**Ticket 2 — Story: Add bio field to user profile**
- **Summary:** Add bio text field with 500-character limit to profile page
- **Priority:** Medium
- **Description:**
  ```
  ## Context
  Users want to share a short description about themselves. Add a bio field to the profile editing and display pages.

  ## Requirements
  - Free-text field with 500-character maximum
  - Character counter shown during editing
  - Bio displayed on public profile page
  - Sanitize input to prevent XSS

  ## Acceptance Criteria
  - [ ] Bio field appears on the profile edit form
  - [ ] Character counter shows remaining characters
  - [ ] Input beyond 500 characters is prevented
  - [ ] Bio is displayed on the profile view page
  - [ ] HTML/script tags are sanitized on save
  - [ ] Empty bio is allowed (field is optional)

  ## Technical Notes
  - Add `bio` column (VARCHAR 500) to user profile table
  - Update profile API GET/PUT to include bio field
  ```
- **Estimated points:** 3

**Ticket 3 — Bug: Fix profile changes not saving on mobile Safari**
- **Summary:** Fix profile changes failing to save on mobile Safari
- **Priority:** High
- **Description** (following `references/bug-report-templates.md`):
  ```
  ## Description
  Profile changes (any field) do not persist when saved from mobile Safari. The save action appears to complete but changes are lost on page reload.

  ## Steps to Reproduce
  1. Open the profile edit page on mobile Safari (iOS)
  2. Modify any profile field (e.g., display name)
  3. Tap the Save button
  4. Observe that the page may show a success state
  5. Reload the page
  6. Observe that changes have reverted

  ## Expected Behavior
  Profile changes save successfully and persist across page reloads on mobile Safari.

  ## Actual Behavior
  Changes are lost after save on mobile Safari. Works correctly on desktop browsers and mobile Chrome.

  ## Environment
  - Browser: Mobile Safari (iOS 16+)
  - Affected: All profile fields
  - Works on: Desktop Safari, Chrome (desktop & mobile), Firefox

  ## Severity
  - Frequency: Always (on mobile Safari)
  - User impact: High — users cannot update their profile from iOS Safari
  - Workaround: Use a different browser on mobile

  ## Technical Notes
  Likely causes: Safari-specific FormData handling, fetch API differences, or WebKit cache behavior. Check for missing Content-Type headers or issues with the beforeunload event interfering with save requests.
  ```
- **Labels:** `bug`, `mobile`, `frontend`
- **Estimated points:** 3

**Ticket 4 — Story: Add profile completion percentage indicator**
- **Summary:** Add profile completion percentage indicator to profile page
- **Priority:** Low
- **Description:**
  ```
  ## Context
  To encourage users to fill out their profiles, display a completion percentage based on which fields are populated.

  ## Requirements
  - Calculate completion percentage based on filled profile fields
  - Display as a visual indicator (progress bar or circle) on the profile page
  - Update dynamically as the user fills in fields
  - Define which fields contribute to completion (name, avatar, bio, social links, etc.)

  ## Acceptance Criteria
  - [ ] Completion percentage displays on the profile page
  - [ ] Percentage updates immediately when fields are added/removed
  - [ ] 100% is shown when all tracked fields are populated
  - [ ] Visual indicator is accessible (screen reader support)
  - [ ] Completion logic accounts for new fields (avatar, bio, social links)

  ## Technical Notes
  - Compute on the client side based on profile data, or add a computed field to the API response
  - Weight fields equally or assign weights (e.g., avatar = 20%, bio = 15%, etc.)
  ```
- **Estimated points:** 3

**Ticket 5 — Story: Allow users to link social media accounts**
- **Summary:** Allow users to link social media accounts to their profile
- **Priority:** Medium
- **Description:**
  ```
  ## Context
  Users want to share their social media presence on their profile. Allow linking to common social platforms.

  ## Requirements
  - Support at least: Twitter/X, LinkedIn, GitHub, Instagram
  - URL validation for each platform
  - Display linked accounts with platform icons on the profile page
  - Allow adding, editing, and removing linked accounts

  ## Acceptance Criteria
  - [ ] User can add a social media link for each supported platform
  - [ ] URLs are validated against the expected platform domain
  - [ ] Invalid URLs show a clear error message
  - [ ] Linked accounts display with recognizable platform icons
  - [ ] User can edit an existing social link
  - [ ] User can remove a social link
  - [ ] Social links appear on the public profile view

  ## Technical Notes
  - Store as a JSON map or separate table: { platform: url }
  - Validate URL format per platform (e.g., twitter.com/*, linkedin.com/in/*)
  - Update profile API to include social_links field
  ```
- **Estimated points:** 5

**Ticket 6 — Task: Update API documentation for new profile endpoints**
- **Summary:** Update API documentation for new profile endpoints
- **Priority:** Low
- **Description:**
  ```
  ## Context
  New profile features (avatar upload, bio field, social links) add or modify API endpoints. Documentation must be updated to reflect these changes.

  ## Requirements
  - Document avatar upload endpoint (multipart/form-data)
  - Document updated profile GET/PUT with bio and social_links fields
  - Include request/response examples
  - Document error responses and validation rules

  ## Acceptance Criteria
  - [ ] Avatar upload endpoint documented with file size/type constraints
  - [ ] Profile GET response schema updated with bio and social_links
  - [ ] Profile PUT request schema updated with bio and social_links
  - [ ] All new error codes documented
  - [ ] Request/response examples provided for each changed endpoint
  - [ ] Documentation is published and accessible

  ## Technical Notes
  - Update OpenAPI/Swagger spec if applicable
  - Should be done after feature tickets are complete so docs match implementation
  ```
- **Labels:** `documentation`
- **Estimated points:** 2

## 6. Complete Breakdown Plan Presented to User

Here is the proposed backlog structure for **FRONTEND** project:

| # | Type | Summary | Priority | Points | Dependencies |
|---|------|---------|----------|--------|--------------|
| -- | **Epic** | Enhance user profile with avatar, bio, social links, and completion indicator | -- | -- | -- |
| 1 | Story | Add profile avatar upload supporting jpg/png up to 5MB | Medium | 5 | -- |
| 2 | Story | Add bio text field with 500-character limit to profile page | Medium | 3 | -- |
| 3 | Bug | Fix profile changes failing to save on mobile Safari | High | 3 | -- |
| 4 | Story | Add profile completion percentage indicator to profile page | Low | 3 | 1, 2, 5 |
| 5 | Story | Allow users to link social media accounts to their profile | Medium | 5 | -- |
| 6 | Task | Update API documentation for new profile endpoints | Low | 2 | 1, 2, 5 |

**Totals:** 1 Epic, 4 Stories, 1 Bug, 1 Task = 6 child tickets, 21 story points

**Suggested priority ordering for creation:**
1. Bug fix first (Ticket 3 — High priority, unblocks mobile users)
2. Feature stories (Tickets 1, 2, 5 — Medium priority, independent of each other)
3. Dependent items last (Ticket 4 depends on 1/2/5 for completion calculation; Ticket 6 depends on 1/2/5 for accurate docs)

At this point in the real workflow, the user would review and confirm before proceeding to creation.

## 7. All Create Commands in Sequence

### Step 1: Create the Epic

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Epic \
  --summary "Enhance user profile with avatar, bio, social links, and completion indicator" \
  --description "## Goal\nImprove the user profile experience by adding avatar uploads, bio field, social media linking, and a completion indicator, while fixing a critical mobile Safari save bug.\n\n## Scope\n- Profile avatar upload (max 5MB, jpg/png)\n- Bio text field (max 500 characters)\n- Fix mobile Safari profile save bug\n- Profile completion percentage indicator\n- Social media account linking\n- API documentation updates for new endpoints\n\n## Out of Scope\n- Profile privacy settings\n- Profile page redesign / layout changes\n- Third-party avatar services (Gravatar, etc.)\n\n## Success Criteria\n- [ ] Users can upload and display a profile avatar\n- [ ] Users can write and save a bio on their profile\n- [ ] Profile changes save correctly on mobile Safari\n- [ ] Users see a profile completion percentage\n- [ ] Users can link at least 3 social media platforms\n- [ ] API docs cover all new profile endpoints\n\n## Dependencies\nNone identified\n\n## Risks\n- Mobile Safari bug may have deeper root cause affecting other save operations\n- Social media OAuth integrations may require per-platform API keys"
```

*Capture returned Epic key, e.g., FRONTEND-200*

### Step 2: Create Bug ticket (highest priority first)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Bug \
  --summary "Fix profile changes failing to save on mobile Safari" \
  --description "## Description\nProfile changes do not persist when saved from mobile Safari. The save action appears to complete but changes are lost on page reload.\n\n## Steps to Reproduce\n1. Open the profile edit page on mobile Safari (iOS)\n2. Modify any profile field\n3. Tap the Save button\n4. Reload the page\n5. Observe that changes have reverted\n\n## Expected Behavior\nProfile changes save successfully and persist across page reloads on mobile Safari.\n\n## Actual Behavior\nChanges are lost after save on mobile Safari. Works correctly on desktop browsers and mobile Chrome.\n\n## Environment\n- Browser: Mobile Safari (iOS 16+)\n- Works on: Desktop Safari, Chrome, Firefox\n\n## Severity\n- Frequency: Always on mobile Safari\n- User impact: High\n- Workaround: Use a different mobile browser" \
  --priority High \
  --labels "bug,mobile,frontend" \
  --parent FRONTEND-200
```

### Step 3: Create Story — Avatar upload

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Story \
  --summary "Add profile avatar upload supporting jpg/png up to 5MB" \
  --description "## Context\nUsers currently have no way to personalize their profile with a photo.\n\n## Requirements\n- Accept jpg and png file formats only\n- Maximum file size: 5MB\n- Display uploaded avatar on profile page and navigation header\n- Provide image cropping/resizing before upload\n\n## Acceptance Criteria\n- [ ] User can upload a jpg or png image as their avatar\n- [ ] Files exceeding 5MB are rejected with a clear error message\n- [ ] Non-jpg/png formats are rejected with a clear error message\n- [ ] Uploaded avatar displays on the profile page\n- [ ] Avatar displays in the navigation header\n- [ ] User can replace an existing avatar\n- [ ] User can remove their avatar" \
  --priority Medium \
  --parent FRONTEND-200
```

### Step 4: Create Story — Bio field

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Story \
  --summary "Add bio text field with 500-character limit to profile page" \
  --description "## Context\nUsers want to share a short description about themselves.\n\n## Requirements\n- Free-text field with 500-character maximum\n- Character counter shown during editing\n- Bio displayed on public profile page\n- Sanitize input to prevent XSS\n\n## Acceptance Criteria\n- [ ] Bio field appears on the profile edit form\n- [ ] Character counter shows remaining characters\n- [ ] Input beyond 500 characters is prevented\n- [ ] Bio is displayed on the profile view page\n- [ ] HTML/script tags are sanitized on save\n- [ ] Empty bio is allowed" \
  --priority Medium \
  --parent FRONTEND-200
```

### Step 5: Create Story — Social media linking

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Story \
  --summary "Allow users to link social media accounts to their profile" \
  --description "## Context\nUsers want to share their social media presence on their profile.\n\n## Requirements\n- Support at least: Twitter/X, LinkedIn, GitHub, Instagram\n- URL validation for each platform\n- Display linked accounts with platform icons\n- Allow adding, editing, and removing linked accounts\n\n## Acceptance Criteria\n- [ ] User can add a social media link for each supported platform\n- [ ] URLs are validated against expected platform domains\n- [ ] Invalid URLs show a clear error message\n- [ ] Linked accounts display with platform icons\n- [ ] User can edit an existing social link\n- [ ] User can remove a social link\n- [ ] Social links appear on the public profile view" \
  --priority Medium \
  --parent FRONTEND-200
```

### Step 6: Create Story — Completion indicator

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Story \
  --summary "Add profile completion percentage indicator to profile page" \
  --description "## Context\nTo encourage users to fill out their profiles, display a completion percentage.\n\n## Requirements\n- Calculate completion based on filled profile fields\n- Display as a visual progress indicator\n- Update dynamically as user fills in fields\n\n## Acceptance Criteria\n- [ ] Completion percentage displays on the profile page\n- [ ] Percentage updates immediately when fields change\n- [ ] 100% shown when all tracked fields are populated\n- [ ] Visual indicator is accessible\n- [ ] Completion logic accounts for avatar, bio, and social links" \
  --priority Low \
  --parent FRONTEND-200
```

### Step 7: Create Task — API documentation

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project FRONTEND \
  --type Task \
  --summary "Update API documentation for new profile endpoints" \
  --description "## Context\nNew profile features add or modify API endpoints. Documentation must be updated.\n\n## Requirements\n- Document avatar upload endpoint\n- Document updated profile GET/PUT with bio and social_links\n- Include request/response examples\n- Document error responses and validation rules\n\n## Acceptance Criteria\n- [ ] Avatar upload endpoint documented with constraints\n- [ ] Profile GET response schema updated\n- [ ] Profile PUT request schema updated\n- [ ] All new error codes documented\n- [ ] Request/response examples provided\n- [ ] Documentation is published" \
  --priority Low \
  --labels "documentation" \
  --parent FRONTEND-200
```

## 8. Reference Files Consulted

| Reference File | Purpose |
|----------------|---------|
| `skills/spec-to-backlog.md` | Primary workflow — 7-step process for converting specs to backlog items |
| `references/ticket-writing-guide.md` | Summary format (Verb + Object + Context), description structure (Context/Requirements/AC/Technical Notes), priority assignment guidelines |
| `references/epic-templates.md` | Epic description structure (Goal/Scope/Out of Scope/Success Criteria/Dependencies/Risks), story point estimation guidance, epic sizing guide |
| `references/breakdown-examples.md` | Breakdown principles (independence, testability, size, vertical slicing), estimation patterns (CRUD = 3-5, new UI = 3-5, bug fix known = 1-3), example breakdowns |
| `references/bug-report-templates.md` | Standard bug template (Steps to Reproduce/Expected/Actual/Environment/Severity), priority assignment guide (severity x frequency matrix) |
| `SKILL.md` | Top-level skill instructions — resolve ambiguity first, confirm before mutating, use workflows for complex tasks, read reference docs when needed |
