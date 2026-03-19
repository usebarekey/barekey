import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../confect";
import type { ExternalServiceError } from "../lib/errors/effect";
import { deleteEncryptedCutoverRowsEffect, loadEncryptedCutoverRowsEffect } from "./repo";
import { cancelScheduledCutoverFunctionsEffect } from "./scheduler";
import { type WipeEncryptedDataArgs, type WipeEncryptedDataResult } from "./shared";

/**
 * One-time cutover helper for destructive encryption migrations.
 *
 * @param ctx The Convex mutation context.
 * @returns An Effect that succeeds with the destructive wipe counts and completion timestamp.
 * @remarks This removes only the data whose ciphertext or wrapping format changed.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function wipeEncryptedDataInternalEffect(
  ctx: MutationCtx,
): Effect.Effect<WipeEncryptedDataResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const rows = yield* loadEncryptedCutoverRowsEffect(ctx);
    const cancelledScheduledFunctionCount = yield* cancelScheduledCutoverFunctionsEffect(
      rows.schedules.map((schedule) => ({
        _id: String(schedule._id),
        scheduledFunctionId:
          schedule.scheduledFunctionId === null ? null : String(schedule.scheduledFunctionId),
      })),
      (scheduledFunctionId) => ctx.scheduler.cancel(scheduledFunctionId as never),
    );

    yield* deleteEncryptedCutoverRowsEffect(ctx, {
      schedules: rows.schedules.map((row) => ({ _id: String(row._id) })),
      projectVariables: rows.projectVariables.map((row) => ({ _id: String(row._id) })),
      projectKeys: rows.projectKeys.map((row) => ({ _id: String(row._id) })),
      orgStorageUsageRows: rows.orgStorageUsageRows.map((row) => ({ _id: String(row._id) })),
    });

    return {
      projectKeyCount: rows.projectKeys.length,
      projectVariableCount: rows.projectVariables.length,
      projectVariableScheduleCount: rows.schedules.length,
      orgStorageUsageCount: rows.orgStorageUsageRows.length,
      cancelledScheduledFunctionCount,
      completedAtMs: Date.now(),
    };
  });
}

/**
 * One-time cutover helper for destructive encryption migrations.
 *
 * This removes only the data whose ciphertext/wrapping format changed:
 * project variable payloads, wrapped DEKs, scheduled variable writes, and the
 * mirrored encrypted-byte counters derived from those records.
 *
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const wipeEncryptedDataInternal = effectInternalMutation<
  WipeEncryptedDataArgs,
  WipeEncryptedDataResult,
  any
>({
  args: {
    confirm: v.literal("wipe_encrypted_data"),
  },
  returns: v.object({
    projectKeyCount: v.number(),
    projectVariableCount: v.number(),
    projectVariableScheduleCount: v.number(),
    orgStorageUsageCount: v.number(),
    cancelledScheduledFunctionCount: v.number(),
    completedAtMs: v.number(),
  }),
  handler: () =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* wipeEncryptedDataInternalEffect(ctx);
    }),
});
