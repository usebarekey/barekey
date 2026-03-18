import type { UserIdentity } from "convex/server";

export type AuthLikeCtx = {
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
