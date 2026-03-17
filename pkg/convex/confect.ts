import { makeFunctions } from "@rjdellecese/confect/server";
import { Effect } from "effect";

import {
  action as generatedAction,
  httpAction as generatedHttpAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { confectSchema } from "./lib/confect/schema";
import {
  AuthService,
  AuditService,
  BillingService,
  ClockService,
  DbService,
  EncryptionService,
  FunctionRunnerService,
  ProjectScopeService,
  RandomService,
  RuntimeConfigService,
} from "./lib/confect/services";
import {
  type LegacyActionDefinition,
  type LegacyMutationDefinition,
  type LegacyQueryDefinition,
  liftLegacyActionHandler,
  liftLegacyMutationHandler,
  liftLegacyQueryHandler,
  runLegacyHttpHandler,
} from "./lib/confect/boundary";
import {
  argsObjectToSchema,
  returnsValidatorToSchema,
  type ConvexValidatorLike,
} from "./lib/confect/validator_schemas";
import { toLegacyHandlerError } from "./lib/effect_errors";

const confectFunctions = makeFunctions(confectSchema);

type EffectDefinition<Args, Returns, Requirements> = {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (args: Args) => Effect.Effect<Returns, unknown, Requirements>;
};

/**
 * Normalizes Effect-native handler failures so they surface through the same
 * compatibility error boundary as legacy handlers.
 *
 * @param handler The Effect-native handler to normalize.
 * @returns A Confect-compatible handler with shared error normalization.
 * @remarks This keeps new Effect programs and legacy handlers consistent at the Convex boundary.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function normalizeEffectHandler<Args, Returns, Requirements>(
  handler: (args: Args) => Effect.Effect<Returns, unknown, Requirements>,
) {
  const normalizedHandler = handler as unknown as (
    args: unknown,
  ) => Effect.Effect<unknown, unknown, never>;

  return ((args: unknown) =>
    normalizedHandler(args).pipe(
      Effect.catchAll((error) => Effect.fail(toLegacyHandlerError(error))),
    )) as (args: unknown) => Effect.Effect<unknown, unknown, never>;
}

/**
 * Registers a public Convex query using the Confect boundary while keeping the
 * existing legacy query definition shape.
 *
 * @param definition The legacy query definition.
 * @returns A generated Convex public query registration.
 * @remarks This is compatibility glue and delegates real execution to `liftLegacyQueryHandler`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const query: typeof generatedQuery = ((definition: LegacyQueryDefinition) =>
  confectFunctions.query({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyQueryHandler(definition.handler),
  })) as typeof generatedQuery;

/**
 * Registers a public Convex query backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native query definition.
 * @returns A generated Convex public query registration.
 * @remarks This is the preferred path for new query implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectQuery<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.query({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers an internal Convex query using the Confect boundary while keeping
 * the existing legacy query definition shape.
 *
 * @param definition The legacy internal query definition.
 * @returns A generated Convex internal query registration.
 * @remarks This remains a compatibility wrapper until domain modules are authored directly in Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const internalQuery: typeof generatedInternalQuery = ((definition: LegacyQueryDefinition) =>
  confectFunctions.internalQuery({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyQueryHandler(definition.handler),
  })) as typeof generatedInternalQuery;

/**
 * Registers an internal Convex query backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal query definition.
 * @returns A generated Convex internal query registration.
 * @remarks This is the preferred path for new internal query implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectInternalQuery<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.internalQuery({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers a public Convex mutation using the Confect boundary while keeping
 * the existing legacy mutation definition shape.
 *
 * @param definition The legacy mutation definition.
 * @returns A generated Convex public mutation registration.
 * @remarks This preserves current call sites while centralizing runtime provisioning in one place.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const mutation: typeof generatedMutation = ((definition: LegacyMutationDefinition) =>
  confectFunctions.mutation({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyMutationHandler(definition.handler),
  })) as typeof generatedMutation;

/**
 * Registers a public Convex mutation backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native mutation definition.
 * @returns A generated Convex public mutation registration.
 * @remarks This is the preferred path for new mutation implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectMutation<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.mutation({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers an internal Convex mutation using the Confect boundary while
 * keeping the existing legacy mutation definition shape.
 *
 * @param definition The legacy internal mutation definition.
 * @returns A generated Convex internal mutation registration.
 * @remarks This is boundary-only code and should stay free of domain logic.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const internalMutation: typeof generatedInternalMutation = ((definition: LegacyMutationDefinition) =>
  confectFunctions.internalMutation({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyMutationHandler(definition.handler),
  })) as typeof generatedInternalMutation;

/**
 * Registers an internal Convex mutation backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal mutation definition.
 * @returns A generated Convex internal mutation registration.
 * @remarks This is the preferred path for new internal mutation implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectInternalMutation<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.internalMutation({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers a public Convex action using the Confect boundary while keeping the
 * existing legacy action definition shape.
 *
 * @param definition The legacy action definition.
 * @returns A generated Convex public action registration.
 * @remarks This remains temporary adapter code until actions are rewritten as first-class Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const action: typeof generatedAction = ((definition: LegacyActionDefinition) =>
  confectFunctions.action({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyActionHandler(definition.handler),
  })) as typeof generatedAction;

/**
 * Registers a public Convex action backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native action definition.
 * @returns A generated Convex public action registration.
 * @remarks This is the preferred path for new action implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectAction<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.action({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers an internal Convex action using the Confect boundary while keeping
 * the existing legacy action definition shape.
 *
 * @param definition The legacy internal action definition.
 * @returns A generated Convex internal action registration.
 * @remarks The returned action still uses the existing file/module export names for compatibility.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const internalAction: typeof generatedInternalAction = ((definition: LegacyActionDefinition) =>
  confectFunctions.internalAction({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: liftLegacyActionHandler(definition.handler),
  })) as typeof generatedInternalAction;

/**
 * Registers an internal Convex action backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal action definition.
 * @returns A generated Convex internal action registration.
 * @remarks This is the preferred path for new internal action implementations during the rewrite.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function effectInternalAction<Args, Returns, Requirements = never>(
  definition: EffectDefinition<Args, Returns, Requirements>,
) {
  return confectFunctions.internalAction({
    args: argsObjectToSchema(definition.args) as never,
    returns: returnsValidatorToSchema(definition.returns) as never,
    handler: normalizeEffectHandler(definition.handler),
  });
}

/**
 * Registers an HTTP action while normalizing legacy handler failures through the
 * shared Effect runtime.
 *
 * @param handler The legacy HTTP handler.
 * @returns A generated Convex HTTP action.
 * @remarks This delegates runtime provisioning to `makeRuntimeLayer` but keeps the existing route registration surface unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const httpAction: typeof generatedHttpAction = ((handler: (
  ctx: ActionCtx,
  request: Request,
) => Promise<Response>) =>
  generatedHttpAction(async (ctx, request) => {
    return await runLegacyHttpHandler(handler, ctx as unknown as ActionCtx, request);
  })) as typeof generatedHttpAction;

export {
  BarekeyConfectActionCtx,
  BarekeyConfectMutationCtx,
  BarekeyConfectQueryCtx,
} from "./lib/confect/schema";
export {
  AuthService,
  AuditService,
  BillingService,
  ClockService,
  DbService,
  EncryptionService,
  FunctionRunnerService,
  ProjectScopeService,
  RandomService,
  RuntimeConfigService,
} from "./lib/confect/services";
export type { ConvexValidatorLike } from "./lib/confect/validator_schemas";
