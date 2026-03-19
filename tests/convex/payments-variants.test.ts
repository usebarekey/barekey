import { describe, expect, test } from "bun:test";

describe("hasForceCheckoutUpgradeDowngradeError", () => {
  async function loadSubject() {
    process.env.BAREKEY_MASTER_KEY_B64 ||= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    return await import("../../pkg/convex/lib/payments/variants");
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

describe("Autumn billing decoders", () => {
  async function loadSubject() {
    process.env.BAREKEY_MASTER_KEY_B64 ||= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    return await import("../../pkg/convex/lib/payments/variants");
  }

  test("keeps valid products when the Autumn list includes malformed entries", async () => {
    const { decodeAutumnProductList } = await loadSubject();

    expect(
      decodeAutumnProductList({
        list: [
          {
            id: "pro_monthly_overage",
            items: [
              {
                price: 9.99,
                billing_units: 1_000,
                feature_id: "static_requests",
                included_usage: 1_000_000,
              },
            ],
          },
          {
            id: 42,
            items: [],
          },
        ],
      }),
    ).toEqual([
      {
        id: "pro_monthly_overage",
        items: [
          {
            price: 9.99,
            billing_units: 1_000,
            feature_id: "static_requests",
            included_usage: 1_000_000,
          },
        ],
      },
    ]);
  });

  test("decodes customer products and ignores malformed rows", async () => {
    const { decodeAutumnCustomerProducts } = await loadSubject();

    expect(
      decodeAutumnCustomerProducts({
        products: [
          {
            product_id: "pro_monthly_overage",
            status: "active",
          },
          {
            id: "bad_missing_status",
          },
          42,
        ],
      }),
    ).toEqual([
      {
        id: "pro_monthly_overage",
        status: "active",
      },
    ]);
  });

  test("decodes portal and checkout urls from Autumn payloads", async () => {
    const { decodeAutumnCheckoutUrl, decodeAutumnPortalUrl } = await loadSubject();

    expect(
      decodeAutumnPortalUrl({
        portal_url: "https://billing.example.com/portal",
      }),
    ).toBe("https://billing.example.com/portal");
    expect(
      decodeAutumnCheckoutUrl({
        checkout_url: "https://billing.example.com/checkout",
      }),
    ).toBe("https://billing.example.com/checkout");
  });

  test("decodes feature usage and rejects malformed payloads", async () => {
    const { decodeAutumnFeatureUsage } = await loadSubject();

    expect(
      decodeAutumnFeatureUsage({
        featureId: "dynamic_requests",
        data: {
          allowed: true,
          usage: 12,
          included_usage: 100,
          usage_limit: 200,
          overage_allowed: true,
          next_reset_at: 1234,
        },
      }),
    ).toEqual({
      featureId: "dynamic_requests",
      allowed: true,
      usage: 12,
      includedUsage: 100,
      usageLimit: 200,
      overageAllowed: true,
      nextResetAtMs: 1234,
    });

    expect(
      decodeAutumnFeatureUsage({
        featureId: "dynamic_requests",
        data: {
          allowed: "yes",
        },
      }),
    ).toBeNull();
  });

  test("reads stable Autumn error messages from strings, errors, and payload objects", async () => {
    const { readAutumnErrorMessage } = await loadSubject();

    expect(readAutumnErrorMessage("upgrade required")).toBe("upgrade required");
    expect(readAutumnErrorMessage(new Error("plan mismatch"))).toBe("plan mismatch");
    expect(
      readAutumnErrorMessage({
        error: "force_checkout is required for upgrade and downgrade requests",
      }),
    ).toBe("force_checkout is required for upgrade and downgrade requests");
  });
});
