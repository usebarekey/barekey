import { Effect } from "effect";

import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import {
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
} from "../../variants";
import { toBillingPlanChangeError } from "./shared";

type BillingVariantSummary = {
  productId: string;
  tier: "free" | "pro" | "max";
};

/**
 * Reconciles the effective product and change outcome after an Autumn attach call.
 *
 * @param ctx The Convex action context.
 * @param args The attached product id and locally resolved pricing variants.
 * @returns An Effect that succeeds with the effective product id and normalized change outcome.
 * @remarks This refreshes the billing customer state after an attach completes without checkout.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function resolvePostAttachOutcomeEffect(
  ctx: ActionCtx,
  args: {
    currentProductId: string | null;
    productId: string;
    variants: ReadonlyArray<BillingVariantSummary>;
  },
): Effect.Effect<
  {
    effectiveProductId: string | null;
    changeOutcome: "applied" | "scheduled" | "submitted";
    effectiveTier: "free" | "pro" | "max" | null;
  },
  Error
> {
  return Effect.gen(function* () {
    let effectiveProductId: string | null = args.currentProductId;
    let changeOutcome: "applied" | "scheduled" | "submitted" = "submitted";
    const customerAfterAttachResult = yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(api.autumn.createCustomer, {
          errorOnNotFound: false,
        }),
      catch: (error) =>
        toBillingPlanChangeError("Failed to refresh the billing customer after attach.", error),
    });
    if (customerAfterAttachResult.error === null) {
      effectiveProductId = readCurrentProductId(customerAfterAttachResult.data);
      const allProducts = readCustomerProducts(customerAfterAttachResult.data);
      const targetStatus = allProducts.find((entry) => entry.id === args.productId)?.status ?? null;
      if (effectiveProductId === args.productId) {
        changeOutcome = "applied";
      } else if (targetStatus === "scheduled") {
        changeOutcome = "scheduled";
      }
    }

    const effectiveTier =
      args.variants.find((variant) => variant.productId === effectiveProductId)?.tier ??
      readCurrentVariantFromProductId(effectiveProductId)?.tier ??
      null;

    return {
      effectiveProductId,
      changeOutcome,
      effectiveTier,
    };
  });
}
