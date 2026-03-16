import { internal } from "../_generated/api";
import { httpAction } from "../confect";
import { getOrgClaimsFromIdentity } from "./auth";
import {
  isAuthResolutionFailure,
  readIdentityOrNull,
  resolveAuthContext,
} from "./http_auth";
import { readOptionalString } from "./http_env";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "./http_responses";
import { runtimeConfig } from "./runtime_config";

function getCliUiOrigin(request: Request): string {
  const defaultPublicUiOrigin = "https://barekey.dev";
  const configured = runtimeConfig.barekeyUiOrigin;
  if (configured && configured.trim().length > 0) {
    const normalizedConfigured = configured.trim().replace(/\/$/, "");
    try {
      const configuredUrl = new URL(normalizedConfigured);
      if (
        configuredUrl.host.endsWith(".convex.site") ||
        configuredUrl.host.endsWith(".convex.cloud")
      ) {
        return defaultPublicUiOrigin;
      }
    } catch {
      return defaultPublicUiOrigin;
    }
    return normalizedConfigured;
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedHost && forwardedHost.length > 0) {
    const derivedHost = forwardedHost.replace(/^api\./, "");
    const protocol =
      forwardedProto && forwardedProto.length > 0 ? forwardedProto.replace(/:$/, "") : "https";
    return `${protocol}://${derivedHost}`;
  }
  const requestUrl = new URL(request.url);
  const derivedHost = requestUrl.host.replace(/^api\./, "");
  if (derivedHost !== requestUrl.host) {
    return `${requestUrl.protocol}//${derivedHost}`;
  }
  if (
    requestUrl.host === "chatty-sparrow-921.convex.site" ||
    requestUrl.host === "chatty-sparrow-921.convex.cloud"
  ) {
    return defaultPublicUiOrigin;
  }
  return requestUrl.origin;
}

export const cliDeviceStart = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const input =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const clientName = readOptionalString(input, "clientName");

  const deviceStart = await ctx.runMutation(internal.cli_auth.createDeviceCodeInternal, {
    clientName,
  });

  const uiOrigin = getCliUiOrigin(request);
  const verificationUrl = new URL(`${uiOrigin}/cli/device`);
  verificationUrl.searchParams.set("user_code", deviceStart.userCode);
  if (clientName !== null) {
    verificationUrl.searchParams.set("client_name", clientName);
  }

  return buildJsonResponse(200, {
    deviceCode: deviceStart.deviceCode,
    userCode: deviceStart.userCode,
    verificationUri: verificationUrl.toString(),
    intervalSec: deviceStart.intervalSec,
    expiresInSec: deviceStart.expiresInSec,
    requestId,
  });
});

export const cliDeviceComplete = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await request.json();
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
      message: "userCode is required.",
      requestId,
    });
  }

  const input = payload as Record<string, unknown>;
  const userCode = readOptionalString(input, "userCode");
  if (userCode === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "userCode is required.",
      requestId,
    });
  }

  const identity = await readIdentityOrNull(ctx.auth);
  if (identity === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT is required.",
      requestId,
    });
  }

  const claims = getOrgClaimsFromIdentity(identity);
  if (claims.orgId === null || claims.orgSlug === null) {
    return errorResponse({
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "No active organization selected for this token.",
      requestId,
    });
  }

  try {
    const result = await ctx.runMutation(
      internal.cli_auth.completeDeviceCodeForCurrentUserInternal,
      {
        userCode,
        clerkUserId: claims.clerkUserId,
        orgId: claims.orgId,
        orgSlug: claims.orgSlug,
      },
    );

    return buildJsonResponse(200, {
      status: result.status,
      orgSlug: result.orgSlug,
      requestId,
    });
  } catch (error: unknown) {
    return errorResponse({
      status: 400,
      code: "DEVICE_COMPLETE_FAILED",
      message: error instanceof Error ? error.message : "Unable to complete device authorization.",
      requestId,
    });
  }
});

export const cliDevicePoll = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await request.json();
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
      message: "deviceCode is required.",
      requestId,
    });
  }

  const input = payload as Record<string, unknown>;
  const deviceCode = readOptionalString(input, "deviceCode");
  if (deviceCode === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "deviceCode is required.",
      requestId,
    });
  }

  const pollResult = await ctx.runMutation(internal.cli_auth.pollDeviceCodeInternal, {
    deviceCode,
  });

  if (pollResult.status === "invalid") {
    return errorResponse({
      status: 404,
      code: "INVALID_DEVICE_CODE",
      message: "Device code is invalid.",
      requestId,
    });
  }

  if (pollResult.status === "expired") {
    return errorResponse({
      status: 410,
      code: "DEVICE_CODE_EXPIRED",
      message: "Device code expired before approval.",
      requestId,
    });
  }

  if (pollResult.status === "already_exchanged") {
    return errorResponse({
      status: 409,
      code: "DEVICE_CODE_ALREADY_CONSUMED",
      message: "Device code has already been consumed.",
      requestId,
    });
  }

  if (pollResult.status === "pending") {
    return buildJsonResponse(200, {
      status: "pending",
      intervalSec: pollResult.intervalSec,
      requestId,
    });
  }

  return buildJsonResponse(200, {
    status: "approved",
    intervalSec: pollResult.intervalSec,
    accessToken: pollResult.accessToken,
    refreshToken: pollResult.refreshToken,
    accessTokenExpiresAtMs: pollResult.accessTokenExpiresAtMs,
    refreshTokenExpiresAtMs: pollResult.refreshTokenExpiresAtMs,
    orgId: pollResult.orgId,
    orgSlug: pollResult.orgSlug,
    clerkUserId: pollResult.clerkUserId,
    requestId,
  });
});

export const cliTokenRefresh = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await request.json();
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

  const refreshed = await ctx.runMutation(internal.cli_auth.refreshSessionInternal, {
    refreshToken,
  });

  if (refreshed === null) {
    return errorResponse({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid or expired.",
      requestId,
    });
  }

  const access = await ctx.runAction(internal.clerk.resolveOrganizationAccessForCliUserInternal, {
    clerkUserId: refreshed.clerkUserId,
    requestedOrgSlug: refreshed.orgSlug,
    fallbackOrgId: refreshed.orgId,
    fallbackOrgSlug: refreshed.orgSlug,
  });

  if (access === null) {
    await ctx.runMutation(internal.cli_auth.revokeSessionInternal, {
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

export const cliLogout = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await request.json();
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

  const result = await ctx.runMutation(internal.cli_auth.revokeSessionInternal, {
    refreshToken,
  });

  return buildJsonResponse(200, {
    revoked: result.revoked,
    requestId,
  });
});

export const cliSession = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  const authResult = await resolveAuthContext(ctx, request);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  return buildJsonResponse(200, {
    clerkUserId: authContext.clerkUserId,
    orgId: authContext.orgId,
    orgSlug: authContext.orgSlug,
    source: authContext.source,
    requestId,
  });
});
