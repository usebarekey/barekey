import { describe, expect, test } from "bun:test";
import type { UserIdentity } from "convex/server";
import { Effect } from "effect";

import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgClaimsEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../pkg/convex/lib/auth";

function makeIdentity(overrides: Record<string, unknown> = {}): UserIdentity {
  return {
    subject: "user_123",
    tokenIdentifier: "token_123",
    issuer: "https://clerk.example.com",
    ...overrides,
  } as UserIdentity;
}

describe("requireIdentityEffect", () => {
  test("returns the authenticated identity", async () => {
    const identity = makeIdentity();

    const result = await Effect.runPromise(
      requireIdentityEffect({
        auth: {
          getUserIdentity: async () => identity,
        },
      }),
    );

    expect(result).toBe(identity);
  });

  test("fails with AuthError when the request is unauthenticated", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          requireIdentityEffect({
            auth: {
              getUserIdentity: async () => null,
            },
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthError",
        message: "Unauthorized",
      },
    });
  });
});

describe("requireActiveOrgClaimsEffect", () => {
  test("returns active organization claims when org id and slug are present", async () => {
    await expect(
      Effect.runPromise(
        requireActiveOrgClaimsEffect(
          makeIdentity({
            org_id: "org_123",
            org_slug: "acme",
            org_role: "member",
          }),
        ),
      ),
    ).resolves.toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
      orgRole: "member",
    });
  });

  test("fails when the active organization slug is missing", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          requireActiveOrgClaimsEffect(
            makeIdentity({
              org_id: "org_123",
            }),
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthError",
        message: "Active organization slug is missing.",
      },
    });
  });
});

describe("requireActiveOrgIdClaimsEffect", () => {
  test("allows a missing slug as long as the organization id exists", async () => {
    await expect(
      Effect.runPromise(
        requireActiveOrgIdClaimsEffect(
          makeIdentity({
            org_id: "org_123",
            org_role: "member",
          }),
        ),
      ),
    ).resolves.toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: null,
      orgRole: "member",
    });
  });
});

describe("assertExpectedOrgSlugEffect", () => {
  test("succeeds when no workspace slug is required", async () => {
    await expect(
      Effect.runPromise(
        assertExpectedOrgSlugEffect(
          {
            orgSlug: "acme",
          },
          null,
        ),
      ),
    ).resolves.toBeUndefined();
  });

  test("fails when the requested workspace does not match the active org", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          assertExpectedOrgSlugEffect(
            {
              orgSlug: "acme",
            },
            "other-org",
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "AuthError",
        message: "Active organization does not match the requested workspace.",
      },
    });
  });
});
