import { makeFunctions } from "@rjdellecese/confect/server";

import {
  action as generatedAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
} from "./_generated/server";
import {
  type EffectDefinition,
  normalizeEffectHandler,
} from "./lib/confect/effect";
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
} from "./lib/confect/boundary";
import {
  argsObjectToSchema,
  returnsValidatorToSchema,
  type ConvexValidatorLike,
} from "./lib/confect/validators";

const confectFunctions = makeFunctions(confectSchema);

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

export {
  BarekeyConfectActionCtx,
  BarekeyConfectMutationCtx,
  BarekeyConfectQueryCtx,
} from "./lib/confect/schema";
export { httpAction } from "./lib/confect/http";
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
export type { ConvexValidatorLike } from "./lib/confect/validators";
