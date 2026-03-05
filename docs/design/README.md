# Barekey Design Docs

This directory contains design docs for Barekey's architecture and roadmap.

## Docs

- [001-platform-architecture.md](./001-platform-architecture.md)
- [002-auth-and-org-claims.md](./002-auth-and-org-claims.md)
- [003-vault-encryption-and-key-lifecycle.md](./003-vault-encryption-and-key-lifecycle.md)
- [004-http-sdk-api-plan.md](./004-http-sdk-api-plan.md)
- [005-operability-and-release-process.md](./005-operability-and-release-process.md)
- [006-dynamic-decision-engine.md](./006-dynamic-decision-engine.md)
- [007-sdk-rpd.md](./007-sdk-rpd.md)
- [008-ui-simplification-plan.md](./008-ui-simplification-plan.md)

## How to use these docs

- Read `001` first for system context.
- Read `002` and `003` before changing auth, org scoping, or encryption logic.
- Read `004` before implementing SDK/CLI HTTP endpoints.
- Read `005` before changing deployment, review, or autonomous workflows.
- Read `006` before implementing bucketing, A/B, or rollout behavior.
- Read `007` before implementing SDK API, typegen, or client caching behavior.
- Read `008` before rewriting product copy, information hierarchy, or dashboard surfaces.

## Status legend

- `Current`: already implemented in this repository.
- `Target`: intended design for near-term implementation.

## Naming note

- Generated org/user/project slugs use `slug-numbers` format (example: `myorg-5831`).
