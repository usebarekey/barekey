import { makeFunctions } from "@rjdellecese/confect/server";

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
import { confectSchema } from "./lib/confect_schema";
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
} from "./lib/confect_services";
import {
  type LegacyActionDefinition,
  type LegacyMutationDefinition,
  type LegacyQueryDefinition,
  liftLegacyActionHandler,
  liftLegacyMutationHandler,
  liftLegacyQueryHandler,
  runLegacyHttpHandler,
} from "./lib/confect_boundary";
import {
  argsObjectToSchema,
  returnsValidatorToSchema,
} from "./lib/confect_validator_schemas";

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
} from "./lib/confect_schema";
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
} from "./lib/confect_services";
export type { ConvexValidatorLike } from "./lib/confect_validator_schemas";
