import { Effect, Layer } from "effect";

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
} from "../services";
import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "../../encryption";
import { runtimeConfig } from "../../runtime/config";
import {
  appendAuditEventWithRuntimeCtx,
} from "./audit";
import {
  compensateBillingUnitsWithRuntimeCtx,
  reserveBillingUnitsWithRuntimeCtx,
} from "./billing";
import { randomBytes } from "./context";
import type { BarekeyRuntimeCtx } from "./context";
import {
  findProjectStageWithRuntimeCtx,
  requireProjectStageWithRuntimeCtx,
} from "./project_scope";

export type { BarekeyRuntimeCtx } from "./context";

/**
 * Builds the shared runtime layer that legacy Convex handlers receive while we
 * migrate domain logic into Effect services.
 *
 * @param convexCtx The active Convex function context for the current query, mutation, or action.
 * @returns A layer that provides config, clock, randomness, function runners, auth, DB access, and encryption services.
 * @remarks This is the single place where raw Convex context is translated into Effect dependencies.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function makeRuntimeLayer(convexCtx: BarekeyRuntimeCtx): Layer.Layer<never> {
  return Layer.mergeAll(
    Layer.succeed(RuntimeConfigService, { config: runtimeConfig }),
    Layer.succeed(ClockService, { nowMs: () => Date.now() }),
    Layer.succeed(RandomService, { randomBytes }),
    Layer.succeed(FunctionRunnerService, {
      runAction:
        "runAction" in convexCtx
          ? (...args) =>
              (convexCtx.runAction as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
      runMutation:
        "runMutation" in convexCtx
          ? (...args) =>
              (convexCtx.runMutation as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
      runQuery:
        "runQuery" in convexCtx
          ? (...args) =>
              (convexCtx.runQuery as (...callArgs: Array<unknown>) => Promise<unknown>)(...args)
          : null,
    }),
    Layer.succeed(AuthService, {
      getUserIdentity: () => convexCtx.auth.getUserIdentity(),
    }),
    Layer.succeed(DbService, {
      db: "db" in convexCtx ? convexCtx.db : null,
    }),
    Layer.succeed(AuditService, {
      append: (payload) => appendAuditEventWithRuntimeCtx(convexCtx, payload),
    }),
    Layer.succeed(BillingService, {
      reserve: (payload) => reserveBillingUnitsWithRuntimeCtx(convexCtx, payload),
      compensate: (payload) => compensateBillingUnitsWithRuntimeCtx(convexCtx, payload),
    }),
    Layer.succeed(ProjectScopeService, {
      find: (payload) => findProjectStageWithRuntimeCtx(convexCtx, payload),
      require: (payload) => requireProjectStageWithRuntimeCtx(convexCtx, payload),
    }),
    Layer.succeed(EncryptionService, {
      decryptUtf8WithKey,
      encryptUtf8WithKey,
      unwrapDekWithMasterKey,
      wrapDekWithMasterKey,
    }),
  );
}
