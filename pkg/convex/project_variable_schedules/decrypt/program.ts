import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, effectMutation } from "../../confect";
import { NotFoundError } from "../../lib/errors/effect";
import { requireCurrentOrgProjectAccessEffect } from "../access";
import { decryptedScheduleValidator } from "../validators";
import { type DecryptForCurrentOrgProjectArgs } from "./shared";
import { decryptScheduledCreateEffect, decryptScheduledUpdateEffect } from "./values";
import { toScheduleExternalServiceError } from "../errors";

/**
 * Decrypts a scheduled variable batch for display in the workspace UI.
 *
 * @param args The workspace, project, and schedule identifier to decrypt.
 * @returns The decrypted scheduled batch payload.
 * @remarks This reveals plaintext values only for the duration of the current user interaction.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function decryptForCurrentOrgProjectEffect(
  args: DecryptForCurrentOrgProjectArgs,
): Effect.Effect<unknown, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
    const { project } = yield* requireCurrentOrgProjectAccessEffect(
      runtimeCtx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const schedule: Doc<"projectVariableSchedules"> | null = yield* Effect.tryPromise({
      try: () => runtimeCtx.db.get(args.scheduleId),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to load the scheduled variable batch.", error),
    });
    if (schedule === null || schedule.projectId !== project._id) {
      return yield* Effect.fail(new NotFoundError({ message: "Scheduled update not found." }));
    }

    const updatesById = new Map(
      schedule.updateTargets.map((entry) => [entry.id, entry.name] as const),
    );

    const creates = yield* Effect.forEach(schedule.preparedCreates, (entry) =>
      decryptScheduledCreateEffect(runtimeCtx, {
        projectId: project._id,
        orgId: project.orgId,
        entry,
      }),
    );

    const updates = yield* Effect.forEach(schedule.preparedUpdates, (entry) =>
      decryptScheduledUpdateEffect(runtimeCtx, {
        projectId: project._id,
        orgId: project.orgId,
        updatesById,
        entry,
      }),
    );

    return {
      id: schedule._id,
      stageSlug: schedule.stageSlug,
      timezone: schedule.timezone,
      runAtMs: schedule.runAtMs,
      status: schedule.status,
      creates,
      updates,
    };
  });
}

/**
 * Decrypts a scheduled variable batch for display in the workspace UI.
 *
 * @param args The workspace, project, and schedule identifier to decrypt.
 * @returns The decrypted scheduled batch payload.
 * @remarks This public mutation delegates to the Effect-native schedule decrypt program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const decryptForCurrentOrgProject = effectMutation<
  DecryptForCurrentOrgProjectArgs,
  unknown,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: decryptedScheduleValidator,
  handler: decryptForCurrentOrgProjectEffect,
});
