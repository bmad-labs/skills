# Full build on Claude Code — RED baseline (2026-11-06)

Skill under test: `skills/bmad-leader/SKILL.md` before the Full build change.
Prompt: Claude Code, autonomy granted, epic planned; Story 2.3 (C++ firmware, `cpp-embedded`) next, not yet planned. List dispatches, write the builder brief, say who runs the review lenses and who approves the plan.

Result (matches the field report from a real session):

- Planner `plan-2-3`: "`bmad-build` (Plan phase only)".
- Builder `builder-2-3`: "`bmad-build`: Implement phase only, from the approved plan."
- Leader dispatches three reviewers each round; "If bmad-build ran its own review anyway, the three still run."
- Verbatim on the conflict: "L252 says `bmad-build` 'owns… its review lenses', but L232 and L487 have the leader dispatch them. I followed L487." and "The phase split (L333) is titled '(OpenCode)', but the Roles section imposes the same split everywhere. I applied it on Claude Code too."

Cause: Roles (planner Plan-only, builder Implement-only), the session loop and Verify step 5 apply the OpenCode phase split on every harness.
Also found: duplicate step "2." in Planning first; duplicate Claude Code teammate rule.
