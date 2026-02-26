# TODO (Chores / Later)

## Org slug route collision (`/o/new`, `/o/select`)

Finding:
- Static routes like `/o/new` and `/o/select` will override dynamic org routes (`/o/:orgSlug`).
- If an organization slug is exactly `new` (or `select`), the org page becomes unreachable at the canonical path.

Why this matters:
- Users could create or rename an org to a reserved path and break navigation.

Do later:
- Reserve org slugs like `new`, `select` (and other system paths) at creation/rename time.
- Validate slug input in all org creation flows (Clerk UI/custom flow if applicable).
- Keep generated default org slugs in safe patterns (already okay: `*-org-####`).

Optional future hardening:
- Move system org pages to a namespaced path (example: `/o/_/new`) if you want to allow any slug.
