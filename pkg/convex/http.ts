import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { getOrgClaimsFromIdentity } from "./lib/auth";

type EvaluateSingleRequest = {
  projectSlug: string;
  stageSlug: string;
  name: string;
  key?: string;
  seed?: string;
};

type EvaluateBatchRequest = {
  projectSlug: string;
  stageSlug: string;
  names: Array<string>;
  key?: string;
  seed?: string;
};

type ResolvedVariableRow = {
  id: Id<"projectVariables">;
  projectId: Id<"projects">;
  orgId: string;
  stageSlug: string;
  name: string;
  kind: "secret";
};

type AuthContext = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
  source: "clerk" | "cli";
};

type AuthResolutionCtx = {
  auth: {
    getUserIdentity(): Promise<import("convex/server").UserIdentity | null>;
  };
  runMutation(functionReference: unknown, args: Record<string, unknown>): Promise<unknown>;
};

function buildJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function readRequestId(request: Request): string {
  const headerRequestId = request.headers.get("x-request-id");
  if (headerRequestId && headerRequestId.trim().length > 0) {
    return headerRequestId.trim();
  }
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorResponse(input: {
  status: number;
  code: string;
  message: string;
  requestId: string;
}): Response {
  return buildJsonResponse(input.status, {
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
    },
  });
}

function normalizeName(value: string): string {
  return value.trim();
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

function parseSingleRequest(payload: unknown): EvaluateSingleRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const name = typeof input.name === "string" ? normalizeName(input.name) : "";

  if (projectSlug.length === 0 || stageSlug.length === 0 || name.length === 0) {
    return null;
  }

  return {
    projectSlug,
    stageSlug,
    name,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}

function parseBatchRequest(payload: unknown): EvaluateBatchRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const names = Array.isArray(input.names)
    ? input.names
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeName(value))
    : [];

  if (projectSlug.length === 0 || stageSlug.length === 0 || names.length === 0) {
    return null;
  }

  const unique = new Set<string>();
  for (const name of names) {
    if (name.length === 0 || unique.has(name)) {
      return null;
    }
    unique.add(name);
  }

  return {
    projectSlug,
    stageSlug,
    names,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}

async function resolveAuthContext(
  ctx: AuthResolutionCtx,
  request: Request,
): Promise<AuthContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity !== null) {
    const orgClaims = getOrgClaimsFromIdentity(identity);
    if (orgClaims.orgId === null || orgClaims.orgSlug === null) {
      return null;
    }
    return {
      clerkUserId: orgClaims.clerkUserId,
      orgId: orgClaims.orgId,
      orgSlug: orgClaims.orgSlug,
      source: "clerk",
    };
  }

  const bearerToken = extractBearerToken(request);
  if (bearerToken === null) {
    return null;
  }

  const session = (await ctx.runMutation(internal.cli_auth.authenticateAccessTokenInternal, {
    accessToken: bearerToken,
  })) as {
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  } | null;

  if (session === null) {
    return null;
  }

  return {
    clerkUserId: session.clerkUserId,
    orgId: session.orgId,
    orgSlug: session.orgSlug,
    source: "cli",
  };
}

function classifyReserveError(error: unknown): {
  status: number;
  code: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE";
  message: string;
} {
  const message =
    error instanceof Error ? error.message : "Billing service is temporarily unavailable.";
  if (message === "Usage limit exceeded for this workspace plan.") {
    return {
      status: 402,
      code: "USAGE_LIMIT_EXCEEDED",
      message,
    };
  }
  return {
    status: 503,
    code: "BILLING_UNAVAILABLE",
    message: "Billing service is temporarily unavailable.",
  };
}

function readOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCliUiOrigin(request: Request): string {
  const configured = process.env.BAREKEY_UI_ORIGIN;
  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const evaluateOne = httpAction(async (ctx, request) => {
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

  const parsed = parseSingleRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug, stageSlug, and name are required.",
      requestId,
    });
  }

  const authContext = await resolveAuthContext(ctx, request);
  if (authContext === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
      requestId,
    });
  }

  const rows: Array<ResolvedVariableRow> = await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      names: [parsed.name],
    },
  );
  if (rows.length !== 1) {
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: `Variable ${parsed.name} was not found in this stage.`,
      requestId,
    });
  }

  let reservedUnits = 0;
  try {
    const reservation = await ctx.runAction(
      internal.payments.reserveFeatureUnitsForCurrentOrgInternal,
      {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "static_requests",
        units: 1,
        reason: "http_evaluate_single",
      },
    );
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const row = rows[0];
    if (!row) {
      throw new Error("Variable row missing.");
    }
    const decrypted = await ctx.runMutation(
      internal.project_variables.decryptValueForOrgProjectStageInternal,
      {
        orgId: authContext.orgId,
        projectSlug: parsed.projectSlug,
        stageSlug: parsed.stageSlug,
        variableId: row.id,
      },
    );

    const requestKeyHeader = request.headers.get("x-barekey-request-key");
    const requestKey =
      requestKeyHeader && requestKeyHeader.trim().length > 0
        ? requestKeyHeader.trim()
        : `single-${requestId}`;
    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey,
      featureId: "static_requests",
      units: 1,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "static_requests",
        units: unitsToCompensate,
        reason: "http_evaluate_single_duplicate_request",
      });
    }

    return buildJsonResponse(200, {
      name: decrypted.name,
      kind: decrypted.kind,
      value: decrypted.value,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "static_requests",
          units: unitsToCompensate,
          reason: "http_evaluate_single_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP single evaluate rollback failed.", rollbackError);
      }
    }
    console.error("HTTP single evaluate failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to evaluate this variable.",
      requestId,
    });
  }
});

const evaluateBatch = httpAction(async (ctx, request) => {
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

  const parsed = parseBatchRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug, stageSlug, and non-empty unique names[] are required.",
      requestId,
    });
  }

  const authContext = await resolveAuthContext(ctx, request);
  if (authContext === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
      requestId,
    });
  }

  const rows: Array<ResolvedVariableRow> = await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      names: parsed.names,
    },
  );

  if (rows.length !== parsed.names.length) {
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: "One or more requested variables were not found.",
      requestId,
    });
  }

  let reservedUnits = 0;
  try {
    const reservation = await ctx.runAction(
      internal.payments.reserveFeatureUnitsForCurrentOrgInternal,
      {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "static_requests",
        units: parsed.names.length,
        reason: "http_evaluate_batch",
      },
    );
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const byName = new Map(rows.map((row) => [row.name, row]));
    const values: Array<{
      name: string;
      kind: "secret";
      value: string;
    }> = [];

    for (const name of parsed.names) {
      const row = byName.get(name);
      if (!row) {
        throw new Error("Batch resolution drift detected.");
      }
      const decrypted = await ctx.runMutation(
        internal.project_variables.decryptValueForOrgProjectStageInternal,
        {
          orgId: authContext.orgId,
          projectSlug: parsed.projectSlug,
          stageSlug: parsed.stageSlug,
          variableId: row.id,
        },
      );
      values.push({
        name: decrypted.name,
        kind: decrypted.kind,
        value: decrypted.value,
      });
    }

    const requestKeyHeader = request.headers.get("x-barekey-request-key");
    const requestKey =
      requestKeyHeader && requestKeyHeader.trim().length > 0
        ? requestKeyHeader.trim()
        : `batch-${requestId}`;
    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey,
      featureId: "static_requests",
      units: parsed.names.length,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "static_requests",
        units: unitsToCompensate,
        reason: "http_evaluate_batch_duplicate_request",
      });
    }

    return buildJsonResponse(200, {
      values,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "static_requests",
          units: unitsToCompensate,
          reason: "http_evaluate_batch_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP batch evaluate rollback failed.", rollbackError);
      }
    }
    console.error("HTTP batch evaluate failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to evaluate this batch request.",
      requestId,
    });
  }
});

const cliDeviceStart = httpAction(async (ctx, request) => {
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
  const verificationUri = `${uiOrigin}/cli/device?user_code=${encodeURIComponent(deviceStart.userCode)}`;

  return buildJsonResponse(200, {
    deviceCode: deviceStart.deviceCode,
    userCode: deviceStart.userCode,
    verificationUri,
    intervalSec: deviceStart.intervalSec,
    expiresInSec: deviceStart.expiresInSec,
    requestId,
  });
});

const cliDeviceComplete = httpAction(async (ctx, request) => {
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

  const identity = await ctx.auth.getUserIdentity();
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

const cliDevicePoll = httpAction(async (ctx, request) => {
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

const cliTokenRefresh = httpAction(async (ctx, request) => {
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

const cliLogout = httpAction(async (ctx, request) => {
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

const cliSession = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  const authContext = await resolveAuthContext(ctx, request);
  if (authContext === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
      requestId,
    });
  }

  return buildJsonResponse(200, {
    clerkUserId: authContext.clerkUserId,
    orgId: authContext.orgId,
    orgSlug: authContext.orgSlug,
    source: authContext.source,
    requestId,
  });
});

const typegenManifest = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  const authContext = await resolveAuthContext(ctx, request);
  if (authContext === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT or CLI access token is required.",
      requestId,
    });
  }

  const url = new URL(request.url);
  const projectSlug = (url.searchParams.get("projectSlug") ?? "").trim();
  const stageSlug = (url.searchParams.get("stageSlug") ?? "").trim();
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug and stageSlug are required query params.",
      requestId,
    });
  }

  const manifest = await ctx.runQuery(internal.typegen.buildManifestForOrgProjectStageInternal, {
    orgId: authContext.orgId,
    projectSlug,
    stageSlug,
  });

  if (manifest === null) {
    return errorResponse({
      status: 404,
      code: "MANIFEST_NOT_FOUND",
      message: "Project or stage not found for this organization.",
      requestId,
    });
  }

  const manifestVersion = await sha256Base64Url(JSON.stringify(manifest));

  return buildJsonResponse(200, {
    ...manifest,
    manifestVersion,
    requestId,
  });
});

const http = httpRouter();

http.route({
  path: "/v1/env/evaluate",
  method: "POST",
  handler: evaluateOne,
});

http.route({
  path: "/v1/env/evaluate-batch",
  method: "POST",
  handler: evaluateBatch,
});

http.route({
  path: "/v1/cli/device/start",
  method: "POST",
  handler: cliDeviceStart,
});

http.route({
  path: "/v1/cli/device/complete",
  method: "POST",
  handler: cliDeviceComplete,
});

http.route({
  path: "/v1/cli/device/poll",
  method: "POST",
  handler: cliDevicePoll,
});

http.route({
  path: "/v1/cli/token/refresh",
  method: "POST",
  handler: cliTokenRefresh,
});

http.route({
  path: "/v1/cli/logout",
  method: "POST",
  handler: cliLogout,
});

http.route({
  path: "/v1/cli/session",
  method: "GET",
  handler: cliSession,
});

http.route({
  path: "/v1/typegen/manifest",
  method: "GET",
  handler: typegenManifest,
});

export default http;
