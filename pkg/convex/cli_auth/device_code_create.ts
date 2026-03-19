import { Effect } from "effect";

import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectInternalMutation,
} from "../confect";
import { createDeviceCodeInternalEffect } from "./device_code_create/program";
import {
  createDeviceCodeArgs,
  createdDeviceCodeResultValidator,
  type CreateDeviceCodeArgs,
  type CreatedDeviceCodeResult,
} from "./device_code_create/shared";

export type { CreateDeviceCodeArgs, CreatedDeviceCodeResult } from "./device_code_create/shared";

/**
 * Creates a new pending CLI device-code flow.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The optional CLI client name.
 * @returns The raw device code, user code, polling interval, and expiry window.
 * @remarks This writes a pending `cliDeviceCodes` row and guarantees unique device and user codes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const createDeviceCodeInternal = effectInternalMutation<
  CreateDeviceCodeArgs,
  CreatedDeviceCodeResult,
  any
>({
  args: createDeviceCodeArgs,
  returns: createdDeviceCodeResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const clock = yield* ClockService;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* createDeviceCodeInternalEffect(ctx, args, clock.nowMs());
    }),
});
