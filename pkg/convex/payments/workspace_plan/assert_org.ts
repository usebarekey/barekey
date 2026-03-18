import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import { readWorkspacePlanStateForOrg } from "../../lib/payments/variants";
import { upsertOrgBillingSnapshotForOrgInternalReference } from "../refs";
import {
  toWorkspacePlanError,
  workspacePlanAssertionResultValidator,
  type WorkspacePlanAssertionArgs,
  type WorkspacePlanAssertionResult,
  type WorkspacePlanEffectError,
} from "./shared";

/**
 * Asserts that an arbitrary organization has an effective workspace plan.
 *
 * @param args The target organization id and optional slug.
 * @returns An Effect that succeeds with the resolved org id, product id, and tier.
 * @remarks This refreshes the organization billing snapshot after plan resolution succeeds.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function assertWorkspacePlanForOrgInternalEffect(
  args: WorkspacePlanAssertionArgs,
): Effect.Effect<WorkspacePlanAssertionResult, WorkspacePlanEffectError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const planState = yield* Effect.tryPromise({
      try: () => readWorkspacePlanStateForOrg(ctx, args),
      catch: (error) =>
        toWorkspacePlanError("Failed to resolve the workspace billing plan.", error),
    });

    yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
          orgId: args.orgId,
          currentTier: planState.currentTier,
        }),
      catch: (error) =>
        toWorkspacePlanError("Failed to refresh the workspace billing snapshot.", error),
    });

    return {
      orgId: args.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  });
}

/**
 * Asserts that the provided organization has an active workspace plan.
 *
 * @param ctx The Convex internal action context.
 * @param args The organization identifier and optional slug.
 * @returns The organization identifier plus the resolved current billing product and tier.
 * @remarks This refreshes the billing snapshot row after successfully resolving the current plan.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const assertWorkspacePlanForOrgInternal = effectInternalAction<
  WorkspacePlanAssertionArgs,
  WorkspacePlanAssertionResult,
  any
>({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: workspacePlanAssertionResultValidator,
  handler: assertWorkspacePlanForOrgInternalEffect,
});
