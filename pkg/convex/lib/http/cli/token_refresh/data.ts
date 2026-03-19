import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

import { httpAction } from "../../../../confect";
import {
  runActionEffect,
  runMutationEffect,
} from "../../../convex/functions";

export type HttpCliActionCtx = Parameters<typeof httpAction>[0] extends (
  ctx: infer T,
  request: Request,
) => unknown
  ? T
  : never;

const refreshSessionInternalReference = makeFunctionReference<
  "mutation",
  {
    refreshToken: string;
  },
  {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAtMs: number;
    refreshTokenExpiresAtMs: number;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  } | null
>("cli_auth:refreshSessionInternal") as any;

const revokeSessionInternalReference = makeFunctionReference<
  "mutation",
  {
    refreshToken: string;
  },
  {
    revoked: boolean;
  }
>("cli_auth:revokeSessionInternal") as any;

const resolveOrganizationAccessForCliUserInternalReference = makeFunctionReference<
  "action",
  {
    clerkUserId: string;
    requestedOrgSlug: string;
    fallbackOrgId: string;
    fallbackOrgSlug: string;
  },
  {
    orgId: string;
    orgSlug: string;
  } | null
>("clerk:resolveOrganizationAccessForCliUserInternal") as any;

export type RefreshedCliSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  refreshTokenExpiresAtMs: number;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
};

/**
 * Refreshes a CLI session from a refresh token.
 *
 * @param ctx The HTTP CLI action context.
 * @param refreshToken The refresh token to rotate.
 * @returns The rotated CLI session, or `null`.
 * @remarks This wraps the CLI auth refresh mutation behind one route-local helper.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function refreshCliSession(
  ctx: HttpCliActionCtx,
  refreshToken: string,
): Promise<RefreshedCliSession | null> {
  return await Effect.runPromise(
    runMutationEffect(
      ctx,
      refreshSessionInternalReference,
      {
        refreshToken,
      },
      (error) => error,
    ),
  );
}

/**
 * Revokes a CLI session by refresh token.
 *
 * @param ctx The HTTP CLI action context.
 * @param refreshToken The refresh token to revoke.
 * @returns A promise that resolves after the revoke mutation completes.
 * @remarks This is used when refreshed CLI access can no longer resolve org scope.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function revokeCliSession(ctx: HttpCliActionCtx, refreshToken: string) {
  return await Effect.runPromise(
    runMutationEffect(
      ctx,
      revokeSessionInternalReference,
      {
        refreshToken,
      },
      (error) => error,
    ),
  );
}

/**
 * Resolves CLI org access for a Clerk user.
 *
 * @param ctx The HTTP CLI action context.
 * @param input The Clerk user id and fallback org scope.
 * @returns The resolved org access, or `null`.
 * @remarks This wraps the Clerk access action for token refresh flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function resolveCliOrganizationAccess(
  ctx: HttpCliActionCtx,
  input: {
    clerkUserId: string;
    requestedOrgSlug: string;
    fallbackOrgId: string;
    fallbackOrgSlug: string;
  },
): Promise<{
  orgId: string;
  orgSlug: string;
} | null> {
  return await Effect.runPromise(
    runActionEffect(
      ctx,
      resolveOrganizationAccessForCliUserInternalReference,
      input,
      (error) => error,
    ),
  );
}
