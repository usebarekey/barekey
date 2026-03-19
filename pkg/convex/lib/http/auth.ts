import { makeFunctionReference, type UserIdentity } from "convex/server";

import { getOrgClaimsFromIdentity } from "../auth";
export { getOrgClaimsFromIdentity } from "../auth";

export type AuthContext = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
  source: "clerk" | "cli";
};

export type AuthResolutionFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type AuthResolutionResult =
  | {
      ok: true;
      context: AuthContext;
    }
  | AuthResolutionFailure;

export type AuthResolutionCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  runAction(functionReference: unknown, args: Record<string, unknown>): Promise<unknown>;
  runMutation(functionReference: unknown, args: Record<string, unknown>): Promise<unknown>;
};

const authenticateAccessTokenInternalReference = makeFunctionReference<
  "mutation",
  {
    accessToken: string;
  },
  {
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  } | null
>("cli_auth:authenticateAccessTokenInternal") as unknown;

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
>("clerk:resolveOrganizationAccessForCliUserInternal") as unknown;

export async function readIdentityOrNull(
  auth: AuthResolutionCtx["auth"],
): Promise<UserIdentity | null> {
  return await auth.getUserIdentity();
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }
  const [type, value] = authorization.split(" ", 2);
  if (!type || !value || type.toLowerCase() !== "bearer") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isAuthResolutionFailure(
  result: AuthResolutionResult,
): result is AuthResolutionFailure {
  return !result.ok;
}

export async function resolveAuthContext(
  convexCtx: AuthResolutionCtx,
  request: Request,
  requestedOrgSlug?: string,
): Promise<AuthResolutionResult> {
  const normalizedRequestedOrgSlug = requestedOrgSlug?.trim() || undefined;
  const bearerToken = extractBearerToken(request);
  const shouldAttemptClerkIdentity = bearerToken === null || looksLikeJwt(bearerToken);
  const identity = shouldAttemptClerkIdentity
    ? await readIdentityOrNull(convexCtx.auth)
    : null;
  if (identity !== null) {
    const orgClaims = getOrgClaimsFromIdentity(identity);
    if (orgClaims.orgId === null || orgClaims.orgSlug === null) {
      return {
        ok: false,
        status: 403,
        code: "ORG_SCOPE_INVALID",
        message: "No active organization selected for this token.",
      };
    }
    if (
      normalizedRequestedOrgSlug &&
      normalizedRequestedOrgSlug !== orgClaims.orgSlug
    ) {
      return {
        ok: false,
        status: 403,
        code: "ORG_SCOPE_INVALID",
        message: "Active organization does not match the requested workspace.",
      };
    }
    return {
      ok: true,
      context: {
        clerkUserId: orgClaims.clerkUserId,
        orgId: orgClaims.orgId,
        orgSlug: orgClaims.orgSlug,
        source: "clerk",
      },
    };
  }

  if (bearerToken === null) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
    };
  }

  const session = (await convexCtx.runMutation(authenticateAccessTokenInternalReference, {
    accessToken: bearerToken,
  })) as {
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  } | null;

  if (session === null) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
    };
  }

  const effectiveOrgSlug = normalizedRequestedOrgSlug ?? session.orgSlug;
  const resolvedOrg =
    effectiveOrgSlug === session.orgSlug
      ? {
          orgId: session.orgId,
          orgSlug: session.orgSlug,
        }
      : ((await convexCtx.runAction(resolveOrganizationAccessForCliUserInternalReference, {
          clerkUserId: session.clerkUserId,
          requestedOrgSlug: effectiveOrgSlug,
          fallbackOrgId: session.orgId,
          fallbackOrgSlug: session.orgSlug,
        })) as {
          orgId: string;
          orgSlug: string;
        } | null);

  if (resolvedOrg === null) {
    return {
      ok: false,
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "This CLI session does not have access to the requested workspace.",
    };
  }

  return {
    ok: true,
    context: {
      clerkUserId: session.clerkUserId,
      orgId: resolvedOrg.orgId,
      orgSlug: resolvedOrg.orgSlug,
      source: "cli",
    },
  };
}
