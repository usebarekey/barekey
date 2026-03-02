# 008: UI Simplification Plan (Minimal, Product-First)

## Problem

Current UI surfaces expose backend/vendor implementation details (for example `Clerk`, `Convex`, JWT claim names like `org_id`) in primary product views.

This creates noise and weakens product positioning. Users should see Barekey concepts first: projects, variables, rollouts, experiments, members, access.

## Goal

Make all core UI surfaces minimal and product-focused.

- Remove backend/tooling references from default user flows.
- Keep only decision-relevant information.
- Move diagnostics to an explicit advanced/admin surface.

## Product copy rule

Default UI must not mention:

- `Clerk`
- `Convex`
- `JWT`
- raw claim keys (`org_id`, `org_slug`, etc.)

Exception:

- Explicit diagnostics/admin view only.

## Information hierarchy target

Primary (always visible):

- Workspace health in product language
- Projects
- Variables (secrets/ab/rollouts)
- Members and access
- Actionable next steps

Secondary (only if needed):

- brief warnings with user-action wording

Tertiary (advanced):

- auth/claim internals
- token debugging
- provider sync details

## Route-by-route cleanup plan

## `/o/:orgSlug/overview`

Current issues:

- "Convex/Clerk organization claim health"
- "Convex auth connected"
- claim-level warnings in main dashboard

Target:

- Rename to product language:
  - "Workspace status"
  - "Access status"
  - "Recent activity"
- Remove claim internals from primary cards.
- Replace with actionable messages:
  - "Workspace access needs attention"
  - button to "Open diagnostics" (advanced)

## `/o/:orgSlug/projects`

Current issues:

- "Reactive Convex list"
- "Missing org_id"
- claim-specific blocks in create/index panels

Target:

- Focus on project creation and search only.
- Replace claim text with product-safe fallback:
  - "Workspace context is still syncing. Try again in a moment."
- Keep "why blocked" details in diagnostics link.

## `/o/:orgSlug/settings`

Current issues:

- heavy "Control plane notes"
- multiple Clerk/Convex references and raw claim fields

Target:

- Default Settings:
  - workspace profile
  - member/admin actions
  - domains/access policy (product wording)
- Move internals into:
  - `Settings > Diagnostics` panel
  - hidden behind explicit "Advanced diagnostics" entry

## `/home` and user overview surfaces

Current issues:

- direct auth bridge status text

Target:

- replace with concise session language:
  - "Signed in"
  - "Workspace ready"
- no vendor names in default states.

## Component-level plan

1. Introduce copy helpers/constants for product-language status text.
2. Add `DiagnosticsPanel` component to isolate internals.
3. Replace inline technical warnings with generic UX-safe alerts + diagnostics CTA.
4. Reduce badges/metrics that do not change user decisions.
5. Keep one primary CTA per card where possible.

## Visual minimalism checklist

- Remove redundant subtext lines.
- Reduce badge density.
- Avoid more than 4 top-level metrics per page.
- Prefer short labels over explanatory paragraphs.
- Keep tables/lists focused on the user task.

## Migration phases

Phase 1: Copy cleanup (no behavior changes)

- Strip vendor/internal terms from all primary pages.
- Introduce diagnostics CTA placeholders.

Phase 2: Layout cleanup

- Remove low-value cards ("signals"/"control plane notes").
- Consolidate into fewer, stronger sections.

Phase 3: Diagnostics isolation

- Add dedicated advanced diagnostics panel/page.
- Move all claim/token/provider details there.

Phase 4: Polish and consistency

- Align tone/labels across all org pages.
- Ensure hover/focus states and spacing remain consistent.

## Acceptance criteria

1. No backend/vendor terms appear in default workspace pages.
2. Core org pages are understandable without backend context.
3. All internal diagnostics are accessible but non-default.
4. Page density is reduced with no loss of critical actions.
5. Existing functionality remains unchanged.

## Risks

- Risk: removing detail can hide useful debugging context.
  - Mitigation: diagnostics panel with clear path from user-facing warnings.
- Risk: copy-only changes drift from actual state logic.
  - Mitigation: keep state logic unchanged in Phase 1; only remap wording.
