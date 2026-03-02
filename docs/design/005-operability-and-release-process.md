# 005: Operability and Release Process

## Goal

Define the operational workflow for safe autonomous development in Barekey.

## Source of truth

- Repository instructions in `AGENTS.md`.
- Runtime/deployment checks via Convex CLI.
- Review gates via Codex PR comments and GitHub PR discussion.

## Required flow per feature

1. Create branch `feat/<task-name>`.
2. Implement and validate locally.
3. Request Codex review in PR comments and address valid issues.
4. Open PR and iterate on review comments.
5. Merge only when review gates are clear.

## Convex deployment rule

- Any change under `pkg/convex/` must be deployed and verified:
  - `npx convex deploy`
  - `npx convex logs`

## High-risk areas

- Encryption and DEK lifecycle.
- Org claim authorization checks.
- Data model and schema migrations.

These areas require extra scrutiny and explicit design review.

## Autonomous execution with Ralph

- Ralph may run Codex in iterative loop from `TASK.md`.
- Keep task briefs explicit about:
  - acceptance criteria
  - validation commands
  - merge constraints
- If blocked or uncertain, stop and record blocker context in `INDEX.md`.
