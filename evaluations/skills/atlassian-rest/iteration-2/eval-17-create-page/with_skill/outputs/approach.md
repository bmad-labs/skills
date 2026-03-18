# Approach: Create Confluence ADR Page for Microservices Migration

## Overview

Create an Architecture Decision Record (ADR) page in the TEAM Confluence space documenting a "Microservices Migration" decision, using the atlassian-rest skill's Create Confluence Document workflow and the ADR template from `references/confluence-formatting.md`.

## Skill References Used

- **SKILL.md** -- main skill instructions, Confluence operations section
- **workflows/create-confluence-document.md** -- step-by-step workflow for creating professional Confluence pages
- **references/confluence-formatting.md** -- ADR template in storage format, macros (status lozenges, info/warning/tip panels, TOC)

## Step-by-Step Approach

### Step 1: Verify Setup

Run the setup script to confirm Atlassian credentials are configured:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

### Step 2: Confirm TEAM Space Exists

List available Confluence spaces to verify the TEAM space key is valid:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs spaces --max 20
```

### Step 3: Build the ADR Storage Format Body

Following the ADR template from `references/confluence-formatting.md`, construct the full storage format HTML body. Because the content exceeds ~2000 characters, write it to a temporary file:

Write the following to `/tmp/confluence-adr-body.html`:

```xml
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>

<p><strong>Status:</strong>
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Yellow</ac:parameter>
  <ac:parameter ac:name="title">PROPOSED</ac:parameter>
</ac:structured-macro></p>

<h2>Context</h2>
<p>Our current monolithic application has grown to over 500,000 lines of code with tightly coupled modules. The system faces several critical challenges:</p>
<ul>
  <li>Deployment cycles take 4+ hours with full regression testing, slowing feature delivery</li>
  <li>A single component failure can cascade and bring down the entire application</li>
  <li>Teams cannot independently scale high-traffic modules (e.g., payment processing, user authentication)</li>
  <li>Technology choices are locked to the monolith's stack, preventing adoption of better-suited tools per domain</li>
  <li>Onboarding new developers takes weeks due to the complexity of understanding the full codebase</li>
</ul>
<p>We need an architectural approach that enables independent deployability, fault isolation, and team autonomy.</p>

<h2>Decision</h2>
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>We will migrate from the monolithic architecture to a microservices-based architecture, decomposing the application along domain boundaries using Domain-Driven Design (DDD) principles. The migration will follow a strangler fig pattern, incrementally extracting services while the monolith continues to operate.</p>
  </ac:rich-text-body>
</ac:structured-macro>
<p>Key decisions within this migration:</p>
<ul>
  <li><strong>Service boundaries:</strong> Defined by bounded contexts identified through event storming sessions</li>
  <li><strong>Communication:</strong> Synchronous REST/gRPC for queries, asynchronous messaging (Kafka) for events</li>
  <li><strong>Data ownership:</strong> Each service owns its database; no shared databases</li>
  <li><strong>Migration strategy:</strong> Strangler fig pattern -- extract one domain at a time starting with the least coupled modules</li>
  <li><strong>Infrastructure:</strong> Kubernetes for orchestration, Istio service mesh for observability and traffic management</li>
</ul>

<h2>Consequences</h2>
<ac:structured-macro ac:name="tip">
  <ac:parameter ac:name="title">Benefits</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li>Independent deployment -- teams can release services without coordinating full-system deployments</li>
      <li>Fault isolation -- a failure in one service does not cascade to others</li>
      <li>Independent scaling -- high-traffic services (e.g., auth, payments) can scale horizontally without scaling the entire application</li>
      <li>Technology flexibility -- teams can choose the best language/framework for their domain</li>
      <li>Team autonomy -- smaller, focused codebases enable faster onboarding and ownership</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>
<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Trade-offs</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li>Increased operational complexity -- managing dozens of services requires mature CI/CD, monitoring, and alerting</li>
      <li>Distributed system challenges -- network latency, eventual consistency, and distributed tracing add complexity</li>
      <li>Data consistency -- cross-service transactions require saga patterns or eventual consistency, which are harder to reason about</li>
      <li>Migration cost -- estimated 6-9 months of parallel effort while maintaining the monolith</li>
      <li>Infrastructure investment -- Kubernetes cluster, service mesh, and centralized logging/monitoring tooling required upfront</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Status</h2>
<table>
  <thead>
    <tr>
      <th style="background-color: #f4f5f7; font-weight: bold;">Date</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Status</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2026-03-18</td>
      <td><ac:structured-macro ac:name="status">
        <ac:parameter ac:name="colour">Yellow</ac:parameter>
        <ac:parameter ac:name="title">PROPOSED</ac:parameter>
      </ac:structured-macro></td>
      <td>Initial ADR created for architecture review board discussion</td>
    </tr>
  </tbody>
</table>

<ac:structured-macro ac:name="note">
  <ac:parameter ac:name="title">Next Steps</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li>Schedule architecture review board meeting to discuss this ADR</li>
      <li>Conduct event storming sessions to identify bounded contexts</li>
      <li>Create proof-of-concept for the first service extraction candidate</li>
      <li>Estimate infrastructure costs for Kubernetes and observability tooling</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Step 4: Create the Confluence Page

Use the `create-page` command with `--body-file` since the content is long:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space TEAM \
  --title "ADR: Microservices Migration" \
  --body-file /tmp/confluence-adr-body.html
```

This returns the created page ID and URL.

### Step 5: Verify the Created Page

Fetch the page to confirm it was created correctly:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <pageId> --format storage
```

### Step 6: Report Results

Report to the user:
- Page URL (from `_links.webui` in the response)
- Confirmation that all four ADR sections (Context, Decision, Consequences, Status) were created
- Note the status lozenge is set to PROPOSED (Yellow)
- Ask if any adjustments are needed (e.g., changing status to ACCEPTED, adding a parent page, attaching diagrams)

## Key Skill Features Used

1. **Create Confluence Document workflow** (`workflows/create-confluence-document.md`) -- followed the 6-step process: gather requirements, plan structure, build storage format, create page, upload images (none needed), review
2. **ADR template** (`references/confluence-formatting.md`) -- used the Architecture Decision Record template as the structural foundation
3. **Confluence macros** -- TOC, status lozenges (PROPOSED/Yellow), info panel (Decision), tip panel (Benefits), warning panel (Trade-offs), note panel (Next Steps)
4. **`--body-file` flag** -- used for the page body since it exceeds shell argument limits
5. **`confluence.mjs spaces`** -- to verify the TEAM space exists before creating
6. **`confluence.mjs create-page`** -- primary command for page creation
7. **`confluence.mjs get-page`** -- for post-creation verification

## ADR Page Structure

| Section | Confluence Element | Description |
|---------|-------------------|-------------|
| Table of Contents | `toc` macro | Auto-generated navigation for 4+ sections |
| Status Badge | Status lozenge (Yellow/PROPOSED) | Visual indicator at top of page |
| Context | `<h2>` + paragraph + bullet list | Problem statement and driving forces |
| Decision | `<h2>` + info panel + bullet list | The chosen approach with key sub-decisions |
| Consequences | `<h2>` + tip panel (Benefits) + warning panel (Trade-offs) | Positive and negative outcomes |
| Status | `<h2>` + table | Decision history tracking with dates |
| Next Steps | Note panel | Actionable follow-up items |
