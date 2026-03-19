import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { assertWorkspacePlanForOrgInternalReference } from "../refs";
import {
  toWorkspacePlanError,
  workspacePlanAssertionResultValidator,
  type WorkspacePlanAssertionResult,
  type WorkspacePlanEffectError,
} from "./shared";

/**
 * Asserts that the active organization has an effective workspace plan.
 *
 * @param args The expected active organization slug.
 * @returns An Effect that succeeds with the resolved org id, product id, and tier.
 * @remarks This validates the active org before delegating to the org-scoped internal action.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function assertWorkspacePlanForCurrentOrgInternalEffect(
  args: {
    expectedOrgSlug: string;
  },
): Effect.Effect<WorkspacePlanAssertionResult, WorkspacePlanEffectError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const planState = (yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runAction(assertWorkspacePlanForOrgInternalReference, {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
        }),
      catch: (error) =>
        toWorkspacePlanError("Failed to resolve the active workspace billing plan.", error),
    })) as WorkspacePlanAssertionResult;

    return {
      orgId: activeOrg.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  });
}

/**
 * Asserts that the current authenticated organization has an active workspace plan.
 *
 * @param runtimeCtx The Convex internal action context.
 * @param args The expected organization slug.
 * @returns The organization identifier plus the resolved current billing product and tier.
 * @remarks This delegates to the org-scoped assertion after validating the active organization.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const assertWorkspacePlanForCurrentOrgInternal = effectInternalAction<
  {
    expectedOrgSlug: string;
  },
  WorkspacePlanAssertionResult,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: workspacePlanAssertionResultValidator,
  handler: assertWorkspacePlanForCurrentOrgInternalEffect,
});
