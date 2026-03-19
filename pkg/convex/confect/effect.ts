import type {
  DefaultFunctionArgs,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "convex/server";

import {
  type EffectDefinition,
  type SchemaEffectDefinition,
  normalizeEffectHandler,
} from "../lib/confect/effect";
import { confectFunctions, toConfectArgsSchema, toConfectReturnsSchema } from "./shared";

/**
 * Registers a public Convex query backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native query definition.
 * @returns A generated Convex public query registration.
 * @remarks This is the preferred path for new query implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectQuery<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredQuery<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.query({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredQuery<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex query backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal query definition.
 * @returns A generated Convex internal query registration.
 * @remarks This is the preferred path for new internal query implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectInternalQuery<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredQuery<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalQuery({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredQuery<"internal", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers a public Convex mutation backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native mutation definition.
 * @returns A generated Convex public mutation registration.
 * @remarks This is the preferred path for new mutation implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectMutation<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredMutation<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.mutation({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredMutation<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex mutation backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal mutation definition.
 * @returns A generated Convex internal mutation registration.
 * @remarks This is the preferred path for new internal mutation implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectInternalMutation<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredMutation<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalMutation({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredMutation<"internal", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers a public Convex action backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native action definition.
 * @returns A generated Convex public action registration.
 * @remarks This is the preferred path for new action implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectAction<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredAction<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.action({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredAction<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex action backed by an Effect-native handler while
 * keeping the current validator-based argument definition style.
 *
 * @param definition The Effect-native internal action definition.
 * @returns A generated Convex internal action registration.
 * @remarks This is the preferred path for new internal action implementations during the rewrite.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function effectInternalAction<
  ConvexArgs extends DefaultFunctionArgs,
  ConvexReturns,
  Requirements = never,
>(
  definition: EffectDefinition<ConvexArgs, ConvexReturns, Requirements>,
): RegisteredAction<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalAction({
    args: toConfectArgsSchema<ConvexArgs, ConvexArgs>(definition.args) as any,
    returns: toConfectReturnsSchema<ConvexReturns, ConvexReturns>(definition.returns) as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredAction<"internal", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers a public Convex query from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native query definition.
 * @returns A generated Convex public query registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectQuery<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredQuery<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.query({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredQuery<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex query from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native internal query definition.
 * @returns A generated Convex internal query registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectInternalQuery<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredQuery<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalQuery({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredQuery<"internal", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers a public Convex mutation from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native mutation definition.
 * @returns A generated Convex public mutation registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectMutation<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredMutation<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.mutation({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredMutation<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex mutation from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native internal mutation definition.
 * @returns A generated Convex internal mutation registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectInternalMutation<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredMutation<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalMutation({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredMutation<"internal", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers a public Convex action from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native action definition.
 * @returns A generated Convex public action registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectAction<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredAction<"public", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.action({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredAction<"public", ConvexArgs, Promise<ConvexReturns>>;
}

/**
 * Registers an internal Convex action from Effect `Schema` contracts directly.
 *
 * @param definition The schema-first Effect-native internal action definition.
 * @returns A generated Convex internal action registration.
 * @remarks New code should prefer this over validator conversion helpers.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function schemaEffectInternalAction<
  ConvexArgs extends DefaultFunctionArgs,
  ConfectArgs,
  ConvexReturns,
  ConfectReturns,
  Requirements = never,
>(
  definition: SchemaEffectDefinition<
    ConvexArgs,
    ConfectArgs,
    ConvexReturns,
    ConfectReturns,
    Requirements
  >,
): RegisteredAction<"internal", ConvexArgs, Promise<ConvexReturns>> {
  return confectFunctions.internalAction({
    args: definition.args as any,
    returns: definition.returns as any,
    handler: normalizeEffectHandler(definition.handler) as any,
  }) as RegisteredAction<"internal", ConvexArgs, Promise<ConvexReturns>>;
}
