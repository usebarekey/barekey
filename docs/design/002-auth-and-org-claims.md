# 002: Auth and Organization Claims

## Goal

Define how identity and org claims flow from Clerk into Convex and drive access control.

## Current

- Convex functions read identity via `ctx.auth.getUserIdentity()`.
- Helpers in `pkg/convex/lib/auth.ts` normalize claims:
  - `org_id`
  - `org_slug`
  - `org_role`
- Org-scoped functions require active org claims before reads/writes.
- UI handles temporary drift while Clerk active-org switching propagates.

## Claim contract

- Required for signed-in identity:
  - `subject` (Clerk user id)
- Required for org-scoped writes:
  - `org_id`
- Optional but strongly expected:
  - `org_slug`
  - `org_role`

## Access pattern

1. User signs in via Clerk.
2. Clerk session/JWT carries org claims.
3. Convex function reads claims from identity.
4. Function validates route slug vs active org slug when applicable.
5. Function scopes query/mutation by `orgId`.

## Failure modes

- Missing `org_id`:
  - org-scoped mutations must fail.
  - UI should show a clear claim-configuration message.
- Slug mismatch:
  - treat as route/org drift during switching; avoid unsafe reads/writes.
- Unsigned user:
  - return unauthenticated UI state or throw `Unauthorized` where required.

## Invariants

- Never trust route slug alone for authorization.
- Never trust client-provided org ids.
- All org data filters must use claims-derived org id.
