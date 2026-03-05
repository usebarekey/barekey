# Zero-Import SDK Typegen (From `@barekey/sdk` Only)

## Summary

Implement typegen so consumer apps get fully typed `get` and `getMany` from `@barekey/sdk` directly, with no separate `$types` import.
Mechanism: generate a module-augmentation `.d.ts` file into the installed SDK package location (`node_modules/@barekey/sdk/...`), and make SDK base declarations always reference that file.

## Public API and Type Contract Changes

1. `@barekey/sdk` exports augmentable interfaces:
   - `BarekeyGeneratedTypeMap` (empty by default)
   - `BarekeyGeneratedRequiredMap` (empty by default)
2. `BarekeyClient` defaults to merged generated map:
   - `type BarekeyTypeMap = BarekeyGeneratedTypeMap extends Record<string, unknown> ? BarekeyGeneratedTypeMap : Record<string, string>`
3. `get` and `getMany` typed overloads remain as planned, but default generic reads generated map automatically.
4. No extra import path is required by consumers; they only import from `@barekey/sdk`.

## Implementation Details

### 1) SDK Declaration Architecture (Always-On Hook)

1. Add a shipped stub file in SDK package, for example `dist/generated/barekey.generated.d.ts`, generated during SDK build with empty augmentation.
2. Ensure `dist/index.d.ts` references it via triple-slash:
   - `/// <reference path="./generated/barekey.generated.d.ts" />`
3. This guarantees TypeScript loads augmentation whenever `@barekey/sdk` is imported.

### 2) CLI Typegen Output Target Resolution

1. `barekey typegen` resolves installed SDK root via module resolution (`@barekey/sdk/package.json`).
2. Default output target becomes:
   - `<resolved-sdk-root>/dist/generated/barekey.generated.d.ts`
3. Keep optional `--out` for overrides.
4. If writing to SDK path fails (read-only filesystem or permissions), command falls back to project-local output and prints an explicit warning and next step.

### 3) Generated File Shape (Module Augmentation)

1. Emit:
   - `import "@barekey/sdk";`
   - `declare module "@barekey/sdk" { interface BarekeyGeneratedTypeMap { ... } }`
   - `declare module "@barekey/sdk" { interface BarekeyGeneratedRequiredMap { ... } }`
   - `export {};`
2. Keep deterministic ordering by variable name.
3. Map Convex manifest types:
   - `string -> string`
   - `number -> number`
   - `boolean -> boolean`
   - `json -> unknown`

### 4) Exact `getMany` Inference

1. Keep tuple-literal overload:
   - `getMany<const TKeys extends readonly (keyof BarekeyTypeMap & string)[]>(keys: TKeys)`
2. Return mapped exact object:
   - `{ [K in TKeys[number]]: BarekeyResolvedValueTyped<BarekeyTypeMap[K]> }`
3. Non-literal arrays degrade to broad record type.

### 5) Convex Manifest and Metadata

1. Persist and emit real `declaredType` and `required` from `projectVariables`.
2. Keep backward fallback (`string`, `true`) for legacy rows.
3. Keep `manifestVersion` as content hash for pulse diff detection.

### 6) SDK Pulse (30s)

1. While SDK client is active, poll manifest every 30s.
2. On manifest version change, regenerate augmentation file in resolved SDK path.
3. Add single-flight, retry/backoff, and `dispose()` lifecycle handling.
4. No-op outside Node runtimes or when filesystem access is unavailable.

## Test Cases

### Type-Level

1. `env.get("KNOWN_KEY")` infers generated scalar type.
2. `env.getMany(["A", "B"] as const)` infers exact `{ A: ..., B: ... }`.
3. Unknown or non-literal key arrays return broad record type.

### Generation

1. `barekey typegen` writes to installed SDK generated `.d.ts` by default.
2. Output is valid module augmentation and picked up without extra imports.

### Runtime

1. Coercion behavior for number, boolean, and json is validated.
2. Pulse rewrites only when manifest version changes.
3. Permission failure fallback path is deterministic.

## Assumptions and Defaults

1. Default behavior is "just works from `@barekey/sdk` import only".
2. Mutating `node_modules` is acceptable for local developer workflows.
3. If package manager creates immutable installs, CLI fallback is used and surfaced clearly.
4. Pulse interval defaults to 30s unless made configurable later.
