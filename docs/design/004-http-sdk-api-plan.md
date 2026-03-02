# 004: HTTP API Plan for SDK and CLI

## Goal

Define the HTTP surface for non-browser clients (SDKs and CLI), including dynamic decision evaluation.

## Current

- SPA talks to Convex directly over WebSocket.
- `pkg/convex/http.ts` is reserved for future endpoints.

## Target API areas

- Identity and org context
  - validate Clerk JWT
  - return resolved user/org claims
- Projects
  - list projects in active org
  - create project
- Secrets
  - list secret metadata by project/env
  - create/update/delete secret values
  - evaluate resolved env payload (including `ab_roll` and `rollout`)
- Dynamic evaluation
  - evaluate a single variable by name + environment + sdk `key` + `seed`
  - evaluate a batch of variables with one sdk `key` + `seed`
  - return resolved value and decision metadata

## Request auth model

- Client sends Clerk-issued JWT.
- Endpoint validates JWT exactly as Convex function auth does.
- Endpoint derives org scope from claims, never from client-only fields.

## Evaluation request contract (target)

```json
{
  "projectSlug": "example-project-1234",
  "environment": "prod",
  "name": "PAYWALL_EXPERIMENT",
  "key": "user_abc_123",
  "seed": "paywall-exp-v1"
}
```

- `key` is required for any dynamic kind (`ab_roll`, `rollout`).
- `key` must be stable for the subject to keep assignment consistent across sessions/devices.
- `seed` is required for dynamic kinds and is used for deterministic roll hashing.
- `seed` changes intentionally shift bucket assignments (useful for experiment/reset versioning).
- Evaluation must happen server-side; SDK should not locally compute variants.

## Evaluation response shape (target)

```json
{
  "name": "PAYWALL_EXPERIMENT",
  "kind": "ab_roll",
  "value": "B",
  "decision": {
    "bucket": 0.341,
    "chance": 0.5,
    "matchedRule": "ab_roll",
    "seed": "paywall-exp-v1"
  }
}
```

## Versioning

- Start with `/v1`.
- Additive changes only within a major version.
- Breaking changes require `/v2`.

## Error shape (target)

```json
{
  "error": {
    "code": "ORG_CLAIMS_MISSING",
    "message": "No active organization selected.",
    "requestId": "..."
  }
}
```

## Non-goals

- Building a second backend server outside Convex.
- Supporting anonymous/public secret access.
- Client-side local-storage-based assignment as a source of truth.
