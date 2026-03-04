import { Autumn } from "@useautumn/convex";

import { components } from "./_generated/api";

function readStringClaim(
  identity: Record<string, unknown>,
  claimName: string,
): string | null {
  const value = identity[claimName];
  return typeof value === "string" ? value : null;
}

export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
  identify: async (ctx: {
    auth: {
      getUserIdentity(): Promise<Record<string, unknown> | null>;
    };
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const orgId = readStringClaim(identity, "org_id");
    if (orgId === null) {
      return null;
    }

    const orgSlug = readStringClaim(identity, "org_slug");
    const email = readStringClaim(identity, "email");

    return {
      customerId: orgId,
      customerData: {
        name: orgSlug ?? orgId,
        email: email ?? undefined,
      },
    };
  },
});

export const {
  track,
  cancel,
  query,
  attach,
  check,
  checkout,
  usage,
  setupPayment,
  createCustomer,
  listProducts,
  billingPortal,
  createReferralCode,
  redeemReferralCode,
  createEntity,
  getEntity,
} = autumn.api();
