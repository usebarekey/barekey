import { Id } from "@rjdellecese/confect/server";
import type { Validator } from "convex/values";
import { Schema } from "effect";

export type ConvexValidatorLike = Validator<any, any, any> & {
  readonly kind:
    | "any"
    | "array"
    | "boolean"
    | "bytes"
    | "float64"
    | "id"
    | "int64"
    | "literal"
    | "null"
    | "object"
    | "record"
    | "string"
    | "union";
  readonly isOptional: "optional" | "required";
  readonly element?: ConvexValidatorLike;
  readonly fields?: Record<string, ConvexValidatorLike>;
  readonly key?: ConvexValidatorLike;
  readonly members?: ReadonlyArray<ConvexValidatorLike>;
  readonly tableName?: string;
  readonly value?: ConvexValidatorLike;
};

/**
 * Converts a Convex validator into its closest Effect schema equivalent.
 *
 * @param validator The Convex validator metadata to translate.
 * @returns An Effect schema that preserves the validator shape as closely as possible.
 * @remarks This is used as migration glue while legacy Convex validator definitions still exist in domain files.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function baseValidatorToSchema(validator: ConvexValidatorLike): Schema.Schema.Any {
  if (!validator) {
    return Schema.Any;
  }

  switch (validator.kind) {
    case "any":
      return Schema.Any;
    case "array":
      return Schema.Array(
        baseValidatorToSchema(
          validator.element ??
            ({
              kind: "any",
              isOptional: "required",
            } as ConvexValidatorLike),
        ),
      );
    case "boolean":
      return Schema.Boolean;
    case "bytes":
      return Schema.Uint8Array;
    case "float64":
      return Schema.Number;
    case "id":
      return Id.Id(validator.tableName ?? "unknown") as Schema.Schema.Any;
    case "int64":
      return Schema.BigIntFromSelf;
    case "literal":
      return Schema.Literal((validator as { readonly value: string | number | boolean | bigint }).value);
    case "null":
      return Schema.Null;
    case "object": {
      const fields = Object.fromEntries(
        Object.entries(validator.fields ?? {}).map(([key, fieldValidator]) => [
          key,
          validatorToFieldSchema(fieldValidator),
        ]),
      );
      return Schema.Struct(fields as Record<string, any>);
    }
    case "record":
      return Schema.Record({
        key: baseValidatorToSchema(
          validator.key ??
            ({
              kind: "string",
              isOptional: "required",
            } as ConvexValidatorLike),
        ),
        value: validatorToSchema(
          validator.value ??
            ({
              kind: "any",
              isOptional: "required",
            } as ConvexValidatorLike),
        ),
      });
    case "string":
      return Schema.String;
    case "union": {
      const members = (validator.members ?? []).map((member) => baseValidatorToSchema(member));
      const [firstMember, ...restMembers] = members;
      return firstMember ? Schema.Union(firstMember, ...restMembers) : Schema.Any;
    }
  }
}

/**
 * Converts a Convex validator into a standard Effect schema.
 *
 * @param validator The validator to translate.
 * @returns An Effect schema for the same value space.
 * @remarks This is a named wrapper around `baseValidatorToSchema` so callers can depend on a stable conversion entrypoint.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validatorToSchema(validator: ConvexValidatorLike): Schema.Schema.Any {
  return baseValidatorToSchema(validator);
}

/**
 * Converts a Convex validator into a struct field schema, preserving optionality.
 *
 * @param validator The field validator to translate.
 * @returns A schema or optional schema suitable for `Schema.Struct`.
 * @remarks This only models field-level optionality and does not write any data.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validatorToFieldSchema(validator: ConvexValidatorLike): unknown {
  const schema = baseValidatorToSchema(validator);
  return validator?.isOptional === "optional" ? Schema.optional(schema) : schema;
}

/**
 * Converts legacy Convex argument validators into a Confect-compatible Effect schema.
 *
 * @param args Either a record of argument validators or a single root validator.
 * @returns An Effect schema that can decode legacy Convex args at the Confect boundary.
 * @remarks This exists so we can migrate domain modules incrementally without changing every function signature first.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function argsObjectToSchema<T>(
  args: Record<string, ConvexValidatorLike> | ConvexValidatorLike,
): Schema.Schema<T, T> {
  if ((args as ConvexValidatorLike).isConvexValidator) {
    return validatorToSchema(args as ConvexValidatorLike) as unknown as Schema.Schema<T, T>;
  }

  const fields = Object.fromEntries(
    Object.entries(args).map(([key, validator]) => [key, validatorToFieldSchema(validator)]),
  );
  return Schema.Struct(fields as Record<string, any>) as unknown as Schema.Schema<T, T>;
}

/**
 * Converts a legacy Convex return validator into a Confect-compatible Effect schema.
 *
 * @param validator The Convex validator describing the function return shape.
 * @returns An Effect schema for encoding handler results at the boundary.
 * @remarks This does not transform values eagerly; it only builds the schema used by Confect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function returnsValidatorToSchema<T>(validator: ConvexValidatorLike): Schema.Schema<T, T> {
  return validatorToSchema(validator) as Schema.Schema<T, T>;
}
