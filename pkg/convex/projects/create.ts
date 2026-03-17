import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalMutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";
import { allocateUniqueProjectSlug, normalizeProjectSlugBase } from "./slug";
import { DEFAULT_PROJECT_STAGES, projectSummaryValidator, type ProjectSummary } from "./types";

/**
 * Creates a project for the current authenticated organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This validates billing eligibility first, then delegates persistence to the internal mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: async (ctx, args): Promise<ProjectSummary> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Project name is required.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Project name must be 120 characters or fewer.");
    }

    await ctx.runAction(internal.payments.assertWorkspacePlanForCurrentOrgInternal, {
      expectedOrgSlug: args.expectedOrgSlug,
    });

    return await ctx.runMutation(internal.projects.createForCurrentOrgInternal, {
      expectedOrgSlug: args.expectedOrgSlug,
      name: trimmedName,
    });
  },
});

/**
 * Creates a project row and its default stages for the current authenticated organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This writes `projects`, seeds default `projectStages`, and appends a project audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrgInternal = internalMutation({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: async (ctx, args): Promise<ProjectSummary> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Project name is required.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Project name must be 120 characters or fewer.");
    }

    const slugBase = normalizeProjectSlugBase(trimmedName);
    const slug = await allocateUniqueProjectSlug(ctx, {
      orgId: activeOrg.orgId,
      slugBase,
    });
    const now = Date.now();

    const id = await ctx.db.insert("projects", {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    });

    for (const stage of DEFAULT_PROJECT_STAGES) {
      await ctx.db.insert("projectStages", {
        projectId: id,
        orgId: activeOrg.orgId,
        slug: stage.slug,
        name: stage.name,
        isDefault: true,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      projectId: id,
      projectSlug: slug,
      stageSlug: null,
      eventType: "project.created",
      category: "project",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "project",
      subjectId: String(id),
      subjectName: trimmedName,
      title: `Created project ${trimmedName}`,
      description: `Project ${trimmedName} is ready with development and production stages.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: slug,
        defaultStages: DEFAULT_PROJECT_STAGES.map((stage) => stage.slug),
      }),
      retentionTierOverride: null,
    });

    return {
      id,
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});
