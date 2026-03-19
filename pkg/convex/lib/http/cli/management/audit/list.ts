import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../../responses";
import { decodeCliAuditListBody } from "../input";
import { readJsonBody } from "../../shared";

const listAuditEventsForCurrentOrgReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
    beforeOccurredAtMs: number | null;
    limit: number;
    category: string | null;
    projectSlug: string | null;
    actorSource: string | null;
    sensitiveOnly: boolean;
  },
  unknown
>("audit:listEventsForCurrentOrg") as any;

const listAuditEventsForCurrentOrgProjectReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
    projectSlug: string;
    beforeOccurredAtMs: number | null;
    limit: number;
    category: string | null;
    actorSource: string | null;
    sensitiveOnly: boolean;
  },
  unknown
>("audit:listEventsForCurrentOrgProject") as any;

/**
 * Lists audit events for one CLI-selected organization or project.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The filtered audit page for the request scope.
 * @remarks This keeps the current audit query contracts available to the standalone CLI without exposing direct Convex references.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliAuditList = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliAuditListBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug is required.",
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

  const limit = Math.min(Math.max(parsed.limit ?? 25, 1), 50);
  const queryResult =
    parsed.projectSlug === null
      ? await ctx.runQuery(listAuditEventsForCurrentOrgReference, {
          expectedOrgSlug: parsed.orgSlug,
          beforeOccurredAtMs: parsed.beforeOccurredAtMs,
          limit,
          category: parsed.category,
          projectSlug: null,
          actorSource: parsed.actorSource,
          sensitiveOnly: parsed.sensitiveOnly,
        })
      : await ctx.runQuery(listAuditEventsForCurrentOrgProjectReference, {
          expectedOrgSlug: parsed.orgSlug,
          projectSlug: parsed.projectSlug,
          beforeOccurredAtMs: parsed.beforeOccurredAtMs,
          limit,
          category: parsed.category,
          actorSource: parsed.actorSource,
          sensitiveOnly: parsed.sensitiveOnly,
        });

  return buildJsonResponse(200, {
    ...((queryResult ?? {}) as object),
    requestId,
  });
});
