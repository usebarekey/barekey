import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../_generated/server";
import { BarekeyConfectActionCtx, effectAction } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  billingVariantValidator,
  FeatureId,
} from "../lib/payments/catalog";
import { resolvePricingVariants } from "../lib/payments/variants";

/**
 * Returns the public pricing catalog and the canonical feature identifiers used
 * by the product.
 *
 * @param ctx The Convex action context.
 * @returns The pricing variants and canonical metered feature identifiers.
 * @remarks This is public read-only billing metadata and does not require workspace auth.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
type PricingCatalogResponse = {
  variants: Awaited<ReturnType<typeof resolvePricingVariants>>;
  featureIds: {
    staticRequests: string;
    dynamicRequests: string;
    storageBytes: string;
  };
};

/**
 * Reads the public pricing catalog as an Effect program.
 *
 * @returns An Effect that succeeds with the pricing variants and canonical feature ids.
 * @remarks This preserves the public billing catalog contract while moving the boundary onto Confect/Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function getPricingCatalogPublicEffect(): Effect.Effect<PricingCatalogResponse, ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const variants = yield* Effect.tryPromise({
      try: () => resolvePricingVariants(ctx),
      catch: (error) =>
        new ExternalServiceError({
          message: error instanceof Error ? error.message : "Failed to load pricing variants.",
          cause: error,
        }),
    });
    return {
      variants,
      featureIds: {
        staticRequests: FeatureId.StaticRequests,
        dynamicRequests: FeatureId.DynamicRequests,
        storageBytes: FeatureId.StorageBytes,
      },
    };
  });
}

export const getPricingCatalogPublic = effectAction<{}, PricingCatalogResponse, any>({
  args: {},
  returns: v.object({
    variants: v.array(billingVariantValidator),
    featureIds: v.object({
      staticRequests: v.string(),
      dynamicRequests: v.string(),
      storageBytes: v.string(),
    }),
  }),
  handler: () => getPricingCatalogPublicEffect(),
});
