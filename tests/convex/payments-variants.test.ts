import { describe, expect, test } from "bun:test";

describe("hasForceCheckoutUpgradeDowngradeError", () => {
  async function loadSubject() {
    process.env.BAREKEY_MASTER_KEY_B64 ||= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    return await import("../../pkg/convex/lib/payments_variants");
  }

  test("returns false for undefined values", async () => {
    const { hasForceCheckoutUpgradeDowngradeError } = await loadSubject();
    expect(hasForceCheckoutUpgradeDowngradeError(undefined)).toBe(false);
  });

  test("matches normalized force checkout upgrade downgrade errors", async () => {
    const { hasForceCheckoutUpgradeDowngradeError } = await loadSubject();
    expect(
      hasForceCheckoutUpgradeDowngradeError(
        new Error("force_checkout is required for upgrade and downgrade requests"),
      ),
    ).toBe(true);
  });
});
