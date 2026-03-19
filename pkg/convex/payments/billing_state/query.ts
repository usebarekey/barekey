import { Effect } from "effect";
import { v } from "convex/values";

import { api } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectAction } from "../../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../../lib/auth";
import {
  BillingTier,
  FeatureId,
  billingVariantValidator,
  scheduledPlanChangeValidator,
} from "../../lib/payments/catalog";
import {
  readCurrentVariantFromProductId,
  resolvePricingVariants,
} from "../../lib/payments/variants";
import { featureUsageValidator } from "../../lib/payments/state";
import { hasFreePlanCreditAssignedToOrg, readFeatureUsage } from "../helpers";
import { upsertOrgBillingSnapshotForOrgInternalReference } from "../refs";
import type { BillingStateResponse } from "../types";
import {
  buildBillingStateResponse,
  readEffectiveBillingUsage,
  readScheduledBillingPlanState,
} from "./state";
import { ensureBillingStateStorageMirror } from "./storage";
import {
  type BillingStateBoundaryError,
  type GetBillingStateForCurrentOrgArgs,
  toBillingStateError,
} from "./shared";

/**
 * Reads the full billing state for the current authenticated organization.
 *
 * @param runtimeCtx The Convex action context.
 * @param args The expected organization slug.
 * @returns The billing catalog, plan status, scheduled change, and normalized feature usage for the active organization.
 * @remarks This may initialize the storage usage mirror and synchronize it to Autumn when the mirror is first created.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
async function getBillingStateForCurrentOrgHandler(
  runtimeCtx: ActionCtx,
  args: GetBillingStateForCurrentOrgArgs,
): Promise<BillingStateResponse> {
  const identity = await requireIdentity(runtimeCtx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
  }

  const ensuredStorage = await ensureBillingStateStorageMirror(runtimeCtx, activeOrg.orgId);

  const [variants, customerResult, staticUsage, dynamicUsage, storageUsage] = await Promise.all([
    resolvePricingVariants(runtimeCtx),
    runtimeCtx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    }),
    readFeatureUsage(runtimeCtx, FeatureId.StaticRequests),
    readFeatureUsage(runtimeCtx, FeatureId.DynamicRequests),
    readFeatureUsage(runtimeCtx, FeatureId.StorageBytes),
  ]);

  const scheduledPlanState = readScheduledBillingPlanState(variants, customerResult.data);
  const currentVariantFromCatalog =
    variants.find((variant) => variant.productId === scheduledPlanState.currentProductId) ?? null;
  const currentVariantFromFallback = readCurrentVariantFromProductId(
    scheduledPlanState.currentProductId,
  );
  const currentTier = currentVariantFromCatalog?.tier ?? currentVariantFromFallback?.tier ?? null;
  const hasAssignedFreePlanCredit =
    currentTier === BillingTier.Free
      ? await hasFreePlanCreditAssignedToOrg(runtimeCtx, {
          orgId: activeOrg.orgId,
        })
      : false;

  const effectiveUsage = readEffectiveBillingUsage({
    currentTier,
    hasAssignedFreePlanCredit,
    staticUsage,
    dynamicUsage,
    storageUsage,
    currentProductId: scheduledPlanState.currentProductId,
  });

  await runtimeCtx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
    orgId: activeOrg.orgId,
    currentTier: effectiveUsage.isWithoutPlan ? null : currentTier,
  });

  return buildBillingStateResponse({
    orgId: activeOrg.orgId,
    orgRole: activeOrg.orgRole,
    currentProductId: scheduledPlanState.currentProductId,
    currentTier,
    currentInterval: currentVariantFromCatalog?.interval ?? currentVariantFromFallback?.interval ?? null,
    currentOverageMode:
      currentVariantFromCatalog?.overageMode ?? currentVariantFromFallback?.overageMode ?? null,
    hasScheduledPlanChange: scheduledPlanState.hasScheduledPlanChange,
    scheduledPlanChange: scheduledPlanState.scheduledPlanChange,
    usage: effectiveUsage.usage,
    storageMirrorBytes: ensuredStorage.encryptedBytes,
    variants,
    isWithoutPlan: effectiveUsage.isWithoutPlan,
  });
}

/**
 * Reads the full billing state for the current authenticated organization.
 *
 * @param args The expected organization slug.
 * @returns The billing catalog, plan status, scheduled change, and normalized feature usage for the active organization.
 * @remarks This public action delegates to the Effect-native billing-state program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const getBillingStateForCurrentOrg = effectAction<
  GetBillingStateForCurrentOrgArgs,
  BillingStateResponse,
  any
>({
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
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
      return yield* Effect.tryPromise({
        try: () => getBillingStateForCurrentOrgHandler(runtimeCtx, args),
        catch: (error): BillingStateBoundaryError => toBillingStateError(error),
      });
    }),
});
