import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectMutation,
} from "../confect";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { NotFoundError, ValidationError } from "../lib/errors/effect";
import { requireCurrentOrgProjectAccessEffect } from "./access";
import { toScheduleExternalServiceError } from "./errors";

type CancelForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  scheduleId: Id<"projectVariableSchedules">;
};

function cancelForCurrentOrgProjectEffect(
  args: CancelForCurrentOrgProjectArgs,
): Effect.Effect<null, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { activeOrg, project } = yield* requireCurrentOrgProjectAccessEffect(
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
    if (schedule.status !== "scheduled") {
      return yield* Effect.fail(
        new ValidationError({ message: "Only scheduled updates can be canceled." }),
      );
    }

    if (schedule.scheduledFunctionId !== null) {
      yield* Effect.tryPromise({
        try: () => ctx.scheduler.cancel(schedule.scheduledFunctionId!),
        catch: (error) =>
          toScheduleExternalServiceError(
            "Failed to cancel the scheduled execution.",
            error,
          ),
      });
    }

    const now = clock.nowMs();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(schedule._id, {
          status: "canceled",
          scheduledFunctionId: null,
          updatedByClerkUserId: activeOrg.clerkUserId,
          updatedAtMs: now,
          canceledAtMs: now,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to cancel the scheduled variable batch.", error),
    });

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: schedule.stageSlug,
      eventType: "schedule.canceled",
      category: "schedule",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "schedule",
      subjectId: String(schedule._id),
      subjectName: schedule.stageSlug,
      title: "Canceled scheduled variable batch",
      description: `A scheduled batch for ${project.slug}/${schedule.stageSlug} was canceled.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        timezone: schedule.timezone,
        runAtMs: schedule.runAtMs,
        counts: {
          created: schedule.createdCount,
          updated: schedule.updatedCount,
        },
      }),
      retentionTierOverride: null,
    });

    return null;
  });
}

/**
 * Cancels a scheduled variable batch that has not executed yet.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, and schedule identifier to cancel.
 * @returns `null` after the schedule is canceled.
 * @remarks This cancels the pending scheduler handle, marks the row as canceled, and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cancelForCurrentOrgProject = effectMutation<
  CancelForCurrentOrgProjectArgs,
  null,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: cancelForCurrentOrgProjectEffect,
});
