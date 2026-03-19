import { Effect } from "effect";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, schemaEffectAction } from "../../confect";
import { requireCurrentOrgAccessEffect } from "../access";
import {
  toProjectVariableExternalServiceError,
} from "../errors";
import {
  listVariableMetadataForOrgProjectStageInternalReference,
  writeVariablesForOrgProjectStageWithUsageInternalReference,
} from "../refs";
import type { VariableMetadataRow } from "../query/shared";
import type { DraftWriteResult } from "../types";
import { appendDraftAppliedAuditEffect } from "./audit";
import { buildDraftWritePayloadEffect } from "./payload";
import {
  applyDraftArgsSchema,
  draftWriteResultSchema,
  type ApplyDraftArgs,
} from "./shared";

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * @param args The workspace, project, stage, and staged variable changes to apply.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This delegates metered persistence to the internal write pipeline and appends an audit event after success.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function applyDraftForCurrentOrgProjectStageEffect(
  args: ApplyDraftArgs,
): Effect.Effect<DraftWriteResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
    const activeOrg = yield* requireCurrentOrgAccessEffect(runtimeCtx, args.expectedOrgSlug);

    const existingRows = (yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runQuery(listVariableMetadataForOrgProjectStageInternalReference, {
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

    const payload = yield* buildDraftWritePayloadEffect(args, existingRows);
    const result = (yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runAction(writeVariablesForOrgProjectStageWithUsageInternalReference, {
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
          clerkUserId: activeOrg.clerkUserId,
          projectSlug: args.projectSlug,
          stageSlug: args.stageSlug,
          mode: "upsert",
          entries: payload.entries,
          deletes: payload.deletes,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to apply staged variable changes.",
          error,
        ),
    })) as DraftWriteResult;

    yield* appendDraftAppliedAuditEffect(activeOrg, args, result, payload.touchedEntries);
    return result;
  });
}

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * The action reserves billable storage before writes and runs a compensating
 * adjustment if a write fails after reservation.
 *
 * @param runtimeCtx The Convex action context.
 * @param args The workspace, project, stage, and staged variable changes to apply.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This delegates metered persistence to the internal write pipeline and appends an audit event after success.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const applyDraftForCurrentOrgProjectStage = schemaEffectAction({
  args: applyDraftArgsSchema,
  returns: draftWriteResultSchema,
  handler: applyDraftForCurrentOrgProjectStageEffect,
});
