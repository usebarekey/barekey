import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { appendEventInternalReference } from "../../../../audit/refs";
import type { BillingPlanAuditArgs } from "./shared";
import { toBillingPlanChangeError } from "./shared";

/**
 * Appends a billing plan-change audit event for the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The resolved organization, actor, and billing change details to record.
 * @param fallbackMessage The message to use if the audit write fails.
 * @returns An Effect that succeeds once the audit event is appended.
 * @remarks This writes one billing event into the shared audit stream.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function appendBillingPlanChangeAuditEventEffect(
  ctx: ActionCtx,
  args: BillingPlanAuditArgs,
  fallbackMessage: string,
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () =>
      ctx.runMutation(appendEventInternalReference, {
        orgId: args.orgId,
        orgSlug: args.orgSlug ?? args.expectedOrgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: "billing.plan_change_requested",
        category: "billing",
        actorSource: "barekey_user",
        actorClerkUserId: args.clerkUserId,
        actorDisplayName: args.actorDisplayName,
        actorEmail: args.actorEmail,
        subjectType: "billing",
        subjectId: args.orgId,
        subjectName: args.orgSlug ?? args.expectedOrgSlug,
        title: args.title,
        description: args.description,
        severity: "info",
        payloadJson: JSON.stringify({
          currentProductId: args.currentProductId,
          attachedProductId: args.attachedProductId,
          effectiveProductId: args.effectiveProductId ?? null,
          changeOutcome: args.changeOutcome,
          targetTier: args.targetTier,
          targetInterval: args.targetInterval,
          targetOverageMode: args.targetOverageMode,
        }),
        retentionTierOverride: null,
      }),
    catch: (error) => toBillingPlanChangeError(fallbackMessage, error),
  }).pipe(Effect.asVoid);
}
