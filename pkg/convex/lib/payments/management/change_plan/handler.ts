import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { AuthError, ExternalServiceError, ValidationError } from "../../../errors/effect";
import { BillingTier } from "../../catalog";
import {
  loadCurrentBillingPlanStateEffect,
  requireBillingPlanChangeAccessEffect,
  resolveTargetBillingPlanEffect,
} from "./access";
import { attachBillingPlanEffect } from "./attach";
import { appendBillingPlanChangeAuditEventEffect } from "./audit";
import { ensureFreePlanCreditForTargetTierEffect } from "./free_credit";
import {
  revokeFreePlanCreditForOrgBestEffortEffect,
  revokeFreePlanCreditForOrgEffect,
  upsertBillingSnapshotEffect,
} from "./mutations";
import { resolvePostAttachOutcomeEffect } from "./post_attach";
import {
  type ChangePlanForCurrentOrgArgs,
  type ChangePlanForCurrentOrgResult,
  toBillingPlanChangeError,
} from "./shared";

/**
 * Changes the billing plan for the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug, target plan, and optional success URL.
 * @returns The checkout or applied-plan result.
 * @remarks This may consume or revoke free-plan credits, update billing snapshots, and append billing audit events.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function changePlanForCurrentOrgHandler(
  ctx: ActionCtx,
  args: ChangePlanForCurrentOrgArgs,
): Promise<ChangePlanForCurrentOrgResult> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const { identity, activeOrg, actorDisplayName, actorEmail } =
        yield* requireBillingPlanChangeAccessEffect(ctx, args);
      const { variants, productId } = yield* resolveTargetBillingPlanEffect(ctx, args);
      const { currentProductId, currentTier } = yield* loadCurrentBillingPlanStateEffect(
        ctx,
        variants,
      );

      const consumedFreeCreditReason = yield* ensureFreePlanCreditForTargetTierEffect(ctx, {
        clerkUserId: identity.subject,
        activeOrg: {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
        },
        tier: args.tier,
      });

      if (
        args.tier === BillingTier.Free &&
        currentProductId === productId &&
        currentTier === BillingTier.Free
      ) {
        return {
          attachedProductId: productId,
          checkoutRequired: false,
          checkoutUrl: null,
          changeOutcome: "applied" as const,
          effectiveProductId: currentProductId,
        };
      }

      const shouldForceCheckout =
        args.tier !== BillingTier.Free &&
        (currentTier === null || currentTier === BillingTier.Free);

      const { checkoutUrl } = yield* attachBillingPlanEffect(ctx, {
        productId,
        shouldForceCheckout,
        successUrl: args.successUrl,
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            if (args.tier === BillingTier.Free && consumedFreeCreditReason === "granted") {
              yield* revokeFreePlanCreditForOrgBestEffortEffect(ctx, {
                orgId: activeOrg.orgId,
                reason: "attach_failed",
              });
            }
            return yield* Effect.fail(error);
          }),
        ),
      );

      if (
        args.tier !== BillingTier.Free &&
        currentTier === BillingTier.Free
      ) {
        yield* revokeFreePlanCreditForOrgEffect(ctx, {
          orgId: activeOrg.orgId,
          reason: "upgraded_to_paid",
        });
      }
      if (checkoutUrl !== null) {
        yield* appendBillingPlanChangeAuditEventEffect(
          ctx,
          {
            orgId: activeOrg.orgId,
            orgSlug: activeOrg.orgSlug,
            clerkUserId: activeOrg.clerkUserId,
            actorDisplayName,
            actorEmail,
            expectedOrgSlug: args.expectedOrgSlug,
            title: "Started billing checkout",
            description: `A billing change for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)} was submitted to checkout.`,
            currentProductId,
            attachedProductId: productId,
            changeOutcome: "submitted",
            targetTier: args.tier,
            targetInterval: args.interval,
            targetOverageMode: args.overageMode,
          },
          "Failed to append the billing checkout audit event.",
        );
        return {
          attachedProductId: productId,
          checkoutRequired: true,
          checkoutUrl,
          changeOutcome: "submitted" as const,
          effectiveProductId: currentProductId,
        };
      }

      const {
        effectiveProductId,
        changeOutcome,
        effectiveTier,
      } = yield* resolvePostAttachOutcomeEffect(ctx, {
        currentProductId,
        productId,
        variants,
      });
      yield* upsertBillingSnapshotEffect(ctx, {
        orgId: activeOrg.orgId,
        currentTier: effectiveTier,
      });
      yield* appendBillingPlanChangeAuditEventEffect(
        ctx,
        {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
          clerkUserId: activeOrg.clerkUserId,
          actorDisplayName,
          actorEmail,
          expectedOrgSlug: args.expectedOrgSlug,
          title: "Changed workspace billing plan",
          description: `Billing change for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)} is ${changeOutcome}.`,
          currentProductId,
          attachedProductId: productId,
          effectiveProductId,
          changeOutcome,
          targetTier: args.tier,
          targetInterval: args.interval,
          targetOverageMode: args.overageMode,
        },
        "Failed to append the billing plan-change audit event.",
      );

      return {
        attachedProductId: productId,
        checkoutRequired: false,
        checkoutUrl: null,
        changeOutcome,
        effectiveProductId,
      };
    }).pipe(
      Effect.mapError((error: unknown) => {
        if (
          error instanceof AuthError ||
          error instanceof ExternalServiceError ||
          error instanceof ValidationError
        ) {
          return new Error(error.message);
        }
        return error instanceof Error ? error : new Error("Unexpected billing plan change error.");
      }),
    ),
  );
}
