import { Effect } from "effect";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  schemaEffectInternalMutation,
  schemaEffectMutation,
} from "../confect";
import {
  requireActiveOrgClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { AuthError, ExternalServiceError, NotFoundError, ValidationError } from "../lib/errors/effect";
import { completePendingDeviceCodeEffect } from "./device_code_complete/program";
import {
  completeDeviceCodeArgsSchema,
  completeDeviceCodeInternalArgsSchema,
  completedDeviceCodeResultSchema,
  type CompleteDeviceCodeArgs,
  type CompleteDeviceCodeInternalArgs,
  type CompletedDeviceCodeResult,
} from "./device_code_complete/shared";

export type {
  CompleteDeviceCodeArgs,
  CompleteDeviceCodeInternalArgs,
  CompletedDeviceCodeResult,
} from "./device_code_complete/shared";

/**
 * Completes a device code for the current authenticated Clerk user.
 *
 * @param ctx The Convex mutation context.
 * @param args The user code to approve.
 * @returns The completed status and approved organization slug.
 * @remarks This requires an active organization in the current Clerk identity and delegates to the shared approval helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function completeDeviceCodeForCurrentUserEffect(
  args: CompleteDeviceCodeArgs,
): Effect.Effect<
  CompletedDeviceCodeResult,
  AuthError | ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgClaimsEffect(identity);

    return yield* completePendingDeviceCodeEffect(ctx, {
      userCode: args.userCode,
      clerkUserId: activeOrg.clerkUserId,
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
    }, clock.nowMs());
  });
}

export const completeDeviceCodeForCurrentUser = schemaEffectMutation({
  args: completeDeviceCodeArgsSchema,
  returns: completedDeviceCodeResultSchema,
  handler: completeDeviceCodeForCurrentUserEffect,
});

/**
 * Completes a device code for an explicitly supplied user and organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The user code and approving actor/org identity.
 * @returns The completed status and approved organization slug.
 * @remarks This is the internal approval entrypoint used by the HTTP CLI flow.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function completeDeviceCodeForCurrentUserInternalEffect(
  args: CompleteDeviceCodeInternalArgs,
): Effect.Effect<
  CompletedDeviceCodeResult,
  ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    return yield* completePendingDeviceCodeEffect(ctx, {
      userCode: args.userCode,
      clerkUserId: args.clerkUserId,
      orgId: args.orgId,
      orgSlug: args.orgSlug,
    }, clock.nowMs());
  });
}

export const completeDeviceCodeForCurrentUserInternal = schemaEffectInternalMutation({
  args: completeDeviceCodeInternalArgsSchema,
  returns: completedDeviceCodeResultSchema,
  handler: completeDeviceCodeForCurrentUserInternalEffect,
});
