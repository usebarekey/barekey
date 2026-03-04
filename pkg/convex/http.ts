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

function parseSingleRequest(payload: unknown): EvaluateSingleRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug =
    typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
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
  const projectSlug =
    typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
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

  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT is required.",
      requestId,
    });
  }

  const orgClaims = getOrgClaimsFromIdentity(identity);
  if (orgClaims.orgId === null) {
    return errorResponse({
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "No active organization selected for this token.",
      requestId,
    });
  }

  const requestOrgSlug = orgClaims.orgSlug ?? "";
  const rows: Array<ResolvedVariableRow> = await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: orgClaims.orgId,
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
        expectedOrgSlug: requestOrgSlug,
        featureId: "static_requests",
        units: 1,
        reason: "http_evaluate_single",
      },
    );
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to evaluate billing limits.";
    const code =
      message.toLowerCase().includes("limit") || message.toLowerCase().includes("usage")
        ? "USAGE_LIMIT_EXCEEDED"
        : "BILLING_UNAVAILABLE";
    return errorResponse({
      status: code === "USAGE_LIMIT_EXCEEDED" ? 402 : 503,
      code,
      message,
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
        orgId: orgClaims.orgId,
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
    const billingLogResult = await ctx.runMutation(
      internal.payments.logBillingRequestInternal,
      {
        orgId: orgClaims.orgId,
        requestKey,
        featureId: "static_requests",
        units: 1,
      },
    );
    if (!billingLogResult.inserted && reservedUnits > 0) {
      await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
        expectedOrgSlug: requestOrgSlug,
        featureId: "static_requests",
        units: reservedUnits,
        reason: "http_evaluate_single_duplicate_request",
      });
      reservedUnits = 0;
    }

    return buildJsonResponse(200, {
      name: decrypted.name,
      kind: decrypted.kind,
      value: decrypted.value,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        await ctx.runAction(
          internal.payments.compensateFeatureUnitsForCurrentOrgInternal,
          {
            expectedOrgSlug: requestOrgSlug,
            featureId: "static_requests",
            units: reservedUnits,
            reason: "http_evaluate_single_rollback",
          },
        );
      } catch (rollbackError: unknown) {
        console.error("HTTP single evaluate rollback failed.", rollbackError);
      }
    }
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Failed to evaluate this variable.",
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

  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT is required.",
      requestId,
    });
  }

  const orgClaims = getOrgClaimsFromIdentity(identity);
  if (orgClaims.orgId === null) {
    return errorResponse({
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "No active organization selected for this token.",
      requestId,
    });
  }

  const requestOrgSlug = orgClaims.orgSlug ?? "";
  const rows: Array<ResolvedVariableRow> = await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: orgClaims.orgId,
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
        expectedOrgSlug: requestOrgSlug,
        featureId: "static_requests",
        units: parsed.names.length,
        reason: "http_evaluate_batch",
      },
    );
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to evaluate billing limits.";
    const code =
      message.toLowerCase().includes("limit") || message.toLowerCase().includes("usage")
        ? "USAGE_LIMIT_EXCEEDED"
        : "BILLING_UNAVAILABLE";
    return errorResponse({
      status: code === "USAGE_LIMIT_EXCEEDED" ? 402 : 503,
      code,
      message,
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
          orgId: orgClaims.orgId,
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
    const billingLogResult = await ctx.runMutation(
      internal.payments.logBillingRequestInternal,
      {
        orgId: orgClaims.orgId,
        requestKey,
        featureId: "static_requests",
        units: parsed.names.length,
      },
    );
    if (!billingLogResult.inserted && reservedUnits > 0) {
      await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
        expectedOrgSlug: requestOrgSlug,
        featureId: "static_requests",
        units: reservedUnits,
        reason: "http_evaluate_batch_duplicate_request",
      });
      reservedUnits = 0;
    }

    return buildJsonResponse(200, {
      values,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        await ctx.runAction(
          internal.payments.compensateFeatureUnitsForCurrentOrgInternal,
          {
            expectedOrgSlug: requestOrgSlug,
            featureId: "static_requests",
            units: reservedUnits,
            reason: "http_evaluate_batch_rollback",
          },
        );
      } catch (rollbackError: unknown) {
        console.error("HTTP batch evaluate rollback failed.", rollbackError);
      }
    }
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Failed to evaluate this batch request.",
      requestId,
    });
  }
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

export default http;
