import type { MutationCtx } from "../_generated/server";
import { Effect } from "effect";

import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectInternalMutation,
} from "../confect";
import { pollDeviceCodeInternalEffect } from "./device_code_poll/program";
import {
  pollDeviceCodeArgs,
  pollDeviceCodeResultValidator,
  type PollDeviceCodeArgs,
  type PollDeviceCodeResult,
} from "./device_code_poll/shared";

export type { PollDeviceCodeArgs, PollDeviceCodeResult } from "./device_code_poll/shared";

/**
 * Polls a device-code flow and exchanges an approved code into CLI session tokens.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw device code to poll.
 * @returns The current device-code state plus tokens when approval has completed.
 * @remarks This may insert `cliSessions` and mark the device code as exchanged exactly once.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const pollDeviceCodeInternal = effectInternalMutation<
  PollDeviceCodeArgs,
  PollDeviceCodeResult,
  any
>({
  args: pollDeviceCodeArgs,
  returns: pollDeviceCodeResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const clock = yield* ClockService;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* pollDeviceCodeInternalEffect(ctx, args, clock.nowMs());
    }),
});
