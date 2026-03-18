# User Profile Enhancement - Jira Tickets

Project: **FRONTEND**

---

## Ticket 1: FRONTEND-??? | Story

**Summary:** Allow users to upload a profile avatar

**Type:** Story
**Priority:** Medium
**Labels:** profile, avatar, upload

**Description:**
Users should be able to upload a profile avatar image from the profile settings page. The avatar will be displayed on the user's profile and throughout the application where user identity is shown.

**Acceptance Criteria:**
- [ ] User can upload an image file from the profile settings page
- [ ] Only JPG and PNG formats are accepted; other formats show a clear error message
- [ ] Maximum file size is 5MB; files exceeding this show a clear error message
- [ ] Uploaded avatar is displayed as a preview before saving
- [ ] Avatar is persisted and displayed on the user's profile page
- [ ] Avatar is displayed in all relevant UI locations (nav bar, comments, etc.)

---

## Ticket 2: FRONTEND-??? | Story

**Summary:** Add bio field to user profile page

**Type:** Story
**Priority:** Medium
**Labels:** profile, bio

**Description:**
Add a text bio field to the user profile page so users can write a short description about themselves. The bio should be visible on their public profile.

**Acceptance Criteria:**
- [ ] Bio text field is displayed on the profile edit page
- [ ] Maximum character limit is 500 characters
- [ ] A character counter is shown to the user
- [ ] Bio is saved when the profile is saved
- [ ] Bio is displayed on the user's public profile page
- [ ] Bio field handles special characters and line breaks correctly

---

## Ticket 3: FRONTEND-??? | Bug

**Summary:** Fix profile changes not saving on mobile Safari

**Type:** Bug
**Priority:** High
**Labels:** profile, bug, mobile, safari

**Description:**
Users report that profile changes (edits to any profile field) do not persist when using mobile Safari. The save action appears to complete but changes are lost on page reload.

**Steps to Reproduce:**
1. Open the profile edit page on mobile Safari (iOS)
2. Make changes to any profile field
3. Tap Save
4. Reload the page
5. Observe that changes were not saved

**Expected Behavior:** Profile changes should be saved and persisted regardless of browser.

**Acceptance Criteria:**
- [ ] Profile changes save successfully on mobile Safari (latest iOS version)
- [ ] Root cause is identified and documented in the PR
- [ ] No regressions on other browsers (Chrome, Firefox, desktop Safari)
- [ ] Verified on at least iOS 16 and iOS 17

---

## Ticket 4: FRONTEND-??? | Story

**Summary:** Add profile completion percentage indicator

**Type:** Story
**Priority:** Low
**Labels:** profile, completion, indicator

**Description:**
Display a profile completion percentage on the user's profile page to encourage users to fill out all profile fields. The indicator should show what percentage of profile fields have been completed and suggest which fields are missing.

**Acceptance Criteria:**
- [ ] A percentage indicator (e.g., progress bar or circular indicator) is displayed on the profile page
- [ ] Percentage accounts for all profile fields: avatar, bio, name, email, social links, etc.
- [ ] Indicator updates in real-time as the user fills in fields
- [ ] Missing fields are listed or highlighted to guide the user
- [ ] 100% completion state is visually distinct (e.g., green, checkmark)

---

## Ticket 5: FRONTEND-??? | Story

**Summary:** Allow users to link social media accounts to their profile

**Type:** Story
**Priority:** Medium
**Labels:** profile, social-media, integrations

**Description:**
Users should be able to add links to their social media accounts (e.g., Twitter/X, LinkedIn, GitHub, Instagram) on their profile page. These links will be displayed on their public profile.

**Acceptance Criteria:**
- [ ] Profile edit page includes fields for social media links
- [ ] At minimum, support: Twitter/X, LinkedIn, GitHub, Instagram
- [ ] URLs are validated for correct format
- [ ] Social media links are displayed with appropriate icons on the public profile
- [ ] Links open in a new tab when clicked
- [ ] Fields are optional; empty fields are not displayed on the public profile

---

## Ticket 6: FRONTEND-??? | Task

**Summary:** Update API documentation for new profile endpoints

**Type:** Task
**Priority:** Medium
**Labels:** profile, documentation, api

**Description:**
Update the API documentation to cover the new and modified profile endpoints introduced by the avatar upload, bio field, and social media linking features.

**Acceptance Criteria:**
- [ ] Documentation covers the avatar upload endpoint (request format, size limits, accepted types, error responses)
- [ ] Documentation covers the bio field in the profile update endpoint
- [ ] Documentation covers the social media links in the profile update endpoint
- [ ] Request and response examples are provided for each endpoint
- [ ] Error codes and messages are documented
- [ ] Documentation is published and accessible to frontend and external consumers
