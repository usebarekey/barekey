import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbPatchEffect, dbUniqueEffect } from "../../lib/convex/db";
import { ExternalServiceError } from "../../lib/errors/effect";
import { toCliDeviceCodeError } from "./errors";

/**
 * Loads one pending CLI device code by user code.
 *
 * @param ctx The Convex mutation context.
 * @param userCode The normalized user code.
 * @returns An Effect that succeeds with the pending device-code row or `null`.
 * @remarks Approval only targets pending rows, so exchanged or expired rows are excluded here.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function findPendingDeviceCodeByUserCodeEffect(
  ctx: MutationCtx,
  userCode: string,
): Effect.Effect<Doc<"cliDeviceCodes"> | null, ExternalServiceError> {
  return dbUniqueEffect(
    ctx,
    "cliDeviceCodes",
    (query) =>
      query.withIndex("by_user_code_and_status", (indexQuery) =>
        indexQuery.eq("userCode", userCode).eq("status", "pending"),
      ),
    (error) => toCliDeviceCodeError("Failed to load the CLI device code.", error),
  );
}

/**
 * Marks one CLI device code as expired.
 *
 * @param ctx The Convex mutation context.
 * @param deviceCodeId The device-code row ID.
 * @param updatedAtMs The timestamp to persist.
 * @returns An Effect that completes when the row has been patched.
 * @remarks This keeps expiry writes consistent between approval and polling flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function markDeviceCodeExpiredEffect(
  ctx: MutationCtx,
  deviceCodeId: Id<"cliDeviceCodes">,
  updatedAtMs: number,
): Effect.Effect<void, ExternalServiceError> {
  return dbPatchEffect(
    ctx,
    deviceCodeId,
    {
      status: "expired",
      updatedAtMs,
    },
    (error) => toCliDeviceCodeError("Failed to mark the CLI device code as expired.", error),
  );
}

/**
 * Marks one pending CLI device code as approved.
 *
 * @param ctx The Convex mutation context.
 * @param input The approval payload to persist.
 * @returns An Effect that completes when the row has been patched.
 * @remarks This records the approving user and organization on the device-code row.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function approveDeviceCodeEffect(
  ctx: MutationCtx,
  input: {
    deviceCodeId: Id<"cliDeviceCodes">;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
    approvedAtMs: number;
  },
): Effect.Effect<void, ExternalServiceError> {
  return dbPatchEffect(
    ctx,
    input.deviceCodeId,
    {
      status: "approved",
      approvedAtMs: input.approvedAtMs,
      approvedByClerkUserId: input.clerkUserId,
      approvedOrgId: input.orgId,
      approvedOrgSlug: input.orgSlug,
      updatedAtMs: input.approvedAtMs,
    },
    (error) => toCliDeviceCodeError("Failed to approve the CLI device code.", error),
  );
}
