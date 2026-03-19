import type { BillingStateResponse } from "../types";
import {
  BillingTier,
  type BillingTierValue,
  type BillingVariant,
  type ScheduledPlanChange,
} from "../../lib/payments/catalog";
import {
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  readDefaultVariantByProductId,
} from "../../lib/payments/variants";
import {
  toDisabledFeatureUsage,
  type FeatureUsage,
} from "../../lib/payments/state";

/**
 * Derives the scheduled plan change summary from current customer products and resolved variants.
 *
 * @param variants The resolved billing variants.
 * @param customerData The raw Autumn customer payload.
 * @returns The scheduled plan-change summary plus the product list state used elsewhere in billing-state assembly.
 * @remarks This keeps scheduled-plan fallback behavior in one place for both live and baked-in pricing data.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readScheduledBillingPlanState(
  variants: Array<BillingVariant>,
  customerData: unknown,
): {
  allProducts: Array<{ id: string; status: string }>;
  currentProductId: string | null;
  hasScheduledPlanChange: boolean;
  scheduledPlanChange: ScheduledPlanChange | null;
} {
  const allProducts = readCustomerProducts(customerData);
  const currentProductId = readCurrentProductId(customerData);
  const scheduledProduct =
    allProducts.find((entry) => entry.status === "scheduled" && entry.id !== currentProductId) ??
    null;
  const hasScheduledPlanChange = scheduledProduct !== null;
  const scheduledVariantFromCatalog =
    variants.find((variant) => variant.productId === (scheduledProduct?.id ?? "")) ?? null;
  const scheduledVariantFromFallback = readCurrentVariantFromProductId(scheduledProduct?.id ?? null);
  const scheduledDefaultVariant = readDefaultVariantByProductId(scheduledProduct?.id ?? null);

  return {
    allProducts,
    currentProductId,
    hasScheduledPlanChange,
    scheduledPlanChange:
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
        : null,
  };
}

/**
 * Normalizes current feature usage based on whether the organization effectively has no active plan.
 *
 * @param input The current-tier and usage context.
 * @returns The effective current tier, planless flag, and normalized feature-usage bundle.
 * @remarks Free-tier organizations without an assigned free-plan credit are treated as planless here.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readEffectiveBillingUsage(input: {
  currentTier: BillingTierValue | null;
  hasAssignedFreePlanCredit: boolean;
  staticUsage: FeatureUsage;
  dynamicUsage: FeatureUsage;
  storageUsage: FeatureUsage;
  currentProductId: string | null;
}) {
  const isWithoutPlan =
    input.currentProductId === null ||
    (input.currentTier === BillingTier.Free && !input.hasAssignedFreePlanCredit);

  return {
    isWithoutPlan,
    usage: {
      staticRequests: isWithoutPlan
        ? toDisabledFeatureUsage({ featureId: input.staticUsage.featureId })
        : input.staticUsage,
      dynamicRequests: isWithoutPlan
        ? toDisabledFeatureUsage({ featureId: input.dynamicUsage.featureId })
        : input.dynamicUsage,
      storageBytes: isWithoutPlan
        ? toDisabledFeatureUsage({ featureId: input.storageUsage.featureId })
        : input.storageUsage,
    },
  };
}

/**
 * Assembles the full billing-state response for the current organization.
 *
 * @param input The resolved billing, usage, and organization context.
 * @returns The workspace billing-state payload returned to the UI.
 * @remarks This is the final shape-normalization step for billing-state reads.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildBillingStateResponse(input: {
  orgId: string;
  orgRole: string | null;
  currentProductId: string | null;
  currentTier: BillingTierValue | null;
  currentInterval: BillingStateResponse["currentInterval"];
  currentOverageMode: BillingStateResponse["currentOverageMode"];
  hasScheduledPlanChange: boolean;
  scheduledPlanChange: ScheduledPlanChange | null;
  usage: BillingStateResponse["usage"];
  storageMirrorBytes: number;
  variants: Array<BillingVariant>;
  isWithoutPlan: boolean;
}): BillingStateResponse {
  return {
    orgId: input.orgId,
    orgRole: input.orgRole,
    canManageBilling: isBillingManagerRole(input.orgRole),
    currentProductId: input.isWithoutPlan ? null : input.currentProductId,
    currentTier: input.isWithoutPlan ? null : input.currentTier,
    currentInterval: input.isWithoutPlan ? null : input.currentInterval,
    currentOverageMode: input.isWithoutPlan ? null : input.currentOverageMode,
    hasScheduledPlanChange: input.hasScheduledPlanChange,
    scheduledPlanChange: input.scheduledPlanChange,
    usage: input.usage,
    storageMirrorBytes: input.storageMirrorBytes,
    variants: input.variants,
  };
}
