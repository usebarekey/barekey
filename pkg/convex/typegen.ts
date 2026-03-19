import type { MutationCtx } from "./_generated/server";
import { Effect } from "effect";

import { BarekeyConfectMutationCtx, ClockService, effectInternalMutation } from "./confect";
import { buildManifestForOrgProjectStageInternalEffect } from "./typegen/manifest";
import {
  typegenArgs,
  typegenManifestValidator,
  type TypegenArgs,
  type TypegenManifest,
  type TypegenVariable,
} from "./typegen/shared";

export type { TypegenManifest, TypegenVariable } from "./typegen/shared";

/**
 * Builds the typegen manifest for one stage, including exact inferred JSON
 * shapes from the currently stored normalized JSON plaintext.
 *
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const buildManifestForOrgProjectStageInternal = effectInternalMutation<
  TypegenArgs,
  TypegenManifest,
  any
>({
  args: typegenArgs,
  returns: typegenManifestValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const clock = yield* ClockService;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* buildManifestForOrgProjectStageInternalEffect(ctx, args, clock.nowMs());
    }),
});
