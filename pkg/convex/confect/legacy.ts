import {
  action as generatedAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
} from "../_generated/server";
import {
  type LegacyActionDefinition,
  type LegacyMutationDefinition,
  type LegacyQueryDefinition,
  liftLegacyActionHandler,
  liftLegacyMutationHandler,
  liftLegacyQueryHandler,
} from "../lib/confect/boundary";
import { confectFunctions, toConfectArgsSchema, toConfectReturnsSchema } from "./shared";

/**
 * Registers a public Convex query using the Confect boundary while keeping the
 * existing legacy query definition shape.
 *
 * @param definition The legacy query definition.
 * @returns A generated Convex public query registration.
 * @remarks This is compatibility glue and delegates real execution to `liftLegacyQueryHandler`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const query: typeof generatedQuery = ((definition: LegacyQueryDefinition) =>
  confectFunctions.query({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyQueryHandler(definition.handler),
  })) as typeof generatedQuery;

/**
 * Registers an internal Convex query using the Confect boundary while keeping
 * the existing legacy query definition shape.
 *
 * @param definition The legacy internal query definition.
 * @returns A generated Convex internal query registration.
 * @remarks This remains a compatibility wrapper until domain modules are authored directly in Effect.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const internalQuery: typeof generatedInternalQuery = ((definition: LegacyQueryDefinition) =>
  confectFunctions.internalQuery({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyQueryHandler(definition.handler),
  })) as typeof generatedInternalQuery;

/**
 * Registers a public Convex mutation using the Confect boundary while keeping
 * the existing legacy mutation definition shape.
 *
 * @param definition The legacy mutation definition.
 * @returns A generated Convex public mutation registration.
 * @remarks This preserves current call sites while centralizing runtime provisioning in one place.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const mutation: typeof generatedMutation = ((definition: LegacyMutationDefinition) =>
  confectFunctions.mutation({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyMutationHandler(definition.handler),
  })) as typeof generatedMutation;

/**
 * Registers an internal Convex mutation using the Confect boundary while
 * keeping the existing legacy mutation definition shape.
 *
 * @param definition The legacy internal mutation definition.
 * @returns A generated Convex internal mutation registration.
 * @remarks This is boundary-only code and should stay free of domain logic.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const internalMutation: typeof generatedInternalMutation = ((definition: LegacyMutationDefinition) =>
  confectFunctions.internalMutation({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyMutationHandler(definition.handler),
  })) as typeof generatedInternalMutation;

/**
 * Registers a public Convex action using the Confect boundary while keeping the
 * existing legacy action definition shape.
 *
 * @param definition The legacy action definition.
 * @returns A generated Convex public action registration.
 * @remarks This remains temporary adapter code until actions are rewritten as first-class Effect programs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const action: typeof generatedAction = ((definition: LegacyActionDefinition) =>
  confectFunctions.action({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyActionHandler(definition.handler),
  })) as typeof generatedAction;

/**
 * Registers an internal Convex action using the Confect boundary while keeping
 * the existing legacy action definition shape.
 *
 * @param definition The legacy internal action definition.
 * @returns A generated Convex internal action registration.
 * @remarks The returned action still uses the existing file/module export names for compatibility.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const internalAction: typeof generatedInternalAction = ((definition: LegacyActionDefinition) =>
  confectFunctions.internalAction({
    args: toConfectArgsSchema(definition.args),
    returns: toConfectReturnsSchema(definition.returns),
    handler: liftLegacyActionHandler(definition.handler),
  })) as typeof generatedInternalAction;
