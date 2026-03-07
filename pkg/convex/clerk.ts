"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";

const clerkOrgAccessValidator = v.object({
  orgId: v.string(),
  orgSlug: v.string(),
});

function isNotFoundClerkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const value = error as {
    status?: unknown;
    errors?: Array<{
      code?: unknown;
    }>;
  };

  if (value.status === 404) {
    return true;
  }

  return value.errors?.some((entry) => entry.code === "resource_not_found") ?? false;
}

/**
 * Resolves an organization slug to a Clerk organization and verifies that the
 * given Clerk user is a member. CLI sessions keep a default org for
 * convenience, but authorization for a different org must be re-checked here.
 */
export const resolveOrganizationAccessForCliUserInternal = internalAction({
  args: {
    clerkUserId: v.string(),
    requestedOrgSlug: v.string(),
    fallbackOrgId: v.string(),
    fallbackOrgSlug: v.string(),
  },
  returns: v.union(clerkOrgAccessValidator, v.null()),
  handler: async (_, args) => {
    if (args.requestedOrgSlug === args.fallbackOrgSlug) {
      return {
        orgId: args.fallbackOrgId,
        orgSlug: args.fallbackOrgSlug,
      };
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("Missing CLERK_SECRET_KEY for CLI organization resolution.");
    }

    const clerk = createClerkClient({
      secretKey: clerkSecretKey,
    });

    let organization: { id: string; slug: string } | null = null;
    try {
      const resolved = await clerk.organizations.getOrganization({
        slug: args.requestedOrgSlug,
      });
      organization = {
        id: resolved.id,
        slug: resolved.slug,
      };
    } catch (error: unknown) {
      if (isNotFoundClerkError(error)) {
        return null;
      }
      throw error;
    }

    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: organization.id,
      userId: [args.clerkUserId],
      limit: 1,
    });

    if (memberships.data.length === 0) {
      return null;
    }

    return {
      orgId: organization.id,
      orgSlug: organization.slug,
    };
  },
});
