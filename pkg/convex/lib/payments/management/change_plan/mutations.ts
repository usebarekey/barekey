import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { runMutationEffect } from "../../../convex/functions";
import {
  revokeFreePlanCreditByOrgIdInternalReference,
  upsertOrgBillingSnapshotForOrgInternalReference,
} from "../../../../payments/refs";
import { toBillingPlanChangeError } from "./shared";

/**
 * Revokes a free-plan credit for an organization.
 *
 * @param ctx The Convex action context.
 * @param input The organization id and revocation reason.
 * @returns An Effect that completes after the revocation mutation runs.
 * @remarks This is used during billing plan transitions that invalidate a previously granted free-plan credit.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function revokeFreePlanCreditForOrgEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    reason: string;
  },
) {
  return runMutationEffect(
    ctx,
    revokeFreePlanCreditByOrgIdInternalReference,
    input,
    (error) =>
      toBillingPlanChangeError("Failed to revoke the previous free-plan credit.", error),
  );
}

/**
 * Best-effort revokes a free-plan credit for an organization.
 *
 * @param ctx The Convex action context.
 * @param input The organization id and revocation reason.
 * @returns An Effect that never fails.
 * @remarks This is used for rollback cleanup after a failed plan attach.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function revokeFreePlanCreditForOrgBestEffortEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    reason: string;
  },
) {
  return runMutationEffect(ctx, revokeFreePlanCreditByOrgIdInternalReference, input, () => undefined);
}

/**
 * Refreshes the persisted billing snapshot for an organization.
 *
 * @param ctx The Convex action context.
 * @param input The organization id and current effective tier.
 * @returns An Effect that completes after the snapshot mutation runs.
 * @remarks This keeps billing snapshot mirrors aligned with the post-change plan outcome.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function upsertBillingSnapshotEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    currentTier: string | null;
  },
) {
  return runMutationEffect(
    ctx,
    upsertOrgBillingSnapshotForOrgInternalReference,
    input,
    (error) => toBillingPlanChangeError("Failed to refresh the billing snapshot.", error),
  );
}
