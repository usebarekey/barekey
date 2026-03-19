import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { ExternalServiceError } from "../../../errors/effect";
import {
  runMutationEffect,
  runQueryEffect,
} from "../../../convex/functions";
import {
  getFreePlanCreditForClerkUserIdInternalReference,
  getFreePlanCreditForOrgIdInternalReference,
  revokeFreePlanCreditForCurrentOrgInternalReference,
} from "../../../../payments/refs";

function toPaymentsRuntimeError(message: string, cause: unknown) {
  return new ExternalServiceError({ message, cause });
}

/**
 * Loads the free-plan credit assigned to an organization.
 *
 * @param ctx The Convex action context.
 * @param orgId The organization id to inspect.
 * @returns The free-plan credit row, or `null`.
 * @remarks This keeps free-credit lookup references out of higher-level billing handlers.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function getFreePlanCreditForOrg(ctx: ActionCtx, orgId: string) {
  return await Effect.runPromise(
    runQueryEffect(
      ctx,
      getFreePlanCreditForOrgIdInternalReference,
      { orgId },
      (error) =>
        toPaymentsRuntimeError(
          "Failed to load the free-plan credit for the organization.",
          error,
        ),
    ),
  );
}

/**
 * Loads the free-plan credit assigned to a Clerk user.
 *
 * @param ctx The Convex action context.
 * @param clerkUserId The Clerk user id to inspect.
 * @returns The free-plan credit row, or `null`.
 * @remarks This is used by billing-management flows that operate on the current signed-in user.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function getFreePlanCreditForClerkUser(ctx: ActionCtx, clerkUserId: string) {
  return await Effect.runPromise(
    runQueryEffect(
      ctx,
      getFreePlanCreditForClerkUserIdInternalReference,
      {
        clerkUserId,
      },
      (error) =>
        toPaymentsRuntimeError(
          "Failed to load the free-plan credit for the Clerk user.",
          error,
        ),
    ),
  );
}

/**
 * Revokes the current user's free-plan credit assignment for an organization.
 *
 * @param ctx The Convex action context.
 * @param input The Clerk user id, organization id, and revoke reason.
 * @returns The raw revoke result.
 * @remarks This wraps the current-org revoke mutation used by billing-management flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function revokeCurrentUserFreePlanCredit(
  ctx: ActionCtx,
  input: {
    clerkUserId: string;
    orgId: string;
    reason: string;
  },
) {
  return await Effect.runPromise(
    runMutationEffect(
      ctx,
      revokeFreePlanCreditForCurrentOrgInternalReference,
      input,
      (error) =>
        toPaymentsRuntimeError(
          "Failed to revoke the current user's free-plan credit.",
          error,
        ),
    ),
  );
}
