import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  ACCESS_TOKEN_TTL_MS,
  DEFAULT_DEVICE_INTERVAL_SEC,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_BYTES,
  randomToken,
  sha256Base64Url,
} from "./token_helpers";

type PollDeviceCodeArgs = {
  deviceCode: string;
};

type PollDeviceCodeResult = {
  status: "pending" | "approved" | "invalid" | "expired" | "already_exchanged";
  intervalSec: number;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAtMs: number | null;
  refreshTokenExpiresAtMs: number | null;
  orgId: string | null;
  orgSlug: string | null;
  clerkUserId: string | null;
};

/**
 * Normalizes device-code polling failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Device-code exchange uses the shared Effect error channel for hashing and persistence failures.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toDeviceCodePollError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

function invalidPollResult(intervalSec: number): PollDeviceCodeResult {
  return {
    status: "invalid",
    intervalSec,
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAtMs: null,
    refreshTokenExpiresAtMs: null,
    orgId: null,
    orgSlug: null,
    clerkUserId: null,
  };
}

/**
 * Polls a device-code flow and exchanges an approved code into CLI session tokens.
 *
 * @param ctx The Convex mutation context.
 * @param args The raw device code to poll.
 * @returns An Effect that succeeds with the current device-code state plus tokens when approval has completed.
 * @remarks This may insert `cliSessions` and mark the device code as exchanged exactly once.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function pollDeviceCodeInternalEffect(
  ctx: MutationCtx,
  args: PollDeviceCodeArgs,
): Effect.Effect<PollDeviceCodeResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const deviceCodeHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(args.deviceCode),
      catch: (error) =>
        toDeviceCodePollError("Failed to hash the CLI device code.", error),
    });
    const deviceCodeRow = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("cliDeviceCodes")
          .withIndex("by_device_code_hash", (q) => q.eq("deviceCodeHash", deviceCodeHash))
          .unique(),
      catch: (error) =>
        toDeviceCodePollError("Failed to load the CLI device-code row.", error),
    });

    if (deviceCodeRow === null) {
      return invalidPollResult(DEFAULT_DEVICE_INTERVAL_SEC);
    }

    const now = Date.now();
    if (deviceCodeRow.expiresAtMs <= now && deviceCodeRow.status !== "exchanged") {
      if (deviceCodeRow.status !== "expired") {
        yield* Effect.tryPromise({
          try: () =>
            ctx.db.patch(deviceCodeRow._id, {
              status: "expired",
              updatedAtMs: now,
            }),
          catch: (error) =>
            toDeviceCodePollError("Failed to mark the CLI device code as expired.", error),
        });
      }
      return {
        status: "expired",
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (deviceCodeRow.status === "pending") {
      return {
        status: "pending",
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (deviceCodeRow.status === "exchanged") {
      return {
        status: "already_exchanged",
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (
      deviceCodeRow.approvedByClerkUserId === null ||
      deviceCodeRow.approvedOrgId === null ||
      deviceCodeRow.approvedOrgSlug === null
    ) {
      return invalidPollResult(deviceCodeRow.intervalSec);
    }
    const approvedClerkUserId = deviceCodeRow.approvedByClerkUserId;
    const approvedOrgId = deviceCodeRow.approvedOrgId;
    const approvedOrgSlug = deviceCodeRow.approvedOrgSlug;

    const accessToken = randomToken("bk_at_", TOKEN_BYTES);
    const refreshToken = randomToken("bk_rt_", TOKEN_BYTES);
    const accessTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(accessToken),
      catch: (error) =>
        toDeviceCodePollError("Failed to hash the exchanged CLI access token.", error),
    });
    const refreshTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(refreshToken),
      catch: (error) =>
        toDeviceCodePollError("Failed to hash the exchanged CLI refresh token.", error),
    });
    const accessTokenExpiresAtMs = now + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = now + REFRESH_TOKEN_TTL_MS;

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("cliSessions", {
          sessionId: randomToken("bk_s_", 16),
          clerkUserId: approvedClerkUserId,
          orgId: approvedOrgId,
          orgSlug: approvedOrgSlug,
          accessTokenHash,
          refreshTokenHash,
          accessTokenExpiresAtMs,
          refreshTokenExpiresAtMs,
          revokedAtMs: null,
          createdAtMs: now,
          updatedAtMs: now,
          lastUsedAtMs: now,
        }),
      catch: (error) =>
        toDeviceCodePollError("Failed to create the exchanged CLI session.", error),
    });

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(deviceCodeRow._id, {
          status: "exchanged",
          exchangedAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toDeviceCodePollError("Failed to mark the CLI device code as exchanged.", error),
    });

    return {
      status: "approved",
      intervalSec: deviceCodeRow.intervalSec,
      accessToken,
      refreshToken,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      orgId: approvedOrgId,
      orgSlug: approvedOrgSlug,
      clerkUserId: approvedClerkUserId,
    };
  });
}

/**
 * Polls a device-code flow and exchanges an approved code into CLI session tokens.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw device code to poll.
 * @returns The current device-code state plus tokens when approval has completed.
 * @remarks This may insert `cliSessions` and mark the device code as exchanged exactly once.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const pollDeviceCodeInternal = effectInternalMutation<
  PollDeviceCodeArgs,
  PollDeviceCodeResult,
  any
>({
  args: {
    deviceCode: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("invalid"),
      v.literal("expired"),
      v.literal("already_exchanged"),
    ),
    intervalSec: v.number(),
    accessToken: v.union(v.string(), v.null()),
    refreshToken: v.union(v.string(), v.null()),
    accessTokenExpiresAtMs: v.union(v.number(), v.null()),
    refreshTokenExpiresAtMs: v.union(v.number(), v.null()),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    clerkUserId: v.union(v.string(), v.null()),
  }),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* pollDeviceCodeInternalEffect(ctx, args);
    }),
});
