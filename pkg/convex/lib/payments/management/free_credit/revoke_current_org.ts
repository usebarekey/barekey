import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../../auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../../errors/effect";
import { isBillingManagerRole } from "../../variants";
import type { FreePlanCreditState } from "../../state";
import {
  revokeFreePlanCreditByOrgIdInternalReference,
  upsertOrgBillingSnapshotForOrgInternalReference,
} from "../../../../payments/refs";
import { appendFreeCreditRevokedAuditEventEffect } from "./audit";
import {
  type RevokeFreePlanCreditForCurrentOrgResult,
  toFreeCreditManagementError,
} from "./shared";

/**
 * Revokes the free-plan credit assigned to the current organization.
 *
 * @param convexCtx The Convex action context.
 * @param args The expected org slug.
 * @returns Whether a free-plan credit was revoked.
 * @remarks This may update billing snapshots and append a billing audit event.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function revokeFreePlanCreditForCurrentOrgHandler(
  convexCtx: ActionCtx,
  args: {
    expectedOrgSlug: string;
  },
): Promise<RevokeFreePlanCreditForCurrentOrgResult> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const identity = yield* requireIdentityEffect(convexCtx);
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
          convexCtx.runMutation(revokeFreePlanCreditByOrgIdInternalReference, {
            orgId: activeOrg.orgId,
            reason: "manual_revoke",
          }),
        catch: (error) =>
          toFreeCreditManagementError("Failed to revoke the workspace free credit.", error),
      })) as { revoked: boolean; credit: FreePlanCreditState | null };

      if (revokeResult.revoked) {
        yield* Effect.tryPromise({
          try: () =>
            convexCtx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
              orgId: activeOrg.orgId,
              currentTier: null,
            }),
          catch: (error) =>
            toFreeCreditManagementError(
              "Failed to refresh the organization billing snapshot.",
              error,
            ),
        });
        yield* appendFreeCreditRevokedAuditEventEffect(convexCtx, {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
          actorClerkUserId: activeOrg.clerkUserId,
          actorDisplayName:
            identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
          actorEmail: identity.email ?? null,
          reason: "manual_revoke",
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
