import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./confect";
import type { ActionCtx } from "./_generated/server";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "./lib/auth";
import {
  BillingTier,
  FeatureId,
  METERED_USAGE_ROLLBACK_ERROR_MESSAGE,
  PLANLESS_WORKSPACE_ERROR_MESSAGE,
  billingVariantValidator,
  scheduledPlanChangeValidator,
  type BillingIntervalValue,
  type BillingTierValue,
  type BillingVariant,
  type OverageModeValue,
  type ScheduledPlanChange,
} from "./lib/payments_catalog";
import {
  createAutumnClient,
  isBillingManagerRole,
  normalizeFiniteNumber,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  readDefaultVariantByProductId,
  readWorkspacePlanStateForOrg,
  resolvePricingVariants,
  type WorkspacePlanState,
} from "./lib/payments_variants";
import {
  computeEncryptedBytesForOrg,
  featureUsageValidator,
  freePlanCreditStateValidator,
  getCanonicalFreePlanCreditForClerkUserId,
  getCanonicalOrgStorageUsageRow,
  pickCanonicalRow,
  toDisabledFeatureUsage,
  toFreePlanCreditState,
  type ConsumeFreePlanCreditResult,
  type FeatureUsage,
  type FreePlanCreditState,
} from "./lib/payments_state";
import {
  changePlanForCurrentOrgHandler,
  openBillingPortalForCurrentOrgHandler,
  revokeCurrentUserFreePlanCreditHandler,
  revokeFreePlanCreditForCurrentOrgHandler,
} from "./lib/payments_management";

type BillingStateResponse = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: BillingTierValue | null;
  currentInterval: BillingIntervalValue | null;
  currentOverageMode: OverageModeValue | null;
  hasScheduledPlanChange: boolean;
  scheduledPlanChange: ScheduledPlanChange | null;
  usage: {
    staticRequests: FeatureUsage;
    dynamicRequests: FeatureUsage;
    storageBytes: FeatureUsage;
  };
  storageMirrorBytes: number;
  variants: Array<BillingVariant>;
};

type WorkspacePlanStatusResponse = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: BillingTierValue | null;
  currentInterval: BillingIntervalValue | null;
  currentOverageMode: OverageModeValue | null;
  isPlanless: boolean;
  billingUnavailable: boolean;
};

type ReserveFeatureUnitsResult = {
  reservedUnits: number;
  errorCode: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE" | null;
};

async function hasFreePlanCreditAssignedToOrg(
  ctx: ActionCtx,
  input: {
    orgId: string;
  },
): Promise<boolean> {
  const credit = await ctx.runQuery(internal.payments.getFreePlanCreditForOrgIdInternal, {
    orgId: input.orgId,
  });
  return credit !== null;
}

async function readFeatureUsage(ctx: ActionCtx, featureId: string): Promise<FeatureUsage> {
  const result = await ctx.runAction(api.autumn.check, {
    featureId,
  });

  if (result.error !== null || result.data === null) {
    return {
      featureId,
      allowed: false,
      usage: null,
      includedUsage: null,
      usageLimit: null,
      overageAllowed: null,
      nextResetAtMs: null,
    };
  }

  return {
    featureId,
    allowed: result.data.allowed,
    usage: normalizeFiniteNumber(result.data.usage),
    includedUsage: normalizeFiniteNumber(result.data.included_usage),
    usageLimit: normalizeFiniteNumber(result.data.usage_limit),
    overageAllowed:
      typeof result.data.overage_allowed === "boolean" ? result.data.overage_allowed : null,
    nextResetAtMs: normalizeFiniteNumber(result.data.next_reset_at),
  };
}

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

export const getOrgStorageUsageInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      encryptedBytes: v.number(),
      updatedAtMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return {
      encryptedBytes: row.encryptedBytes,
      updatedAtMs: row.updatedAtMs,
    };
  },
});

export const ensureOrgStorageUsageForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    initialized: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing !== null) {
      return {
        encryptedBytes: existing.encryptedBytes,
        initialized: false,
      };
    }
    const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
    const now = Date.now();
    await ctx.db.insert("orgStorageUsage", {
      orgId: args.orgId,
      encryptedBytes,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      encryptedBytes,
      initialized: true,
    };
  },
});

export const upsertOrgBillingSnapshotForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgBillingSnapshots")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .unique();
    const updatedAtMs = Date.now();

    if (existing === null) {
      await ctx.db.insert("orgBillingSnapshots", {
        orgId: args.orgId,
        currentTier: args.currentTier,
        updatedAtMs,
      });
      return null;
    }

    await ctx.db.patch(existing._id, {
      currentTier: args.currentTier,
      updatedAtMs,
    });
    return null;
  },
});

export const applyStorageDeltaForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    deltaBytes: v.number(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    updatedAtMs: v.number(),
  }),
  handler: async (ctx, args): Promise<{ encryptedBytes: number; updatedAtMs: number }> => {
    let existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing === null) {
      const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
      const now = Date.now();
      const rowId = await ctx.db.insert("orgStorageUsage", {
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      });
      existing = {
        _id: rowId,
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    const nextEncryptedBytes = Math.max(0, existing.encryptedBytes + args.deltaBytes);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    });

    return {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    };
  },
});

export const logBillingRequestInternal = internalMutation({
  args: {
    orgId: v.string(),
    requestKey: v.string(),
    featureId: v.string(),
    units: v.number(),
  },
  returns: v.object({
    inserted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    if (existing.length > 0) {
      return { inserted: false };
    }

    const rowId = await ctx.db.insert("billingRequestLog", {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: Date.now(),
    });
    const rows = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    const canonical = pickCanonicalRow(rows);
    if (canonical === null) {
      return { inserted: false };
    }
    if (canonical._id !== rowId) {
      await ctx.db.delete(rowId);
      return { inserted: false };
    }

    for (const row of rows) {
      if (row._id !== canonical._id) {
        await ctx.db.delete(row._id);
      }
    }
    return { inserted: true };
  },
});

export const getFreePlanCreditForClerkUserIdInternal = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});

export const getFreePlanCreditForOrgIdInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .first();
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});

export const ensureFreePlanCreditForClerkUserInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    consumeForOrgIfAvailable: v.boolean(),
  },
  returns: freePlanCreditStateValidator,
  handler: async (ctx, args): Promise<FreePlanCreditState> => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);
    let createdCredit = false;

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
      createdCredit = true;
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }
    const currentRow = row;
    const currentRowId = currentRow._id;

    if (
      args.consumeForOrgIfAvailable &&
      createdCredit &&
      args.orgId !== null &&
      currentRow.assignedOrgId === null &&
      currentRow.remainingCredits > 0
    ) {
      const existingOrgAssignments = await ctx.db
        .query("userFreePlanCredits")
        .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
        .collect();
      const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
        (entry) => entry._id !== currentRowId,
      );
      if (assignmentExistsForAnotherCredit) {
        return toFreePlanCreditState(currentRow);
      }

      const nextRemainingCredits = Math.max(0, currentRow.remainingCredits - 1);
      await ctx.db.patch(currentRow._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      };
    } else if (
      args.orgId !== null &&
      currentRow.assignedOrgId === args.orgId &&
      currentRow.assignedOrgSlug !== args.orgSlug
    ) {
      await ctx.db.patch(currentRow._id, {
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      };
    }

    return toFreePlanCreditState(row ?? currentRow);
  },
});

export const consumeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    granted: v.boolean(),
    reason: v.union(
      v.literal("granted"),
      v.literal("already_assigned"),
      v.literal("org_already_assigned"),
      v.literal("assigned_elsewhere"),
      v.literal("no_remaining_credits"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args): Promise<ConsumeFreePlanCreditResult> => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }

    if (row.assignedOrgId === args.orgId) {
      if (row.assignedOrgSlug !== args.orgSlug) {
        await ctx.db.patch(row._id, {
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        });
        row = {
          ...row,
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        };
      }
      return {
        granted: true,
        reason: "already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    const existingOrgAssignments = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
      (entry) => entry._id !== row._id,
    );
    if (assignmentExistsForAnotherCredit) {
      return {
        granted: false,
        reason: "org_already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== null && row.assignedOrgId !== args.orgId) {
      return {
        granted: false,
        reason: "assigned_elsewhere",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.remainingCredits <= 0) {
      return {
        granted: false,
        reason: "no_remaining_credits",
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.max(0, row.remainingCredits - 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    };
    return {
      granted: true,
      reason: "granted",
      credit: toFreePlanCreditState(patched),
    };
  },
});

export const revokeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    reason: v.union(
      v.literal("revoked"),
      v.literal("already_available"),
      v.literal("not_assigned_to_org"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId === null) {
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== args.orgId) {
      return {
        revoked: false,
        reason: "not_assigned_to_org" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    };
    return {
      revoked: true,
      reason: "revoked" as const,
      credit: toFreePlanCreditState(patched),
    };
  },
});

export const revokeFreePlanCreditByOrgIdInternal = internalMutation({
  args: {
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    credit: v.union(freePlanCreditStateValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    if (rows.length === 0) {
      return {
        revoked: false,
        credit: null,
      };
    }

    const patchedRows: Array<FreePlanCreditState> = [];
    for (const row of rows) {
      const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
      await ctx.db.patch(row._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: null,
        assignedOrgSlug: null,
        revokedAtMs: now,
        revokedReason: args.reason ?? "manual_revoke",
        updatedAtMs: now,
      });
      patchedRows.push(
        toFreePlanCreditState({
          ...row,
          remainingCredits: nextRemainingCredits,
          assignedOrgId: null,
          assignedOrgSlug: null,
          revokedAtMs: now,
          revokedReason: args.reason ?? "manual_revoke",
        }),
      );
    }

    return {
      revoked: true,
      credit: patchedRows[0] ?? null,
    };
  },
});

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
    currentTier: BillingTierValue | null;
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
    currentTier: BillingTierValue | null;
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

    const resultBundle = await Promise.all([
      resolvePricingVariants(ctx),
      ctx.runAction(api.autumn.createCustomer, {
        errorOnNotFound: false,
      }),
      readFeatureUsage(ctx, FeatureId.StaticRequests),
      readFeatureUsage(ctx, FeatureId.DynamicRequests),
      readFeatureUsage(ctx, FeatureId.StorageBytes),
    ]);
    const variants: Array<BillingVariant> = resultBundle[0];
    const customerResult = resultBundle[1];
    const staticUsage: FeatureUsage = resultBundle[2];
    const dynamicUsage: FeatureUsage = resultBundle[3];
    const storageUsage: FeatureUsage = resultBundle[4];

    const allProducts = readCustomerProducts(customerResult.data);
    const currentProductId = readCurrentProductId(customerResult.data);
    const hasScheduledPlanChange = allProducts.some(
      (entry) => entry.status === "scheduled" && entry.id !== currentProductId,
    );
    const scheduledProduct = allProducts.find(
      (entry) => entry.status === "scheduled" && entry.id !== currentProductId,
    );
    const scheduledVariantFromCatalog =
      variants.find((variant) => variant.productId === (scheduledProduct?.id ?? "")) ?? null;
    const scheduledVariantFromFallback = readCurrentVariantFromProductId(
      scheduledProduct?.id ?? null,
    );
    const scheduledDefaultVariant = readDefaultVariantByProductId(scheduledProduct?.id ?? null);
    const scheduledPlanChange: ScheduledPlanChange | null =
      scheduledProduct !== undefined && scheduledVariantFromFallback !== null
        ? {
            productId: scheduledProduct.id,
            tier: scheduledVariantFromCatalog?.tier ?? scheduledVariantFromFallback.tier,
            interval:
              scheduledVariantFromCatalog?.interval ?? scheduledVariantFromFallback.interval,
            overageMode:
              scheduledVariantFromCatalog?.overageMode ?? scheduledVariantFromFallback.overageMode,
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
    const effectiveStaticUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.StaticRequests,
        })
      : staticUsage;
    const effectiveDynamicUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.DynamicRequests,
        })
      : dynamicUsage;
    const effectiveStorageUsage = isWithoutPlan
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

export const changePlanForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
    interval: v.union(v.literal("monthly"), v.literal("annually")),
    overageMode: v.union(v.literal("without_overages"), v.literal("with_overages")),
    successUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    attachedProductId: v.string(),
    checkoutRequired: v.boolean(),
    checkoutUrl: v.union(v.string(), v.null()),
    changeOutcome: v.union(v.literal("applied"), v.literal("scheduled"), v.literal("submitted")),
    effectiveProductId: v.union(v.string(), v.null()),
  }),
  handler: changePlanForCurrentOrgHandler,
});

export const revokeFreePlanCreditForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: revokeFreePlanCreditForCurrentOrgHandler,
});

export const revokeCurrentUserFreePlanCredit = action({
  args: {
    expectedAssignedOrgId: v.union(v.string(), v.null()),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    reason: v.union(v.literal("revoked"), v.literal("already_available"), v.literal("mismatch")),
    previousAssignedOrgId: v.union(v.string(), v.null()),
    previousAssignedOrgSlug: v.union(v.string(), v.null()),
  }),
  handler: revokeCurrentUserFreePlanCreditHandler,
});

export const openBillingPortalForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    returnUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    portalUrl: v.string(),
  }),
  handler: openBillingPortalForCurrentOrgHandler,
});
