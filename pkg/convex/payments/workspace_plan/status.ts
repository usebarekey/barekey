import { Effect } from "effect";
import { v } from "convex/values";

import { api } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectAction } from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { BillingTier } from "../../lib/payments/catalog";
import {
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
} from "../../lib/payments/variants";
import { hasFreePlanCreditAssignedToOrg } from "../helpers";
import { upsertOrgBillingSnapshotForOrgInternalReference } from "../refs";
import {
  toWorkspacePlanError,
  workspacePlanStatusResponseValidator,
  type WorkspacePlanEffectError,
  type WorkspacePlanStatusResponse,
} from "./shared";

/**
 * Reads the current workspace billing status for the active organization.
 *
 * @param args The expected organization slug.
 * @returns An Effect that succeeds with the workspace billing status response.
 * @remarks This refreshes the billing snapshot row after resolving the effective current plan.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function getWorkspacePlanStatusForCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
  },
): Effect.Effect<WorkspacePlanStatusResponse, WorkspacePlanEffectError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const customerResult = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runAction(api.autumn.createCustomer, {
          errorOnNotFound: false,
        }),
      catch: (error) =>
        toWorkspacePlanError("Failed to initialize the billing customer.", error),
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
        ? yield* Effect.tryPromise({
            try: () =>
              hasFreePlanCreditAssignedToOrg(runtimeCtx, {
                orgId: activeOrg.orgId,
              }),
            catch: (error) =>
              toWorkspacePlanError("Failed to load free-plan credit state.", error),
          })
        : false;
    const isWithoutPlan =
      currentProductId === null ||
      (currentVariant?.tier === BillingTier.Free && !hasAssignedFreePlanCredit);

    yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
          orgId: activeOrg.orgId,
          currentTier: isWithoutPlan ? null : (currentVariant?.tier ?? null),
        }),
      catch: (error) =>
        toWorkspacePlanError("Failed to refresh the workspace billing snapshot.", error),
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
  });
}

/**
 * Reads the workspace plan status for the current authenticated organization.
 *
 * @param runtimeCtx The Convex action context.
 * @param args The expected organization slug.
 * @returns The current workspace billing status used by onboarding and projects screens.
 * @remarks This refreshes the billing snapshot row for the active organization.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const getWorkspacePlanStatusForCurrentOrg = effectAction<
  {
    expectedOrgSlug: string;
  },
  WorkspacePlanStatusResponse,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: workspacePlanStatusResponseValidator,
  handler: getWorkspacePlanStatusForCurrentOrgEffect,
});
