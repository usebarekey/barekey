# 007: SDK RPD (Runtime & Typegen)

## Goal

Define the Barekey SDK API and type system so developers get:

- ergonomic env-style access
- deterministic dynamic behavior
- strong generated types for known keys (not `unknown` by default)

## Proposed DX

```ts
import { env } from "@barekey/sdk";

/* known at compile time */
const database_url = env.get("DATABASE_URL");

/* unknown at compile time & needs handling */
const enable_logging = env.get("ENABLE_LOGGING")
  .coerce("boolean")
  .default(false);

/* dynamic enables cache invalidation every 5 minutes */
/* use seed to enable deterministic probability */
const new_dashboard = env.get("NEW_DASHBOARD", {
  dynamic: {
    ttl: 300000,
  },
  seed: user.id,
});
```

## Product requirements

1. Known keys are strongly typed from generated schema/types.
2. Unknown keys are handled explicitly with `.coerce()` / `.default()` / `.required()`.
3. Dynamic values support local TTL cache for freshness/perf tradeoff.
4. Dynamic roll behavior is deterministic with `seed`.
5. SDK behavior is consistent across Node/server, edge, and browser runtimes.

## API shape

### `env.get(name, options?)`

- Returns a value builder object.
- Overloads:
  - known key overload: inferred type from generated map
  - unknown key overload: unresolved builder requiring coercion/default handling

Options:

- `dynamic?: { ttl?: number }`
  - cache lifetime in milliseconds
- `seed?: string`
  - deterministic roll input for dynamic kinds
- `key?: string`
  - optional stable identity key for consistency/stickiness

Note:

- `seed` drives deterministic roll hashing.
- `key` is for consistency identity semantics when provided.
- Both affect decision bucketing only, never authorization scope.

### Builder methods

- `.coerce(kind)`
  - `kind`: `"string" | "number" | "boolean" | "json" | "int" | "float" | "url"`
  - narrows the result type
- `.default(value)`
  - returns non-nullish typed value with fallback
- `.required(message?)`
  - throws typed runtime error when unresolved/invalid
- `.raw()`
  - returns raw unresolved payload for debugging/advanced cases

## Generated types

At build/startup, generate a key map from Barekey config:

```ts
export type BarekeyKnownKey =
  | "DATABASE_URL"
  | "ENABLE_LOGGING"
  | "NEW_DASHBOARD";

export interface BarekeyTypeMap {
  DATABASE_URL: string;
  ENABLE_LOGGING: boolean;
  NEW_DASHBOARD: boolean;
}
```

## Type behavior

- `env.get("DATABASE_URL")` => `string` (or strict builder resolving to `string`)
- `env.get("ENABLE_LOGGING")` => `boolean` when known
- unknown string literal or runtime string:
  - returns unresolved builder (not silently trusted)
  - requires `.coerce()` or `.default()` for a concrete type

## Why this matters

- Prevents the common weak env API behavior where everything becomes `unknown` or `string`.
- Maintains ergonomic runtime access while keeping static safety.

## Runtime behavior

## Resolution pipeline

1. Read local cache entry if present and unexpired (`dynamic.ttl`).
2. Fetch from Barekey SDK endpoint when missing/expired.
3. For dynamic kinds (`ab_roll`, `rollout`), evaluate deterministically with `seed` (and optional `key`).
4. Apply coercion/default/required semantics.
5. Return typed value and optionally update cache.

## Caching rules

- Cache key includes:
  - project
  - environment
  - variable name
  - `seed` (and `key` when provided)
- Changing `seed` intentionally changes deterministic assignment and cache identity.
- TTL expiration triggers refresh; stale values are not trusted past TTL unless configured.

## Error model

Typed error codes:

- `KEY_NOT_FOUND`
- `COERCE_FAILED`
- `REQUIRED_VALUE_MISSING`
- `DYNAMIC_SEED_REQUIRED`
- `AUTH_SCOPE_INVALID`
- `NETWORK_ERROR`

## Non-goals

- Making unknown keys silently typed without explicit handling.
- Client-only local-storage assignment as source of truth.
- Using `seed` or `key` for authorization decisions.

## Acceptance criteria

1. Known keys resolve with compile-time inferred types from generated map.
2. Unknown keys require explicit handling and cannot accidentally pass type-check as concrete values.
3. `dynamic.ttl` caching works and is observable in tests.
4. Dynamic assignment is deterministic for same `(name, project, env, seed, key?)`.
5. SDK behavior matches server evaluation semantics for `ab_roll` and `rollout`.
