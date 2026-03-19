import { httpAction } from "../../../confect";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { decodeCliRefreshTokenBody } from "./input";
import {
  refreshCliSession,
  revokeCliSession,
  resolveCliOrganizationAccess,
  type RefreshedCliSession,
} from "./token_refresh/data";
import { readJsonBody } from "./shared";

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

  const parsed = decodeCliRefreshTokenBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const refreshed = (await refreshCliSession(ctx, parsed.refreshToken)) as RefreshedCliSession | null;

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
    access = (await resolveCliOrganizationAccess(ctx, {
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
    await revokeCliSession(ctx, refreshed.refreshToken);
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
