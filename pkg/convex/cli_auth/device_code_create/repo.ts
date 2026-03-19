import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { dbInsertEffect, dbUniqueEffect } from "../../lib/convex/db";
import { ExternalServiceError } from "../../lib/errors/effect";
import { toDeviceCodeCreateError } from "./errors";

/**
 * Checks whether a CLI device-code hash already exists.
 *
 * @param ctx The Convex mutation context.
 * @param deviceCodeHash The hashed device code candidate.
 * @returns An Effect that succeeds with `true` when the hash is already in use.
 * @remarks Device-code allocation loops through this helper until the unique index is free.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function hasDeviceCodeHashEffect(
  ctx: MutationCtx,
  deviceCodeHash: string,
): Effect.Effect<boolean, ExternalServiceError> {
  return dbUniqueEffect(
    ctx,
    "cliDeviceCodes",
    (query) =>
      query.withIndex("by_device_code_hash", (indexQuery) =>
        indexQuery.eq("deviceCodeHash", deviceCodeHash),
      ),
    (error) => toDeviceCodeCreateError("Failed to check existing CLI device codes.", error),
  ).pipe(Effect.map((row) => row !== null));
}

/**
 * Checks whether a pending CLI user code already exists.
 *
 * @param ctx The Convex mutation context.
 * @param userCode The pending user-code candidate.
 * @returns An Effect that succeeds with `true` when the user code is already in use.
 * @remarks Device-code issuance keeps pending user codes unique through this helper.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function hasPendingUserCodeEffect(
  ctx: MutationCtx,
  userCode: string,
): Effect.Effect<boolean, ExternalServiceError> {
  return dbUniqueEffect(
    ctx,
    "cliDeviceCodes",
    (query) =>
      query.withIndex("by_user_code_and_status", (indexQuery) =>
        indexQuery.eq("userCode", userCode).eq("status", "pending"),
      ),
    (error) => toDeviceCodeCreateError("Failed to check existing CLI user codes.", error),
  ).pipe(Effect.map((row) => row !== null));
}

/**
 * Inserts a new pending CLI device-code row.
 *
 * @param ctx The Convex mutation context.
 * @param input The pending device-code payload to persist.
 * @returns An Effect that completes when the row has been inserted.
 * @remarks This writes `cliDeviceCodes` with pending approval metadata and the configured expiry window.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertDeviceCodeEffect(
  ctx: MutationCtx,
  input: {
    deviceCodeHash: string;
    userCode: string;
    clientName: string | null;
    createdAtMs: number;
    expiresAtMs: number;
    intervalSec: number;
  },
): Effect.Effect<void, ExternalServiceError> {
  return dbInsertEffect(
    ctx,
    "cliDeviceCodes",
    {
      deviceCodeHash: input.deviceCodeHash,
      userCode: input.userCode,
      status: "pending",
      clientName: input.clientName,
      approvedAtMs: null,
      approvedByClerkUserId: null,
      approvedOrgId: null,
      approvedOrgSlug: null,
      exchangedAtMs: null,
      createdAtMs: input.createdAtMs,
      updatedAtMs: input.createdAtMs,
      expiresAtMs: input.expiresAtMs,
      intervalSec: input.intervalSec,
    },
    (error) => toDeviceCodeCreateError("Failed to insert the CLI device-code row.", error),
  ).pipe(Effect.asVoid);
}
