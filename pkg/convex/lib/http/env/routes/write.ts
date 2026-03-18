import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { classifyReserveError, parseWriteRequest } from "..";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "../../responses";
import { readJsonBody } from "./shared";
import type { WriteWithUsageResult } from "../../../../project_variables/types";

const writeVariablesForOrgProjectStageWithUsageInternalReference = makeFunctionReference<
  "action",
  {
    orgId: string;
    orgSlug: string;
    clerkUserId: string;
    projectSlug: string;
    stageSlug: string;
    mode: "create_only" | "upsert";
    entries: Array<unknown>;
    deletes: Array<string>;
  },
  WriteWithUsageResult
>("project_variables:writeVariablesForOrgProjectStageWithUsageInternal") as any;

/**
 * Writes variable changes for an authenticated environment request.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The write summary response or a normalized error response.
 * @remarks This delegates to the project-variable write workflow, including billing and audit side effects.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const envWrite = httpAction(async (ctx, request) => {
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

  const parsed = parseWriteRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "Invalid write payload. Check projectSlug/stageSlug/mode/entries/deletes.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  try {
    const result = (await ctx.runAction(
      writeVariablesForOrgProjectStageWithUsageInternalReference,
      {
        orgId: authContext.orgId,
        orgSlug: authContext.orgSlug,
        clerkUserId: authContext.clerkUserId,
        projectSlug: parsed.projectSlug,
        stageSlug: parsed.stageSlug,
        mode: parsed.mode,
        entries: parsed.entries,
        deletes: parsed.deletes,
      },
    )) as WriteWithUsageResult;

    return buildJsonResponse(200, {
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      deletedCount: result.deletedCount,
      requestId,
    });
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.isBillingRelated ? classified.status : 400,
      code: classified.isBillingRelated ? classified.code : "WRITE_FAILED",
      message: classified.isBillingRelated ? classified.message : "Failed to write variables.",
      requestId,
    });
  }
});
