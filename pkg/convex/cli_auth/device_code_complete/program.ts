import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import {
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors/effect";
import { appendDeviceCodeApprovedAuditEffect } from "./audit";
import { approveDeviceCodeEffect, findPendingDeviceCodeByUserCodeEffect, markDeviceCodeExpiredEffect } from "./repo";
import { decodeUserCodeEffect, type CompletedDeviceCodeResult } from "./shared";

/**
 * Approves a pending CLI device code for a specific user and organization.
 *
 * @param ctx The Convex mutation context.
 * @param input The user code and approving actor/org identity.
 * @param nowMs The current timestamp in milliseconds.
 * @returns The completed status and approved organization slug.
 * @remarks This patches `cliDeviceCodes` and appends a CLI audit event for the approval.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function completePendingDeviceCodeEffect(
  ctx: MutationCtx,
  input: {
    userCode: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
  nowMs: number,
): Effect.Effect<
  CompletedDeviceCodeResult,
  ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const normalizedUserCode = yield* decodeUserCodeEffect(input.userCode);
    const deviceCodeRow = yield* findPendingDeviceCodeByUserCodeEffect(ctx, normalizedUserCode);

    if (deviceCodeRow === null) {
      return yield* Effect.fail(
        new NotFoundError({ message: "Device code not found or already used." }),
      );
    }

    if (deviceCodeRow.expiresAtMs <= nowMs) {
      yield* markDeviceCodeExpiredEffect(ctx, deviceCodeRow._id, nowMs);
      return yield* Effect.fail(new ValidationError({ message: "Device code has expired." }));
    }

    yield* approveDeviceCodeEffect(ctx, {
      deviceCodeId: deviceCodeRow._id,
      clerkUserId: input.clerkUserId,
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      approvedAtMs: nowMs,
    });
    yield* appendDeviceCodeApprovedAuditEffect(deviceCodeRow, input);

    return {
      status: "completed",
      orgSlug: input.orgSlug,
    };
  });
}
