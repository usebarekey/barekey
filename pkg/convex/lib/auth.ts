import type { UserIdentity } from "convex/server";

type AuthLikeCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

export type OrgClaims = {
  clerkUserId: string;
  orgId: string | null;
  orgSlug: string | null;
  orgRole: string | null;
};

export type ActiveOrgClaims = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
  orgRole: string | null;
};

export type ActiveOrgIdClaims = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string | null;
  orgRole: string | null;
};

function readStringClaim(identity: UserIdentity, key: string): string | null {
  const value = identity[key];
  return typeof value === "string" ? value : null;
}

export async function requireIdentity(ctx: AuthLikeCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Unauthorized");
  }

  return identity;
}

export function getOrgClaimsFromIdentity(identity: UserIdentity): OrgClaims {
  return {
    clerkUserId: identity.subject,
    orgId: readStringClaim(identity, "org_id"),
    orgSlug: readStringClaim(identity, "org_slug"),
    orgRole: readStringClaim(identity, "org_role"),
  };
}

export function requireActiveOrgClaims(identity: UserIdentity): ActiveOrgClaims {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null) {
    throw new Error("No active organization selected.");
  }

  if (claims.orgSlug === null) {
    throw new Error("Active organization slug is missing.");
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

export function getActiveOrgClaimsOrNull(identity: UserIdentity): ActiveOrgClaims | null {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null || claims.orgSlug === null) {
    return null;
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

export function requireActiveOrgIdClaims(identity: UserIdentity): ActiveOrgIdClaims {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null) {
    throw new Error("No active organization selected.");
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

export function getActiveOrgIdClaimsOrNull(identity: UserIdentity): ActiveOrgIdClaims | null {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null) {
    return null;
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

export function assertExpectedOrgSlug(
  claims: { orgSlug: string | null },
  expectedOrgSlug: string | null,
): void {
  if (expectedOrgSlug === null) {
    return;
  }

  if (claims.orgSlug !== expectedOrgSlug) {
    throw new Error("Active organization does not match the requested workspace.");
  }
}
