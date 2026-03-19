import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_BYTES,
  randomToken,
  sha256Base64Url,
} from "../token_helpers";
import type { ApprovedDeviceCode } from "./approval";
import { toDeviceCodePollError } from "./errors";
import {
  insertCliSessionEffect,
  markDeviceCodeExchangedEffect,
} from "./repo";
import type { PollDeviceCodeResult } from "./shared";

/**
 * Exchanges one approved CLI device code into session tokens.
 *
 * @param ctx The Convex mutation context.
 * @param row The approved device-code row being exchanged.
 * @param approval The decoded approved identity payload.
 * @param nowMs The current timestamp in milliseconds.
 * @returns An Effect that succeeds with the approved poll result payload.
 * @remarks This writes `cliSessions` and marks the device code as exchanged exactly once.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function exchangeApprovedDeviceCodeEffect(
  ctx: MutationCtx,
  row: Doc<"cliDeviceCodes">,
  approval: ApprovedDeviceCode,
  nowMs: number,
): Effect.Effect<PollDeviceCodeResult, ExternalServiceError> {
  return Effect.gen(function* () {
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
    const accessTokenExpiresAtMs = nowMs + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = nowMs + REFRESH_TOKEN_TTL_MS;

    yield* insertCliSessionEffect(ctx, {
      sessionId: randomToken("bk_s_", 16),
      clerkUserId: approval.clerkUserId,
      orgId: approval.orgId,
      orgSlug: approval.orgSlug,
      accessTokenHash,
      refreshTokenHash,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      createdAtMs: nowMs,
    });
    yield* markDeviceCodeExchangedEffect(ctx, row._id, nowMs);

    return {
      status: "approved",
      intervalSec: row.intervalSec,
      accessToken,
      refreshToken,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      orgId: approval.orgId,
      orgSlug: approval.orgSlug,
      clerkUserId: approval.clerkUserId,
    };
  });
}
