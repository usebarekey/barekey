import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { action } from "../confect";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../lib/auth";
import {
  BillingTier,
  FeatureId,
  billingVariantValidator,
  scheduledPlanChangeValidator,
  type BillingVariant,
  type ScheduledPlanChange,
} from "../lib/payments_catalog";
import {
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  readDefaultVariantByProductId,
  resolvePricingVariants,
} from "../lib/payments_variants";
import { featureUsageValidator, toDisabledFeatureUsage, type FeatureUsage } from "../lib/payments_state";
import { hasFreePlanCreditAssignedToOrg, readFeatureUsage } from "./helpers";
import type { BillingStateResponse } from "./types";

/**
 * Reads the full billing state for the current authenticated organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected organization slug.
 * @returns The billing catalog, plan status, scheduled change, and normalized feature usage for the active organization.
 * @remarks This may initialize the storage usage mirror and synchronize it to Autumn when the mirror is first created.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getBillingStateForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    orgRole: v.union(v.string(), v.null()),
    canManageBilling: v.boolean(),
    currentProductId: v.union(v.string(), v.null()),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
    currentInterval: v.union(v.literal("monthly"), v.literal("annually"), v.null()),
    currentOverageMode: v.union(
      v.literal("without_overages"),
      v.literal("with_overages"),
      v.null(),
    ),
    hasScheduledPlanChange: v.boolean(),
    scheduledPlanChange: v.union(scheduledPlanChangeValidator, v.null()),
    usage: v.object({
      staticRequests: featureUsageValidator,
      dynamicRequests: featureUsageValidator,
      storageBytes: featureUsageValidator,
    }),
    storageMirrorBytes: v.number(),
    variants: v.array(billingVariantValidator),
  }),
  handler: async (ctx, args): Promise<BillingStateResponse> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const ensuredStorage = await ctx.runMutation(
      internal.payments.ensureOrgStorageUsageForOrgInternal,
      {
        orgId: activeOrg.orgId,
      },
    );
    if (ensuredStorage.initialized) {
      const syncStorageUsageResult = await ctx.runAction(api.autumn.usage, {
        featureId: FeatureId.StorageBytes,
        value: ensuredStorage.encryptedBytes,
      });
      if (syncStorageUsageResult.error !== null) {
        console.error("Failed to sync initial storage usage to Autumn.", {
          orgId: activeOrg.orgId,
          error: syncStorageUsageResult.error,
        });
      }
    }

    const [variants, customerResult, staticUsage, dynamicUsage, storageUsage] = await Promise.all([
      resolvePricingVariants(ctx),
      ctx.runAction(api.autumn.createCustomer, {
        errorOnNotFound: false,
      }),
      readFeatureUsage(ctx, FeatureId.StaticRequests),
      readFeatureUsage(ctx, FeatureId.DynamicRequests),
      readFeatureUsage(ctx, FeatureId.StorageBytes),
    ]);

    const allProducts = readCustomerProducts(customerResult.data);
    const currentProductId = readCurrentProductId(customerResult.data);
    const hasScheduledPlanChange = allProducts.some(
      (entry) => entry.status === "scheduled" && entry.id !== currentProductId,
    );
    const scheduledProduct =
      allProducts.find((entry) => entry.status === "scheduled" && entry.id !== currentProductId) ??
      null;
    const scheduledVariantFromCatalog =
      variants.find((variant) => variant.productId === (scheduledProduct?.id ?? "")) ?? null;
    const scheduledVariantFromFallback = readCurrentVariantFromProductId(
      scheduledProduct?.id ?? null,
    );
    const scheduledDefaultVariant = readDefaultVariantByProductId(scheduledProduct?.id ?? null);
    const scheduledPlanChange: ScheduledPlanChange | null =
      scheduledProduct !== null && scheduledVariantFromFallback !== null
        ? {
            productId: scheduledProduct.id,
            tier: scheduledVariantFromCatalog?.tier ?? scheduledVariantFromFallback.tier,
            interval:
              scheduledVariantFromCatalog?.interval ?? scheduledVariantFromFallback.interval,
            overageMode:
              scheduledVariantFromCatalog?.overageMode ??
              scheduledVariantFromFallback.overageMode,
            monthlyPriceUsd:
              scheduledVariantFromCatalog?.monthlyPriceUsd ??
              scheduledDefaultVariant?.monthlyPriceUsd ??
              0,
          }
        : null;
    const currentVariantFromCatalog: BillingVariant | null =
      variants.find((variant) => variant.productId === currentProductId) ?? null;
    const currentVariantFromFallback = readCurrentVariantFromProductId(currentProductId);
    const currentTier = currentVariantFromCatalog?.tier ?? currentVariantFromFallback?.tier ?? null;
    const hasAssignedFreePlanCredit =
      currentTier === BillingTier.Free
        ? await hasFreePlanCreditAssignedToOrg(ctx, {
            orgId: activeOrg.orgId,
          })
        : false;
    const isWithoutPlan =
      currentProductId === null || (currentTier === BillingTier.Free && !hasAssignedFreePlanCredit);
    const effectiveStaticUsage: FeatureUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.StaticRequests,
        })
      : staticUsage;
    const effectiveDynamicUsage: FeatureUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.DynamicRequests,
        })
      : dynamicUsage;
    const effectiveStorageUsage: FeatureUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.StorageBytes,
        })
      : storageUsage;

    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: activeOrg.orgId,
      currentTier: isWithoutPlan ? null : currentTier,
    });

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      canManageBilling: isBillingManagerRole(activeOrg.orgRole),
      currentProductId: isWithoutPlan ? null : currentProductId,
      currentTier: isWithoutPlan ? null : currentTier,
      currentInterval: isWithoutPlan
        ? null
        : (currentVariantFromCatalog?.interval ?? currentVariantFromFallback?.interval ?? null),
      currentOverageMode: isWithoutPlan
        ? null
        : (currentVariantFromCatalog?.overageMode ??
          currentVariantFromFallback?.overageMode ??
          null),
      hasScheduledPlanChange,
      scheduledPlanChange,
      usage: {
        staticRequests: effectiveStaticUsage,
        dynamicRequests: effectiveDynamicUsage,
        storageBytes: effectiveStorageUsage,
      },
      storageMirrorBytes: ensuredStorage.encryptedBytes,
      variants,
    };
  },
});
