import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { appendEventInternalReference } from "../../../../audit/refs";
import { toFreeCreditManagementError } from "./shared";

/**
 * Appends a free-credit revocation audit event.
 *
 * @param convexCtx The Convex action context.
 * @param args The organization, actor, and revoke metadata to record.
 * @returns An Effect that succeeds once the audit event is appended.
 * @remarks This writes one billing audit event for the affected organization.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function appendFreeCreditRevokedAuditEventEffect(
  convexCtx: ActionCtx,
  args: {
    orgId: string;
    orgSlug: string;
    actorClerkUserId: string;
    actorDisplayName: string | null;
    actorEmail: string | null;
    reason: string;
  },
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () =>
      convexCtx.runMutation(appendEventInternalReference, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: "billing.free_credit_revoked",
        category: "billing",
        actorSource: "barekey_user",
        actorClerkUserId: args.actorClerkUserId,
        actorDisplayName: args.actorDisplayName,
        actorEmail: args.actorEmail,
        subjectType: "billing",
        subjectId: args.orgId,
        subjectName: args.orgSlug,
        title: "Revoked free workspace credit",
        description: `The free plan credit was revoked from ${args.orgSlug}.`,
        severity: "warning",
        payloadJson: JSON.stringify({
          reason: args.reason,
        }),
        retentionTierOverride: null,
      }),
    catch: (error) =>
      toFreeCreditManagementError("Failed to append the free-credit audit event.", error),
  }).pipe(Effect.asVoid);
}
