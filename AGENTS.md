# AGENTS.md — Barekey

## Project Overview

Barekey is a developer SaaS vault manager with Vercel/Apple-tier DX.
It manages encrypted environment variables (secrets) for developer teams.

**Current state:** Early scaffold — signup, org creation, and project
creation work. UI and core vault features are being built now.

## Package Manager

- This repo uses Bun.
- Use `bun install` for dependency changes.
- Use `bun run <script>` for repo scripts.
- Use `bun test` for tests.
- Do not use `npm` or commit `package-lock.json`.

## Stack

| Layer        | Tool                                     |
| ------------ | ---------------------------------------- |
| Backend / DB | Convex (BaaS) — `pkg/convex/` directory  |
| Auth & Orgs  | Clerk (Google, GitHub, Passkeys planned) |
| Payments     | Autumn (not yet implemented)             |
| Frontend     | React SPA (Vite) with ConvexReactClient  |
| Styling      | Shadcn + Tailwind                        |

## Architecture

### Convex is the backend

There is no separate API server. Convex hosts everything.
The SPA connects to Convex directly via `ConvexReactClient` (WebSocket).
Later, SDKs/CLIs will use HTTP endpoints defined in `pkg/convex/http.ts`.

### Directory structure

```text
pkg/convex/
├── _generated/
├── schema.ts
├── http.ts            ← HTTP endpoints for SDKs/CLI (future)
├── auth/              ← Clerk integration helpers
├── vaults/            ← secrets CRUD, encryption, env config
├── teams/             ← team/org logic
├── projects/          ← project management, DEK lifecycle
└── payments/          ← Autumn integration (future, leave empty)
```

### Auth

Clerk handles all authentication and organization management.

- The SPA uses Clerk's React SDK + ConvexProviderWithClerk
- Convex functions use `ctx.auth.getUserIdentity()` to get the current user
- HTTP endpoints (future) validate Clerk JWTs the same way
- Every user auto-gets an org named "\<name\>'s Organization"
- Only teams (orgs) can own projects — never individual users

### Data model

- **Org** → managed by Clerk (not a Convex table)
- **Project** → belongs to an org. Has a DEK (data encryption key)
- **Secret** → belongs to a project. Encrypted with the project's DEK
- **DEK** → per-project, encrypted by a master KEK

### Slug policy

- Org, user, and project slugs must follow `slug-numbers` format: `{slug-base}-{digits}`
- `slug-base` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Full slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+$`
- Disallowed: underscores, spaces, uppercase, and symbols

### Encryption architecture (envelope encryption)

```text
Master KEK (stored encrypted in the project document)
└── encrypts → Project DEK (one per project, stored encrypted in DB)
               └── encrypts → each secret value
```

- For the MVP phase, the KEK is stored encrypted at rest in Convex
- Client-side encryption is the long-term goal but not required yet
- When rotating keys, re-encrypt all secrets with a new DEK, then
  re-encrypt the new DEK with the KEK

### Secret types

Each environment variable has a `kind` that determines its behavior:

| Kind      | Behavior                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| `secret`  | Classic secret — returns the stored value                                                     |
| `ab_roll` | A/B roll — has two values and a `chance` (0–1). Returns value A or B based on the probability |

More kinds may be added later. Use a discriminated union with `as const` for the kind field.

Example schema shape:

```typescript
v.union(
  v.object({
    kind: v.literal("secret"),
    name: v.string(),
    encryptedValue: v.string(),
  }),
  v.object({
    kind: v.literal("ab_roll"),
    name: v.string(),
    encryptedValueA: v.string(),
    encryptedValueB: v.string(),
    chance: v.number(),
  }),
);
```

---

## Available Tools

### agent-browser — Visual verification

You have `agent-browser` installed. The dev server runs on `http://localhost:5173`.

**Before starting a UI task:**

```bash
agent-browser open http://localhost:5173
agent-browser screenshot baseline.png
```

**After every UI change:**

```bash
agent-browser snapshot -i
agent-browser screenshot --annotate current.png
```

Read the snapshot to verify structure. Check the annotated screenshot
to verify visuals. Interact with elements using `@ref` IDs.

**Before finishing a UI task:**

```bash
agent-browser diff screenshot --baseline baseline.png
```

If unintended pixel changes appear, investigate and fix.

### Cubic PR review — GitHub comments

Use Cubic review directly in PR comments.

**When you want review:**

```bash
gh pr comment --body "@cubic-dev-ai review this pull request"
```

**How to work with it:**

- Do not block on every push/commit waiting for review.
- Continue implementing and push incrementally.
- Check PR comments intermittently:

```bash
gh pr view --comments
```

- Fix valid Cubic issues when they appear, then push follow-up commits.

---

## Git Workflow

- Create a feature branch per task: `feat/<task-name>`
- Commit frequently with descriptive messages as you work
- Push regularly so PR progress is visible
- When a task is complete:
  1. Push and create a PR: `gh pr create --fill`
  2. Request Cubic review: `gh pr comment --body "@cubic-dev-ai review this pull request"`
  3. Continue work without waiting per push/commit
  4. Check comments intermittently and fix valid issues
  5. Push fixes and merge when done
- Never commit to `main` directly

---

## TypeScript Rules

- Double quotes `""` for all strings and JSX props
- Semicolons `;` on every statement
- Filenames: `kebab-case`
- Types, classes, components, enums: `PascalCase`
- Enums use `as const` objects, **NOT** the `enum` keyword:

```typescript
const SecretKind = {
  Secret: "secret",
  AbRoll: "ab_roll",
} as const;
```

- **NEVER** cast to `any` — use `unknown`. If `any` is truly needed,
  write a comment justifying it
- Route param folders use brackets: `[param]`, `[slug]`
- **NO** `export default` in React components
- Route files: `page.tsx` exports `Page()`, `layout.tsx` exports `Layout()`
- Type arrays as `const arr: Array<T> = [...]`
- Type records as `const rec: Record<KeyType, ValueType> = {...}`
- Use `Id<"tableName">` for document IDs — never plain `string`

---

## Convex Rules

### Functions

- Always use the named export object syntax with argument validators
- `query`, `mutation`, `action` = public API (exposed to internet)
- `internalQuery`, `internalMutation`, `internalAction` = private
- **NEVER** register functions through `api` or `internal` objects
- When calling functions in the same file with `ctx.runQuery` etc,
  add a return type annotation to avoid TS circularity

### Queries

- **NEVER** use `.filter()` — define an index and use `.withIndex()`
- **NEVER** use `.delete()` on queries — `.collect()` then loop with `ctx.db.delete(row._id)`
- Use `.unique()` to assert a single result
- Default order is ascending `_creationTime`

### Mutations

- `ctx.db.replace` = full replace (throws if missing)
- `ctx.db.patch` = shallow merge (throws if missing)

### Actions

- Add `"use node";` only for Node.js built-ins
- **NEVER** put `"use node";` in a file with queries or mutations
- `fetch()` works without `"use node";`
- **NEVER** use `ctx.db` in actions

### Schema

- Define in `pkg/convex/schema.ts`
- System fields `_id` and `_creationTime` are automatic
- Index names must list all fields: `by_orgId_and_name`
- Index fields must be queried in definition order

### Crons

- Only use `crons.interval` or `crons.cron`
- Always import `internal` from `_generated/api`

### File Storage

- `ctx.storage.getUrl(fileId)` for signed URLs
- Query `_storage` system table for metadata — do **NOT** use deprecated `ctx.storage.getMetadata`

### Validators

- `v.int64()` not `v.bigint()` (deprecated)
- `v.record(keys, values)` for dynamic key objects
- `v.map()` and `v.set()` are **NOT** supported

---

## UI / Styling

- Use Shadcn components from the project's component library
- Use Tailwind utility classes — no custom CSS unless unavoidable
- Aim for Vercel/Apple-tier DX: clean, minimal, fast, obvious
- Every interactive element must have clear hover/focus states

# INDEX.md — Agent & Developer Scratchpad

This file is a persistent, shared scratchpad for both AI agents and human
developers working on this codebase.

It is not documentation. It is not a changelog. It is a place to think out
loud, leave breadcrumbs, and ensure nothing gets lost between sessions.

---

## Purpose

- **Agents:** Use this file to record observations, draft plans, flag
  unexpected behavior, and leave notes for the next run. You are encouraged
  to write freely here — bullet points, questions, half-formed thoughts, and
  warnings are all valid.

- **Developers:** Use this file to leave context that doesn't belong in a
  commit message or PR description — things like "this broke for a weird
  reason," "come back to this," or "this decision was deliberate."

---

## Guidelines

- **Date your entries.** Prefix notes with `YYYY-MM-DD` so context ages
  gracefully.
- **Be honest, not polished.** This is not public-facing. A rough note is
  better than no note.
- **Don't delete old entries.** Archive them under an `## Archive` section
  at the bottom if they're no longer relevant. History is useful.
- **Flag urgency when needed.** Use `[URGENT]`, `[REVISIT]`, or `[WEIRD]`
  tags to make entries scannable.

## Git Workflow

- Create a feature branch per task: `feat/<task-name>`
- Commit frequently with descriptive messages as you work
- Push regularly so PR progress is visible
- Agents are expected to complete the **full GitHub lifecycle autonomously**
  — from branch creation through to a merged PR — without waiting for human
  intervention, unless explicitly blocked (see below)

### Full cycle (run this every time)

1. Push and open a PR: `gh pr create --fill`
2. Request Cubic review: `gh pr comment --body "@cubic-dev-ai review this pull request"`
3. Keep implementing and pushing; do not wait for review on each push/commit
4. Intermittently check comments: `gh pr view --comments`
5. Fix valid Cubic issues, then push again
6. Before merge, perform one final comment check and address critical issues
7. Merge the PR:

```bash
gh pr merge --squash --delete-branch
```

> **Per-push review waiting is not required.**
> Continue shipping and check Cubic feedback intermittently.

### When NOT to merge autonomously

Hold and leave a note in `INDEX.md` if any of the following are true:

- The feature depends on another feature that is not yet merged or built
- The PR touches the encryption or DEK lifecycle and has not been reviewed
  by a human
- Cubic raises a concern you cannot resolve confidently
- The task description explicitly says to wait for review

### Merge strategies

```bash
gh pr merge --squash --delete-branch   # preferred — keeps history clean
gh pr merge --merge --delete-branch    # use for large multi-commit PRs
gh pr merge --auto --squash            # use when waiting for CI to pass
```

- Never commit to `main` directly
- Never merge your own PR with unresolved critical Cubic issues
- Never force-push to `main`

## GitHub CLI

  Agents are expected to use the GitHub CLI (`gh`) as the primary interface
  for all GitHub activity. Do not leave GitHub tasks half-finished — the full
  lifecycle from issue to merged PR should be handled autonomously.

### Issues

  ```bash
  gh issue list                                         # browse open work
  gh issue view 42                                      # read an issue before starting
  gh issue create --title "<title>" --body "<body>"     # file a new issue
  gh issue comment 42 --body "<comment>"                # leave progress updates
  gh issue close 42                                     # close when resolved
  ```

  - Before starting any task, check `gh issue list` for related open issues
  - Leave a comment on the issue when you begin work and when you open a PR
  - If you discover a bug or follow-up task during work, file it as a new issue
    rather than silently ignoring it or bundling it into the current PR

### Pull Requests

  ```bash
  gh pr create --fill                  # open a PR from the current branch
  gh pr view --comments                # check for review comments
  gh pr comment --body "@cubic-dev-ai review this pull request" # request Cubic PR review
  gh pr merge --squash --delete-branch # merge when done and critical issues are addressed
  gh pr close                          # close without merging if work is abandoned
  gh pr comment --body "<comment>"     # respond to review comments
  ```

  - Link the relevant issue in the PR body when creating (e.g. `Closes #42`)
  - Respond to Cubic comments with `gh pr comment` when explaining a
    decision rather than making a change

***

## Convex CLI

  The Convex CLI is the primary interface for all backend operations. Agents
  must use it to deploy, inspect, and debug — never assume a Convex change is
  live until it has been explicitly deployed and verified.

### Core commands

  ```bash
  npx convex dev              # start local dev server and watch for changes
  npx convex deploy           # deploy functions to production
  npx convex logs             # tail live function logs
  npx convex data             # browse table data
  npx convex env list         # list environment variables
  npx convex env set KEY val  # set an environment variable
  npx convex import           # import data into a table
  npx convex export           # export table data
  ```

### Expected behavior
  - Always run `npx convex deploy` after changes to any file in `pkg/convex/`
    and confirm the deploy succeeds before opening a PR
  - Use `npx convex logs` to verify function behavior after deploying — do not
    assume correctness from TypeScript compilation alone
  - If a function throws at runtime, capture the log output and include it in
    the PR description or the relevant GitHub issue
  - Use `npx convex env set` for any environment variable changes — never
    hardcode values or commit secrets
  - If a schema migration is required, verify that existing data is not broken
    after deploying by inspecting with `npx convex data`

## Code Comments

Agents lose context between sessions. A comment is how the agent that wrote
the code passes intent to the agent that reads it next — treat it as
inter-agent communication, not documentation for humans.

### Rules

- **Never comment self-evident code.** A comment that restates what the code
  literally does wastes tokens and creates staleness risk. If the comment
  would go stale the moment the code changes, don't write it.

- **Always comment non-obvious decisions.** If you made a choice that isn't
  immediately clear from reading the code — an algorithm, an ordering
  constraint, a deliberate workaround — explain it. The next agent will not
  have the context you had when you wrote it.

- **Always comment the encryption and DEK lifecycle.** This is the highest
  risk area of the codebase. Any agent touching it must be able to
  understand the full intent of each step without inference. Be explicit.

- **Stale comments are worse than no comments.** If you change logic, update
  the comment. If you can't update the comment, delete it. A misleading
  comment actively causes mistakes — it is not a neutral omission.

### What to comment

| Situation                                      | Comment? |
| ---------------------------------------------- | -------- |
| Encryption steps, key derivation, DEK rotation | Always   |
| Non-obvious index field ordering in Convex     | Always   |
| Why a particular edge case is handled          | Always   |
| Probability logic (`ab_roll` chance)           | Always   |
| A deliberate workaround or known limitation    | Always   |
| What a function does (when non-obvious)        | Yes      |
| Self-evident code (`const name = user.name`)   | Never    |

### Format

Use JSDoc for all exported functions — agents can read these across the
codebase without opening the file:

```typescript
/**
 * Decrypts the project DEK using the master KEK.
 * The KEK is never stored in plaintext — it is derived at runtime and
 * discarded immediately after unwrapping the DEK.
 * Do NOT cache the result — call this per-request.
 */
export async function unwrapDek(encryptedDek: string): Promise<string> {
```

Use inline comments sparingly, only where intent would otherwise be lost:

```typescript
// chance is a 0–1 float — Math.random() is exclusive of 1, so a
// chance of 1.0 always returns A as intended
return Math.random() < chance ? valueA : valueB;
```
