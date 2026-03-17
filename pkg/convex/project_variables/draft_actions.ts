import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../confect";
import type { DeclaredVariableType } from "../lib/declared_types";
import type { RolloutFunction, RolloutMilestone } from "../lib/rollout";
import { validateRolloutMilestones } from "../lib/rollout";
import {
  draftUpdateValidator,
  mapVariableMetadataRow,
  validateChance,
  writeEntryValidator,
} from "../lib/project_variables_shared";
import type { VariableVisibility } from "../lib/visibility";
import { requireCurrentOrgAccess } from "./access";
import type { DraftWriteResult } from "./types";

type VariableMetadataRow = ReturnType<typeof mapVariableMetadataRow>;

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
export const applyDraftForCurrentOrgProjectStage = action({
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
  handler: async (ctx, args): Promise<DraftWriteResult> => {
    const activeOrg = await requireCurrentOrgAccess(ctx, args.expectedOrgSlug);

    const existingRows: Array<VariableMetadataRow> = await ctx.runQuery(
      internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
      {
        orgId: activeOrg.orgId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
      },
    );
    const existingById = new Map(existingRows.map((row) => [row.id, row] as const));

    const entries = [...args.creates];
    for (const update of args.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        throw new Error("Variable update target does not exist.");
      }

      if (update.kind === "secret") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "secret",
          declaredType: update.declaredType,
          value: update.value,
        });
        continue;
      }

      if (update.kind === "ab_roll") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "ab_roll",
          declaredType: update.declaredType,
          valueA: update.valueA,
          valueB: update.valueB,
          chance: validateChance(update.chance),
        });
        continue;
      }

      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "rollout",
        declaredType: update.declaredType,
        valueA: update.valueA,
        valueB: update.valueB,
        rolloutFunction: update.rolloutFunction,
        rolloutMilestones: validateRolloutMilestones(update.rolloutMilestones),
      });
    }

    const deletes = args.deletes.map((variableId) => {
      const existing = existingById.get(variableId);
      if (existing === undefined) {
        throw new Error("Variable delete target does not exist.");
      }
      return existing.name;
    });

    const result = await ctx.runAction(
      internal.project_variables.writeVariablesForOrgProjectStageWithUsageInternal,
      {
        orgId: activeOrg.orgId,
        orgSlug: activeOrg.orgSlug,
        clerkUserId: activeOrg.clerkUserId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        mode: "upsert",
        entries,
        deletes,
      },
    );

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

    await ctx.runMutation(internal.audit.appendEventInternal, {
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
  },
});
