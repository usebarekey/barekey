import { api, internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../auth";
import { isBillingManagerRole, normalizeString } from "../payments_variants";

export type OpenBillingPortalForCurrentOrgResult = {
  portalUrl: string;
};

/**
 * Opens the billing portal for the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug and optional portal return URL.
 * @returns The billing portal URL.
 * @remarks This ensures the Autumn customer exists and appends a billing audit event when the portal opens.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
