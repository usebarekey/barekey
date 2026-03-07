import type { BarekeyError } from "./errors";

export type BarekeyResolvedKind = "secret" | "ab_roll" | "rollout";
export type BarekeyDeclaredType = "string" | "boolean" | "int64" | "float" | "date" | "json";
export type BarekeyTemporalInstant = {
  readonly epochMilliseconds: number;
  toJSON(): string;
  toString(): string;
};

export interface BarekeyGeneratedTypeMap {}

export type BarekeyGeneratedValueForKey<TKey extends string> =
  TKey extends keyof BarekeyGeneratedTypeMap ? BarekeyGeneratedTypeMap[TKey] : unknown;

export type BarekeyResolvedValue = {
  name: string;
  kind: BarekeyResolvedKind;
  declaredType: BarekeyDeclaredType;
  value: string;
  decision?: {
    bucket?: number;
    chance?: number;
    seed?: string;
    key?: string;
    matchedRule?: string;
  };
};

export type BarekeyErrorCode =
  | "UNAUTHORIZED"
  | "ORG_SCOPE_INVALID"
  | "VARIABLE_NOT_FOUND"
  | "INVALID_REQUEST"
  | "BILLING_UNAVAILABLE"
  | "USAGE_LIMIT_EXCEEDED"
  | "NETWORK_ERROR"
  | "COERCE_FAILED"
  | "REQUIRED_VALUE_MISSING"
  | "EVALUATION_FAILED"
  | "UNKNOWN_ERROR";

export type BarekeyAuthProvider = {
  getAccessToken(): Promise<string>;
  onAuthError?(error: BarekeyError): Promise<void>;
};

export type BarekeyGetOptions = {
  dynamic?: {
    ttl?: number;
  };
  seed?: string;
  key?: string;
};

export type BarekeyCacheRecord = {
  value: BarekeyResolvedValue;
  expiresAtMs: number;
};

export type BarekeyCacheAdapter = {
  get(key: string): Promise<BarekeyCacheRecord | null>;
  set(key: string, value: BarekeyCacheRecord): Promise<void>;
  delete(key: string): Promise<void>;
};

export type BarekeyClientOptions = {
  baseUrl: string;
  auth: BarekeyAuthProvider;
  projectSlug: string;
  stageSlug: string;
  orgSlug?: string;
  cache?: BarekeyCacheAdapter;
  fetch?: typeof globalThis.fetch;
};

export type BarekeyEvaluateSingleResponse = {
  name: string;
  kind: BarekeyResolvedKind;
  declaredType: BarekeyDeclaredType;
  value: string;
  decision?: BarekeyResolvedValue["decision"];
};

export type BarekeyEvaluateBatchResponse = {
  values: Array<BarekeyEvaluateSingleResponse>;
};

export type BarekeyApiErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};
