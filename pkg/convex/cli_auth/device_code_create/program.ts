import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  DEFAULT_DEVICE_EXPIRES_IN_SEC,
  DEFAULT_DEVICE_INTERVAL_SEC,
  DEVICE_CODE_BYTES,
  randomToken,
  randomUserCode,
  sha256Base64Url,
} from "../token_helpers";
import { toDeviceCodeCreateError } from "./errors";
import {
  hasDeviceCodeHashEffect,
  hasPendingUserCodeEffect,
  insertDeviceCodeEffect,
} from "./repo";
import type { CreateDeviceCodeArgs, CreatedDeviceCodeResult } from "./shared";

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
      const exists = yield* hasDeviceCodeHashEffect(ctx, candidateHash);
      if (!exists) {
        return {
          deviceCode: candidate,
          deviceCodeHash: candidateHash,
        };
      }
    }
  });
}

function allocateUserCodeEffect(
  ctx: MutationCtx,
): Effect.Effect<string, ExternalServiceError> {
  return Effect.gen(function* () {
    while (true) {
      const candidate = randomUserCode();
      const exists = yield* hasPendingUserCodeEffect(ctx, candidate);
      if (!exists) {
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
 * @param nowMs The current timestamp in milliseconds.
 * @returns An Effect that succeeds with the raw device code, user code, polling interval, and expiry window.
 * @remarks This writes a pending `cliDeviceCodes` row and guarantees unique device and user codes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function createDeviceCodeInternalEffect(
  ctx: MutationCtx,
  args: CreateDeviceCodeArgs,
  nowMs: number,
): Effect.Effect<CreatedDeviceCodeResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const { deviceCode, deviceCodeHash } = yield* allocateDeviceCodeEffect(ctx);
    const userCode = yield* allocateUserCodeEffect(ctx);
    const expiresInSec = DEFAULT_DEVICE_EXPIRES_IN_SEC;
    const intervalSec = DEFAULT_DEVICE_INTERVAL_SEC;

    yield* insertDeviceCodeEffect(ctx, {
      deviceCodeHash,
      userCode,
      clientName: args.clientName,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + expiresInSec * 1000,
      intervalSec,
    });

    return {
      deviceCode,
      userCode,
      intervalSec,
      expiresInSec,
    };
  });
}
