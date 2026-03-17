import { Context, Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { AuditEventInput } from "../../audit/types";
import type { ReserveFeatureUnitsResult } from "../../payments/types";
import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "../encryption";
import type { BillingError, ExternalServiceError, NotFoundError } from "../effect_errors";
import { runtimeConfig } from "../runtime_config";

export type BillingCurrentOrgUnitsInput = {
  scope: "currentOrg";
  expectedOrgSlug: string;
  featureId: string;
  units: number;
  reason: string;
};

export type BillingOrgUnitsInput = {
  scope: "org";
  orgId: string;
  orgSlug: string | null;
  featureId: string;
  units: number;
  reason: string;
};

export type BillingUnitsInput = BillingCurrentOrgUnitsInput | BillingOrgUnitsInput;

export type BillingCompensationResult = {
  compensatedUnits: number;
};

export type ProjectScopeLookupByOrgId = {
  scope: "orgId";
  orgId: string;
  projectSlug: string;
  stageSlug: string;
};

export type ProjectScopeLookupByOrgSlug = {
  scope: "orgSlug";
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
};

export type ProjectScopeLookup = ProjectScopeLookupByOrgId | ProjectScopeLookupByOrgSlug;

export type ProjectStageScope = {
  project: Doc<"projects">;
  stage: Doc<"projectStages">;
};

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
    readonly append: (
      payload: AuditEventInput,
    ) => Effect.Effect<Id<"auditEvents">, ExternalServiceError>;
  }
>() {}

export class BillingService extends Context.Tag("BillingService")<
  BillingService,
  {
    readonly reserve: (
      payload: BillingUnitsInput,
    ) => Effect.Effect<ReserveFeatureUnitsResult, BillingError>;
    readonly compensate: (
      payload: BillingUnitsInput,
    ) => Effect.Effect<BillingCompensationResult, BillingError>;
  }
>() {}

export class ProjectScopeService extends Context.Tag("ProjectScopeService")<
  ProjectScopeService,
  {
    readonly find: (
      payload: ProjectScopeLookup,
    ) => Effect.Effect<ProjectStageScope | null, ExternalServiceError>;
    readonly require: (
      payload: ProjectScopeLookup,
    ) => Effect.Effect<ProjectStageScope, ExternalServiceError | NotFoundError>;
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
