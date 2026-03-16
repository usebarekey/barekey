/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as autumn from "../autumn.js";
import type * as bootstrap from "../bootstrap.js";
import type * as clerk from "../clerk.js";
import type * as cli_auth from "../cli_auth.js";
import type * as confect from "../confect.js";
import type * as crons from "../crons.js";
import type * as cutover from "../cutover.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_declared_types from "../lib/declared_types.js";
import type * as lib_effect_errors from "../lib/effect_errors.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_http_auth from "../lib/http_auth.js";
import type * as lib_http_cli from "../lib/http_cli.js";
import type * as lib_http_env from "../lib/http_env.js";
import type * as lib_http_env_routes from "../lib/http_env_routes.js";
import type * as lib_http_misc from "../lib/http_misc.js";
import type * as lib_http_responses from "../lib/http_responses.js";
import type * as lib_payments_catalog from "../lib/payments_catalog.js";
import type * as lib_payments_management from "../lib/payments_management.js";
import type * as lib_payments_state from "../lib/payments_state.js";
import type * as lib_payments_variants from "../lib/payments_variants.js";
import type * as lib_project_scope from "../lib/project_scope.js";
import type * as lib_project_variable_schedules from "../lib/project_variable_schedules.js";
import type * as lib_project_variables_shared from "../lib/project_variables_shared.js";
import type * as lib_rollout from "../lib/rollout.js";
import type * as lib_runtime_config from "../lib/runtime_config.js";
import type * as lib_runtime_config_loader from "../lib/runtime_config_loader.js";
import type * as lib_timezone from "../lib/timezone.js";
import type * as lib_visibility from "../lib/visibility.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as project_stages from "../project_stages.js";
import type * as project_variable_schedules from "../project_variable_schedules.js";
import type * as project_variables from "../project_variables.js";
import type * as projects from "../projects.js";
import type * as typegen from "../typegen.js";
import type * as user_preferences from "../user_preferences.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  autumn: typeof autumn;
  bootstrap: typeof bootstrap;
  clerk: typeof clerk;
  cli_auth: typeof cli_auth;
  confect: typeof confect;
  crons: typeof crons;
  cutover: typeof cutover;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/declared_types": typeof lib_declared_types;
  "lib/effect_errors": typeof lib_effect_errors;
  "lib/encryption": typeof lib_encryption;
  "lib/http_auth": typeof lib_http_auth;
  "lib/http_cli": typeof lib_http_cli;
  "lib/http_env": typeof lib_http_env;
  "lib/http_env_routes": typeof lib_http_env_routes;
  "lib/http_misc": typeof lib_http_misc;
  "lib/http_responses": typeof lib_http_responses;
  "lib/payments_catalog": typeof lib_payments_catalog;
  "lib/payments_management": typeof lib_payments_management;
  "lib/payments_state": typeof lib_payments_state;
  "lib/payments_variants": typeof lib_payments_variants;
  "lib/project_scope": typeof lib_project_scope;
  "lib/project_variable_schedules": typeof lib_project_variable_schedules;
  "lib/project_variables_shared": typeof lib_project_variables_shared;
  "lib/rollout": typeof lib_rollout;
  "lib/runtime_config": typeof lib_runtime_config;
  "lib/runtime_config_loader": typeof lib_runtime_config_loader;
  "lib/timezone": typeof lib_timezone;
  "lib/visibility": typeof lib_visibility;
  orgs: typeof orgs;
  payments: typeof payments;
  project_stages: typeof project_stages;
  project_variable_schedules: typeof project_variable_schedules;
  project_variables: typeof project_variables;
  projects: typeof projects;
  typegen: typeof typegen;
  user_preferences: typeof user_preferences;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  autumn: {};
};
