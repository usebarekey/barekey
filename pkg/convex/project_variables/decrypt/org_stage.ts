import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Effect, Schema } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  schemaEffectInternalMutation,
} from "../../confect";
import { decryptedVariableValueSchema, decryptVariableForProjectStageEffect } from "./stage";
import type { DecryptedVariableValue } from "../types";

const decryptOrgStageArgsSchema = Schema.Struct({
  orgId: Schema.String,
  projectSlug: Schema.String,
  stageSlug: Schema.String,
  variableId: ConfectId.Id("projectVariables"),
});

/**
 * Decrypts one variable value in an org-scoped project stage.
 *
 * @param args The organization, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks Internal HTTP and SDK flows use this after org scope has already been resolved.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function decryptValueForOrgProjectStageInternalEffect(
  args: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    variableId: Id<"projectVariables">;
  },
): Effect.Effect<DecryptedVariableValue, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    return yield* decryptVariableForProjectStageEffect(
      confectCtx.ctx as unknown as MutationCtx,
      args,
    );
  });
}

/**
 * Decrypts one variable value in an org-scoped project stage.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks Internal HTTP and SDK flows use this to reveal variable values after resolving org scope.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const decryptValueForOrgProjectStageInternal = schemaEffectInternalMutation({
  args: decryptOrgStageArgsSchema,
  returns: decryptedVariableValueSchema,
  handler: decryptValueForOrgProjectStageInternalEffect,
});
