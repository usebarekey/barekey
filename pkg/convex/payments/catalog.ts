import { v } from "convex/values";

import { action } from "../confect";
import {
  billingVariantValidator,
  FeatureId,
} from "../lib/payments_catalog";
import { resolvePricingVariants } from "../lib/payments_variants";

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
export const getPricingCatalogPublic = action({
  args: {},
  returns: v.object({
    variants: v.array(billingVariantValidator),
    featureIds: v.object({
      staticRequests: v.string(),
      dynamicRequests: v.string(),
      storageBytes: v.string(),
    }),
  }),
  handler: async (ctx) => {
    const variants = await resolvePricingVariants(ctx);
    return {
      variants,
      featureIds: {
        staticRequests: FeatureId.StaticRequests,
        dynamicRequests: FeatureId.DynamicRequests,
        storageBytes: FeatureId.StorageBytes,
      },
    };
  },
});
