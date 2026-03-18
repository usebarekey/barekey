import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { readOptionalString } from "../env";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { readJsonBody } from "./shared";

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

/**
 * Refreshes a CLI session from a refresh token.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The rotated token pair or a normalized error response.
 * @remarks This revokes the rotated session when organization access can no longer be resolved.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliTokenRefresh = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  if (typeof payload !== "object" || payload === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const input = payload as Record<string, unknown>;
  const refreshToken = readOptionalString(input, "refreshToken");
  if (refreshToken === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const refreshed = (await ctx.runMutation(refreshSessionInternalReference, {
    refreshToken,
  })) as
    | {
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresAtMs: number;
        refreshTokenExpiresAtMs: number;
        clerkUserId: string;
        orgId: string;
        orgSlug: string;
      }
    | null;

  if (refreshed === null) {
    return errorResponse({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid or expired.",
      requestId,
    });
  }

  let access: {
    orgId: string;
    orgSlug: string;
  } | null;
  try {
    access = (await ctx.runAction(resolveOrganizationAccessForCliUserInternalReference, {
      clerkUserId: refreshed.clerkUserId,
      requestedOrgSlug: refreshed.orgSlug,
      fallbackOrgId: refreshed.orgId,
      fallbackOrgSlug: refreshed.orgSlug,
    })) as {
      orgId: string;
      orgSlug: string;
    } | null;
  } catch {
    access = {
      orgId: refreshed.orgId,
      orgSlug: refreshed.orgSlug,
    };
  }

  if (access === null) {
    await ctx.runMutation(revokeSessionInternalReference, {
      refreshToken: refreshed.refreshToken,
    });
    return errorResponse({
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "Access to the organization has been revoked.",
      requestId,
    });
  }

  return buildJsonResponse(200, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTokenExpiresAtMs: refreshed.accessTokenExpiresAtMs,
    refreshTokenExpiresAtMs: refreshed.refreshTokenExpiresAtMs,
    orgId: refreshed.orgId,
    orgSlug: refreshed.orgSlug,
    clerkUserId: refreshed.clerkUserId,
    requestId,
  });
});
