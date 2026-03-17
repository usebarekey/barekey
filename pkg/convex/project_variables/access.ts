import type { UserIdentity } from "convex/server";

import type { ActiveOrgIdClaims } from "../lib/auth";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";

type AuthCtxLike = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

/**
 * Resolves the current active organization when a request may proceed
 * anonymously or without an active org context.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns The active organization claims or `null` when no matching org context is active.
 * @remarks This is used by read-only flows that should fail closed by returning no data.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCurrentOrgAccessOrNull(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Promise<ActiveOrgIdClaims | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  const activeOrg = getActiveOrgIdClaimsOrNull(identity);
  if (activeOrg === null) {
    return null;
  }

  if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== expectedOrgSlug) {
    return null;
  }

  return activeOrg;
}

/**
 * Resolves and validates the current active organization for a workspace-scoped
 * mutation or action.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns The validated active organization claims.
 * @remarks This throws when the caller is unauthenticated or points at a different active workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireCurrentOrgAccess(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Promise<ActiveOrgIdClaims> {
  const identity = await requireIdentity(ctx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, expectedOrgSlug);
  }
  return activeOrg;
}
