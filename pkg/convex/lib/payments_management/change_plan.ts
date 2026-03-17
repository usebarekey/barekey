import { api, internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../auth";
import { BillingTier } from "../payments_catalog";
import {
  hasForceCheckoutUpgradeDowngradeError,
  isBillingManagerRole,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  resolvePricingVariants,
  resolveProductId,
  resolveVariant,
} from "../payments_variants";
import type { ConsumeFreePlanCreditResult } from "../payments_state";

export type ChangePlanForCurrentOrgResult = {
  attachedProductId: string;
  checkoutRequired: boolean;
  checkoutUrl: string | null;
  changeOutcome: "applied" | "scheduled" | "submitted";
  effectiveProductId: string | null;
};

/**
 * Changes the billing plan for the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug, target plan, and optional success URL.
 * @returns The checkout or applied-plan result.
 * @remarks This may consume or revoke free-plan credits, update billing snapshots, and append billing audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function changePlanForCurrentOrgHandler(
  ctx: ActionCtx,
  args: {
    expectedOrgSlug: string;
    tier: "free" | "pro" | "max";
    interval: "monthly" | "annually";
    overageMode: "without_overages" | "with_overages";
    successUrl: string | null;
  },
): Promise<ChangePlanForCurrentOrgResult> {
  const identity = await requireIdentity(ctx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
  }
  if (!isBillingManagerRole(activeOrg.orgRole)) {
    throw new Error("Only organization admins can change billing plans.");
  }

  const variants = await resolvePricingVariants(ctx);
  const targetVariant = resolveVariant({
    variants,
    tier: args.tier,
    interval: args.interval,
    overageMode: args.overageMode,
  });
  const fallbackProductId = resolveProductId({
    tier: args.tier,
    interval: args.interval,
    overageMode: args.overageMode,
  });
  if (!targetVariant.isConfiguredInAutumn) {
    throw new Error(
      `This billing plan is not configured in Autumn yet (${fallbackProductId}). Configure pricing products first.`,
    );
  }
  const productId = targetVariant.productId;

  const customerResult = await ctx.runAction(api.autumn.createCustomer, {
    errorOnNotFound: false,
  });
  if (customerResult.error !== null) {
    throw new Error("Billing service is temporarily unavailable.");
  }
  const currentProductId = readCurrentProductId(customerResult.data);
  const currentVariant =
    variants.find((variant) => variant.productId === currentProductId) ??
    readCurrentVariantFromProductId(currentProductId);

  const existingOrgFreeCredit = await ctx.runQuery(
    internal.payments.getFreePlanCreditForOrgIdInternal,
    {
      orgId: activeOrg.orgId,
    },
  );

  let consumedFreeCreditReason: ConsumeFreePlanCreditResult["reason"] | null = null;
  if (args.tier === BillingTier.Free && existingOrgFreeCredit === null) {
    const consumeResult = await ctx.runMutation(
      internal.payments.consumeFreePlanCreditForCurrentOrgInternal,
      {
        clerkUserId: identity.subject,
        orgId: activeOrg.orgId,
        orgSlug: activeOrg.orgSlug,
      },
    );
    consumedFreeCreditReason = consumeResult.reason;
    if (!consumeResult.granted) {
      if (consumeResult.reason === "org_already_assigned") {
        throw new Error(
          "This organization is already using another member's free organization credit.",
        );
      }
      if (consumeResult.reason === "assigned_elsewhere") {
        throw new Error(
          "Your free workspace credit is already assigned to another workspace. Revoke it there before activating free here.",
        );
      }
      throw new Error(
        "Your free workspace credit is unavailable. Revoke an existing free assignment or choose a paid plan.",
      );
    }
  }

  if (
    args.tier === BillingTier.Free &&
    currentProductId === productId &&
    currentVariant?.tier === BillingTier.Free
  ) {
    return {
      attachedProductId: productId,
      checkoutRequired: false,
      checkoutUrl: null,
      changeOutcome: "applied",
      effectiveProductId: currentProductId,
    };
  }

  const shouldForceCheckout =
    args.tier !== BillingTier.Free &&
    (currentVariant === null || currentVariant.tier === BillingTier.Free);

  let attachResult = await ctx.runAction(api.autumn.attach, {
    productId,
    forceCheckout: shouldForceCheckout,
    successUrl: args.successUrl ?? undefined,
  });
  if (
    (attachResult.error !== null || attachResult.data === null) &&
    shouldForceCheckout &&
    hasForceCheckoutUpgradeDowngradeError(attachResult.error)
  ) {
    attachResult = await ctx.runAction(api.autumn.attach, {
      productId,
      forceCheckout: false,
      successUrl: args.successUrl ?? undefined,
    });
  }
  if (attachResult.error !== null || attachResult.data === null) {
    if (args.tier === BillingTier.Free && consumedFreeCreditReason === "granted") {
      await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
        orgId: activeOrg.orgId,
        reason: "attach_failed",
      });
    }
    const attachFailureMessage =
      attachResult.error?.message ?? "Unable to start checkout for this billing change.";
    throw new Error(attachFailureMessage);
  }

  if (
    args.tier !== BillingTier.Free &&
    currentVariant !== null &&
    currentVariant.tier === BillingTier.Free
  ) {
    await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
      orgId: activeOrg.orgId,
      reason: "upgraded_to_paid",
    });
  }

  const checkoutUrl = attachResult.data.checkout_url ?? null;
  if (checkoutUrl !== null) {
    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: "billing.plan_change_requested",
      category: "billing",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
      actorEmail: identity.email ?? null,
      subjectType: "billing",
      subjectId: activeOrg.orgId,
      subjectName: activeOrg.orgSlug ?? args.expectedOrgSlug,
      title: "Started billing checkout",
      description: `A billing change for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)} was submitted to checkout.`,
      severity: "info",
      payloadJson: JSON.stringify({
        currentProductId,
        attachedProductId: productId,
        changeOutcome: "submitted",
        targetTier: args.tier,
        targetInterval: args.interval,
        targetOverageMode: args.overageMode,
      }),
      retentionTierOverride: null,
    });
    return {
      attachedProductId: productId,
      checkoutRequired: true,
      checkoutUrl,
      changeOutcome: "submitted",
      effectiveProductId: currentProductId,
    };
  }

  let effectiveProductId: string | null = currentProductId;
  let changeOutcome: "applied" | "scheduled" | "submitted" = "submitted";
  const customerAfterAttachResult = await ctx.runAction(api.autumn.createCustomer, {
    errorOnNotFound: false,
  });
  if (customerAfterAttachResult.error === null) {
    effectiveProductId = readCurrentProductId(customerAfterAttachResult.data);
    const allProducts = readCustomerProducts(customerAfterAttachResult.data);
    const targetStatus = allProducts.find((entry) => entry.id === productId)?.status ?? null;
    if (effectiveProductId === productId) {
      changeOutcome = "applied";
    } else if (targetStatus === "scheduled") {
      changeOutcome = "scheduled";
    }
  }

  const effectiveTier =
    variants.find((variant) => variant.productId === effectiveProductId)?.tier ??
    readCurrentVariantFromProductId(effectiveProductId)?.tier ??
    null;
  await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
    orgId: activeOrg.orgId,
    currentTier: effectiveTier,
  });
  await ctx.runMutation(internal.audit.appendEventInternal, {
    orgId: activeOrg.orgId,
    orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
    projectId: null,
    projectSlug: null,
    stageSlug: null,
    eventType: "billing.plan_change_requested",
    category: "billing",
    actorSource: "barekey_user",
    actorClerkUserId: activeOrg.clerkUserId,
    actorDisplayName: identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
    actorEmail: identity.email ?? null,
    subjectType: "billing",
    subjectId: activeOrg.orgId,
    subjectName: activeOrg.orgSlug ?? args.expectedOrgSlug,
    title: "Changed workspace billing plan",
    description: `Billing change for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)} is ${changeOutcome}.`,
    severity: "info",
    payloadJson: JSON.stringify({
      currentProductId,
      attachedProductId: productId,
      effectiveProductId,
      changeOutcome,
      targetTier: args.tier,
      targetInterval: args.interval,
      targetOverageMode: args.overageMode,
    }),
    retentionTierOverride: null,
  });

  return {
    attachedProductId: productId,
    checkoutRequired: false,
    checkoutUrl: null,
    changeOutcome,
    effectiveProductId,
  };
}
