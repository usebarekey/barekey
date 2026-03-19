import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Effect, Schema } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectInternalMutation } from "../confect";
import { ExternalServiceError, ValidationError } from "../lib/errors/effect";
import { decodeConfigProjectSlugEffect, decodeProjectNameEffect } from "../projects/input";
import {
  ensureBootstrapProjectStagesEffect,
  findBootstrapProjectEffect,
  getBootstrapProjectEffect,
  insertBootstrapProjectEffect,
} from "./repo";

const bootstrapProjectArgsSchema = Schema.Struct({
  orgId: Schema.String,
  orgSlug: Schema.String,
  clerkUserId: Schema.String,
  projectSlug: Schema.String,
  projectName: Schema.String,
});

const bootstrapProjectSchema = Schema.Struct({
  id: ConfectId.Id("projects"),
  orgId: Schema.String,
  orgSlug: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  createdAtMs: Schema.Number,
  updatedAtMs: Schema.Number,
});

/**
 * Ensures the config project and its default stages exist for one organization.
 *
 * @param args The organization, user, slug, and name for the config project.
 * @returns An Effect that succeeds with the ensured project row summary.
 * @remarks This creates the `projects` row lazily and backfills the canonical default stages when missing.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function ensureConfigProjectForOrgInternalEffect(
  args: {
    orgId: string;
    orgSlug: string;
    clerkUserId: string;
    projectSlug: string;
    projectName: string;
  },
): Effect.Effect<
  {
    id: Id<"projects">;
    orgId: string;
    orgSlug: string;
    slug: string;
    name: string;
    createdAtMs: number;
    updatedAtMs: number;
  },
  ExternalServiceError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;

    const projectSlug = yield* decodeConfigProjectSlugEffect(args.projectSlug);
    const projectName = yield* decodeProjectNameEffect(args.projectName);
    const existing = yield* findBootstrapProjectEffect(ctx, {
      orgSlug: args.orgSlug,
      projectSlug,
    });
    const now = Date.now();
    const projectId =
      existing?._id ??
      (yield* insertBootstrapProjectEffect(ctx, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        clerkUserId: args.clerkUserId,
        projectSlug,
        projectName,
        now,
      }));

    const project = existing ?? (yield* getBootstrapProjectEffect(ctx, String(projectId)));
    if (project === null) {
      return yield* Effect.fail(
        new ExternalServiceError({
          message: "Config project could not be created.",
        }),
      );
    }

    yield* ensureBootstrapProjectStagesEffect(ctx, {
      projectId: String(project._id),
      orgId: args.orgId,
      now,
    });

    return {
      id: project._id,
      orgId: project.orgId,
      orgSlug: project.orgSlug,
      slug: project.slug,
      name: project.name,
      createdAtMs: project.createdAtMs,
      updatedAtMs: project.updatedAtMs,
    };
  });
}

/**
 * Ensures the config project and its default stages exist for one organization.
 *
 * @remarks This internal mutation delegates to the Effect-native bootstrap program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const ensureConfigProjectForOrgInternal = schemaEffectInternalMutation({
  args: bootstrapProjectArgsSchema,
  returns: bootstrapProjectSchema,
  handler: ensureConfigProjectForOrgInternalEffect,
});
