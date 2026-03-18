# Approach: Breaking Inline Requirements into Jira Tickets (DO Project)

## Task

Break 6 inline requirements into Jira tickets in the DO project at wnesolutions.atlassian.net, assigning the correct issue type to each.

## Approach Without Atlassian Skill

No Atlassian skill, helper scripts, or authorized MCP plugin is available. The MCP plugin returned an authorization error ("Cloud id isn't explicitly granted by the user") when attempting to access the wnesolutions.atlassian.net site. Therefore, tickets cannot be created directly in Jira.

The approach is:

1. **Analyze each requirement** -- Classify by issue type based on the nature of the work described.
2. **Map to standard Jira issue types** -- Story for new user-facing features, Bug for defect fixes, Task for non-feature work.
3. **Document the full breakdown** -- Provide structured ticket definitions that could be manually entered into Jira or used as input for a future automation step.

## Requirement Analysis and Issue Type Mapping

| # | Requirement | Issue Type | Rationale |
|---|-------------|------------|-----------|
| 1 | Add dark mode toggle to settings page | **Story** | New user-facing feature -- adds a new capability to the settings page |
| 2 | Implement real-time notification badge | **Story** | New user-facing feature -- adds a new UI component for notifications |
| 3 | Fix: mobile Safari layout breaks on checkout page | **Bug** | Explicitly marked as a fix; describes broken behavior on a specific platform |
| 4 | Add filtering by date range to the reports dashboard | **Story** | New user-facing feature -- enhances the reports dashboard with new functionality |
| 5 | Implement CSV export for transaction history | **Story** | New user-facing feature -- adds a new export capability |
| 6 | Task: Update API documentation for v2 endpoints | **Task** | Explicitly marked as a task; documentation maintenance work, not user-facing functionality |

**Classification rationale:**
- Requirements 1, 2, 4, 5 are **Stories** because they describe new user-facing features that deliver value.
- Requirement 3 is a **Bug** because the prefix "Fix:" and the description ("layout breaks") indicate a defect in existing functionality on a specific platform (mobile Safari).
- Requirement 6 is a **Task** because the prefix "Task:" and the nature of the work (documentation updates) indicate supporting/maintenance work that does not deliver direct user-facing functionality.

## Proposed Ticket Breakdown

### Epic (Parent)

**Summary:** Inline Requirements -- Settings, Notifications, Checkout Fix, Reports, Export, API Docs

**Description:**
Grouping epic for 6 inline requirements covering settings enhancements, notification features, a checkout page bug fix, reports filtering, transaction export, and API documentation updates.

### Ticket 1 -- Story: Add dark mode toggle to settings page

- **Type:** Story
- **Summary:** Add dark mode toggle to settings page
- **Priority:** Medium
- **Description:**

  Add a toggle control to the application settings page that allows users to switch between light mode and dark mode.

  **Acceptance Criteria:**
  - User can toggle between light and dark mode from the settings page
  - Selected theme persists across sessions (saved to user preferences)
  - Theme change applies immediately without requiring a page reload
  - All pages and components render correctly in both modes

### Ticket 2 -- Story: Implement real-time notification badge

- **Type:** Story
- **Summary:** Implement real-time notification badge
- **Priority:** Medium
- **Description:**

  Add a notification badge to the UI that updates in real time to show the count of unread notifications.

  **Acceptance Criteria:**
  - Notification badge displays unread count
  - Badge updates in real time without requiring manual refresh
  - Badge clears/decrements when notifications are read
  - Badge is visible in the main navigation area

### Ticket 3 -- Bug: Mobile Safari layout breaks on checkout page

- **Type:** Bug
- **Summary:** Fix mobile Safari layout breaks on checkout page
- **Priority:** High
- **Description:**

  **Problem:** The checkout page layout is broken when viewed in mobile Safari.

  **Steps to Reproduce:**
  1. Open the checkout page on mobile Safari (iOS)
  2. Observe layout issues (misaligned elements, overflow, or broken styling)

  **Expected Behavior:** Checkout page renders correctly and is fully usable on mobile Safari, matching the experience on other browsers.

  **Actual Behavior:** Layout breaks on mobile Safari, potentially blocking users from completing checkout.

  **Environment:**
  - Browser: Mobile Safari (iOS)
  - Page: Checkout page

  **Severity:** High -- directly impacts revenue if users cannot complete checkout on iOS Safari.

### Ticket 4 -- Story: Add filtering by date range to reports dashboard

- **Type:** Story
- **Summary:** Add filtering by date range to reports dashboard
- **Priority:** Medium
- **Description:**

  Add date range filtering capability to the reports dashboard so users can narrow down report data to a specific time period.

  **Acceptance Criteria:**
  - User can select a start date and end date to filter reports
  - Date picker UI is intuitive and accessible
  - Reports data updates to reflect the selected date range
  - Common presets available (last 7 days, last 30 days, this quarter, etc.)
  - Selected date range persists during the session

### Ticket 5 -- Story: Implement CSV export for transaction history

- **Type:** Story
- **Summary:** Implement CSV export for transaction history
- **Priority:** Medium
- **Description:**

  Add the ability for users to export their transaction history as a CSV file.

  **Acceptance Criteria:**
  - User can trigger a CSV export from the transaction history page
  - Exported CSV includes all relevant transaction fields (date, amount, type, status, etc.)
  - Export respects any active filters (date range, status, etc.)
  - Large exports are handled gracefully (progress indicator or async download)
  - CSV file downloads with a descriptive filename

### Ticket 6 -- Task: Update API documentation for v2 endpoints

- **Type:** Task
- **Summary:** Update API documentation for v2 endpoints
- **Priority:** Low
- **Description:**

  Update the API documentation to cover all v2 endpoints, including new and modified routes, request/response schemas, and authentication requirements.

  **Acceptance Criteria:**
  - All v2 endpoints are documented
  - Request and response examples provided for each endpoint
  - Breaking changes from v1 are clearly noted
  - Authentication and authorization requirements documented
  - Documentation is published and accessible to API consumers

## Summary Table

| # | Type | Summary | Priority |
|---|------|---------|----------|
| -- | **Epic** | Inline Requirements -- Settings, Notifications, Checkout Fix, Reports, Export, API Docs | -- |
| 1 | Story | Add dark mode toggle to settings page | Medium |
| 2 | Story | Implement real-time notification badge | Medium |
| 3 | Bug | Fix mobile Safari layout breaks on checkout page | High |
| 4 | Story | Add filtering by date range to reports dashboard | Medium |
| 5 | Story | Implement CSV export for transaction history | Medium |
| 6 | Task | Update API documentation for v2 endpoints | Low |

**Totals:** 1 Epic, 4 Stories, 1 Bug, 1 Task = 6 child tickets

## What Would Be Different With the Atlassian Skill or Authorized MCP

With a working Atlassian integration, the workflow would be:

1. **Discover project metadata** -- Use `getJiraProjectIssueTypesMetadata` for DO project to confirm available issue types (Epic, Story, Bug, Task, etc.).
2. **Create the Epic first** -- Use `createJiraIssue` with type Epic to get a parent key.
3. **Create child tickets** -- Use `createJiraIssue` for each ticket with the `parent` field set to the Epic key.
4. **Present results** -- Return the created issue keys and URLs.

## Limitations of This Approach

- Tickets are not actually created in Jira (MCP plugin lacks authorization for this site).
- No validation that the DO project exists or what issue types it supports.
- No real issue keys generated.
- No epic-child linking.
- No custom field or workflow validation.
