import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Effect, Schema } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  schemaEffectMutation,
} from "../../confect";
import { requireCurrentOrgAccessEffect } from "../access";
import { decryptedVariableValueSchema, decryptVariableForProjectStageEffect } from "./stage";
import type { DecryptedVariableValue } from "../types";

const decryptCurrentOrgStageArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
  stageSlug: Schema.String,
  variableId: ConfectId.Id("projectVariables"),
});

/**
 * Decrypts one stage variable value for immediate UI reveal.
 *
 * @param args The workspace, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks This validates current workspace access before delegating to the shared stage decrypt helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function decryptValueForCurrentOrgProjectStageEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
    variableId: Id<"projectVariables">;
  },
): Effect.Effect<DecryptedVariableValue, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const activeOrg = yield* requireCurrentOrgAccessEffect(ctx, args.expectedOrgSlug);

    return yield* decryptVariableForProjectStageEffect(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      variableId: args.variableId,
    });
  });
}

/**
 * Decrypts one stage variable value for immediate UI reveal.
 *
 * Callers should treat the returned plaintext as ephemeral and avoid caching
 * beyond the current user interaction.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks This validates current workspace access before delegating to the shared stage decrypt helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const decryptValueForCurrentOrgProjectStage = schemaEffectMutation({
  args: decryptCurrentOrgStageArgsSchema,
  returns: decryptedVariableValueSchema,
  handler: decryptValueForCurrentOrgProjectStageEffect,
});
