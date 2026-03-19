import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../_generated/server";
import { BarekeyConfectActionCtx, effectAction } from "../confect";
import {
  changePlanForCurrentOrgHandler,
  type ChangePlanForCurrentOrgResult,
  openBillingPortalForCurrentOrgHandler,
  type OpenBillingPortalForCurrentOrgResult,
  type RevokeCurrentUserFreePlanCreditResult,
  type RevokeFreePlanCreditForCurrentOrgResult,
  revokeCurrentUserFreePlanCreditHandler,
  revokeFreePlanCreditForCurrentOrgHandler,
} from "../lib/payments/management";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors/effect";

function toBillingManagementBoundaryError(error: unknown): AuthError | ExternalServiceError | ValidationError {
  if (
    error instanceof AuthError ||
    error instanceof ExternalServiceError ||
    error instanceof ValidationError
  ) {
    return error;
  }

  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Unexpected billing management error.",
    cause: error,
  });
}

function withCurrentActionCtx<Args, Result>(
  handler: (ctx: ActionCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    return yield* Effect.tryPromise({
      try: () => handler(ctx, args),
      catch: toBillingManagementBoundaryError,
    });
  });
}

/**
 * Changes the billing plan for the current authenticated organization.
 *
 * @param ctx The Convex action context.
 * @param args The requested target plan details and expected organization slug.
 * @returns The checkout or applied-plan result for the plan change.
 * @remarks This boundary delegates to the billing management handler and may trigger checkout or audit writes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const changePlanForCurrentOrg = effectAction<
  {
    expectedOrgSlug: string;
    tier: "free" | "pro" | "max";
    interval: "monthly" | "annually";
    overageMode: "without_overages" | "with_overages";
    successUrl: string | null;
  },
  ChangePlanForCurrentOrgResult,
  any
>({
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
  handler: (args) => withCurrentActionCtx(changePlanForCurrentOrgHandler, args),
});

/**
 * Revokes the free-plan credit currently assigned to the active organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected organization slug.
 * @returns Whether a free-plan credit was revoked.
 * @remarks This boundary delegates to the billing management handler and may update audit and billing snapshot rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const revokeFreePlanCreditForCurrentOrg = effectAction<
  {
    expectedOrgSlug: string;
  },
  RevokeFreePlanCreditForCurrentOrgResult,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: (args) => withCurrentActionCtx(revokeFreePlanCreditForCurrentOrgHandler, args),
});

/**
 * Revokes the current user's free-plan credit assignment, optionally checking an expected organization id.
 *
 * @param ctx The Convex action context.
 * @param args The expected assigned org id and optional revoke reason.
 * @returns The revoke outcome along with the previous org assignment details.
 * @remarks This boundary delegates to the billing management handler and may update billing snapshot and audit rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const revokeCurrentUserFreePlanCredit = effectAction<
  {
    expectedAssignedOrgId: string | null;
    reason: string | null;
  },
  RevokeCurrentUserFreePlanCreditResult,
  any
>({
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
  handler: (args) => withCurrentActionCtx(revokeCurrentUserFreePlanCreditHandler, args),
});

/**
 * Opens the billing portal for the active organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected organization slug and optional portal return URL.
 * @returns The portal URL generated by Autumn.
 * @remarks This boundary delegates to the billing management handler and emits an audit event when the portal opens.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const openBillingPortalForCurrentOrg = effectAction<
  {
    expectedOrgSlug: string;
    returnUrl: string | null;
  },
  OpenBillingPortalForCurrentOrgResult,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    returnUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    portalUrl: v.string(),
  }),
  handler: (args) => withCurrentActionCtx(openBillingPortalForCurrentOrgHandler, args),
});
