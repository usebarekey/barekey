import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "./confect";
import { ExternalServiceError, ValidationError } from "./lib/errors/effect";

const defaultStages = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;

const bootstrapProjectValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  slug: v.string(),
  name: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

/**
 * Normalizes and validates the config project slug.
 *
 * @param value The untrusted project slug input.
 * @returns An Effect that succeeds with the normalized slug.
 * @remarks This fails when the normalized slug would be empty.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function normalizeProjectSlugEffect(value: string): Effect.Effect<string, ValidationError> {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    return Effect.fail(new ValidationError({ message: "Project slug is required." }));
  }

  return Effect.succeed(slug);
}

/**
 * Validates and trims the config project name.
 *
 * @param value The untrusted project name input.
 * @returns An Effect that succeeds with the trimmed project name.
 * @remarks This fails when the trimmed project name is empty.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function validateProjectNameEffect(value: string): Effect.Effect<string, ValidationError> {
  const projectName = value.trim();
  if (projectName.length === 0) {
    return Effect.fail(new ValidationError({ message: "Project name is required." }));
  }

  return Effect.succeed(projectName);
}

/**
 * Ensures the config project and its default stages exist for one organization.
 *
 * @param args The organization, user, slug, and name for the config project.
 * @returns An Effect that succeeds with the ensured project row summary.
 * @remarks This creates the `projects` row lazily and backfills the canonical default stages when missing.
 * @lastModified 2026-03-17
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
    id: string;
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

    const projectSlug = yield* normalizeProjectSlugEffect(args.projectSlug);
    const projectName = yield* validateProjectNameEffect(args.projectName);

    const existing = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("projects")
          .withIndex("by_org_slug_and_slug", (q) =>
            q.eq("orgSlug", args.orgSlug).eq("slug", projectSlug),
          )
          .unique(),
      catch: (error) =>
        new ExternalServiceError({
          message: "Failed to look up the config project.",
          cause: error,
        }),
    });

    const now = Date.now();
    const projectId =
      existing?._id ??
      (yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("projects", {
            orgId: args.orgId,
            orgSlug: args.orgSlug,
            name: projectName,
            slug: projectSlug,
            slugBase: projectSlug,
            createdByClerkUserId: args.clerkUserId,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to create the config project.",
            cause: error,
          }),
      }));

    const project =
      existing ??
      (yield* Effect.tryPromise({
        try: () => ctx.db.get(projectId),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to reload the config project.",
            cause: error,
          }),
      }));

    if (project === null) {
      return yield* Effect.fail(
        new ExternalServiceError({
          message: "Config project could not be created.",
        }),
      );
    }

    const stages = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("projectStages")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .collect(),
      catch: (error) =>
        new ExternalServiceError({
          message: "Failed to load config project stages.",
          cause: error,
        }),
    });
    const existingStageSlugs = new Set(stages.map((stage) => stage.slug));

    for (const stage of defaultStages) {
      if (existingStageSlugs.has(stage.slug)) {
        continue;
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("projectStages", {
            projectId: project._id,
            orgId: args.orgId,
            slug: stage.slug,
            name: stage.name,
            isDefault: stage.slug === "development",
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: `Failed to create config project stage ${stage.slug}.`,
            cause: error,
          }),
      });
    }

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

export const ensureConfigProjectForOrgInternal = effectInternalMutation({
  args: {
    orgId: v.string(),
    orgSlug: v.string(),
    clerkUserId: v.string(),
    projectSlug: v.string(),
    projectName: v.string(),
  },
  returns: bootstrapProjectValidator,
  handler: ensureConfigProjectForOrgInternalEffect,
});
