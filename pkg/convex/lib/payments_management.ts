import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "./auth";
import { BillingTier } from "./payments_catalog";
import {
  hasForceCheckoutUpgradeDowngradeError,
  isBillingManagerRole,
  normalizeString,
  readCurrentProductId,
  readCurrentVariantFromProductId,
  readCustomerProducts,
  resolvePricingVariants,
  resolveProductId,
  resolveVariant,
} from "./payments_variants";
import type { ConsumeFreePlanCreditResult, FreePlanCreditState } from "./payments_state";

export type ChangePlanForCurrentOrgResult = {
  attachedProductId: string;
  checkoutRequired: boolean;
  checkoutUrl: string | null;
  changeOutcome: "applied" | "scheduled" | "submitted";
  effectiveProductId: string | null;
};

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

  const existingOrgFreeCredit = await ctx.runQuery(internal.payments.getFreePlanCreditForOrgIdInternal, {
    orgId: activeOrg.orgId,
  });

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

export type RevokeFreePlanCreditForCurrentOrgResult = {
  revoked: boolean;
};

export async function revokeFreePlanCreditForCurrentOrgHandler(
  ctx: ActionCtx,
  args: {
    expectedOrgSlug: string;
  },
): Promise<RevokeFreePlanCreditForCurrentOrgResult> {
  const identity = await requireIdentity(ctx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
  }
  if (!isBillingManagerRole(activeOrg.orgRole)) {
    throw new Error("Only organization admins can revoke free workspace credits.");
  }

  const revokeResult: { revoked: boolean; credit: FreePlanCreditState | null } =
    await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
      orgId: activeOrg.orgId,
      reason: "manual_revoke",
    });

  if (revokeResult.revoked) {
    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: activeOrg.orgId,
      currentTier: null,
    });
    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: "billing.free_credit_revoked",
      category: "billing",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
      actorEmail: identity.email ?? null,
      subjectType: "billing",
      subjectId: activeOrg.orgId,
      subjectName: activeOrg.orgSlug ?? args.expectedOrgSlug,
      title: "Revoked free workspace credit",
      description: `The free plan credit was revoked from ${(activeOrg.orgSlug ?? args.expectedOrgSlug)}.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        reason: "manual_revoke",
      }),
      retentionTierOverride: null,
    });
  }

  return {
    revoked: revokeResult.revoked,
  };
}

export type RevokeCurrentUserFreePlanCreditResult = {
  revoked: boolean;
  reason: "revoked" | "already_available" | "mismatch";
  previousAssignedOrgId: string | null;
  previousAssignedOrgSlug: string | null;
};

export async function revokeCurrentUserFreePlanCreditHandler(
  ctx: ActionCtx,
  args: {
    expectedAssignedOrgId: string | null;
    reason: string | null;
  },
): Promise<RevokeCurrentUserFreePlanCreditResult> {
  const identity = await requireIdentity(ctx);
  const currentCredit: FreePlanCreditState | null = await ctx.runQuery(
    internal.payments.getFreePlanCreditForClerkUserIdInternal,
    {
      clerkUserId: identity.subject,
    },
  );
  const previousAssignedOrgId = currentCredit?.assignedOrgId ?? null;
  const previousAssignedOrgSlug = currentCredit?.assignedOrgSlug ?? null;

  if (previousAssignedOrgId === null) {
    return {
      revoked: false,
      reason: "already_available",
      previousAssignedOrgId,
      previousAssignedOrgSlug,
    };
  }

  if (
    args.expectedAssignedOrgId !== null &&
    previousAssignedOrgId !== args.expectedAssignedOrgId
  ) {
    return {
      revoked: false,
      reason: "mismatch",
      previousAssignedOrgId,
      previousAssignedOrgSlug,
    };
  }

  const revokeResult: {
    revoked: boolean;
    reason: "revoked" | "already_available" | "not_assigned_to_org";
    credit: FreePlanCreditState;
  } = await ctx.runMutation(internal.payments.revokeFreePlanCreditForCurrentOrgInternal, {
    clerkUserId: identity.subject,
    orgId: previousAssignedOrgId,
    reason: args.reason ?? "manual_revoke",
  });

  if (revokeResult.revoked) {
    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: previousAssignedOrgId,
      currentTier: null,
    });
  }

  return {
    revoked: revokeResult.revoked,
    reason:
      revokeResult.reason === "revoked"
        ? "revoked"
        : revokeResult.reason === "not_assigned_to_org"
          ? "mismatch"
          : "already_available",
    previousAssignedOrgId,
    previousAssignedOrgSlug,
  };
}

export type OpenBillingPortalForCurrentOrgResult = {
  portalUrl: string;
};

export async function openBillingPortalForCurrentOrgHandler(
  ctx: ActionCtx,
  args: {
    expectedOrgSlug: string;
    returnUrl: string | null;
  },
): Promise<OpenBillingPortalForCurrentOrgResult> {
  const identity = await requireIdentity(ctx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
  }
  if (!isBillingManagerRole(activeOrg.orgRole)) {
    throw new Error("Only organization admins can manage billing settings.");
  }

  await ctx.runAction(api.autumn.createCustomer, {
    errorOnNotFound: false,
  });

  const portalResult = await ctx.runAction(api.autumn.billingPortal, {
    returnUrl: args.returnUrl ?? undefined,
  });
  if (portalResult.error !== null || portalResult.data === null) {
    throw new Error("Unable to open billing portal right now.");
  }

  const portalUrl = normalizeString(
    (portalResult.data as { url?: unknown; portal_url?: unknown }).url ??
      (portalResult.data as { url?: unknown; portal_url?: unknown }).portal_url,
  );
  if (portalUrl === null) {
    throw new Error("Billing portal response did not include a URL.");
  }

  await ctx.runMutation(internal.audit.appendEventInternal, {
    orgId: activeOrg.orgId,
    orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
    projectId: null,
    projectSlug: null,
    stageSlug: null,
    eventType: "billing.portal_opened",
    category: "billing",
    actorSource: "barekey_user",
    actorClerkUserId: activeOrg.clerkUserId,
    actorDisplayName: identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
    actorEmail: identity.email ?? null,
    subjectType: "billing",
    subjectId: activeOrg.orgId,
    subjectName: activeOrg.orgSlug ?? args.expectedOrgSlug,
    title: "Opened billing portal",
    description: `Billing management was opened for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)}.`,
    severity: "info",
    payloadJson: JSON.stringify({
      returnUrl: args.returnUrl,
    }),
    retentionTierOverride: null,
  });

  return {
    portalUrl,
  };
}
