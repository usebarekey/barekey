import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalMutation, mutation } from "../confect";
import { requireActiveOrgClaims, requireIdentity } from "../lib/auth";
import type { MutationCtx } from "../_generated/server";

/**
 * Approves a pending CLI device code for a specific user and organization.
 *
 * @param ctx The Convex mutation context.
 * @param input The user code and approving actor/org identity.
 * @returns The completed status and approved organization slug.
 * @remarks This patches `cliDeviceCodes` and appends a CLI audit event for the approval.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function completePendingDeviceCode(
  ctx: MutationCtx,
  input: {
    userCode: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
): Promise<{
  status: "completed";
  orgSlug: string;
}> {
  const normalizedUserCode = input.userCode.trim().toUpperCase();
  if (normalizedUserCode.length === 0) {
    throw new Error("Device code is required.");
  }

  const deviceCodeRow = await ctx.db
    .query("cliDeviceCodes")
    .withIndex("by_user_code_and_status", (q) =>
      q.eq("userCode", normalizedUserCode).eq("status", "pending"),
    )
    .unique();

  if (deviceCodeRow === null) {
    throw new Error("Device code not found or already used.");
  }

  const now = Date.now();
  if (deviceCodeRow.expiresAtMs <= now) {
    await ctx.db.patch(deviceCodeRow._id, {
      status: "expired",
      updatedAtMs: now,
    });
    throw new Error("Device code has expired.");
  }

  await ctx.db.patch(deviceCodeRow._id, {
    status: "approved",
    approvedAtMs: now,
    approvedByClerkUserId: input.clerkUserId,
    approvedOrgId: input.orgId,
    approvedOrgSlug: input.orgSlug,
    updatedAtMs: now,
  });

  await ctx.runMutation(internal.audit.appendEventInternal, {
    orgId: input.orgId,
    orgSlug: input.orgSlug,
    projectId: null,
    projectSlug: null,
    stageSlug: null,
    eventType: "cli.device_code_approved",
    category: "cli",
    actorSource: "cli",
    actorClerkUserId: input.clerkUserId,
    actorDisplayName: null,
    actorEmail: null,
    subjectType: "cli_session",
    subjectId: deviceCodeRow.userCode,
    subjectName: deviceCodeRow.clientName ?? "CLI device flow",
    title: "Approved CLI sign-in",
    description: `A CLI device code was approved for workspace ${input.orgSlug}.`,
    severity: "info",
    payloadJson: JSON.stringify({
      userCode: deviceCodeRow.userCode,
      clientName: deviceCodeRow.clientName,
    }),
    retentionTierOverride: null,
  });

  return {
    status: "completed",
    orgSlug: input.orgSlug,
  };
}

/**
 * Completes a device code for the current authenticated Clerk user.
 *
 * @param ctx The Convex mutation context.
 * @param args The user code to approve.
 * @returns The completed status and approved organization slug.
 * @remarks This requires an active organization in the current Clerk identity and delegates to the shared approval helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const completeDeviceCodeForCurrentUser = mutation({
  args: {
    userCode: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgClaims(identity);

    return await completePendingDeviceCode(ctx, {
      userCode: args.userCode,
      clerkUserId: activeOrg.clerkUserId,
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
    });
  },
});

/**
 * Completes a device code for an explicitly supplied user and organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The user code and approving actor/org identity.
 * @returns The completed status and approved organization slug.
 * @remarks This is the internal approval entrypoint used by the HTTP CLI flow.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const completeDeviceCodeForCurrentUserInternal = internalMutation({
  args: {
    userCode: v.string(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
  handler: async (ctx, args) =>
    await completePendingDeviceCode(ctx, {
      userCode: args.userCode,
      clerkUserId: args.clerkUserId,
      orgId: args.orgId,
      orgSlug: args.orgSlug,
    }),
});
