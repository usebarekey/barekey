import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import { action, internalAction } from "../confect";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../lib/auth";
import { BillingTier } from "../lib/payments_catalog";
import {
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readWorkspacePlanStateForOrg,
} from "../lib/payments_variants";
import { hasFreePlanCreditAssignedToOrg } from "./helpers";
import type { WorkspacePlanStatusResponse } from "./types";

/**
 * Reads the workspace plan status for the current authenticated organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected organization slug.
 * @returns The current workspace billing status used by onboarding and projects screens.
 * @remarks This refreshes the billing snapshot row for the active organization.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getWorkspacePlanStatusForCurrentOrg = action({
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
    isPlanless: v.boolean(),
    billingUnavailable: v.boolean(),
  }),
  handler: async (ctx, args): Promise<WorkspacePlanStatusResponse> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const customerResult = await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });
    if (customerResult.error !== null) {
      return {
        orgId: activeOrg.orgId,
        orgRole: activeOrg.orgRole,
        canManageBilling: isBillingManagerRole(activeOrg.orgRole),
        currentProductId: null,
        currentTier: null,
        currentInterval: null,
        currentOverageMode: null,
        isPlanless: false,
        billingUnavailable: true,
      };
    }

    const currentProductId = readCurrentProductId(customerResult.data);
    const currentVariant = readCurrentVariantFromProductId(currentProductId);
    const hasAssignedFreePlanCredit =
      currentVariant?.tier === BillingTier.Free
        ? await hasFreePlanCreditAssignedToOrg(ctx, {
            orgId: activeOrg.orgId,
          })
        : false;
    const isWithoutPlan =
      currentProductId === null ||
      (currentVariant?.tier === BillingTier.Free && !hasAssignedFreePlanCredit);

    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: activeOrg.orgId,
      currentTier: isWithoutPlan ? null : (currentVariant?.tier ?? null),
    });

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      canManageBilling: isBillingManagerRole(activeOrg.orgRole),
      currentProductId: isWithoutPlan ? null : currentProductId,
      currentTier: isWithoutPlan ? null : (currentVariant?.tier ?? null),
      currentInterval: isWithoutPlan ? null : (currentVariant?.interval ?? null),
      currentOverageMode: isWithoutPlan ? null : (currentVariant?.overageMode ?? null),
      isPlanless: isWithoutPlan,
      billingUnavailable: false,
    };
  },
});

/**
 * Asserts that the current authenticated organization has an active workspace plan.
 *
 * @param ctx The Convex internal action context.
 * @param args The expected organization slug.
 * @returns The organization identifier plus the resolved current billing product and tier.
 * @remarks This delegates to the org-scoped assertion after validating the active organization.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const assertWorkspacePlanForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    currentProductId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    orgId: string;
    currentProductId: string;
    currentTier: "free" | "pro" | "max" | null;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const planState = await ctx.runAction(internal.payments.assertWorkspacePlanForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
    });
    return {
      orgId: activeOrg.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  },
});

/**
 * Asserts that the provided organization has an active workspace plan.
 *
 * @param ctx The Convex internal action context.
 * @param args The organization identifier and optional slug.
 * @returns The organization identifier plus the resolved current billing product and tier.
 * @remarks This refreshes the billing snapshot row after successfully resolving the current plan.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const assertWorkspacePlanForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    orgId: v.string(),
    currentProductId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    orgId: string;
    currentProductId: string;
    currentTier: "free" | "pro" | "max" | null;
  }> => {
    const planState = await readWorkspacePlanStateForOrg(ctx, {
      orgId: args.orgId,
      orgSlug: args.orgSlug,
    });
    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: args.orgId,
      currentTier: planState.currentTier,
    });
    return {
      orgId: args.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  },
});
