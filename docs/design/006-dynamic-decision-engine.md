# 006: Dynamic Decision Engine

## Goal

Define Barekey as a platform for dynamic runtime decisions, not only secrets.

## Product position

Barekey is an all-in-one control plane for values that must change behavior at runtime.

Primary capability families:

- Secrets:
  - encrypted static values like `DATABASE_URL`, API tokens, credentials
- Experiments:
  - A/B assignment with deterministic bucketing
- Rollouts:
  - gradual exposure over points using selectable curves
- Future dynamic kinds:
  - kill switches
  - numeric/string parameter flags
  - JSON config payload variants
  - targeted rules (segment, region, org tier)

## Deterministic bucketing contract

Every dynamic evaluation uses SDK-provided `key` and `seed`.

- Required request inputs:
  - `project`
  - `environment`
  - `name`
  - `key`
  - `seed`
- Deterministic bucket:
  - compute normalized value in `[0,1)` from hash of `(project, environment, name, key, seed)`
- Why:
  - consistent assignment across sessions/devices
  - cannot be gamed by clearing local storage
  - identical behavior across backend SDKs

Input meaning:

- `key`: stable identity for consistency (who is being bucketed).
- `seed`: deterministic roll input (how the roll is calculated).

## `ab_roll` model

Config:

- `valueA`
- `valueB`
- `chance` in `[0,1]`

Decision:

- if `bucket < chance`: return `valueB`
- else: return `valueA`

Example:

- `chance = 0.5` means 50% bucketed to `B`, 50% to `A`.

## `rollout` model

`rollout` is progressive A/B where effective chance changes by point.

Config:

- `valueA`
- `valueB`
- `curve`: `linear` | `exp` | future
- `basePercent`: initial probability in `[0,1]` (default `0`)
- `stepPercent`: percent change per point in `[0,1]`
- `points`: total number of points (`>= 1`)
- `currentPoint`: active point index (`0..points-1`)

Derived chance:

- `linear`:
  - `chance = clamp(basePercent + stepPercent * currentPoint, 0, 1)`
- `exp`:
  - `chance = clamp(basePercent + stepPercent * (2^currentPoint - 1), 0, 1)`

Decision:

- evaluate as A/B with the derived chance.

## Engine invariants

- Decision output must be pure for the same `(config, key, seed)` input.
- Engine behavior must be consistent between SDK and HTTP API paths.
- Dynamic evaluation must be isolated from auth scope:
  - `key` and `seed` influence bucket only
  - org/project authorization still comes from validated auth claims
- Changes to curve math or hashing strategy require explicit versioning.

## Observability (target)

- Log decision metadata (without secret plaintext):
  - variable name
  - kind
  - derived chance
  - curve
  - point
  - bucket
- Provide audit events for config updates:
  - who changed chance/curve/points
  - previous and new values
  - timestamp
