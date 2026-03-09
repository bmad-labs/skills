# Execution Plan: Handling Manual Task Report from Sub-Agent (Story 2.1)

## Scenario

The orchestrator is running the Phase 4 main loop. During **Step 3 (Develop Story)** for story 2.1, the "story-developer" sub-agent has reported back via `SendMessage` that it needs the user to manually create an AWS S3 bucket and configure IAM permissions before it can proceed.

## What the Skill Instructs

The SKILL.md defines a specific protocol for this situation under **Step 3: Develop Story > Orchestrator actions after sub-agent reports > "If manual task reported"** (lines 346-352). The sub-agent prompt itself also contains a **Manual Task Handling** section (lines 325-335) that governs what the sub-agent should have done before escalating.

## Step-by-Step Execution (DRY RUN)

### 1. Receive the Sub-Agent Report

The "story-developer" sub-agent sends a `SendMessage` to the team lead reporting:
- **What the manual task is:** Create an AWS S3 bucket and configure IAM permissions.
- **What automation approaches were considered and why they don't work.**
- **What specific user action is needed.**

Per the skill's Manual Task Handling instructions (lines 325-335), the sub-agent is required to have already investigated automation before reporting. The report should include what was considered (e.g., AWS CLI `aws s3 mb`, CloudFormation/CDK templates, Terraform, IAM policy creation via `aws iam`).

### 2. Orchestrator Reviews the Automation Investigation

Per lines 346-349, the orchestrator's first action is:

> "Review the sub-agent's automation investigation results. If the orchestrator sees an automation approach the sub-agent missed, send instructions to try it. Wait for re-report."

**Evaluation of automation feasibility for this task:**

AWS S3 bucket creation and IAM configuration CAN typically be automated via:
- **AWS CLI:** `aws s3 mb s3://bucket-name` and `aws iam create-policy` / `aws iam attach-role-policy`
- **CloudFormation/CDK:** Infrastructure-as-code templates
- **Terraform:** IaC definitions
- **LocalStack:** For local development/testing, a mock AWS environment

The orchestrator would check whether the sub-agent considered these approaches. The key question is whether the sub-agent has valid reasons for why automation is not possible (e.g., no AWS credentials configured in the development environment, requires organizational approval, needs specific account-level permissions the developer doesn't have).

### 3. Decision Point: Can the Orchestrator Suggest an Automation Approach?

**If YES (orchestrator spots a missed automation approach):**
- Send feedback to the **same** "story-developer" sub-agent via `SendMessage` (not spawning a new one — per Critical Rule 9: "Send feedback, don't respawn"):
  ```
  SendMessage: {
    type: "message",
    recipient: "story-developer",
    content: "Try automating the S3 bucket and IAM setup using AWS CLI commands:
      1. aws s3 mb s3://<bucket-name> --region <region>
      2. aws iam create-policy --policy-name <name> --policy-document file://policy.json
      3. aws iam attach-role-policy ...
      Or use LocalStack for local dev. Report back after attempting.",
    summary: "Try AWS CLI automation for S3/IAM"
  }
  ```
- Wait for the sub-agent to re-report. The sub-agent retains full context of the story implementation.

**If NO (truly manual — e.g., no AWS credentials, requires org approval):**
- Proceed to step 4.

### 4. Halt and Ask the User

Per lines 350-352:

> "If truly manual, halt and ask the user: describe the manual step needed, what was investigated, and why automation is not possible. Wait for user to complete the manual step and confirm before resuming."

The orchestrator would:

1. **Keep the "story-developer" sub-agent alive** (it is NOT shut down — it retains full context and will resume after the user completes the manual step).
2. **Report to the user** with a structured message:

   ```
   MANUAL ACTION REQUIRED — Story 2.1

   The implementation of Story 2.1 requires a manual step that cannot be automated:

   WHAT IS NEEDED:
   - Create an AWS S3 bucket (name: <bucket-name>, region: <region>)
   - Configure IAM permissions:
     - Create an IAM policy with S3 read/write access to the bucket
     - Attach the policy to the application's IAM role/user

   WHAT WAS INVESTIGATED:
   - AWS CLI automation: Not feasible because [sub-agent's reason, e.g., no AWS
     credentials configured in this environment]
   - LocalStack: Not feasible because [reason, e.g., production bucket needed for
     integration tests]
   - CloudFormation/Terraform: Not feasible because [reason]

   WHY AUTOMATION IS NOT POSSIBLE:
   [Sub-agent's explanation, e.g., "Requires AWS console access with admin
   privileges that are not available in the development environment"]

   Please complete these steps and confirm when done. The implementation will
   resume automatically from where it left off.
   ```

3. **Wait for user confirmation.** The orchestrator does NOT proceed, does NOT move to the next story, does NOT shut down the sub-agent.

### 5. After User Confirms

Once the user says the manual step is done:

1. **Send a message to the still-alive "story-developer"** sub-agent:
   ```
   SendMessage: {
     type: "message",
     recipient: "story-developer",
     content: "The user has completed the manual step (S3 bucket created, IAM
       configured). Please continue the implementation from where you left off.",
     summary: "Manual step complete, resume work"
   }
   ```
2. Wait for the sub-agent to report completion.
3. **Re-read `sprint-status.yaml`** (Critical Rule 3) to confirm the story moved to `review` status.
4. If successful, send `shutdown_request` to "story-developer" and proceed to **Step 4 (Code Review)**.

### 6. What Does NOT Happen

Per the skill's design:
- The orchestrator does NOT skip the story or mark it as blocked without user involvement.
- The orchestrator does NOT trigger the Collaborative Escalation pattern — that pattern is for *technical* blockers after 2 rounds of feedback, not for confirmed manual tasks.
- The orchestrator does NOT invoke `/bmad-bmm-correct-course` — that is for unresolvable technical issues, not for expected manual infrastructure setup.
- The orchestrator does NOT spawn a new sub-agent — the existing "story-developer" is kept alive to preserve its implementation context.

## Summary of Skill-Prescribed Behavior

| Phase | Action | Skill Reference |
|-------|--------|-----------------|
| Sub-agent reports manual task | Sub-agent must first investigate automation (CLI, scripts, APIs, Docker, mocks) | Lines 325-335, Critical Rule 14 |
| Orchestrator receives report | Review automation investigation; suggest missed approaches if any | Lines 346-349 |
| If automation approach exists | Send feedback to same sub-agent to try it | Lines 348-349, Critical Rule 9 |
| If truly manual | Halt, describe to user what is needed and why automation failed | Lines 350-352 |
| User completes manual step | Resume by messaging the same sub-agent | Implied by team architecture (lines 38-46) |
| After story completes | Re-read sprint-status.yaml, proceed to Step 4 (Code Review) | Lines 341-342, Critical Rule 3 |

## Key Skill Design Principles Applied

1. **Automate before asking for help** (Critical Rule 14): The sub-agent must exhaust automation options before reporting manual. The orchestrator gets a second look.
2. **Send feedback, don't respawn** (Critical Rule 9): The same "story-developer" sub-agent handles the continuation — no context is lost.
3. **Always re-read sprint-status.yaml** (Critical Rule 3): Ground truth is always refreshed after any sub-agent action.
4. **Halt with full context**: The user receives not just the ask, but the investigation trail — what was tried and why it didn't work.
