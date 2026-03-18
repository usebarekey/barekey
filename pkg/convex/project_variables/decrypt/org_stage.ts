import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { decryptedVariableValueValidator, decryptVariableForProjectStageEffect } from "./stage";
import type { DecryptedVariableValue } from "../types";

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
export const decryptValueForOrgProjectStageInternal = effectInternalMutation({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    variableId: v.id("projectVariables"),
  },
  returns: decryptedVariableValueValidator,
  handler: decryptValueForOrgProjectStageInternalEffect,
});
