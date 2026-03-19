import { makeFunctions } from "@rjdellecese/confect/server";
import type { DefaultFunctionArgs } from "convex/server";

import { confectSchema } from "../lib/confect/schema";
import {
  argsObjectToSchema,
  returnsValidatorToSchema,
  type ConvexValidatorLike,
} from "../lib/confect/validators";

export const confectFunctions = makeFunctions(confectSchema);

/**
 * Converts one legacy validator args object into the Confect schema form used
 * by runtime registration helpers.
 *
 * @param args The validator-based argument definition.
 * @returns The equivalent Confect argument schema.
 * @remarks This keeps registration modules focused on boundary wiring instead of validator translation.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toConfectArgsSchema<ConvexArgs extends DefaultFunctionArgs, ConfectArgs>(
  args: Record<string, ConvexValidatorLike>,
) {
  return argsObjectToSchema(args) as never as import("effect").Schema.Schema<
    ConfectArgs,
    ConvexArgs
  >;
}

/**
 * Converts one legacy validator return contract into the Confect schema form
 * used by runtime registration helpers.
 *
 * @param returnsValidator The validator-based return definition.
 * @returns The equivalent Confect return schema.
 * @remarks Boundary registration stays small by centralizing validator conversion here.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toConfectReturnsSchema<ConvexReturns, ConfectReturns>(
  returnsValidator: ConvexValidatorLike,
) {
  return returnsValidatorToSchema(returnsValidator) as import("effect").Schema.Schema<
    ConfectReturns,
    ConvexReturns
  >;
}
