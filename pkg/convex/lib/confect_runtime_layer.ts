import { Layer } from "effect";

import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "./encryption";
import {
  AuditService,
  AuthService,
  BillingService,
  ClockService,
  DbService,
  EncryptionService,
  FunctionRunnerService,
  ProjectScopeService,
  RandomService,
  RuntimeConfigService,
} from "./confect_services";
import { runtimeConfig } from "./runtime_config";

export type BarekeyRuntimeCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Generates cryptographically secure random bytes for Effect services that need
 * nonce, key, or token material.
 *
 * @param length The number of random bytes to generate.
 * @returns A new `Uint8Array` filled with secure random bytes.
 * @remarks This reads from `crypto.getRandomValues` and does not mutate any Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Builds the shared runtime layer that legacy Convex handlers receive while we
 * migrate domain logic into Effect services.
 *
 * @param ctx The active Convex function context for the current query, mutation, or action.
 * @returns A layer that provides config, clock, randomness, function runners, auth, DB access, and encryption services.
 * @remarks This is the single place where raw Convex context is translated into Effect dependencies.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function makeRuntimeLayer(ctx: BarekeyRuntimeCtx): Layer.Layer<never> {
  return Layer.mergeAll(
    Layer.succeed(RuntimeConfigService, { config: runtimeConfig }),
    Layer.succeed(ClockService, { nowMs: () => Date.now() }),
    Layer.succeed(RandomService, { randomBytes }),
    Layer.succeed(FunctionRunnerService, {
      runAction:
        "runAction" in ctx
          ? (...args) =>
              (ctx.runAction as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
      runMutation:
        "runMutation" in ctx
          ? (...args) =>
              (ctx.runMutation as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
      runQuery:
        "runQuery" in ctx
          ? (...args) =>
              (ctx.runQuery as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
    }),
    Layer.succeed(AuthService, {
      getUserIdentity: () => ctx.auth.getUserIdentity(),
    }),
    Layer.succeed(DbService, {
      db: "db" in ctx ? ctx.db : null,
    }),
    Layer.succeed(AuditService, {
      append: async () => {},
    }),
    Layer.succeed(BillingService, {
      reserve: async () => null,
      compensate: async () => {},
    }),
    Layer.succeed(ProjectScopeService, {
      resolve: async () => null,
    }),
    Layer.succeed(EncryptionService, {
      decryptUtf8WithKey,
      encryptUtf8WithKey,
      unwrapDekWithMasterKey,
      wrapDekWithMasterKey,
    }),
  );
}
