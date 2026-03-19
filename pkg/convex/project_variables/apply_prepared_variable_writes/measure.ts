import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../../confect";
import {
  toProjectVariableValidationError,
} from "../errors";
import { summarizePreparedWriteApplication } from "../prepared_write_summary";
import {
  measurePreparedVariableWritesArgs,
  storageDeltaResultValidator,
  type MeasurePreparedVariableWritesArgs,
} from "./shared";
import { loadPreparedWriteStageStateEffect } from "./state";

function measurePreparedVariableWritesForOrgProjectStageInternalEffect(
  args: MeasurePreparedVariableWritesArgs,
): Effect.Effect<{ storageDeltaBytes: number }, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { existingRows } = yield* loadPreparedWriteStageStateEffect(ctx, args);

    return yield* Effect.try({
      try: () =>
        summarizePreparedWriteApplication({
          existingRows,
          creates: args.creates,
          updates: args.updates,
          deletes: args.deletes,
        }),
      catch: (error) =>
        toProjectVariableValidationError(
          "Prepared variable write measurement is invalid.",
          error,
        ),
    });
  });
}

/**
 * Recomputes the storage delta of a prepared variable write against the latest
 * persisted stage state.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The org, project, stage, and prepared write payloads to measure.
 * @returns The net encrypted storage delta for the prepared write set.
 * @remarks This is used immediately before billed writes commit to catch drift between preparation and application.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const measurePreparedVariableWritesForOrgProjectStageInternal = effectInternalMutation<
  MeasurePreparedVariableWritesArgs,
  { storageDeltaBytes: number },
  any
>({
  args: measurePreparedVariableWritesArgs,
  returns: storageDeltaResultValidator,
  handler: measurePreparedVariableWritesForOrgProjectStageInternalEffect,
});
