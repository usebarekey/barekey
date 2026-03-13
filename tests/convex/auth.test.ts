import { describe, expect, test } from "bun:test";
import type { UserIdentity } from "convex/server";

import {
  assertExpectedOrgSlug,
  getActiveOrgClaimsOrNull,
  getActiveOrgIdClaimsOrNull,
  getOrgClaimsFromIdentity,
  requireActiveOrgClaims,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../../pkg/convex/lib/auth";

function makeIdentity(overrides: Record<string, unknown> = {}): UserIdentity {
  return {
    subject: "user_123",
    tokenIdentifier: "token_123",
    issuer: "https://clerk.example.com",
    ...overrides,
  } as UserIdentity;
}

describe("requireIdentity", () => {
  test("returns the authenticated identity", async () => {
    const identity = makeIdentity();

    const result = await requireIdentity({
      auth: {
        getUserIdentity: async () => identity,
      },
    });

    expect(result).toBe(identity);
  });

  test("throws when the request is unauthenticated", async () => {
    await expect(
      requireIdentity({
        auth: {
          getUserIdentity: async () => null,
        },
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("getOrgClaimsFromIdentity", () => {
  test("reads active organization claims from string fields", () => {
    expect(
      getOrgClaimsFromIdentity(
        makeIdentity({
          org_id: "org_123",
          org_slug: "acme",
          org_role: "admin",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
      orgRole: "admin",
    });
  });

  test("ignores non-string organization claims", () => {
    expect(
      getOrgClaimsFromIdentity(
        makeIdentity({
          org_id: 123,
          org_slug: { slug: "acme" },
          org_role: false,
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: null,
      orgSlug: null,
      orgRole: null,
    });
  });
});

describe("requireActiveOrgClaims", () => {
  test("returns active organization claims when org id and slug are present", () => {
    expect(
      requireActiveOrgClaims(
        makeIdentity({
          org_id: "org_123",
          org_slug: "acme",
          org_role: "member",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
      orgRole: "member",
    });
  });

  test("throws when the active organization id is missing", () => {
    expect(() =>
      requireActiveOrgClaims(
        makeIdentity({
          org_slug: "acme",
        }),
      ),
    ).toThrow("No active organization selected.");
  });

  test("throws when the active organization slug is missing", () => {
    expect(() =>
      requireActiveOrgClaims(
        makeIdentity({
          org_id: "org_123",
        }),
      ),
    ).toThrow("Active organization slug is missing.");
  });
});

describe("getActiveOrgClaimsOrNull", () => {
  test("returns active organization claims when both id and slug are present", () => {
    expect(
      getActiveOrgClaimsOrNull(
        makeIdentity({
          org_id: "org_123",
          org_slug: "acme",
          org_role: "member",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
      orgRole: "member",
    });
  });

  test("returns null when the active organization id is missing", () => {
    expect(
      getActiveOrgClaimsOrNull(
        makeIdentity({
          org_slug: "acme",
        }),
      ),
    ).toBeNull();
  });

  test("returns null when the active organization slug is missing", () => {
    expect(
      getActiveOrgClaimsOrNull(
        makeIdentity({
          org_id: "org_123",
        }),
      ),
    ).toBeNull();
  });
});

describe("requireActiveOrgIdClaims", () => {
  test("allows a missing slug as long as the organization id exists", () => {
    expect(
      requireActiveOrgIdClaims(
        makeIdentity({
          org_id: "org_123",
          org_role: "member",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: null,
      orgRole: "member",
    });
  });

  test("throws when the active organization id is missing", () => {
    expect(() => requireActiveOrgIdClaims(makeIdentity())).toThrow(
      "No active organization selected.",
    );
  });
});

describe("getActiveOrgIdClaimsOrNull", () => {
  test("returns claims when the organization id exists", () => {
    expect(
      getActiveOrgIdClaimsOrNull(
        makeIdentity({
          org_id: "org_123",
          org_slug: "acme",
          org_role: "member",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
      orgRole: "member",
    });
  });

  test("returns claims with a null slug when only the organization id exists", () => {
    expect(
      getActiveOrgIdClaimsOrNull(
        makeIdentity({
          org_id: "org_123",
        }),
      ),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: null,
      orgRole: null,
    });
  });

  test("returns null when the organization id is missing", () => {
    expect(getActiveOrgIdClaimsOrNull(makeIdentity())).toBeNull();
  });
});

describe("assertExpectedOrgSlug", () => {
  test("allows requests that do not specify an expected org slug", () => {
    expect(() =>
      assertExpectedOrgSlug(
        {
          orgSlug: "acme",
        },
        null,
      ),
    ).not.toThrow();
  });

  test("allows matching active and requested org slugs", () => {
    expect(() =>
      assertExpectedOrgSlug(
        {
          orgSlug: "acme",
        },
        "acme",
      ),
    ).not.toThrow();
  });

  test("throws when the requested workspace does not match the active org", () => {
    expect(() =>
      assertExpectedOrgSlug(
        {
          orgSlug: "acme",
        },
        "other-org",
      ),
    ).toThrow("Active organization does not match the requested workspace.");
  });
});
