import { verifyWebhook } from "@clerk/backend/webhooks";

import { internal } from "../_generated/api";
import { httpAction } from "../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "./http_auth";
import {
  authErrorResponse,
  buildCorsPreflightResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "./http_responses";
import { runtimeConfig } from "./runtime_config";

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export const typegenManifest = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  const url = new URL(request.url);
  const requestedOrgSlug = (url.searchParams.get("orgSlug") ?? "").trim() || undefined;
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

  const authResult = await resolveAuthContext(ctx, request, requestedOrgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const manifest = await ctx.runMutation(internal.typegen.buildManifestForOrgProjectStageInternal, {
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

  const manifestVersion = await sha256Base64Url(
    JSON.stringify({
      orgId: manifest.orgId,
      orgSlug: manifest.orgSlug,
      projectSlug: manifest.projectSlug,
      stageSlug: manifest.stageSlug,
      variables: manifest.variables,
    }),
  );

  return buildJsonResponse(200, {
    ...manifest,
    manifestVersion,
    requestId,
  });
});

export const clerkWebhook = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  if (runtimeConfig.clerkWebhookSigningSecret === null) {
    return errorResponse({
      status: 503,
      code: "WEBHOOK_UNAVAILABLE",
      message: "Clerk webhook signing secret is not configured.",
      requestId,
    });
  }

  let event: unknown;
  try {
    event = await verifyWebhook(request, {
      signingSecret: runtimeConfig.clerkWebhookSigningSecret,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Webhook verification failed.";
    return errorResponse({
      status: 401,
      code: "INVALID_WEBHOOK_SIGNATURE",
      message,
      requestId,
    });
  }

  const result = await ctx.runAction(internal.audit.ingestClerkWebhookEventInternal, {
    payloadJson: JSON.stringify(event),
  });

  return buildJsonResponse(200, {
    accepted: result.accepted,
    requestId,
  });
});

export const corsPreflight = httpAction(async () => buildCorsPreflightResponse());
