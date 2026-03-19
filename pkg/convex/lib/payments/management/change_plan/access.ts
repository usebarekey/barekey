import { Effect } from "effect";

import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../../auth";
import { ExternalServiceError, ValidationError } from "../../../errors/effect";
import type { BillingVariant, BillingTierValue } from "../../catalog";
import {
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  resolvePricingVariants,
  resolveProductId,
  resolveVariant,
} from "../../variants";
import type { ChangePlanForCurrentOrgArgs } from "./shared";
import { toBillingPlanChangeError } from "./shared";

/**
 * Resolves the authenticated org and actor identity for a billing plan change.
 *
 * @param convexCtx The Convex action context.
 * @param args The requested billing change input.
 * @returns An Effect that succeeds with the active org and actor display details.
 * @remarks This enforces org-slug matching and billing-manager permissions before plan work begins.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function requireBillingPlanChangeAccessEffect(
  convexCtx: ActionCtx,
  args: ChangePlanForCurrentOrgArgs,
) {
  return Effect.gen(function* () {
    const identity = yield* requireIdentityEffect(convexCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }
    if (!isBillingManagerRole(activeOrg.orgRole)) {
      return yield* Effect.fail(
        new ValidationError({ message: "Only organization admins can change billing plans." }),
      );
    }

    return {
      identity,
      activeOrg,
      actorDisplayName:
        identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
      actorEmail: identity.email ?? null,
    };
  });
}

/**
 * Resolves the requested target billing variant from live Autumn pricing.
 *
 * @param convexCtx The Convex action context.
 * @param args The requested billing change input.
 * @returns An Effect that succeeds with the resolved target variant and product id.
 * @remarks This fails when the requested plan is not present in the configured variant matrix.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function resolveTargetBillingPlanEffect(
  convexCtx: ActionCtx,
  args: ChangePlanForCurrentOrgArgs,
) {
  return Effect.gen(function* () {
    const variants = yield* Effect.tryPromise({
      try: () => resolvePricingVariants(convexCtx),
      catch: (error) => toBillingPlanChangeError("Failed to resolve pricing variants.", error),
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

    return {
      variants,
      productId: targetVariant.productId,
    };
  });
}

/**
 * Loads the current effective workspace billing state from Autumn.
 *
 * @param convexCtx The Convex action context.
 * @param variants The resolved pricing variants used for fallback matching.
 * @returns An Effect that succeeds with the current product id and effective tier.
 * @remarks This ensures the Autumn customer exists before current-plan comparisons are made.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadCurrentBillingPlanStateEffect(
  convexCtx: ActionCtx,
  variants: ReadonlyArray<BillingVariant>,
) {
  return Effect.gen(function* () {
    const customerResult = yield* Effect.tryPromise({
      try: () =>
        convexCtx.runAction(api.autumn.createCustomer, {
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
    const currentTier: BillingTierValue | null =
      variants.find((variant) => variant.productId === currentProductId)?.tier ??
      readCurrentVariantFromProductId(currentProductId)?.tier ??
      null;

    return {
      currentProductId,
      currentTier,
    };
  });
}
