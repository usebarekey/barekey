import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
  effectMutation,
} from "../confect";
import {
  requireActiveOrgClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { AuthError, ExternalServiceError, NotFoundError, ValidationError } from "../lib/errors/effect";

function toCliDeviceCodeError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Approves a pending CLI device code for a specific user and organization.
 *
 * @param ctx The Convex mutation context.
 * @param input The user code and approving actor/org identity.
 * @returns The completed status and approved organization slug.
 * @remarks This patches `cliDeviceCodes` and appends a CLI audit event for the approval.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function completePendingDeviceCodeEffect(
  ctx: MutationCtx,
  input: {
    userCode: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
): Effect.Effect<
  {
    status: "completed";
    orgSlug: string;
  },
  ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const normalizedUserCode = input.userCode.trim().toUpperCase();
    if (normalizedUserCode.length === 0) {
      return yield* Effect.fail(new ValidationError({ message: "Device code is required." }));
    }

    const deviceCodeRow = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("cliDeviceCodes")
          .withIndex("by_user_code_and_status", (q) =>
            q.eq("userCode", normalizedUserCode).eq("status", "pending"),
          )
          .unique(),
      catch: (error) =>
        toCliDeviceCodeError("Failed to load the CLI device code.", error),
    });

    if (deviceCodeRow === null) {
      return yield* Effect.fail(
        new NotFoundError({ message: "Device code not found or already used." }),
      );
    }

    const now = Date.now();
    if (deviceCodeRow.expiresAtMs <= now) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch(deviceCodeRow._id, {
            status: "expired",
            updatedAtMs: now,
          }),
        catch: (error) =>
          toCliDeviceCodeError("Failed to mark the CLI device code as expired.", error),
      });
      return yield* Effect.fail(new ValidationError({ message: "Device code has expired." }));
    }

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(deviceCodeRow._id, {
          status: "approved",
          approvedAtMs: now,
          approvedByClerkUserId: input.clerkUserId,
          approvedOrgId: input.orgId,
          approvedOrgSlug: input.orgSlug,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toCliDeviceCodeError("Failed to approve the CLI device code.", error),
    });

    yield* appendAuditEventEffect({
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: "cli.device_code_approved",
      category: "cli",
      actorSource: "cli",
      actorClerkUserId: input.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "cli_session",
      subjectId: deviceCodeRow.userCode,
      subjectName: deviceCodeRow.clientName ?? "CLI device flow",
      title: "Approved CLI sign-in",
      description: `A CLI device code was approved for workspace ${input.orgSlug}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        userCode: deviceCodeRow.userCode,
        clientName: deviceCodeRow.clientName,
      }),
      retentionTierOverride: null,
    });

    return {
      status: "completed",
      orgSlug: input.orgSlug,
    };
  });
}

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
  args: {
    userCode: string;
  },
): Effect.Effect<
  {
    status: "completed";
    orgSlug: string;
  },
  AuthError | ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgClaimsEffect(identity);

    return yield* completePendingDeviceCodeEffect(ctx, {
      userCode: args.userCode,
      clerkUserId: activeOrg.clerkUserId,
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
    });
  });
}

export const completeDeviceCodeForCurrentUser = effectMutation({
  args: {
    userCode: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
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
  args: {
    userCode: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
): Effect.Effect<
  {
    status: "completed";
    orgSlug: string;
  },
  ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    return yield* completePendingDeviceCodeEffect(ctx, {
      userCode: args.userCode,
      clerkUserId: args.clerkUserId,
      orgId: args.orgId,
      orgSlug: args.orgSlug,
    });
  });
}

export const completeDeviceCodeForCurrentUserInternal = effectInternalMutation({
  args: {
    userCode: v.string(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
  handler: completeDeviceCodeForCurrentUserInternalEffect,
});
