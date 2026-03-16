import {
  ConfectActionCtx,
  ConfectMutationCtx,
  ConfectQueryCtx,
  Id,
  defineSchema,
  defineTable,
  makeFunctions,
} from "@rjdellecese/confect/server";
import type { Validator } from "convex/values";
import { Context, Effect, Layer, Schema } from "effect";

import {
  action as generatedAction,
  httpAction as generatedHttpAction,
  internalAction as generatedInternalAction,
  internalMutation as generatedInternalMutation,
  internalQuery as generatedInternalQuery,
  mutation as generatedMutation,
  query as generatedQuery,
} from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "./lib/encryption";
import { runtimeConfig } from "./lib/runtime_config";
import { toLegacyHandlerError } from "./lib/effect_errors";

const variableVisibilitySchema = Schema.Union(Schema.Literal("private"), Schema.Literal("public"));

const declaredTypeSchema = Schema.Union(
  Schema.Literal("string"),
  Schema.Literal("boolean"),
  Schema.Literal("int64"),
  Schema.Literal("float"),
  Schema.Literal("date"),
  Schema.Literal("json"),
);

const rolloutFunctionSchema = Schema.Union(
  Schema.Literal("linear"),
  Schema.Literal("step"),
  Schema.Literal("ease_in_out"),
);

const rolloutMilestoneSchema = Schema.Struct({
  at: Schema.String,
  percentage: Schema.Number,
});

const preparedCreateSchema = Schema.Struct({
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

const preparedUpdateSchema = Schema.Struct({
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

const confectSchema = defineSchema({
  users: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      slug: Schema.String,
      slugBase: Schema.String,
      email: Schema.NullOr(Schema.String),
      displayName: Schema.NullOr(Schema.String),
      imageUrl: Schema.NullOr(Schema.String),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      lastSeenAtMs: Schema.Number,
    }),
  )
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_slug", ["slug"]),
  userFreePlanCredits: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      totalCredits: Schema.Number,
      remainingCredits: Schema.Number,
      assignedOrgId: Schema.NullOr(Schema.String),
      assignedOrgSlug: Schema.NullOr(Schema.String),
      consumedAtMs: Schema.NullOr(Schema.Number),
      revokedAtMs: Schema.NullOr(Schema.Number),
      revokedReason: Schema.NullOr(Schema.String),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_assigned_org_id", ["assignedOrgId"]),
  userPreferences: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      preferredTheme: Schema.Union(
        Schema.Literal("system"),
        Schema.Literal("light"),
        Schema.Literal("dark"),
      ),
      defaultOrgSlug: Schema.NullOr(Schema.String),
      landingPreference: Schema.Union(
        Schema.Literal("account_overview"),
        Schema.Literal("default_workspace"),
      ),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  ).index("by_clerk_user_id", ["clerkUserId"]),
  projects: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      orgSlug: Schema.String,
      name: Schema.String,
      slug: Schema.String,
      slugBase: Schema.String,
      createdByClerkUserId: Schema.String,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_org_id", ["orgId"])
    .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"])
    .index("by_org_id_and_slug", ["orgId", "slug"])
    .index("by_org_slug_and_slug", ["orgSlug", "slug"]),
  projectStages: defineTable(
    Schema.Struct({
      projectId: Id.Id("projects"),
      orgId: Schema.String,
      slug: Schema.String,
      name: Schema.String,
      isDefault: Schema.Boolean,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_project_id", ["projectId"])
    .index("by_project_id_and_slug", ["projectId", "slug"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectKeys: defineTable(
    Schema.Struct({
      projectId: Id.Id("projects"),
      orgId: Schema.String,
      encryptedDek: Schema.String,
      dekVersion: Schema.Number,
      rotatedAtMs: Schema.Number,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_project_id", ["projectId"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectVariables: defineTable(
    Schema.Struct({
      projectId: Id.Id("projects"),
      orgId: Schema.String,
      stageSlug: Schema.String,
      name: Schema.String,
      visibility: Schema.optional(variableVisibilitySchema),
      kind: Schema.Union(
        Schema.Literal("secret"),
        Schema.Literal("ab_roll"),
        Schema.Literal("rollout"),
      ),
      declaredType: Schema.optional(declaredTypeSchema),
      encryptedValue: Schema.NullOr(Schema.String),
      encryptedValueA: Schema.NullOr(Schema.String),
      encryptedValueB: Schema.NullOr(Schema.String),
      chance: Schema.NullOr(Schema.Number),
      rolloutFunction: Schema.optional(Schema.NullOr(rolloutFunctionSchema)),
      rolloutMilestones: Schema.optional(Schema.NullOr(Schema.Array(rolloutMilestoneSchema))),
      createdByClerkUserId: Schema.String,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
    .index("by_project_id_and_stage_slug_and_name", ["projectId", "stageSlug", "name"])
    .index("by_project_id_and_stage_slug_and_visibility", ["projectId", "stageSlug", "visibility"])
    .index("by_project_id_and_stage_slug_and_visibility_and_name", [
      "projectId",
      "stageSlug",
      "visibility",
      "name",
    ])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectVariableSchedules: defineTable(
    Schema.Struct({
      projectId: Id.Id("projects"),
      orgId: Schema.String,
      stageSlug: Schema.String,
      timezone: Schema.String,
      runAtMs: Schema.Number,
      status: Schema.Union(
        Schema.Literal("scheduled"),
        Schema.Literal("applied"),
        Schema.Literal("canceled"),
        Schema.Literal("failed"),
      ),
      scheduledFunctionId: Schema.NullOr(Id.Id("_scheduled_functions")),
      preparedCreates: Schema.Array(preparedCreateSchema),
      preparedUpdates: Schema.Array(preparedUpdateSchema),
      updateTargets: Schema.Array(Schema.Any),
      createdCount: Schema.Number,
      updatedCount: Schema.Number,
      createdByClerkUserId: Schema.String,
      updatedByClerkUserId: Schema.String,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      executedAtMs: Schema.NullOr(Schema.Number),
      canceledAtMs: Schema.NullOr(Schema.Number),
      failedAtMs: Schema.NullOr(Schema.Number),
      failureMessage: Schema.NullOr(Schema.String),
    }),
  )
    .index("by_project_id", ["projectId"])
    .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
    .index("by_project_id_and_status", ["projectId", "status"])
    .index("by_project_id_and_run_at_ms", ["projectId", "runAtMs"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  orgStorageUsage: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      encryptedBytes: Schema.Number,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  ).index("by_org_id", ["orgId"]),
  orgBillingSnapshots: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      currentTier: Schema.NullOr(
        Schema.Union(Schema.Literal("free"), Schema.Literal("pro"), Schema.Literal("max")),
      ),
      updatedAtMs: Schema.Number,
    }),
  ).index("by_org_id", ["orgId"]),
  billingRequestLog: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      requestKey: Schema.String,
      featureId: Schema.String,
      units: Schema.Number,
      createdAtMs: Schema.Number,
    }),
  )
    .index("by_org_id_and_request_key", ["orgId", "requestKey"])
    .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"]),
  cliDeviceCodes: defineTable(
    Schema.Struct({
      deviceCodeHash: Schema.String,
      userCode: Schema.String,
      status: Schema.Union(
        Schema.Literal("pending"),
        Schema.Literal("approved"),
        Schema.Literal("exchanged"),
        Schema.Literal("expired"),
      ),
      clientName: Schema.NullOr(Schema.String),
      approvedAtMs: Schema.NullOr(Schema.Number),
      approvedByClerkUserId: Schema.NullOr(Schema.String),
      approvedOrgId: Schema.NullOr(Schema.String),
      approvedOrgSlug: Schema.NullOr(Schema.String),
      exchangedAtMs: Schema.NullOr(Schema.Number),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      expiresAtMs: Schema.Number,
      intervalSec: Schema.Number,
    }),
  )
    .index("by_device_code_hash", ["deviceCodeHash"])
    .index("by_user_code_and_status", ["userCode", "status"])
    .index("by_status_and_expires_at_ms", ["status", "expiresAtMs"]),
  cliSessions: defineTable(
    Schema.Struct({
      sessionId: Schema.String,
      clerkUserId: Schema.String,
      orgId: Schema.String,
      orgSlug: Schema.String,
      accessTokenHash: Schema.String,
      refreshTokenHash: Schema.String,
      accessTokenExpiresAtMs: Schema.Number,
      refreshTokenExpiresAtMs: Schema.Number,
      revokedAtMs: Schema.NullOr(Schema.Number),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      lastUsedAtMs: Schema.Number,
    }),
  )
    .index("by_session_id", ["sessionId"])
    .index("by_access_token_hash", ["accessTokenHash"])
    .index("by_refresh_token_hash", ["refreshTokenHash"])
    .index("by_clerk_user_id_and_org_id", ["clerkUserId", "orgId"]),
  auditEvents: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      orgSlug: Schema.String,
      projectId: Schema.NullOr(Id.Id("projects")),
      projectSlug: Schema.NullOr(Schema.String),
      stageSlug: Schema.NullOr(Schema.String),
      eventType: Schema.String,
      category: Schema.Union(
        Schema.Literal("org"),
        Schema.Literal("project"),
        Schema.Literal("stage"),
        Schema.Literal("variable"),
        Schema.Literal("billing"),
        Schema.Literal("auth"),
        Schema.Literal("cli"),
      ),
      occurredAtMs: Schema.Number,
      actorSource: Schema.Union(
        Schema.Literal("barekey_user"),
        Schema.Literal("system"),
        Schema.Literal("clerk"),
        Schema.Literal("cli"),
        Schema.Literal("api"),
      ),
      actorClerkUserId: Schema.NullOr(Schema.String),
      actorDisplayName: Schema.NullOr(Schema.String),
      actorEmail: Schema.NullOr(Schema.String),
      subjectType: Schema.Union(
        Schema.Literal("org"),
        Schema.Literal("project"),
        Schema.Literal("stage"),
        Schema.Literal("variable"),
        Schema.Literal("billing"),
        Schema.Literal("session"),
        Schema.Literal("user"),
      ),
      subjectId: Schema.NullOr(Schema.String),
      subjectName: Schema.NullOr(Schema.String),
      title: Schema.String,
      description: Schema.String,
      severity: Schema.Union(
        Schema.Literal("info"),
        Schema.Literal("warning"),
        Schema.Literal("error"),
      ),
      payloadJson: Schema.String,
      retentionTier: Schema.Union(
        Schema.Literal("free_30d"),
        Schema.Literal("pro_180d"),
        Schema.Literal("max_forever"),
      ),
      expiresAtMs: Schema.NullOr(Schema.Number),
    }),
  )
    .index("by_org_id_and_occurred_at_ms", ["orgId", "occurredAtMs"])
    .index("by_org_id_and_category_and_occurred_at_ms", ["orgId", "category", "occurredAtMs"])
    .index("by_org_id_and_project_slug_and_occurred_at_ms", [
      "orgId",
      "projectSlug",
      "occurredAtMs",
    ])
    .index("by_org_id_and_event_type_and_occurred_at_ms", ["orgId", "eventType", "occurredAtMs"])
    .index("by_expires_at_ms", ["expiresAtMs"]),
});

type BarekeyConfectDataModel = import("@rjdellecese/confect/server").ConfectDataModelFromConfectSchemaDefinition<
  typeof confectSchema
>;

export const BarekeyConfectQueryCtx = ConfectQueryCtx<BarekeyConfectDataModel>();
export const BarekeyConfectMutationCtx = ConfectMutationCtx<BarekeyConfectDataModel>();
export const BarekeyConfectActionCtx = ConfectActionCtx<BarekeyConfectDataModel>();

export class RuntimeConfigService extends Context.Tag("RuntimeConfigService")<
  RuntimeConfigService,
  {
    readonly config: typeof runtimeConfig;
  }
>() {}

export class ClockService extends Context.Tag("ClockService")<
  ClockService,
  {
    readonly nowMs: () => number;
  }
>() {}

export class RandomService extends Context.Tag("RandomService")<
  RandomService,
  {
    readonly randomBytes: (length: number) => Uint8Array;
  }
>() {}

export class FunctionRunnerService extends Context.Tag("FunctionRunnerService")<
  FunctionRunnerService,
  {
    readonly runQuery: ((...args: ReadonlyArray<unknown>) => Promise<unknown>) | null;
    readonly runMutation: ((...args: ReadonlyArray<unknown>) => Promise<unknown>) | null;
    readonly runAction: ((...args: ReadonlyArray<unknown>) => Promise<unknown>) | null;
  }
>() {}

export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly getUserIdentity: () => Promise<unknown>;
  }
>() {}

export class DbService extends Context.Tag("DbService")<
  DbService,
  {
    readonly db: unknown;
  }
>() {}

export class AuditService extends Context.Tag("AuditService")<
  AuditService,
  {
    readonly append: (payload: unknown) => Promise<void>;
  }
>() {}

export class BillingService extends Context.Tag("BillingService")<
  BillingService,
  {
    readonly reserve: (payload: unknown) => Promise<unknown>;
    readonly compensate: (payload: unknown) => Promise<void>;
  }
>() {}

export class ProjectScopeService extends Context.Tag("ProjectScopeService")<
  ProjectScopeService,
  {
    readonly resolve: (payload: unknown) => Promise<unknown>;
  }
>() {}

export class EncryptionService extends Context.Tag("EncryptionService")<
  EncryptionService,
  {
    readonly decryptUtf8WithKey: typeof decryptUtf8WithKey;
    readonly encryptUtf8WithKey: typeof encryptUtf8WithKey;
    readonly unwrapDekWithMasterKey: typeof unwrapDekWithMasterKey;
    readonly wrapDekWithMasterKey: typeof wrapDekWithMasterKey;
  }
>() {}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function makeRuntimeLayer(ctx: QueryCtx | MutationCtx | ActionCtx): Layer.Layer<never> {
  return Layer.mergeAll(
    Layer.succeed(RuntimeConfigService, { config: runtimeConfig }),
    Layer.succeed(ClockService, { nowMs: () => Date.now() }),
    Layer.succeed(RandomService, { randomBytes }),
    Layer.succeed(FunctionRunnerService, {
      runAction: "runAction" in ctx ? (...args) => (ctx.runAction as (...args: Array<unknown>) => Promise<unknown>)(...args) : null,
      runMutation:
        "runMutation" in ctx
          ? (...args) => (ctx.runMutation as (...args: Array<unknown>) => Promise<unknown>)(...args)
          : null,
      runQuery:
        "runQuery" in ctx
          ? (...args) => (ctx.runQuery as (...args: Array<unknown>) => Promise<unknown>)(...args)
          : null,
    }),
    Layer.succeed(AuthService, {
      getUserIdentity: () => ctx.auth.getUserIdentity(),
    }),
    Layer.succeed(DbService, {
      db: "db" in ctx ? ctx.db : null,
    }),
    Layer.succeed(AuditService, {
      append: async () => {},
    }),
    Layer.succeed(BillingService, {
      reserve: async () => null,
      compensate: async () => {},
    }),
    Layer.succeed(ProjectScopeService, {
      resolve: async () => null,
    }),
    Layer.succeed(EncryptionService, {
      decryptUtf8WithKey,
      encryptUtf8WithKey,
      unwrapDekWithMasterKey,
      wrapDekWithMasterKey,
    }),
  );
}

type ConvexValidatorLike = Validator<any, any, any> & {
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

function baseValidatorToSchema(validator: ConvexValidatorLike): Schema.Schema.Any {
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
          // Records store value schemas, not property signatures.
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

function validatorToSchema(validator: ConvexValidatorLike): Schema.Schema.Any {
  return baseValidatorToSchema(validator);
}

function validatorToFieldSchema(validator: ConvexValidatorLike): unknown {
  const schema = baseValidatorToSchema(validator);
  return validator?.isOptional === "optional" ? Schema.optional(schema) : schema;
}

function argsObjectToSchema<T>(
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

function returnsValidatorToSchema<T>(validator: ConvexValidatorLike): Schema.Schema<T, T> {
  return validatorToSchema(validator) as Schema.Schema<T, T>;
}

async function runLegacyHandler<T>(
  effect: Effect.Effect<T, unknown, never>,
): Promise<T> {
  return await Effect.runPromise(
    effect.pipe(
      Effect.catchAll((error) => Effect.fail(toLegacyHandlerError(error))),
    ),
  );
}

const confectFunctions = makeFunctions(confectSchema);

export const query: typeof generatedQuery = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: QueryCtx, args: unknown) => unknown;
}) =>
  confectFunctions.query({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectQueryCtx;
        const legacyCtx = confectCtx.ctx as unknown as QueryCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedQuery;

export const internalQuery: typeof generatedInternalQuery = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: QueryCtx, args: unknown) => unknown;
}) =>
  confectFunctions.internalQuery({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectQueryCtx;
        const legacyCtx = confectCtx.ctx as unknown as QueryCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedInternalQuery;

export const mutation: typeof generatedMutation = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: MutationCtx, args: unknown) => unknown;
}) =>
  confectFunctions.mutation({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectMutationCtx;
        const legacyCtx = confectCtx.ctx as unknown as MutationCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedMutation;

export const internalMutation: typeof generatedInternalMutation = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: MutationCtx, args: unknown) => unknown;
}) =>
  confectFunctions.internalMutation({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectMutationCtx;
        const legacyCtx = confectCtx.ctx as unknown as MutationCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedInternalMutation;

export const action: typeof generatedAction = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: ActionCtx, args: unknown) => unknown;
}) =>
  confectFunctions.action({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectActionCtx;
        const legacyCtx = confectCtx.ctx as unknown as ActionCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedAction;

export const internalAction: typeof generatedInternalAction = ((definition: {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: ActionCtx, args: unknown) => unknown;
}) =>
  confectFunctions.internalAction({
    args: argsObjectToSchema(definition.args),
    returns: returnsValidatorToSchema(definition.returns),
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectActionCtx;
        const legacyCtx = confectCtx.ctx as unknown as ActionCtx;
        return yield* Effect.promise(() =>
          runLegacyHandler(
            Effect.promise(async () => await definition.handler(legacyCtx, args)).pipe(
              Effect.provide(makeRuntimeLayer(legacyCtx)),
            ),
          ),
        );
      }),
  })) as typeof generatedInternalAction;

export const httpAction: typeof generatedHttpAction = ((handler: (
  ctx: ActionCtx,
  request: Request,
) => Promise<Response>) =>
  generatedHttpAction(async (ctx, request) => {
    return await runLegacyHandler(
      Effect.promise(async () => await handler(ctx as unknown as ActionCtx, request)).pipe(
        Effect.provide(makeRuntimeLayer(ctx as unknown as ActionCtx)),
      ),
    );
  })) as typeof generatedHttpAction;
