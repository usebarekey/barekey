import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../../confect";
import { buildJsonResponse, errorResponse, readRequestId } from "../../../responses";

const getPricingCatalogPublicReference = makeFunctionReference<
  "action",
  {},
  unknown
>("payments:getPricingCatalogPublic") as any;

/**
 * Reads the public billing catalog for the CLI.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The public billing catalog and feature identifiers.
 * @remarks This is public metadata, so it does not require auth beyond standard route access.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliBillingCatalog = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);

  try {
    const catalog = await ctx.runAction(getPricingCatalogPublicReference, {});
    return buildJsonResponse(200, {
      ...((catalog ?? {}) as object),
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 500,
      code: "BILLING_CATALOG_FAILED",
      message: error instanceof Error ? error.message : "Failed to load billing catalog.",
      requestId,
    });
  }
});
