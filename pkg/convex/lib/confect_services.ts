import { Context } from "effect";

import {
  decryptUtf8WithKey,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "./encryption";
import { runtimeConfig } from "./runtime_config";

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
