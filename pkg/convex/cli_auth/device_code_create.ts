import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  DEFAULT_DEVICE_EXPIRES_IN_SEC,
  DEFAULT_DEVICE_INTERVAL_SEC,
  DEVICE_CODE_BYTES,
  randomToken,
  randomUserCode,
  sha256Base64Url,
} from "./token_helpers";

type CreateDeviceCodeArgs = {
  clientName: string | null;
};

type CreatedDeviceCodeResult = {
  deviceCode: string;
  userCode: string;
  intervalSec: number;
  expiresInSec: number;
};

/**
 * Normalizes device-code creation failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Device-code issuance uses the shared Effect error channel for token hashing and persistence failures.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toDeviceCodeCreateError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Allocates a unique device-code token and hash pair.
 *
 * @param ctx The Convex mutation context.
 * @returns An Effect that succeeds with the raw device code and its hash.
 * @remarks This loops until the `cliDeviceCodes` device-code hash index is free.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function allocateDeviceCodeEffect(
  ctx: MutationCtx,
): Effect.Effect<{ deviceCode: string; deviceCodeHash: string }, ExternalServiceError> {
  return Effect.gen(function* () {
    while (true) {
      const candidate = randomToken("bk_dc_", DEVICE_CODE_BYTES);
      const candidateHash = yield* Effect.tryPromise({
        try: () => sha256Base64Url(candidate),
        catch: (error) =>
          toDeviceCodeCreateError("Failed to hash the CLI device code.", error),
      });
      const existing = yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("cliDeviceCodes")
            .withIndex("by_device_code_hash", (q) => q.eq("deviceCodeHash", candidateHash))
            .unique(),
        catch: (error) =>
          toDeviceCodeCreateError("Failed to check existing CLI device codes.", error),
      });
      if (existing === null) {
        return {
          deviceCode: candidate,
          deviceCodeHash: candidateHash,
        };
      }
    }
  });
}

/**
 * Allocates a unique pending user code.
 *
 * @param ctx The Convex mutation context.
 * @returns An Effect that succeeds with the raw user code.
 * @remarks This loops until the `cliDeviceCodes` pending-user-code index is free.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function allocateUserCodeEffect(
  ctx: MutationCtx,
): Effect.Effect<string, ExternalServiceError> {
  return Effect.gen(function* () {
    while (true) {
      const candidate = randomUserCode();
      const existing = yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("cliDeviceCodes")
            .withIndex("by_user_code_and_status", (q) =>
              q.eq("userCode", candidate).eq("status", "pending"),
            )
            .unique(),
        catch: (error) =>
          toDeviceCodeCreateError("Failed to check existing CLI user codes.", error),
      });
      if (existing === null) {
        return candidate;
      }
    }
  });
}

/**
 * Creates a new pending CLI device-code flow.
 *
 * @param ctx The Convex mutation context.
 * @param args The optional CLI client name.
 * @returns An Effect that succeeds with the raw device code, user code, polling interval, and expiry window.
 * @remarks This writes a pending `cliDeviceCodes` row and guarantees unique device and user codes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function createDeviceCodeInternalEffect(
  ctx: MutationCtx,
  args: CreateDeviceCodeArgs,
): Effect.Effect<CreatedDeviceCodeResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const { deviceCode, deviceCodeHash } = yield* allocateDeviceCodeEffect(ctx);
    const userCode = yield* allocateUserCodeEffect(ctx);

    const now = Date.now();
    const expiresInSec = DEFAULT_DEVICE_EXPIRES_IN_SEC;
    const intervalSec = DEFAULT_DEVICE_INTERVAL_SEC;

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("cliDeviceCodes", {
          deviceCodeHash,
          userCode,
          status: "pending",
          clientName: args.clientName,
          approvedAtMs: null,
          approvedByClerkUserId: null,
          approvedOrgId: null,
          approvedOrgSlug: null,
          exchangedAtMs: null,
          createdAtMs: now,
          updatedAtMs: now,
          expiresAtMs: now + expiresInSec * 1000,
          intervalSec,
        }),
      catch: (error) =>
        toDeviceCodeCreateError("Failed to insert the CLI device-code row.", error),
    });

    return {
      deviceCode,
      userCode,
      intervalSec,
      expiresInSec,
    };
  });
}

/**
 * Creates a new pending CLI device-code flow.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The optional CLI client name.
 * @returns The raw device code, user code, polling interval, and expiry window.
 * @remarks This writes a pending `cliDeviceCodes` row and guarantees unique device and user codes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createDeviceCodeInternal = effectInternalMutation<
  CreateDeviceCodeArgs,
  CreatedDeviceCodeResult,
  any
>({
  args: {
    clientName: v.union(v.string(), v.null()),
  },
  returns: v.object({
    deviceCode: v.string(),
    userCode: v.string(),
    intervalSec: v.number(),
    expiresInSec: v.number(),
  }),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* createDeviceCodeInternalEffect(ctx, args);
    }),
});
