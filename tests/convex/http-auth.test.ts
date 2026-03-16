import { describe, expect, test } from "bun:test";
import type { UserIdentity } from "convex/server";

import { resolveAuthContext } from "../../pkg/convex/lib/http_auth";

function makeIdentity(overrides: Record<string, unknown> = {}): UserIdentity {
  return {
    subject: "user_123",
    tokenIdentifier: "token_123",
    issuer: "https://clerk.example.com",
    ...overrides,
  } as UserIdentity;
}

describe("resolveAuthContext", () => {
  test("normalizes requested org slug for Clerk identities", async () => {
    const result = await resolveAuthContext(
      {
        auth: {
          getUserIdentity: async () =>
            makeIdentity({
              org_id: "org_123",
              org_slug: "acme",
            }),
        },
        runAction: async () => null,
        runMutation: async () => null,
      },
      new Request("https://api.example.test/v1/env/get"),
      "  acme  ",
    );

    expect(result).toEqual({
      ok: true,
      context: {
        clerkUserId: "user_123",
        orgId: "org_123",
        orgSlug: "acme",
        source: "clerk",
      },
    });
  });

  test("propagates identity lookup failures", async () => {
    await expect(
      resolveAuthContext(
        {
          auth: {
            getUserIdentity: async () => {
              throw new Error("Clerk unavailable");
            },
          },
          runAction: async () => null,
          runMutation: async () => null,
        },
        new Request("https://api.example.test/v1/env/get"),
      ),
    ).rejects.toThrow("Clerk unavailable");
  });
});
