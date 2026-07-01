## Source References

- When exact library APIs or current patterns matter, prefer local vendor source
  or installed type definitions over memory.
- Use official documentation only when local source does not answer the question
  or when the task explicitly asks for current external information.
- Do not guess security-sensitive, framework-specific, or persistence APIs.

## Editing

- Keep changes scoped to the user's request.
- Do not revert or overwrite unrelated dirty work, as it might be multiple
  agents working.
- Use small, reviewable edits. Avoid opportunistic refactors while fixing a
  narrow issue.
- Prefer structured APIs and parsers over ad hoc string manipulation when the
  codebase or standard toolchain provides them.
- Add comments only when they clarify non-obvious intent. Use JSDoc-style
  comments for comments in TypeScript files.
- Avoid examples copied from unrelated projects. Examples in docs should use
  local concepts or stay generic.

## Runtime Boundaries

- Runtime code must stay Node-compatible, universal Web API-compatible, or
  WinterTC/TC55-compatible. Do not rely on Deno-only or Bun-only behavior in
  code that ships as part of Barekey's CLI, SDKs, worker, sync service, frontend
  server code, or other production runtime surfaces.
- Deno is the development and task runner for this repository. It is fine in
  tests, local scripts, migrations, code generation, and other repo tooling, but
  Deno-specific APIs must not leak into production runtime code.
- Avoid direct runtime globals such as `Deno.*`, `Bun.*`, package-manager
  globals, or runtime-specific filesystem/process APIs in runtime code.
- Prefer Web-standard and portable APIs such as `fetch`, `Request`, `Response`,
  `URL`, `URLPattern` where available, `crypto.subtle`, `TextEncoder`,
  `TextDecoder`, `ReadableStream`, and `AbortSignal`.
- Use Node-compatible packages or project adapters for capabilities that are not
  universal: filesystem, environment variables, process exit, child processes,
  terminal/TTY handling, chmod, temporary directories, browser-opening, and OS
  keychain access.
- If a production runtime surface genuinely needs host-specific behavior,
  isolate it behind an adapter with a portable interface instead of branching
  business logic on Deno, Bun, or Node globals.

## TypeScript Style

- Follow the naming, import, and file-layout conventions already used in the
  touched module.
- Use kebab-case for filenames, snake_case for ordinary code identifiers, and
  PascalCase for Effects, types, and classes.
- Do not create aliases, functions, or exports whose only purpose is to rename
  or forward another symbol. Use the original symbol directly unless the new
  binding adds real behavior, narrows a public contract, or is part of an
  established adapter boundary.
- Keep non-trivial functions readable:
  - gather setup values near the top;
  - use early guard clauses;
  - separate meaningful phases with blank lines;
  - avoid dense nested conditionals.
- Use modern, intentful operators where they improve clarity:
  - `??` / `??=`;
  - `?.`;
  - `.some`, `.find`, `.map`, `.filter`;
  - array/object spread when building new values.

## Effect Style

- Use Effect.ts as the default programming model for all TypeScript application
  code, on both client and server. Model async workflows, dependency boundaries,
  resource lifecycles, validation, and typed failures with Effect primitives
  unless the code is a narrow framework adapter or a trivial synchronous value.
- In Svelte/SvelteKit code, use `svelte-effect-runtime` for effectful client and
  server flows. Preserve valid SER syntax such as `<script effect>`, supported
  direct `yield*`, `ClientRuntime`, `ServerRuntime`, and remote functions instead
  of rewriting it into Promises, callbacks, stores, or plain Svelte patterns.
- Prefer Effect APIs before ad hoc `Promise` chains, `try`/`catch`, untyped
  thrown errors, mutable module state, or third-party control-flow helpers.
- Prefer `Effect.gen` for business logic and inferred Effect return types unless
  an explicit type is part of a public contract.
- Do not create functions whose only purpose is returning an Effect expression.
  Prefer a variable binding such as `const run_task = () => Effect.gen(...)`.
- Think of an Effect program as `Effect.gen(function* () { ... }).pipe(...)`:
  keep business logic inside `Effect.gen`, then put composition and adapter
  logic in `.pipe(...)`.
- Prefer composing Effects with `.pipe(...)`.
- Prefer Effect APIs and look for them before reaching for third-party
  libraries.
- Use tagged errors for typed failures. Place tagged error classes near the top
  of the file.
- Use schemas for input boundaries and attach the inferred type to the schema
  declaration.
- Avoid throwing raw strings, returning ambiguous error objects, or branching on
  untyped error shapes when typed Effect errors or schema decoding can express
  the intent.

## Documentation

- Exported user-facing functions should have JSDoc with a brief description,
  `@since`, `@param`, and `@returns`.
- Exported internal functions, classes, types, constants, and schemas should at
  least have a brief JSDoc and `@since` when the surrounding code expects it.
- Only include `@example` for user-facing SDK or API documentation.
- Keep examples short and relevant to the repository.

## Tests

- Add or update tests in the location established by the repository.
- Prefer targeted tests for narrow changes and broader tests when touching
  shared behavior or user-facing flows.
- Tests must not leave process, environment, filesystem, network, database, or
  auth-state side effects behind.
- Restore mutated state in `finally` or use dependency injection/temp paths
  where possible.

## Git

- Check `git status --short` before staging.
- Stage only files related to the completed task.
- Do not stage unrelated dirty files or generated artifacts unless they are
  required for the task.
- Commit after a successful change and verification pass.
- Use short commit messages in this shape:
  `docs|chore|fix|feat|revert/<model>: <summary>`.
- Push the current branch after committing when the repo workflow expects remote
  updates.
