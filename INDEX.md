# INDEX.md — Agent & Developer Scratchpad

---

## Active Notes

### 2026-03-16

- **[REVISIT] Effect/Confect + XChaCha20 prod cutover is deployed but must not be auto-merged.**
  Branch: `codex/effect-confect-xchacha-cutover`. This change rewires
  `pkg/convex` through a Confect/Effect bridge, changes secret/DEK envelopes to
  `xcp1.*`, and includes a destructive cutover mutation
  `cutover:wipeEncryptedDataInternal` that clears `projectKeys`,
  `projectVariables`, `projectVariableSchedules`, and `orgStorageUsage`.
  Repo policy says encryption / DEK lifecycle changes require human review
  before merge, so open/maintain the PR but do not merge it autonomously.

### 2026-03-14

- **Select component `alignItemWithTrigger` default changed to `false`.**
  The Base UI Select `SelectContent` had `alignItemWithTrigger = true` as the
  default, which shifts the dropdown popup vertically so the selected item
  overlays the trigger. This looked wrong across the app — dropdowns appeared
  offset rather than cleanly below their triggers. Changed the default in
  `pkg/ui/src/components/ui/select.tsx` to `false`. If a future Select
  intentionally needs the overlay behavior, pass `alignItemWithTrigger={true}`
  explicitly.

- **Audit payload display uses `formatPayloadKey` / `formatPayloadValue`.**
  Added helpers in `pkg/ui/src/lib/audit.tsx` that convert camelCase payload
  keys to readable labels (stripping noise suffixes like "Id", "Slug") and
  format snake_case values into human-readable text. The old approach applied
  CSS `uppercase` to raw keys, producing unreadable labels like
  `CURRENTPRODUCTID`.

- **Audit filter Selects use `displayNameMap`.**
  Base UI's `SelectValue` does not automatically resolve display text from
  portaled `SelectItem` children. The audit page filters now pass explicit
  `displayNameMap` props so triggers show labels instead of raw sentinel
  values like `__all_category__`.

---

## Archive

_(nothing archived yet)_
