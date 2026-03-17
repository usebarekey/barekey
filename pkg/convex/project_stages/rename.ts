import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";
import { countVariablesForStage, requireProjectBySlugForOrg } from "./access";
import { stageSummaryValidator } from "./types";

/**
 * Renames a project stage display name.
 *
 * @param ctx The Convex mutation context.
 * @param args The expected org slug, project slug, stage slug, and next stage name.
 * @returns The updated stage summary.
 * @remarks The stage slug remains immutable; this only patches the display name and audit trail.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const renameForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    name: v.string(),
  },
  returns: stageSummaryValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await requireProjectBySlugForOrg(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Stage name is required.");
    }
    if (trimmedName.length > 64) {
      throw new Error("Stage name must be 64 characters or fewer.");
    }

    const now = Date.now();
    await ctx.db.patch(stage._id, {
      name: trimmedName,
      updatedAtMs: now,
    });

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      eventType: "stage.renamed",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stage._id),
      subjectName: trimmedName,
      title: `Renamed stage ${stage.name}`,
      description: `Stage ${stage.slug} is now labeled ${trimmedName}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: stage.slug,
        previousName: stage.name,
        nextName: trimmedName,
      }),
      retentionTierOverride: null,
    });

    return {
      id: stage._id,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug: stage.slug,
      name: trimmedName,
      isDefault: stage.isDefault,
      variableCount: await countVariablesForStage(ctx, {
        projectId: project._id,
        stageSlug: stage.slug,
      }),
      createdAtMs: stage.createdAtMs,
      updatedAtMs: now,
    };
  },
});
