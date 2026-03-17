import { Effect, Layer } from "effect";

import { internal } from "../../_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import type { AuditEventInput } from "../../audit/types";
import { insertAuditEventWithMutationCtx } from "../../audit/record_insert";
import type { ReserveFeatureUnitsResult } from "../../payments/types";
import {
  AuditService,
  AuthService,
  type BillingCompensationResult,
  BillingService,
  type BillingUnitsInput,
  ClockService,
  DbService,
  EncryptionService,
  FunctionRunnerService,
  type ProjectScopeLookup,
  ProjectScopeService,
  type ProjectStageScope,
  RandomService,
  RuntimeConfigService,
} from "./services";
import { BillingError, ExternalServiceError, NotFoundError } from "../effect_errors";
import {
  findProjectByOrgSlugAndSlugEffect,
  findProjectStageByOrgIdAndSlugEffect,
  findProjectStageByOrgSlugAndSlugEffect,
  findStageByProjectIdAndSlugEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../project_scope";
import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "../encryption";
import { runtimeConfig } from "../runtime_config";

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
 * Detects whether the active runtime context can write directly through Convex DB mutations.
 *
 * @param ctx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex mutation context.
 * @remarks This enables mutation-only helpers without relying on fragile nominal typing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function isMutationRuntimeCtx(ctx: BarekeyRuntimeCtx): ctx is MutationCtx {
  return "db" in ctx && typeof (ctx.db as { insert?: unknown }).insert === "function";
}

/**
 * Detects whether the active runtime context exposes a readable Convex database handle.
 *
 * @param ctx The raw runtime context to inspect.
 * @returns `true` when the context can issue direct database reads.
 * @remarks Query and mutation contexts satisfy this check; action contexts do not.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function hasDatabaseReader(ctx: BarekeyRuntimeCtx): ctx is QueryCtx | MutationCtx {
  return "db" in ctx;
}

/**
 * Detects whether the active runtime context can invoke internal mutations.
 *
 * @param ctx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex action context with mutation runners.
 * @remarks This is used for action-side audit writes and other boundary adapters.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function hasMutationRunner(ctx: BarekeyRuntimeCtx): ctx is ActionCtx {
  return "runMutation" in ctx && typeof ctx.runMutation === "function";
}

/**
 * Detects whether the active runtime context can invoke internal actions.
 *
 * @param ctx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex action context with action runners.
 * @remarks Metered billing reservations and compensations require this capability.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function hasActionRunner(ctx: BarekeyRuntimeCtx): ctx is ActionCtx {
  return "runAction" in ctx && typeof ctx.runAction === "function";
}

/**
 * Normalizes unknown runtime-layer failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps runtime service adapters from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toExternalServiceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Normalizes unknown runtime-layer failures into the shared billing error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed billing error.
 * @remarks Billing adapters intentionally collapse provider/runner failures into the billing error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toBillingError(fallbackMessage: string, error: unknown): BillingError {
  return new BillingError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}

/**
 * Appends an audit event using the capabilities available on the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The audit event payload to insert.
 * @returns An Effect that succeeds with the inserted audit event id.
 * @remarks Mutations write directly through DB helpers; actions delegate to the internal audit mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function appendAuditEventWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: AuditEventInput,
) {
  if (isMutationRuntimeCtx(ctx)) {
    return Effect.tryPromise({
      try: () => insertAuditEventWithMutationCtx(ctx, payload),
      catch: (error) => toExternalServiceError("Failed to append audit event.", error),
    });
  }

  if (hasMutationRunner(ctx)) {
    return Effect.tryPromise({
      try: () =>
        ctx.runMutation(internal.audit.appendEventInternal, payload) as ReturnType<
          typeof insertAuditEventWithMutationCtx
        >,
      catch: (error) => toExternalServiceError("Failed to append audit event.", error),
    });
  }

  return Effect.fail(
    new ExternalServiceError({
      message: "Audit writes require a mutation or action context.",
    }),
  );
}

/**
 * Reserves metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing reservation request.
 * @returns An Effect that succeeds with the reservation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function reserveBillingUnitsWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: BillingUnitsInput,
) {
  if (!hasActionRunner(ctx)) {
    return Effect.fail(
      new BillingError({
        message: "Metered billing reservations require an action context.",
      }),
    );
  }

  return Effect.tryPromise({
    try: async () => {
      if (payload.scope === "currentOrg") {
        return (await ctx.runAction(internal.payments.reserveFeatureUnitsForCurrentOrgInternal, {
          expectedOrgSlug: payload.expectedOrgSlug,
          featureId: payload.featureId,
          units: payload.units,
          reason: payload.reason,
        })) as ReserveFeatureUnitsResult;
      }

      return (await ctx.runAction(internal.payments.reserveFeatureUnitsForOrgInternal, {
        orgId: payload.orgId,
        orgSlug: payload.orgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      })) as ReserveFeatureUnitsResult;
    },
    catch: (error) => toBillingError("Failed to reserve metered feature units.", error),
  });
}

/**
 * Compensates previously reserved metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing compensation request.
 * @returns An Effect that succeeds with the compensation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function compensateBillingUnitsWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: BillingUnitsInput,
) {
  if (!hasActionRunner(ctx)) {
    return Effect.fail(
      new BillingError({
        message: "Metered billing compensation requires an action context.",
      }),
    );
  }

  return Effect.tryPromise({
    try: async () => {
      if (payload.scope === "currentOrg") {
        return (await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, {
          expectedOrgSlug: payload.expectedOrgSlug,
          featureId: payload.featureId,
          units: payload.units,
          reason: payload.reason,
        })) as BillingCompensationResult;
      }

      return (await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
        orgId: payload.orgId,
        orgSlug: payload.orgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      })) as BillingCompensationResult;
    },
    catch: (error) => toBillingError("Failed to compensate metered feature units.", error),
  });
}

/**
 * Finds a project/stage pair using direct database access from the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The organization/project/stage lookup input.
 * @returns An Effect that succeeds with the project/stage pair or `null`.
 * @remarks This currently requires query or mutation DB access and fails for action-only contexts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function findProjectStageWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: ProjectScopeLookup,
) {
  if (!hasDatabaseReader(ctx)) {
    return Effect.fail(
      new ExternalServiceError({
        message: "Project scope resolution requires database access.",
      }),
    );
  }

  if (payload.scope === "orgId") {
    return findProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: payload.orgId,
      projectSlug: payload.projectSlug,
      stageSlug: payload.stageSlug,
    });
  }

  return findProjectStageByOrgSlugAndSlugEffect(ctx.db, {
    orgSlug: payload.orgSlug,
    projectSlug: payload.projectSlug,
    stageSlug: payload.stageSlug,
  });
}

/**
 * Requires a project/stage pair using direct database access from the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The organization/project/stage lookup input.
 * @returns An Effect that succeeds with the required project/stage pair.
 * @remarks This currently requires query or mutation DB access and fails for action-only contexts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function requireProjectStageWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: ProjectScopeLookup,
) {
  if (!hasDatabaseReader(ctx)) {
    return Effect.fail(
      new ExternalServiceError({
        message: "Project scope resolution requires database access.",
      }),
    );
  }

  if (payload.scope === "orgId") {
    return requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: payload.orgId,
      projectSlug: payload.projectSlug,
      stageSlug: payload.stageSlug,
    });
  }

  return Effect.gen(function* () {
    const project = yield* findProjectByOrgSlugAndSlugEffect(ctx.db, {
      orgSlug: payload.orgSlug,
      projectSlug: payload.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(ctx.db, {
      projectId: project._id,
      stageSlug: payload.stageSlug,
    });
    if (stage === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Stage not found." }));
    }

    return { project, stage } satisfies ProjectStageScope;
  });
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
      append: (payload) => appendAuditEventWithRuntimeCtx(ctx, payload),
    }),
    Layer.succeed(BillingService, {
      reserve: (payload) => reserveBillingUnitsWithRuntimeCtx(ctx, payload),
      compensate: (payload) => compensateBillingUnitsWithRuntimeCtx(ctx, payload),
    }),
    Layer.succeed(ProjectScopeService, {
      find: (payload) => findProjectStageWithRuntimeCtx(ctx, payload),
      require: (payload) => requireProjectStageWithRuntimeCtx(ctx, payload),
    }),
    Layer.succeed(EncryptionService, {
      decryptUtf8WithKey,
      encryptUtf8WithKey,
      unwrapDekWithMasterKey,
      wrapDekWithMasterKey,
    }),
  );
}
