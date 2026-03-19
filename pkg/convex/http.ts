import { httpRouter } from "convex/server";

import {
  cliDeviceComplete,
  cliDevicePoll,
  cliDeviceStart,
  cliLogout,
  cliAuditList,
  cliBillingCatalog,
  cliBillingStatus,
  cliOrganizationsCreate,
  cliOrganizationsList,
  cliProjectsCreate,
  cliProjectsDelete,
  cliProjectsList,
  cliSession,
  cliStagesCreate,
  cliStagesDelete,
  cliStagesList,
  cliStagesRename,
  cliTokenRefresh,
} from "./lib/http/cli";
import {
  envDefinitions,
  envList,
  envPull,
  envWrite,
  evaluateBatch,
  evaluateOne,
  publicEnvDefinitions,
} from "./lib/http/env/routes";
import { clerkWebhook, corsPreflight, typegenManifest } from "./lib/http/misc";

const http = httpRouter();

function registerCorsRoute(
  path: string,
  method: "GET" | "POST",
  handler: Parameters<typeof http.route>[0]["handler"],
): void {
  http.route({
    path,
    method,
    handler,
  });
  http.route({
    path,
    method: "OPTIONS",
    handler: corsPreflight,
  });
}

registerCorsRoute("/v1/env/evaluate", "POST", evaluateOne);
registerCorsRoute("/v1/env/evaluate-batch", "POST", evaluateBatch);
registerCorsRoute("/v1/env/list", "POST", envList);
registerCorsRoute("/v1/env/write", "POST", envWrite);
registerCorsRoute("/v1/env/pull", "POST", envPull);
registerCorsRoute("/v1/env/definitions", "POST", envDefinitions);
registerCorsRoute("/v1/public/env/definitions", "POST", publicEnvDefinitions);

registerCorsRoute("/v1/cli/device/start", "POST", cliDeviceStart);
registerCorsRoute("/v1/cli/device/complete", "POST", cliDeviceComplete);
registerCorsRoute("/v1/cli/device/poll", "POST", cliDevicePoll);
registerCorsRoute("/v1/cli/token/refresh", "POST", cliTokenRefresh);
registerCorsRoute("/v1/cli/logout", "POST", cliLogout);
registerCorsRoute("/v1/cli/session", "GET", cliSession);
registerCorsRoute("/v1/cli/orgs", "GET", cliOrganizationsList);
registerCorsRoute("/v1/cli/orgs/create", "POST", cliOrganizationsCreate);
registerCorsRoute("/v1/cli/projects/list", "POST", cliProjectsList);
registerCorsRoute("/v1/cli/projects/create", "POST", cliProjectsCreate);
registerCorsRoute("/v1/cli/projects/delete", "POST", cliProjectsDelete);
registerCorsRoute("/v1/cli/stages/list", "POST", cliStagesList);
registerCorsRoute("/v1/cli/stages/create", "POST", cliStagesCreate);
registerCorsRoute("/v1/cli/stages/rename", "POST", cliStagesRename);
registerCorsRoute("/v1/cli/stages/delete", "POST", cliStagesDelete);
registerCorsRoute("/v1/cli/billing/catalog", "GET", cliBillingCatalog);
registerCorsRoute("/v1/cli/billing/status", "POST", cliBillingStatus);
registerCorsRoute("/v1/cli/audit/list", "POST", cliAuditList);

registerCorsRoute("/v1/typegen/manifest", "GET", typegenManifest);
registerCorsRoute("/v1/internal/clerk/webhook", "POST", clerkWebhook);

export default http;
