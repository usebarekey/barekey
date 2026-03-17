import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "../auth";
import { isBillingManagerRole } from "../payments_variants";
import type { FreePlanCreditState } from "../payments_state";

export type RevokeFreePlanCreditForCurrentOrgResult = {
  revoked: boolean;
};

/**
 * Revokes the free-plan credit assigned to the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug.
 * @returns Whether a free-plan credit was revoked.
 * @remarks This may update billing snapshots and append a billing audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

/**
 * Revokes the current user's free-plan credit assignment.
 *
 * @param ctx The Convex action context.
 * @param args The expected assigned org id and optional revoke reason.
 * @returns The revoke outcome plus the previous org assignment.
 * @remarks This may update billing snapshots and append a billing audit event for the previously assigned workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
    const auditOrgSlug = previousAssignedOrgSlug ?? previousAssignedOrgId;
    await ctx.runMutation(internal.payments.upsertOrgBillingSnapshotForOrgInternal, {
      orgId: previousAssignedOrgId,
      currentTier: null,
    });
    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: previousAssignedOrgId,
      orgSlug: auditOrgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: "billing.free_credit_revoked",
      category: "billing",
      actorSource: "barekey_user",
      actorClerkUserId: identity.subject,
      actorDisplayName: identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
      actorEmail: identity.email ?? null,
      subjectType: "billing",
      subjectId: previousAssignedOrgId,
      subjectName: auditOrgSlug,
      title: "Revoked free workspace credit",
      description: `The free plan credit was revoked from ${auditOrgSlug}.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        reason: args.reason ?? "manual_revoke",
      }),
      retentionTierOverride: null,
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
