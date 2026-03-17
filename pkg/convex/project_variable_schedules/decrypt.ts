import { v } from "convex/values";

import { mutation } from "../confect";
import { decryptSecretValueForProject } from "../lib/encryption";
import { requireCurrentOrgProjectAccess } from "./access";
import {
  decryptedScheduleValidator,
} from "./validators";

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
export const decryptForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: decryptedScheduleValidator,
  handler: async (ctx, args) => {
    const { project } = await requireCurrentOrgProjectAccess(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null || schedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }

    const updatesById = new Map(
      schedule.updateTargets.map((entry) => [entry.id, entry.name] as const),
    );

    const creates = await Promise.all(
      schedule.preparedCreates.map(async (entry) => {
        if (entry.kind === "secret") {
          const value = await decryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            encryptedValue: entry.encryptedValue,
          });
          return {
            name: entry.name,
            visibility: entry.visibility,
            kind: "secret" as const,
            declaredType: entry.declaredType,
            value,
          };
        }

        const valueA = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: entry.encryptedValueA,
        });
        const valueB = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: entry.encryptedValueB,
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

    const updates = await Promise.all(
      schedule.preparedUpdates.map(async (entry) => {
        const name = updatesById.get(entry.id);
        if (name === undefined) {
          throw new Error("Scheduled update metadata is corrupted.");
        }

        if (entry.kind === "secret") {
          const value = await decryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            encryptedValue: entry.encryptedValue,
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

        const valueA = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: entry.encryptedValueA,
        });
        const valueB = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: entry.encryptedValueB,
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
  },
});
