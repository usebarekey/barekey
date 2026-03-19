import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbInsertEffect, dbPatchEffect, dbUniqueEffect } from "../../lib/convex/db";
import { ExternalServiceError } from "../../lib/errors/effect";
import { toDeviceCodePollError } from "./errors";

/**
 * Loads one CLI device-code row by hashed device code.
 *
 * @param ctx The Convex mutation context.
 * @param deviceCodeHash The hashed raw device code.
 * @returns An Effect that succeeds with the matching device-code row or `null`.
 * @remarks Device-code polling always reads through this helper so persistence errors stay typed.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadDeviceCodeRowEffect(
  ctx: MutationCtx,
  deviceCodeHash: string,
): Effect.Effect<Doc<"cliDeviceCodes"> | null, ExternalServiceError> {
  return dbUniqueEffect(
    ctx,
    "cliDeviceCodes",
    (query) =>
      query.withIndex("by_device_code_hash", (indexQuery) =>
        indexQuery.eq("deviceCodeHash", deviceCodeHash),
      ),
    (error) => toDeviceCodePollError("Failed to load the CLI device-code row.", error),
  );
}

/**
 * Marks one CLI device code as expired.
 *
 * @param ctx The Convex mutation context.
 * @param deviceCodeId The row ID to patch.
 * @param updatedAtMs The timestamp to persist.
 * @returns An Effect that completes when the row has been patched.
 * @remarks This only updates status metadata and does not create any session rows.
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
    (error) => toDeviceCodePollError("Failed to mark the CLI device code as expired.", error),
  );
}

/**
 * Inserts a new CLI session created from an approved device-code exchange.
 *
 * @param ctx The Convex mutation context.
 * @param input The session payload to insert.
 * @returns An Effect that completes when the session row has been inserted.
 * @remarks This writes `cliSessions` exactly once per successful exchange.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertCliSessionEffect(
  ctx: MutationCtx,
  input: {
    sessionId: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
    accessTokenHash: string;
    refreshTokenHash: string;
    accessTokenExpiresAtMs: number;
    refreshTokenExpiresAtMs: number;
    createdAtMs: number;
  },
): Effect.Effect<void, ExternalServiceError> {
  return dbInsertEffect(
    ctx,
    "cliSessions",
    {
      sessionId: input.sessionId,
      clerkUserId: input.clerkUserId,
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      accessTokenHash: input.accessTokenHash,
      refreshTokenHash: input.refreshTokenHash,
      accessTokenExpiresAtMs: input.accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs: input.refreshTokenExpiresAtMs,
      revokedAtMs: null,
      createdAtMs: input.createdAtMs,
      updatedAtMs: input.createdAtMs,
      lastUsedAtMs: input.createdAtMs,
    },
    (error) => toDeviceCodePollError("Failed to create the exchanged CLI session.", error),
  ).pipe(Effect.asVoid);
}

/**
 * Marks one CLI device code as exchanged.
 *
 * @param ctx The Convex mutation context.
 * @param deviceCodeId The row ID to patch.
 * @param exchangedAtMs The timestamp to persist.
 * @returns An Effect that completes when the row has been patched.
 * @remarks This records the one-time exchange boundary after session creation succeeds.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function markDeviceCodeExchangedEffect(
  ctx: MutationCtx,
  deviceCodeId: Id<"cliDeviceCodes">,
  exchangedAtMs: number,
): Effect.Effect<void, ExternalServiceError> {
  return dbPatchEffect(
    ctx,
    deviceCodeId,
    {
      status: "exchanged",
      exchangedAtMs,
      updatedAtMs: exchangedAtMs,
    },
    (error) => toDeviceCodePollError("Failed to mark the CLI device code as exchanged.", error),
  );
}
