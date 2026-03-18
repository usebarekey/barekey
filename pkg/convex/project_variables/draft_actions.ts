import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { BarekeyConfectActionCtx, effectAction } from "../confect";
import { appendAuditEventEffect } from "../lib/confect/audit";
import type { DeclaredVariableType } from "../lib/declared/types";
import type { RolloutFunction, RolloutMilestone } from "../lib/rollout";
import { validateRolloutMilestones } from "../lib/rollout";
import {
  draftUpdateValidator,
  writeEntryValidator,
} from "../lib/project_variables/contracts";
import { mapVariableMetadataRow } from "../lib/project_variables/rows";
import { validateChance } from "../lib/project_variables/validation";
import type { VariableVisibility } from "../lib/visibility";
import { requireCurrentOrgAccessEffect } from "./access";
import {
  projectVariableValidationError,
  toProjectVariableExternalServiceError,
} from "./errors";
import {
  listVariableMetadataForOrgProjectStageInternalReference,
  writeVariablesForOrgProjectStageWithUsageInternalReference,
} from "./refs";
import type { DraftWriteResult } from "./types";

type VariableMetadataRow = ReturnType<typeof mapVariableMetadataRow>;

type ApplyDraftArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<{
    name: string;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
    value?: string;
    valueA?: string;
    valueB?: string;
    chance?: number;
    rolloutFunction?: RolloutFunction;
    rolloutMilestones?: Array<RolloutMilestone>;
  }>;
  updates: Array<{
    id: Id<"projectVariables">;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
    value?: string;
    valueA?: string;
    valueB?: string;
    chance?: number;
    rolloutFunction?: RolloutFunction;
    rolloutMilestones?: Array<RolloutMilestone>;
  }>;
  deletes: Array<Id<"projectVariables">>;
};

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * @param args The workspace, project, stage, and staged variable changes to apply.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This delegates metered persistence to the internal write pipeline and appends an audit event after success.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function applyDraftForCurrentOrgProjectStageEffect(
  args: ApplyDraftArgs,
): Effect.Effect<DraftWriteResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const activeOrg = yield* requireCurrentOrgAccessEffect(ctx, args.expectedOrgSlug);

    const existingRows = (yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(listVariableMetadataForOrgProjectStageInternalReference, {
          orgId: activeOrg.orgId,
          projectSlug: args.projectSlug,
          stageSlug: args.stageSlug,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to load existing variables for the draft write.",
          error,
        ),
    })) as Array<VariableMetadataRow>;
    const existingById = new Map(existingRows.map((row) => [row.id, row] as const));

    const entries = [...args.creates];
    for (const update of args.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable update target does not exist."),
        );
      }

      if (update.kind === "secret") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "secret",
          declaredType: update.declaredType,
          value: update.value ?? "",
        });
        continue;
      }

      if (update.kind === "ab_roll") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "ab_roll",
          declaredType: update.declaredType,
          valueA: update.valueA ?? "",
          valueB: update.valueB ?? "",
          chance: validateChance(update.chance ?? 0),
        });
        continue;
      }

      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "rollout",
        declaredType: update.declaredType,
        valueA: update.valueA ?? "",
        valueB: update.valueB ?? "",
        rolloutFunction: update.rolloutFunction ?? "linear",
        rolloutMilestones: validateRolloutMilestones(update.rolloutMilestones ?? []),
      });
    }

    const deletes: Array<string> = [];
    for (const variableId of args.deletes) {
      const existing = existingById.get(variableId);
      if (existing === undefined) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable delete target does not exist."),
        );
      }
      deletes.push(existing.name);
    }

    const result = (yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(writeVariablesForOrgProjectStageWithUsageInternalReference, {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
          clerkUserId: activeOrg.clerkUserId,
          projectSlug: args.projectSlug,
          stageSlug: args.stageSlug,
          mode: "upsert",
          entries,
          deletes,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to apply staged variable changes.",
          error,
        ),
    })) as DraftWriteResult;

    const touchedEntries = [
      ...args.creates.map((entry) => ({
        operation: "create",
        name: entry.name,
        kind: entry.kind,
        visibility: entry.visibility,
        declaredType: entry.declaredType,
      })),
      ...args.updates.map((entry) => {
        const existing = existingById.get(entry.id);
        return {
          operation: "update",
          name: existing?.name ?? "unknown",
          kind: entry.kind,
          visibility: entry.visibility,
          declaredType: entry.declaredType,
        };
      }),
      ...args.deletes.map((variableId) => {
        const existing = existingById.get(variableId);
        return {
          operation: "delete",
          name: existing?.name ?? "unknown",
          kind: existing?.kind ?? "secret",
          visibility: existing?.visibility ?? "private",
          declaredType: existing?.declaredType ?? "string",
        };
      }),
    ];

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: null,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      eventType: "variable.draft_applied",
      category: "variable",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: args.stageSlug,
      subjectName: args.stageSlug,
      title: `Applied ${touchedEntries.length} variable change${touchedEntries.length === 1 ? "" : "s"}`,
      description: `Updated ${args.projectSlug}/${args.stageSlug} with ${result.createdCount} create${result.createdCount === 1 ? "" : "s"}, ${result.updatedCount} update${result.updatedCount === 1 ? "" : "s"}, and ${result.deletedCount} delete${result.deletedCount === 1 ? "" : "s"}.`,
      severity: touchedEntries.some((entry) => entry.visibility === "private")
        ? "sensitive"
        : "info",
      payloadJson: JSON.stringify({
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        counts: result,
        variables: touchedEntries,
      }),
      retentionTierOverride: null,
    });

    return result;
  });
}

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * The action reserves billable storage before writes and runs a compensating
 * adjustment if a write fails after reservation.
 *
 * @param ctx The Convex action context.
 * @param args The workspace, project, stage, and staged variable changes to apply.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This delegates metered persistence to the internal write pipeline and appends an audit event after success.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyDraftForCurrentOrgProjectStage = effectAction({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(writeEntryValidator),
    updates: v.array(draftUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: applyDraftForCurrentOrgProjectStageEffect,
});
