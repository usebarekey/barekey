import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";
import { requireProjectBySlugForOrg } from "./access";
import { allocateUniqueStageSlug, normalizeStageSlugBase } from "./slug";
import { stageSummaryValidator } from "./types";

/**
 * Creates a custom stage within a project.
 *
 * @param ctx The Convex mutation context.
 * @param args The expected org slug, project slug, and stage name.
 * @returns The created stage summary.
 * @remarks This writes `projectStages` and appends a stage creation audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
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

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Stage name is required.");
    }
    if (trimmedName.length > 64) {
      throw new Error("Stage name must be 64 characters or fewer.");
    }

    const slug = await allocateUniqueStageSlug(ctx, {
      projectId: project._id,
      slugBase: normalizeStageSlugBase(trimmedName),
    });
    const now = Date.now();

    const stageId = await ctx.db.insert("projectStages", {
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug,
      name: trimmedName,
      isDefault: false,
      createdAtMs: now,
      updatedAtMs: now,
    });

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: slug,
      eventType: "stage.created",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stageId),
      subjectName: trimmedName,
      title: `Created stage ${trimmedName}`,
      description: `Stage ${trimmedName} was added to project ${project.name}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: slug,
        isDefault: false,
      }),
      retentionTierOverride: null,
    });

    return {
      id: stageId,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug,
      name: trimmedName,
      isDefault: false,
      variableCount: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});
