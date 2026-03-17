import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../confect";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../lib/auth";
import {
  METERED_USAGE_ROLLBACK_ERROR_MESSAGE,
  PLANLESS_WORKSPACE_ERROR_MESSAGE,
} from "../lib/payments_catalog";
import {
  createAutumnClient,
  readWorkspacePlanStateForOrg,
  type WorkspacePlanState,
} from "../lib/payments_variants";
import type { ReserveFeatureUnitsResult } from "./types";

/**
 * Reserves metered feature units for the current authenticated organization.
 *
 * @param ctx The Convex internal action context.
 * @param args The expected org slug, feature identifier, units, and billing reason.
 * @returns The reserved unit count and any normalized billing error code.
 * @remarks This validates the active org and delegates the actual reservation to the org-scoped internal action.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const reserveFeatureUnitsForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    reservedUnits: v.number(),
    errorCode: v.union(
      v.literal("USAGE_LIMIT_EXCEEDED"),
      v.literal("BILLING_UNAVAILABLE"),
      v.null(),
    ),
  }),
  handler: async (ctx, args): Promise<ReserveFeatureUnitsResult> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    return await ctx.runAction(internal.payments.reserveFeatureUnitsForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
      featureId: args.featureId,
      units: args.units,
      reason: args.reason,
    });
  },
});

/**
 * Reserves metered feature units for an arbitrary organization.
 *
 * @param ctx The Convex internal action context.
 * @param args The organization identity, feature identifier, units, and billing reason.
 * @returns The reserved unit count and any normalized billing error code.
 * @remarks This reads the workspace plan, refreshes the billing snapshot, and emits the reservation event to Autumn.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const reserveFeatureUnitsForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    reservedUnits: v.number(),
    errorCode: v.union(
      v.literal("USAGE_LIMIT_EXCEEDED"),
      v.literal("BILLING_UNAVAILABLE"),
      v.null(),
    ),
  }),
  handler: async (ctx, args): Promise<ReserveFeatureUnitsResult> => {
    let planState: WorkspacePlanState;
    try {
      planState = await readWorkspacePlanStateForOrg(ctx, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === PLANLESS_WORKSPACE_ERROR_MESSAGE) {
        return {
          reservedUnits: 0,
          errorCode: "USAGE_LIMIT_EXCEEDED",
        };
      }
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE",
      };
    }

    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: args.orgId,
      currentTier: planState.currentTier,
    });

    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        reservedUnits: 0,
        errorCode: null,
      };
    }

    const autumn = createAutumnClient();
    const result = await autumn.check({
      customer_id: args.orgId,
      feature_id: args.featureId,
      required_balance: args.units,
      send_event: true,
    });

    if (result.error !== null || result.data === null) {
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE",
      };
    }
    if (!result.data.allowed) {
      return {
        reservedUnits: 0,
        errorCode: "USAGE_LIMIT_EXCEEDED",
      };
    }

    return {
      reservedUnits: args.units,
      errorCode: null,
    };
  },
});

/**
 * Compensates previously reserved metered feature units for the current authenticated organization.
 *
 * @param ctx The Convex internal action context.
 * @param args The expected org slug, feature identifier, units, and compensation reason.
 * @returns The compensated unit count.
 * @remarks This validates the active org and delegates to the org-scoped compensation action.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const compensateFeatureUnitsForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    compensatedUnits: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    compensatedUnits: number;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    return await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
      featureId: args.featureId,
      units: args.units,
      reason: args.reason,
    });
  },
});

/**
 * Compensates previously reserved metered feature units for an arbitrary organization.
 *
 * @param ctx The Convex internal action context.
 * @param args The organization identity, feature identifier, units, and compensation reason.
 * @returns The compensated unit count.
 * @remarks This emits a negative usage event to Autumn and throws when rollback fails.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const compensateFeatureUnitsForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    compensatedUnits: v.number(),
  }),
  handler: async (_ctx, args) => {
    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        compensatedUnits: 0,
      };
    }

    const autumn = createAutumnClient();
    const result = await autumn.track({
      customer_id: args.orgId,
      feature_id: args.featureId,
      value: -Math.abs(args.units),
      properties: {
        reason: args.reason,
      },
    });

    if (result.error !== null) {
      throw new Error(METERED_USAGE_ROLLBACK_ERROR_MESSAGE);
    }

    return {
      compensatedUnits: Math.abs(args.units),
    };
  },
});
