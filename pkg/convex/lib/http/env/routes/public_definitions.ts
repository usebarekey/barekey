import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../../confect";
import type { PublicVariableResolution } from "../../../../project_variables/queries";
import { parseDefinitionsRequest, resolveDefinitionsForRows } from "..";
import { buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { readJsonBody } from "./shared";

const resolvePublicVariableRowsForOrgProjectStageInternalReference = makeFunctionReference<
  "query",
  {
    orgSlug: string;
    projectSlug: string;
    stageSlug: string;
    names?: Array<string>;
  },
  PublicVariableResolution
>("project_variables:resolvePublicVariableRowsForOrgProjectStageInternal") as any;

/**
 * Resolves public variable definitions without authenticated workspace context.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The public definitions payload or a normalized error response.
 * @remarks This only exposes definitions for rows already marked public by the project-variable query.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const publicEnvDefinitions = httpAction(async (ctx, request) => {
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

  const parsed = parseDefinitionsRequest(payload);
  if (parsed === null || !parsed.orgSlug) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug, projectSlug, and stageSlug are required.",
      requestId,
    });
  }

  const resolved = (await ctx.runQuery(
    resolvePublicVariableRowsForOrgProjectStageInternalReference,
    {
      orgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      ...(parsed.names === undefined ? {} : { names: parsed.names }),
    },
  )) as PublicVariableResolution;
  if (resolved === null) {
    return errorResponse({
      status: 404,
      code: "ENVIRONMENT_NOT_FOUND",
      message: "Project or environment was not found.",
      requestId,
    });
  }

  if (parsed.names !== undefined && resolved.rows.length !== parsed.names.length) {
    const returnedNames = new Set(resolved.rows.map((row: { name: string }) => row.name));
    const missingName = parsed.names.find((name) => !returnedNames.has(name)) ?? parsed.names[0];
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: `Variable ${missingName ?? "unknown"} was not found in this stage.`,
      requestId,
    });
  }

  try {
    const definitions = await resolveDefinitionsForRows(ctx, {
      orgId: resolved.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      rows: resolved.rows,
    });

    return buildJsonResponse(200, {
      definitions,
      requestId,
    });
  } catch (error: unknown) {
    console.error("HTTP public definitions failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to resolve public variable definitions.",
      requestId,
    });
  }
});
