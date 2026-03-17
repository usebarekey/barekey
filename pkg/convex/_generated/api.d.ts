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
import type * as audit_append from "../audit/append.js";
import type * as audit_clerk_webhooks from "../audit/clerk_webhooks.js";
import type * as audit_list from "../audit/list.js";
import type * as audit_normalization from "../audit/normalization.js";
import type * as audit_prune from "../audit/prune.js";
import type * as audit_types from "../audit/types.js";
import type * as autumn from "../autumn.js";
import type * as bootstrap from "../bootstrap.js";
import type * as clerk from "../clerk.js";
import type * as cli_auth from "../cli_auth.js";
import type * as cli_auth_device_code_complete from "../cli_auth/device_code_complete.js";
import type * as cli_auth_device_code_create from "../cli_auth/device_code_create.js";
import type * as cli_auth_device_code_poll from "../cli_auth/device_code_poll.js";
import type * as cli_auth_sessions from "../cli_auth/sessions.js";
import type * as cli_auth_token_helpers from "../cli_auth/token_helpers.js";
import type * as confect from "../confect.js";
import type * as crons from "../crons.js";
import type * as cutover from "../cutover.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_confect_boundary from "../lib/confect_boundary.js";
import type * as lib_confect_runtime_layer from "../lib/confect_runtime_layer.js";
import type * as lib_confect_schema from "../lib/confect_schema.js";
import type * as lib_confect_services from "../lib/confect_services.js";
import type * as lib_confect_validator_schemas from "../lib/confect_validator_schemas.js";
import type * as lib_declared_types from "../lib/declared_types.js";
import type * as lib_effect_errors from "../lib/effect_errors.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_http_auth from "../lib/http_auth.js";
import type * as lib_http_cli from "../lib/http_cli.js";
import type * as lib_http_cli_device_complete from "../lib/http_cli/device_complete.js";
import type * as lib_http_cli_device_poll from "../lib/http_cli/device_poll.js";
import type * as lib_http_cli_device_start from "../lib/http_cli/device_start.js";
import type * as lib_http_cli_logout from "../lib/http_cli/logout.js";
import type * as lib_http_cli_session from "../lib/http_cli/session.js";
import type * as lib_http_cli_shared from "../lib/http_cli/shared.js";
import type * as lib_http_cli_token_refresh from "../lib/http_cli/token_refresh.js";
import type * as lib_http_env from "../lib/http_env.js";
import type * as lib_http_env_errors from "../lib/http_env/errors.js";
import type * as lib_http_env_parsing from "../lib/http_env/parsing.js";
import type * as lib_http_env_types from "../lib/http_env/types.js";
import type * as lib_http_env_values from "../lib/http_env/values.js";
import type * as lib_http_env_routes from "../lib/http_env_routes.js";
import type * as lib_http_env_routes_definitions from "../lib/http_env_routes/definitions.js";
import type * as lib_http_env_routes_evaluate_batch from "../lib/http_env_routes/evaluate_batch.js";
import type * as lib_http_env_routes_evaluate_one from "../lib/http_env_routes/evaluate_one.js";
import type * as lib_http_env_routes_list from "../lib/http_env_routes/list.js";
import type * as lib_http_env_routes_public_definitions from "../lib/http_env_routes/public_definitions.js";
import type * as lib_http_env_routes_pull from "../lib/http_env_routes/pull.js";
import type * as lib_http_env_routes_shared from "../lib/http_env_routes/shared.js";
import type * as lib_http_env_routes_write from "../lib/http_env_routes/write.js";
import type * as lib_http_misc from "../lib/http_misc.js";
import type * as lib_http_responses from "../lib/http_responses.js";
import type * as lib_payments_catalog from "../lib/payments_catalog.js";
import type * as lib_payments_management from "../lib/payments_management.js";
import type * as lib_payments_management_billing_portal from "../lib/payments_management/billing_portal.js";
import type * as lib_payments_management_change_plan from "../lib/payments_management/change_plan.js";
import type * as lib_payments_management_free_credit from "../lib/payments_management/free_credit.js";
import type * as lib_payments_state from "../lib/payments_state.js";
import type * as lib_payments_variants from "../lib/payments_variants.js";
import type * as lib_project_scope from "../lib/project_scope.js";
import type * as lib_project_scope_errors from "../lib/project_scope/errors.js";
import type * as lib_project_scope_programs from "../lib/project_scope/programs.js";
import type * as lib_project_scope_readers from "../lib/project_scope/readers.js";
import type * as lib_project_variable_schedules from "../lib/project_variable_schedules.js";
import type * as lib_project_variables_shared from "../lib/project_variables_shared.js";
import type * as lib_rollout from "../lib/rollout.js";
import type * as lib_runtime_config from "../lib/runtime_config.js";
import type * as lib_runtime_config_loader from "../lib/runtime_config_loader.js";
import type * as lib_timezone from "../lib/timezone.js";
import type * as lib_visibility from "../lib/visibility.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as payments_billing_state from "../payments/billing_state.js";
import type * as payments_catalog from "../payments/catalog.js";
import type * as payments_credit_grants from "../payments/credit_grants.js";
import type * as payments_credit_queries from "../payments/credit_queries.js";
import type * as payments_credit_revocations from "../payments/credit_revocations.js";
import type * as payments_helpers from "../payments/helpers.js";
import type * as payments_management_actions from "../payments/management_actions.js";
import type * as payments_metered_usage from "../payments/metered_usage.js";
import type * as payments_request_log from "../payments/request_log.js";
import type * as payments_storage from "../payments/storage.js";
import type * as payments_types from "../payments/types.js";
import type * as payments_workspace_plan from "../payments/workspace_plan.js";
import type * as project_stages from "../project_stages.js";
import type * as project_stages_access from "../project_stages/access.js";
import type * as project_stages_create from "../project_stages/create.js";
import type * as project_stages_defaults from "../project_stages/defaults.js";
import type * as project_stages_delete from "../project_stages/delete.js";
import type * as project_stages_queries from "../project_stages/queries.js";
import type * as project_stages_rename from "../project_stages/rename.js";
import type * as project_stages_slug from "../project_stages/slug.js";
import type * as project_stages_types from "../project_stages/types.js";
import type * as project_variable_schedules from "../project_variable_schedules.js";
import type * as project_variable_schedules_access from "../project_variable_schedules/access.js";
import type * as project_variable_schedules_cancel from "../project_variable_schedules/cancel.js";
import type * as project_variable_schedules_create from "../project_variable_schedules/create.js";
import type * as project_variable_schedules_decrypt from "../project_variable_schedules/decrypt.js";
import type * as project_variable_schedules_execution from "../project_variable_schedules/execution.js";
import type * as project_variable_schedules_list from "../project_variable_schedules/list.js";
import type * as project_variable_schedules_snapshot from "../project_variable_schedules/snapshot.js";
import type * as project_variable_schedules_types from "../project_variable_schedules/types.js";
import type * as project_variable_schedules_update from "../project_variable_schedules/update.js";
import type * as project_variable_schedules_validators from "../project_variable_schedules/validators.js";
import type * as project_variables from "../project_variables.js";
import type * as project_variables_access from "../project_variables/access.js";
import type * as project_variables_apply_prepared_variable_writes from "../project_variables/apply_prepared_variable_writes.js";
import type * as project_variables_decrypt from "../project_variables/decrypt.js";
import type * as project_variables_draft_actions from "../project_variables/draft_actions.js";
import type * as project_variables_draft_mutations from "../project_variables/draft_mutations.js";
import type * as project_variables_prepare_variable_writes from "../project_variables/prepare_variable_writes.js";
import type * as project_variables_prepared_write_actions from "../project_variables/prepared_write_actions.js";
import type * as project_variables_prepared_write_mutations from "../project_variables/prepared_write_mutations.js";
import type * as project_variables_prepared_write_summary from "../project_variables/prepared_write_summary.js";
import type * as project_variables_queries from "../project_variables/queries.js";
import type * as project_variables_types from "../project_variables/types.js";
import type * as projects from "../projects.js";
import type * as projects_create from "../projects/create.js";
import type * as projects_delete from "../projects/delete.js";
import type * as projects_queries from "../projects/queries.js";
import type * as projects_slug from "../projects/slug.js";
import type * as projects_types from "../projects/types.js";
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
  "audit/append": typeof audit_append;
  "audit/clerk_webhooks": typeof audit_clerk_webhooks;
  "audit/list": typeof audit_list;
  "audit/normalization": typeof audit_normalization;
  "audit/prune": typeof audit_prune;
  "audit/types": typeof audit_types;
  autumn: typeof autumn;
  bootstrap: typeof bootstrap;
  clerk: typeof clerk;
  cli_auth: typeof cli_auth;
  "cli_auth/device_code_complete": typeof cli_auth_device_code_complete;
  "cli_auth/device_code_create": typeof cli_auth_device_code_create;
  "cli_auth/device_code_poll": typeof cli_auth_device_code_poll;
  "cli_auth/sessions": typeof cli_auth_sessions;
  "cli_auth/token_helpers": typeof cli_auth_token_helpers;
  confect: typeof confect;
  crons: typeof crons;
  cutover: typeof cutover;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/confect_boundary": typeof lib_confect_boundary;
  "lib/confect_runtime_layer": typeof lib_confect_runtime_layer;
  "lib/confect_schema": typeof lib_confect_schema;
  "lib/confect_services": typeof lib_confect_services;
  "lib/confect_validator_schemas": typeof lib_confect_validator_schemas;
  "lib/declared_types": typeof lib_declared_types;
  "lib/effect_errors": typeof lib_effect_errors;
  "lib/encryption": typeof lib_encryption;
  "lib/http_auth": typeof lib_http_auth;
  "lib/http_cli": typeof lib_http_cli;
  "lib/http_cli/device_complete": typeof lib_http_cli_device_complete;
  "lib/http_cli/device_poll": typeof lib_http_cli_device_poll;
  "lib/http_cli/device_start": typeof lib_http_cli_device_start;
  "lib/http_cli/logout": typeof lib_http_cli_logout;
  "lib/http_cli/session": typeof lib_http_cli_session;
  "lib/http_cli/shared": typeof lib_http_cli_shared;
  "lib/http_cli/token_refresh": typeof lib_http_cli_token_refresh;
  "lib/http_env": typeof lib_http_env;
  "lib/http_env/errors": typeof lib_http_env_errors;
  "lib/http_env/parsing": typeof lib_http_env_parsing;
  "lib/http_env/types": typeof lib_http_env_types;
  "lib/http_env/values": typeof lib_http_env_values;
  "lib/http_env_routes": typeof lib_http_env_routes;
  "lib/http_env_routes/definitions": typeof lib_http_env_routes_definitions;
  "lib/http_env_routes/evaluate_batch": typeof lib_http_env_routes_evaluate_batch;
  "lib/http_env_routes/evaluate_one": typeof lib_http_env_routes_evaluate_one;
  "lib/http_env_routes/list": typeof lib_http_env_routes_list;
  "lib/http_env_routes/public_definitions": typeof lib_http_env_routes_public_definitions;
  "lib/http_env_routes/pull": typeof lib_http_env_routes_pull;
  "lib/http_env_routes/shared": typeof lib_http_env_routes_shared;
  "lib/http_env_routes/write": typeof lib_http_env_routes_write;
  "lib/http_misc": typeof lib_http_misc;
  "lib/http_responses": typeof lib_http_responses;
  "lib/payments_catalog": typeof lib_payments_catalog;
  "lib/payments_management": typeof lib_payments_management;
  "lib/payments_management/billing_portal": typeof lib_payments_management_billing_portal;
  "lib/payments_management/change_plan": typeof lib_payments_management_change_plan;
  "lib/payments_management/free_credit": typeof lib_payments_management_free_credit;
  "lib/payments_state": typeof lib_payments_state;
  "lib/payments_variants": typeof lib_payments_variants;
  "lib/project_scope": typeof lib_project_scope;
  "lib/project_scope/errors": typeof lib_project_scope_errors;
  "lib/project_scope/programs": typeof lib_project_scope_programs;
  "lib/project_scope/readers": typeof lib_project_scope_readers;
  "lib/project_variable_schedules": typeof lib_project_variable_schedules;
  "lib/project_variables_shared": typeof lib_project_variables_shared;
  "lib/rollout": typeof lib_rollout;
  "lib/runtime_config": typeof lib_runtime_config;
  "lib/runtime_config_loader": typeof lib_runtime_config_loader;
  "lib/timezone": typeof lib_timezone;
  "lib/visibility": typeof lib_visibility;
  orgs: typeof orgs;
  payments: typeof payments;
  "payments/billing_state": typeof payments_billing_state;
  "payments/catalog": typeof payments_catalog;
  "payments/credit_grants": typeof payments_credit_grants;
  "payments/credit_queries": typeof payments_credit_queries;
  "payments/credit_revocations": typeof payments_credit_revocations;
  "payments/helpers": typeof payments_helpers;
  "payments/management_actions": typeof payments_management_actions;
  "payments/metered_usage": typeof payments_metered_usage;
  "payments/request_log": typeof payments_request_log;
  "payments/storage": typeof payments_storage;
  "payments/types": typeof payments_types;
  "payments/workspace_plan": typeof payments_workspace_plan;
  project_stages: typeof project_stages;
  "project_stages/access": typeof project_stages_access;
  "project_stages/create": typeof project_stages_create;
  "project_stages/defaults": typeof project_stages_defaults;
  "project_stages/delete": typeof project_stages_delete;
  "project_stages/queries": typeof project_stages_queries;
  "project_stages/rename": typeof project_stages_rename;
  "project_stages/slug": typeof project_stages_slug;
  "project_stages/types": typeof project_stages_types;
  project_variable_schedules: typeof project_variable_schedules;
  "project_variable_schedules/access": typeof project_variable_schedules_access;
  "project_variable_schedules/cancel": typeof project_variable_schedules_cancel;
  "project_variable_schedules/create": typeof project_variable_schedules_create;
  "project_variable_schedules/decrypt": typeof project_variable_schedules_decrypt;
  "project_variable_schedules/execution": typeof project_variable_schedules_execution;
  "project_variable_schedules/list": typeof project_variable_schedules_list;
  "project_variable_schedules/snapshot": typeof project_variable_schedules_snapshot;
  "project_variable_schedules/types": typeof project_variable_schedules_types;
  "project_variable_schedules/update": typeof project_variable_schedules_update;
  "project_variable_schedules/validators": typeof project_variable_schedules_validators;
  project_variables: typeof project_variables;
  "project_variables/access": typeof project_variables_access;
  "project_variables/apply_prepared_variable_writes": typeof project_variables_apply_prepared_variable_writes;
  "project_variables/decrypt": typeof project_variables_decrypt;
  "project_variables/draft_actions": typeof project_variables_draft_actions;
  "project_variables/draft_mutations": typeof project_variables_draft_mutations;
  "project_variables/prepare_variable_writes": typeof project_variables_prepare_variable_writes;
  "project_variables/prepared_write_actions": typeof project_variables_prepared_write_actions;
  "project_variables/prepared_write_mutations": typeof project_variables_prepared_write_mutations;
  "project_variables/prepared_write_summary": typeof project_variables_prepared_write_summary;
  "project_variables/queries": typeof project_variables_queries;
  "project_variables/types": typeof project_variables_types;
  projects: typeof projects;
  "projects/create": typeof projects_create;
  "projects/delete": typeof projects_delete;
  "projects/queries": typeof projects_queries;
  "projects/slug": typeof projects_slug;
  "projects/types": typeof projects_types;
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
