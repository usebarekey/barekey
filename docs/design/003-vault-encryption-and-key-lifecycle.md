# 003: Vault Encryption and Key Lifecycle

## Goal

Define envelope encryption for Barekey variables and key rotation behavior.

## Status

- `Current`: users/projects scaffolding is implemented.
- `Target`: DEK and secret encryption flow described below.

## Data model (target)

- `projects`
  - `orgId`, `orgSlug`, metadata
  - `encryptedDek` (project DEK wrapped by KEK)
  - key metadata (`dekVersion`, `rotatedAtMs`, etc.)
- `secrets`
  - `projectId`
  - `name`
  - `kind` (`secret`, `ab_roll`, `rollout`, ...)
  - encrypted payload fields based on kind

## Envelope model

```text
Master KEK
  -> wraps Project DEK (stored as encryptedDek)
      -> encrypts each secret payload
```

## Variable kinds (target)

- `secret`
  - traditional encrypted value (for items like `DATABASE_URL`)
- `ab_roll`
  - `encryptedValueA`
  - `encryptedValueB`
  - `chance` in range `[0, 1]`
  - semantics: return `B` when deterministic bucket is `< chance`, else `A`
- `rollout`
  - `encryptedValueA`
  - `encryptedValueB`
  - rollout config:
    - `curve`: `linear`, `exp`, future curves
    - `stepPercent`: percent change per point in range `(0, 1]`
    - `points`: number of rollout points
    - `currentPoint`: active point index
  - semantics: derive effective `chance` from curve + point, then evaluate like `ab_roll`

## Deterministic evaluation inputs (target)

- SDK evaluation requests must include a stable `key` field.
- SDK evaluation requests must include a `seed` field for deterministic roll calculation.
- `key` identifies the subject being bucketed (for example user id, account id, device id) and keeps assignments consistent.
- `seed` is the value used in roll hashing so bucket calculation is deterministic and repeatable.
- Bucketing must be server-side and deterministic so users cannot game outcomes by clearing local storage.
- Deterministic bucket input should include:
  - project id
  - variable name
  - environment
  - sdk `key`
  - sdk `seed`

## Rotation workflow (target)

1. Load project and unwrap current DEK.
2. Generate a new DEK.
3. Re-encrypt every secret payload with new DEK.
4. Wrap new DEK with KEK.
5. Atomically update project key metadata and secret rows.

## Security invariants

- Never persist plaintext secret values.
- Never persist plaintext DEKs.
- Do not cache unwrapped DEKs across requests.
- Rotation should be idempotent and resumable where possible.
- Audit trails should record who rotated keys and when.
- SDK `key` must be treated as sensitive request input and never trusted for authorization scope.
- SDK `seed` must only affect deterministic roll calculation and never authorization scope.

## Open design decisions

- KEK source strategy for production (managed KMS vs app-managed secret).
- Batch strategy for large-secret-set rotations.
- Migration strategy for introducing encryption to existing plaintext data, if any.
