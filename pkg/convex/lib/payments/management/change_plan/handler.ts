import { Effect } from "effect";

import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../../auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../../errors/effect";
import { BillingTier } from "../../catalog";
import {
  hasForceCheckoutUpgradeDowngradeError,
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  resolvePricingVariants,
  resolveProductId,
  resolveVariant,
} from "../../variants";
import {
  revokeFreePlanCreditByOrgIdInternalReference,
  upsertOrgBillingSnapshotForOrgInternalReference,
} from "../../../../payments/refs";
import { appendBillingPlanChangeAuditEventEffect } from "./audit";
import { ensureFreePlanCreditForTargetTierEffect } from "./free_credit";
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
      const identity = yield* requireIdentityEffect(ctx);
      const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
      if (activeOrg.orgSlug !== null) {
        yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
      }
      if (!isBillingManagerRole(activeOrg.orgRole)) {
        return yield* Effect.fail(
          new ValidationError({ message: "Only organization admins can change billing plans." }),
        );
      }

      const variants = yield* Effect.tryPromise({
        try: () => resolvePricingVariants(ctx),
        catch: (error) =>
          toBillingPlanChangeError("Failed to resolve pricing variants.", error),
      });
      const targetVariant = yield* Effect.try({
        try: () =>
          resolveVariant({
            variants,
            tier: args.tier,
            interval: args.interval,
            overageMode: args.overageMode,
          }),
        catch: (error) =>
          new ValidationError({
            message:
              error instanceof Error
                ? error.message
                : "Unable to resolve the requested billing plan.",
          }),
      });
      const fallbackProductId = resolveProductId({
        tier: args.tier,
        interval: args.interval,
        overageMode: args.overageMode,
      });
      if (!targetVariant.isConfiguredInAutumn) {
        return yield* Effect.fail(
          new ValidationError({
            message: `This billing plan is not configured in Autumn yet (${fallbackProductId}). Configure pricing products first.`,
          }),
        );
      }
      const productId = targetVariant.productId;

      const customerResult = yield* Effect.tryPromise({
        try: () =>
          ctx.runAction(api.autumn.createCustomer, {
            errorOnNotFound: false,
          }),
        catch: (error) =>
          toBillingPlanChangeError("Failed to initialize the billing customer.", error),
      });
      if (customerResult.error !== null) {
        return yield* Effect.fail(
          new ExternalServiceError({ message: "Billing service is temporarily unavailable." }),
        );
      }
      const currentProductId = readCurrentProductId(customerResult.data);
      const currentVariant =
        variants.find((variant) => variant.productId === currentProductId) ??
        readCurrentVariantFromProductId(currentProductId);

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
        currentVariant?.tier === BillingTier.Free
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
        (currentVariant === null || currentVariant.tier === BillingTier.Free);

      let attachResult = yield* Effect.tryPromise({
        try: () =>
          ctx.runAction(api.autumn.attach, {
            productId,
            forceCheckout: shouldForceCheckout,
            successUrl: args.successUrl ?? undefined,
          }),
        catch: (error) =>
          toBillingPlanChangeError("Failed to start the billing attachment flow.", error),
      });
      if (
        (attachResult.error !== null || attachResult.data === null) &&
        shouldForceCheckout &&
        hasForceCheckoutUpgradeDowngradeError(attachResult.error)
      ) {
        attachResult = yield* Effect.tryPromise({
          try: () =>
            ctx.runAction(api.autumn.attach, {
              productId,
              forceCheckout: false,
              successUrl: args.successUrl ?? undefined,
            }),
          catch: (error) =>
            toBillingPlanChangeError("Failed to retry the billing attachment flow.", error),
        });
      }
      if (attachResult.error !== null || attachResult.data === null) {
        if (args.tier === BillingTier.Free && consumedFreeCreditReason === "granted") {
          yield* Effect.tryPromise({
            try: () =>
              ctx.runMutation(revokeFreePlanCreditByOrgIdInternalReference, {
                orgId: activeOrg.orgId,
                reason: "attach_failed",
              }),
            catch: () => undefined,
          });
        }
        const attachFailureMessage =
          attachResult.error?.message ?? "Unable to start checkout for this billing change.";
        return yield* Effect.fail(
          new ExternalServiceError({
            message: attachFailureMessage,
          }),
        );
      }

      if (
        args.tier !== BillingTier.Free &&
        currentVariant !== null &&
        currentVariant.tier === BillingTier.Free
      ) {
        yield* Effect.tryPromise({
          try: () =>
            ctx.runMutation(revokeFreePlanCreditByOrgIdInternalReference, {
              orgId: activeOrg.orgId,
              reason: "upgraded_to_paid",
            }),
          catch: (error) =>
            toBillingPlanChangeError("Failed to revoke the previous free-plan credit.", error),
        });
      }

      const actorDisplayName =
        identity.name ?? identity.nickname ?? identity.preferredUsername ?? null;
      const actorEmail = identity.email ?? null;
      const checkoutUrl = attachResult.data.checkout_url ?? null;
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
      yield* Effect.tryPromise({
        try: () =>
          ctx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
            orgId: activeOrg.orgId,
            currentTier: effectiveTier,
          }),
        catch: (error) =>
          toBillingPlanChangeError("Failed to refresh the billing snapshot.", error),
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
