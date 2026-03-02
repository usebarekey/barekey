# TODO (Chores / Later)

## 2026-02-28 [URGENT] Convex deploy blocked in prod

Blocker:
- `npx convex deploy -y` failed for deployment `kindred-newt-974` because `CLERK_JWT_ISSUER_DOMAIN` is required in auth config but not set in prod environment variables.

Why this blocks completion:
- The autonomous workflow requires successful Convex deploy for backend changes in the PR branch history.
- Deploy cannot proceed without setting this secret in Convex dashboard/env config.

Next action:
- Set `CLERK_JWT_ISSUER_DOMAIN` in Convex prod deployment env vars, then rerun `npx convex deploy -y`.

## 2026-02-28 [RESOLVED] Prior Ralph blockers

Status update:
- `PRD.md` is now present in the repository.
- Work continued from the existing dirty branch state by creating a dedicated feature branch:
  `feat/ui-simplification-language-cleanup`.

Follow-up:
- Keep isolating new work by staging only task-relevant files for commits and PRs.

## Org slug route collision (`/o/new`, `/o/select`)

Finding:
- Static routes like `/o/new` and `/o/select` will override dynamic org routes (`/o/:orgSlug`).
- If an organization slug is exactly `new` (or `select`), the org page becomes unreachable at the canonical path.

Why this matters:
- Users could create or rename an org to a reserved path and break navigation.

Do later:
- Reserve org slugs like `new`, `select` (and other system paths) at creation/rename time.
- Validate slug input in all org creation flows (Clerk UI/custom flow if applicable).
- Keep generated default org slugs in safe patterns (alphanumeric-only, e.g. `johndoeorg5831`).

Optional future hardening:
- Move system org pages to a namespaced path (example: `/o/_/new`) if you want to allow any slug.

## 2026-02-28 [WEIRD] agent-browser localhost navigation blocked

- `agent-browser open http://localhost:5173` and `agent-browser open http://localhost:5174` both fail with `net::ERR_INTERNET_DISCONNECTED` in this environment.
- This blocks reliable pre/post UI visual verification against a fresh baseline for this task.
- Fallback used: code review + lint + UI build validation only.
