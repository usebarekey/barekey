import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { requireIdentityEffect } from "../../../auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../../errors/effect";
import {
  getFreePlanCreditForClerkUser,
  revokeCurrentUserFreePlanCredit,
  upsertOrgBillingSnapshot,
} from "../../runtime/ops";
import type { FreePlanCreditState } from "../../state";
import { appendFreeCreditRevokedAuditEventEffect } from "./audit";
import {
  type RevokeCurrentUserFreePlanCreditResult,
  toFreeCreditManagementError,
} from "./shared";

/**
 * Revokes the current user's free-plan credit assignment.
 *
 * @param ctx The Convex action context.
 * @param args The expected assigned org id and optional revoke reason.
 * @returns The revoke outcome plus the previous org assignment.
 * @remarks This may update billing snapshots and append a billing audit event for the previously assigned workspace.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function revokeCurrentUserFreePlanCreditHandler(
  ctx: ActionCtx,
  args: {
    expectedAssignedOrgId: string | null;
    reason: string | null;
  },
): Promise<RevokeCurrentUserFreePlanCreditResult> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const identity = yield* requireIdentityEffect(ctx);
      const currentCredit = (yield* Effect.tryPromise({
        try: () => getFreePlanCreditForClerkUser(ctx, identity.subject),
        catch: (error) =>
          toFreeCreditManagementError("Failed to load the current user's free credit.", error),
      })) as FreePlanCreditState | null;
      const previousAssignedOrgId = currentCredit?.assignedOrgId ?? null;
      const previousAssignedOrgSlug = currentCredit?.assignedOrgSlug ?? null;

      if (previousAssignedOrgId === null) {
        return {
          revoked: false,
          reason: "already_available" as const,
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
          reason: "mismatch" as const,
          previousAssignedOrgId,
          previousAssignedOrgSlug,
        };
      }

      const revokeResult = (yield* Effect.tryPromise({
        try: () =>
          revokeCurrentUserFreePlanCredit(ctx, {
            clerkUserId: identity.subject,
            orgId: previousAssignedOrgId,
            reason: args.reason ?? "manual_revoke",
          }),
        catch: (error) =>
          toFreeCreditManagementError("Failed to revoke the current user's free credit.", error),
      })) as {
        revoked: boolean;
        reason: "revoked" | "already_available" | "not_assigned_to_org";
        credit: FreePlanCreditState;
      };

      if (revokeResult.revoked) {
        const auditOrgSlug = previousAssignedOrgSlug ?? previousAssignedOrgId;
        yield* Effect.tryPromise({
          try: () =>
            upsertOrgBillingSnapshot(ctx, {
              orgId: previousAssignedOrgId,
              currentTier: null,
            }),
          catch: (error) =>
            toFreeCreditManagementError(
              "Failed to refresh the previous organization's billing snapshot.",
              error,
            ),
        });
        yield* appendFreeCreditRevokedAuditEventEffect(ctx, {
          orgId: previousAssignedOrgId,
          orgSlug: auditOrgSlug,
          actorClerkUserId: identity.subject,
          actorDisplayName:
            identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
          actorEmail: identity.email ?? null,
          reason: args.reason ?? "manual_revoke",
        });
      }

      return {
        revoked: revokeResult.revoked,
        reason: (
          revokeResult.reason === "revoked"
            ? "revoked"
            : revokeResult.reason === "not_assigned_to_org"
              ? "mismatch"
              : "already_available"
        ) as RevokeCurrentUserFreePlanCreditResult["reason"],
        previousAssignedOrgId,
        previousAssignedOrgSlug,
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
        return error instanceof Error
          ? error
          : new Error("Unexpected current-user free-credit revoke error.");
      }),
    ),
  );
}
