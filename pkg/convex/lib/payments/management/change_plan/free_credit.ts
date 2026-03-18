import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { ValidationError, ExternalServiceError } from "../../../errors/effect";
import { BillingTier } from "../../catalog";
import {
  consumeFreePlanCreditForCurrentOrgInternalReference,
  getFreePlanCreditForOrgIdInternalReference,
} from "../../../../payments/refs";
import type { ConsumeFreePlanCreditResult } from "../../state";
import { toBillingPlanChangeError } from "./shared";

type ActiveOrgIdentity = {
  orgId: string;
  orgSlug: string | null;
};

/**
 * Ensures the target organization has a usable free-plan credit before switching
 * onto the free workspace tier.
 *
 * @param ctx The Convex action context.
 * @param args The current user, active organization, and requested tier.
 * @returns The consume reason when a credit was consumed, or `null` when no credit work was needed.
 * @remarks This may consume one free-plan credit and fails with typed validation errors when the credit cannot be used.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function ensureFreePlanCreditForTargetTierEffect(
  ctx: ActionCtx,
  args: {
    clerkUserId: string;
    activeOrg: ActiveOrgIdentity;
    tier: "free" | "pro" | "max";
  },
): Effect.Effect<
  ConsumeFreePlanCreditResult["reason"] | null,
  ValidationError | ExternalServiceError
> {
  return Effect.gen(function* () {
    const existingOrgFreeCredit = yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(getFreePlanCreditForOrgIdInternalReference, {
          orgId: args.activeOrg.orgId,
        }),
      catch: (error) =>
        toBillingPlanChangeError("Failed to load existing free-plan credit state.", error),
    });

    if (args.tier !== BillingTier.Free || existingOrgFreeCredit !== null) {
      return null;
    }

    const consumeResult = (yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(consumeFreePlanCreditForCurrentOrgInternalReference, {
          clerkUserId: args.clerkUserId,
          orgId: args.activeOrg.orgId,
          orgSlug: args.activeOrg.orgSlug,
        }),
      catch: (error) =>
        toBillingPlanChangeError("Failed to consume the free workspace credit.", error),
    })) as ConsumeFreePlanCreditResult;

    if (consumeResult.granted) {
      return consumeResult.reason;
    }
    if (consumeResult.reason === "org_already_assigned") {
      return yield* Effect.fail(
        new ValidationError({
          message: "This organization is already using another member's free organization credit.",
        }),
      );
    }
    if (consumeResult.reason === "assigned_elsewhere") {
      return yield* Effect.fail(
        new ValidationError({
          message:
            "Your free workspace credit is already assigned to another workspace. Revoke it there before activating free here.",
        }),
      );
    }
    return yield* Effect.fail(
      new ValidationError({
        message:
          "Your free workspace credit is unavailable. Revoke an existing free assignment or choose a paid plan.",
      }),
    );
  });
}
