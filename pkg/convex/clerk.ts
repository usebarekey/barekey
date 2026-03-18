"use node";

import { Effect } from "effect";
import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";

import type { ActionCtx } from "./_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "./confect";
import { ExternalServiceError } from "./lib/errors/effect";
import { runtimeConfig } from "./lib/runtime/config";

const clerkOrgAccessValidator = v.object({
  orgId: v.string(),
  orgSlug: v.string(),
});

type ResolveOrganizationAccessArgs = {
  clerkUserId: string;
  requestedOrgSlug: string;
  fallbackOrgId: string;
  fallbackOrgSlug: string;
};

type ResolvedOrganizationAccess = {
  orgId: string;
  orgSlug: string;
} | null;

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

  return Array.isArray(value.errors)
    ? value.errors.some((entry) => entry.code === "resource_not_found")
    : false;
}

/**
 * Normalizes Clerk integration failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Not-found Clerk errors are handled separately by the lookup program and should not use this helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toClerkLookupError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Resolves an organization slug to a Clerk organization and verifies that the
 * given Clerk user is a member.
 *
 * @param _ctx The Convex action context.
 * @param args The Clerk user plus requested and fallback organization information.
 * @returns An Effect that succeeds with the resolved organization access, or `null`.
 * @remarks CLI sessions keep a default org for convenience, but authorization for a different org must be re-checked here.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function resolveOrganizationAccessForCliUserInternalEffect(
  _ctx: ActionCtx,
  args: ResolveOrganizationAccessArgs,
): Effect.Effect<ResolvedOrganizationAccess, ExternalServiceError> {
  return Effect.gen(function* () {
    const clerk = createClerkClient({
      secretKey: runtimeConfig.clerkSecretKey,
    });

    const organizationResult = yield* Effect.either(
      Effect.tryPromise({
        try: async (): Promise<{ id: string; slug: string }> => {
          const resolved = await clerk.organizations.getOrganization({
            slug: args.requestedOrgSlug,
          });
          return {
            id: resolved.id,
            slug: resolved.slug,
          };
        },
        catch: (error) =>
          isNotFoundClerkError(error)
            ? new ExternalServiceError({
                message: "CLERK_NOT_FOUND",
                cause: error,
              })
            : toClerkLookupError("Failed to resolve the Clerk organization.", error),
      }),
    );
    if (organizationResult._tag === "Left") {
      if (organizationResult.left.message === "CLERK_NOT_FOUND") {
        return null;
      }
      return yield* Effect.fail(organizationResult.left);
    }
    const organization = organizationResult.right;

    const memberships = yield* Effect.tryPromise({
      try: () =>
        clerk.organizations.getOrganizationMembershipList({
          organizationId: organization.id,
          userId: [args.clerkUserId],
          limit: 1,
        }),
      catch: (error) =>
        toClerkLookupError("Failed to load the Clerk organization membership.", error),
    });

    if (memberships.data.length === 0) {
      return null;
    }

    return {
      orgId: organization.id,
      orgSlug: organization.slug,
    };
  });
}

/**
 * Resolves an organization slug to a Clerk organization and verifies that the
 * given Clerk user is a member. CLI sessions keep a default org for
 * convenience, but authorization for a different org must be re-checked here.
 *
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const resolveOrganizationAccessForCliUserInternal = effectInternalAction<
  ResolveOrganizationAccessArgs,
  ResolvedOrganizationAccess,
  any
>({
  args: {
    clerkUserId: v.string(),
    requestedOrgSlug: v.string(),
    fallbackOrgId: v.string(),
    fallbackOrgSlug: v.string(),
  },
  returns: v.union(clerkOrgAccessValidator, v.null()),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const ctx = confectCtx.ctx as unknown as ActionCtx;
      return yield* resolveOrganizationAccessForCliUserInternalEffect(ctx, args);
    }),
});
