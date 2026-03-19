import { describe, expect, test } from "bun:test";

import { decodeApprovedDeviceCode } from "../../pkg/convex/cli_auth/device_code_poll/approval";

describe("decodeApprovedDeviceCode", () => {
  test("decodes complete approved device-code metadata", () => {
    expect(
      decodeApprovedDeviceCode({
        approvedByClerkUserId: "user_123",
        approvedOrgId: "org_123",
        approvedOrgSlug: "acme",
      } as any),
    ).toEqual({
      clerkUserId: "user_123",
      orgId: "org_123",
      orgSlug: "acme",
    });
  });

  test("returns null when approval metadata is incomplete", () => {
    expect(
      decodeApprovedDeviceCode({
        approvedByClerkUserId: "user_123",
        approvedOrgId: null,
        approvedOrgSlug: "acme",
      } as any),
    ).toBeNull();
  });
});
