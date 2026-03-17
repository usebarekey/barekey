import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { normalizeFiniteNumber } from "../lib/payments_variants";
import type { FeatureUsage } from "../lib/payments_state";

/**
 * Checks whether a free-plan credit is already assigned to the given organization.
 *
 * @param ctx The Convex action context.
 * @param input The organization identifier to inspect.
 * @returns `true` when a free-plan credit is assigned to the organization.
 * @remarks This is used when determining whether a free-tier workspace should count as planless.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function hasFreePlanCreditAssignedToOrg(
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

/**
 * Reads current feature usage from Autumn, normalizing missing or failed
 * responses into a disabled usage payload.
 *
 * @param ctx The Convex action context.
 * @param featureId The feature identifier to inspect.
 * @returns The normalized feature usage payload.
 * @remarks This always resolves a shape the UI can render, even when Autumn fails.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function readFeatureUsage(
  ctx: ActionCtx,
  featureId: string,
): Promise<FeatureUsage> {
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
