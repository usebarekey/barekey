/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as autumn from "../autumn.js";
import type * as clerk from "../clerk.js";
import type * as cli_auth from "../cli_auth.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_declared_types from "../lib/declared_types.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as orgs from "../orgs.js";
import type * as payments from "../payments.js";
import type * as project_stages from "../project_stages.js";
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
  autumn: typeof autumn;
  clerk: typeof clerk;
  cli_auth: typeof cli_auth;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/declared_types": typeof lib_declared_types;
  "lib/encryption": typeof lib_encryption;
  orgs: typeof orgs;
  payments: typeof payments;
  project_stages: typeof project_stages;
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
