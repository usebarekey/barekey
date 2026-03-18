import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectMutation,
} from "../confect";
import { decryptSecretValueForProject } from "../lib/encryption";
import { NotFoundError, ValidationError } from "../lib/errors/effect";
import { requireCurrentOrgProjectAccessEffect } from "./access";
import { toScheduleExternalServiceError } from "./errors";
import {
  decryptedScheduleValidator,
} from "./validators";

type DecryptForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  scheduleId: Id<"projectVariableSchedules">;
};

function decryptForCurrentOrgProjectEffect(
  args: DecryptForCurrentOrgProjectArgs,
): Effect.Effect<unknown, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { project } = yield* requireCurrentOrgProjectAccessEffect(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const schedule: Doc<"projectVariableSchedules"> | null = yield* Effect.tryPromise({
      try: () => ctx.db.get(args.scheduleId),
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
      Effect.gen(function* () {
        if (entry.kind === "secret") {
          const value = yield* Effect.tryPromise({
            try: () =>
              decryptSecretValueForProject(ctx, {
                projectId: project._id,
                orgId: project.orgId,
                encryptedValue: entry.encryptedValue,
              }),
            catch: (error) =>
              toScheduleExternalServiceError(
                "Failed to decrypt a scheduled secret value.",
                error,
              ),
          });
          return {
            name: entry.name,
            visibility: entry.visibility,
            kind: "secret" as const,
            declaredType: entry.declaredType,
            value,
          };
        }

        const valueA = yield* Effect.tryPromise({
          try: () =>
            decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: entry.encryptedValueA,
            }),
          catch: (error) =>
            toScheduleExternalServiceError(
              "Failed to decrypt a scheduled variant value.",
              error,
            ),
        });
        const valueB = yield* Effect.tryPromise({
          try: () =>
            decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: entry.encryptedValueB,
            }),
          catch: (error) =>
            toScheduleExternalServiceError(
              "Failed to decrypt a scheduled variant value.",
              error,
            ),
        });

        if (entry.kind === "ab_roll") {
          return {
            name: entry.name,
            visibility: entry.visibility,
            kind: "ab_roll" as const,
            declaredType: entry.declaredType,
            valueA,
            valueB,
            chance: entry.chance,
          };
        }

        return {
          name: entry.name,
          visibility: entry.visibility,
          kind: "rollout" as const,
          declaredType: entry.declaredType,
          valueA,
          valueB,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones: entry.rolloutMilestones,
        };
      }),
    );

    const updates = yield* Effect.forEach(schedule.preparedUpdates, (entry) =>
      Effect.gen(function* () {
        const name = updatesById.get(entry.id);
        if (name === undefined) {
          return yield* Effect.fail(
            new ValidationError({
              message: "Scheduled update metadata is corrupted.",
            }),
          );
        }

        if (entry.kind === "secret") {
          const value = yield* Effect.tryPromise({
            try: () =>
              decryptSecretValueForProject(ctx, {
                projectId: project._id,
                orgId: project.orgId,
                encryptedValue: entry.encryptedValue,
              }),
            catch: (error) =>
              toScheduleExternalServiceError(
                "Failed to decrypt a scheduled secret value.",
                error,
              ),
          });
          return {
            id: entry.id,
            name,
            visibility: entry.visibility,
            kind: "secret" as const,
            declaredType: entry.declaredType,
            value,
          };
        }

        const valueA = yield* Effect.tryPromise({
          try: () =>
            decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: entry.encryptedValueA,
            }),
          catch: (error) =>
            toScheduleExternalServiceError(
              "Failed to decrypt a scheduled variant value.",
              error,
            ),
        });
        const valueB = yield* Effect.tryPromise({
          try: () =>
            decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: entry.encryptedValueB,
            }),
          catch: (error) =>
            toScheduleExternalServiceError(
              "Failed to decrypt a scheduled variant value.",
              error,
            ),
        });

        if (entry.kind === "ab_roll") {
          return {
            id: entry.id,
            name,
            visibility: entry.visibility,
            kind: "ab_roll" as const,
            declaredType: entry.declaredType,
            valueA,
            valueB,
            chance: entry.chance,
          };
        }

        return {
          id: entry.id,
          name,
          visibility: entry.visibility,
          kind: "rollout" as const,
          declaredType: entry.declaredType,
          valueA,
          valueB,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones: entry.rolloutMilestones,
        };
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
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, and schedule identifier to decrypt.
 * @returns The decrypted scheduled batch payload.
 * @remarks This reveals plaintext values only for the duration of the current user interaction.
 * @lastModified 2026-03-17
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
