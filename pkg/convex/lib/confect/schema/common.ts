import { Id } from "@rjdellecese/confect/server";
import { Schema } from "effect";

export const variableVisibilitySchema = Schema.Union(
  Schema.Literal("private"),
  Schema.Literal("public"),
);

export const declaredTypeSchema = Schema.Union(
  Schema.Literal("string"),
  Schema.Literal("boolean"),
  Schema.Literal("int64"),
  Schema.Literal("float"),
  Schema.Literal("date"),
  Schema.Literal("json"),
);

export const rolloutFunctionSchema = Schema.Union(
  Schema.Literal("linear"),
  Schema.Literal("step"),
  Schema.Literal("ease_in_out"),
);

export const rolloutMilestoneSchema = Schema.Struct({
  at: Schema.String,
  percentage: Schema.Number,
});

export const preparedCreateSchema = Schema.Struct({
  name: Schema.String,
  visibility: variableVisibilitySchema,
  kind: Schema.Union(
    Schema.Literal("secret"),
    Schema.Literal("ab_roll"),
    Schema.Literal("rollout"),
  ),
  declaredType: declaredTypeSchema,
  encryptedValue: Schema.NullOr(Schema.String),
  encryptedValueA: Schema.NullOr(Schema.String),
  encryptedValueB: Schema.NullOr(Schema.String),
  chance: Schema.NullOr(Schema.Number),
  rolloutFunction: Schema.NullOr(rolloutFunctionSchema),
  rolloutMilestones: Schema.NullOr(Schema.Array(rolloutMilestoneSchema)),
});

export const preparedUpdateSchema = Schema.Struct({
  id: Id.Id("projectVariables"),
  visibility: variableVisibilitySchema,
  kind: Schema.Union(
    Schema.Literal("secret"),
    Schema.Literal("ab_roll"),
    Schema.Literal("rollout"),
  ),
  declaredType: declaredTypeSchema,
  encryptedValue: Schema.NullOr(Schema.String),
  encryptedValueA: Schema.NullOr(Schema.String),
  encryptedValueB: Schema.NullOr(Schema.String),
  chance: Schema.NullOr(Schema.Number),
  rolloutFunction: Schema.NullOr(rolloutFunctionSchema),
  rolloutMilestones: Schema.NullOr(Schema.Array(rolloutMilestoneSchema)),
});
