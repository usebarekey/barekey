import type { BarekeyError } from "./errors";

export type BarekeyResolvedKind = "secret" | "ab_roll" | "rollout";

export type BarekeyResolvedValue = {
  name: string;
  kind: BarekeyResolvedKind;
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
