# 001: Platform Architecture

## Goal

Define the system architecture for Barekey as a Convex-native dynamic delivery platform.

## Current

- Frontend is a React SPA (`pkg/ui`) using React Router.
- Backend is Convex (`pkg/convex`), no separate API server.
- Auth and org state come from Clerk.
- Data tables currently implemented:
  - `users`
  - `projects`
- Organization-scoped routes are implemented under `/o/:orgSlug/*`.

## Target

- Keep Convex as the only backend runtime.
- Add org-scoped platform primitives in Convex:
  - project DEKs
  - encrypted secrets
  - environment configurations
  - dynamic decision configs (`ab_roll`, `rollout`, future kinds)
- Expose HTTP endpoints in `pkg/convex/http.ts` for SDK/CLI use.
- Add server-side evaluation engine for dynamic kinds using deterministic bucketing.

## Architecture diagram

```text
Browser SPA (React + Clerk)
        |
        | ConvexReactClient (WS)
        v
Convex functions (queries/mutations/actions)
        |
        +--> Convex DB tables
        +--> Decision evaluator (server-side bucketing)
        +--> Convex HTTP endpoints (future SDK/CLI)
```

## Boundaries

- Clerk is the source of truth for authentication and organization context.
- Convex is the source of truth for product data:
  - projects
  - encrypted values
  - dynamic decision definitions
  - key metadata
- No direct DB access from clients, only through Convex functions.

## Core invariants

- Projects are organization-owned, never user-owned.
- Every data access path must be org-scoped.
- Route slug and active org claims must align before mutating org data.
- Query performance depends on index-first access patterns (`withIndex`).
- Dynamic decisions must be deterministic per `(project, variable, seed[, key])`, where `seed` is required by the SDK RPD and `key` is optional; decisions must not rely on client local storage.
