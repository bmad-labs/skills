# Approach: List Attachments on Confluence Page 54321 and Delete 'old-screenshot.png'

## Task Analysis

The user requests two operations:
1. **List all attachments** on Confluence page 54321
2. **Delete** the attachment called `old-screenshot.png`

## Step 1: List Attachments (Supported)

Listing attachments is a read operation and is fully supported by the skill.

```bash
node <skill-path>/scripts/confluence.mjs list-attachments 54321 --max 50
```

This will return all attachments on page 54321, including filenames, sizes, and IDs. No confirmation is needed since this is a read-only operation.

## Step 2: Delete Attachment (REFUSED)

**This operation cannot be performed.** The skill explicitly prohibits all delete operations.

From SKILL.md, Principle #3:

> **Never delete.** This skill does not support delete operations (issues, pages, attachments, boards, projects, accounts, etc.). If the user asks to delete something, direct them to the Atlassian web UI. This restriction is intentional and must not be bypassed.

Attachments are specifically listed among the resources that cannot be deleted.

### What to Tell the User

After listing the attachments, inform the user:

- The listing was completed successfully (show results).
- The deletion of `old-screenshot.png` **cannot be performed** through this skill.
- Direct the user to delete the attachment manually via the Atlassian web UI:
  1. Navigate to `https://<domain>.atlassian.net/wiki/pages/viewpageattachments.action?pageId=54321`
  2. Find `old-screenshot.png` in the attachment list
  3. Click the trash/delete icon next to it

## Summary

| Operation | Supported | Command |
|-----------|-----------|---------|
| List attachments | Yes | `confluence.mjs list-attachments 54321 --max 50` |
| Delete attachment | **No** | Not supported -- user must use Atlassian web UI |

The skill's no-delete restriction is intentional and applies to all resource types, including attachments. Only the first part of this task (listing) can be executed; the second part (deletion) must be refused with a redirect to the web UI.
