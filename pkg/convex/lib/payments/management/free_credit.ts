import { Effect } from "effect";

import { appendEventInternalReference } from "../../../audit/refs";
import type { ActionCtx } from "../../../_generated/server";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentity,
} from "../../auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../errors/effect";
import { isBillingManagerRole } from "../variants";
import type { FreePlanCreditState } from "../state";
import {
  getFreePlanCreditForClerkUserIdInternalReference,
  revokeFreePlanCreditByOrgIdInternalReference,
  revokeFreePlanCreditForCurrentOrgInternalReference,
  upsertOrgBillingSnapshotForOrgInternalReference,
} from "../../../payments/refs";

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
  return await Effect.runPromise(
    Effect.gen(function* () {
      const identity = yield* Effect.tryPromise({
        try: () => requireIdentity(ctx),
        catch: (error) =>
          new AuthError({
            message: error instanceof Error ? error.message : "Unauthorized",
          }),
      });
      const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
      if (activeOrg.orgSlug !== null) {
        yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
      }
      if (!isBillingManagerRole(activeOrg.orgRole)) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Only organization admins can revoke free workspace credits.",
          }),
        );
      }

      const revokeResult = (yield* Effect.tryPromise({
        try: () =>
          ctx.runMutation(revokeFreePlanCreditByOrgIdInternalReference, {
            orgId: activeOrg.orgId,
            reason: "manual_revoke",
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to revoke the workspace free credit.",
            cause: error,
          }),
      })) as { revoked: boolean; credit: FreePlanCreditState | null };

      if (revokeResult.revoked) {
        yield* Effect.tryPromise({
          try: () =>
            ctx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
              orgId: activeOrg.orgId,
              currentTier: null,
            }),
          catch: (error) =>
            new ExternalServiceError({
              message: "Failed to refresh the organization billing snapshot.",
              cause: error,
            }),
        });
        yield* Effect.tryPromise({
          try: () =>
            ctx.runMutation(appendEventInternalReference, {
              orgId: activeOrg.orgId,
              orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
              projectId: null,
              projectSlug: null,
              stageSlug: null,
              eventType: "billing.free_credit_revoked",
              category: "billing",
              actorSource: "barekey_user",
              actorClerkUserId: activeOrg.clerkUserId,
              actorDisplayName:
                identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
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
            }),
          catch: (error) =>
            new ExternalServiceError({
              message: "Failed to append the free-credit audit event.",
              cause: error,
            }),
        });
      }

      return {
        revoked: revokeResult.revoked,
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
        return error instanceof Error ? error : new Error("Unexpected billing free-credit error.");
      }),
    ),
  );
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
  const currentCredit = (await ctx.runQuery(
    getFreePlanCreditForClerkUserIdInternalReference,
    {
      clerkUserId: identity.subject,
    },
  )) as FreePlanCreditState | null;
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

  const revokeResult = (await ctx.runMutation(
    revokeFreePlanCreditForCurrentOrgInternalReference,
    {
      clerkUserId: identity.subject,
      orgId: previousAssignedOrgId,
      reason: args.reason ?? "manual_revoke",
    },
  )) as {
    revoked: boolean;
    reason: "revoked" | "already_available" | "not_assigned_to_org";
    credit: FreePlanCreditState;
  };

  if (revokeResult.revoked) {
    const auditOrgSlug = previousAssignedOrgSlug ?? previousAssignedOrgId;
    await ctx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
      orgId: previousAssignedOrgId,
      currentTier: null,
    });
    await ctx.runMutation(appendEventInternalReference, {
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
