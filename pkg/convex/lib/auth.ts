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
