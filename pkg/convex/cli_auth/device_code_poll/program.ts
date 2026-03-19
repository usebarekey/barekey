import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { ExternalServiceError } from "../../lib/errors/effect";
import { DEFAULT_DEVICE_INTERVAL_SEC, sha256Base64Url } from "../token_helpers";
import { decodeApprovedDeviceCode } from "./approval";
import { toDeviceCodePollError } from "./errors";
import { exchangeApprovedDeviceCodeEffect } from "./exchange";
import {
  loadDeviceCodeRowEffect,
  markDeviceCodeExpiredEffect,
} from "./repo";
import { buildPendingPollResult, type PollDeviceCodeArgs, type PollDeviceCodeResult } from "./shared";

/**
 * Polls a device-code flow and exchanges an approved code into CLI session tokens.
 *
 * @param ctx The Convex mutation context.
 * @param args The raw device code to poll.
 * @param nowMs The current timestamp in milliseconds.
 * @returns An Effect that succeeds with the current device-code state plus tokens when approval has completed.
 * @remarks This may insert `cliSessions` and mark the device code as exchanged exactly once.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function pollDeviceCodeInternalEffect(
  ctx: MutationCtx,
  args: PollDeviceCodeArgs,
  nowMs: number,
): Effect.Effect<PollDeviceCodeResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const deviceCodeHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(args.deviceCode),
      catch: (error) =>
        toDeviceCodePollError("Failed to hash the CLI device code.", error),
    });
    const deviceCodeRow = yield* loadDeviceCodeRowEffect(ctx, deviceCodeHash);

    if (deviceCodeRow === null) {
      return buildPendingPollResult("invalid", DEFAULT_DEVICE_INTERVAL_SEC);
    }

    if (deviceCodeRow.expiresAtMs <= nowMs && deviceCodeRow.status !== "exchanged") {
      if (deviceCodeRow.status !== "expired") {
        yield* markDeviceCodeExpiredEffect(ctx, deviceCodeRow._id, nowMs);
      }
      return buildPendingPollResult("expired", deviceCodeRow.intervalSec);
    }

    if (deviceCodeRow.status === "pending") {
      return buildPendingPollResult("pending", deviceCodeRow.intervalSec);
    }

    if (deviceCodeRow.status === "exchanged") {
      return buildPendingPollResult("already_exchanged", deviceCodeRow.intervalSec);
    }

    const approval = decodeApprovedDeviceCode(deviceCodeRow);
    if (approval === null) {
      return buildPendingPollResult("invalid", deviceCodeRow.intervalSec);
    }

    return yield* exchangeApprovedDeviceCodeEffect(ctx, deviceCodeRow, approval, nowMs);
  });
}
