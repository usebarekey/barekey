export type BarekeyResolvedKind = "secret" | "ab_roll" | "rollout";

export type BarekeyDeclaredType = "string" | "boolean" | "int64" | "float" | "date" | "json";

export type BarekeyTemporalInstant = {
  readonly epochMilliseconds: number;
  toJSON(): string;
  toString(): string;
};

export type Secret = "secret";

export type AB = "ab";

export type Linear<
  TMilestones extends ReadonlyArray<readonly [string, number]> = ReadonlyArray<
    readonly [string, number]
  >,
> = {
  readonly kind: "linear";
  readonly milestones: TMilestones;
};

export type Env<TMode, TValue, TFunction = never> = TValue & {
  readonly __barekey?: {
    readonly mode: TMode;
    readonly function: TFunction;
  };
};

export type BarekeyRolloutMilestone = {
  at: string;
  percentage: number;
};

export type BarekeyDecision = {
  bucket: number;
  chance: number;
  seed?: string;
  key?: string;
  matchedRule: "ab_roll" | "linear_rollout";
};

export type BarekeyEvaluatedValue = {
  name: string;
  kind: BarekeyResolvedKind;
  declaredType: BarekeyDeclaredType;
  value: string;
  decision?: BarekeyDecision;
  selectedArm?: "A" | "B";
};

export type BarekeyVariableDefinition =
  | {
      name: string;
      kind: "secret";
      declaredType: BarekeyDeclaredType;
      value: string;
    }
  | {
      name: string;
      kind: "ab_roll";
      declaredType: BarekeyDeclaredType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      name: string;
      kind: "rollout";
      declaredType: BarekeyDeclaredType;
      valueA: string;
      valueB: string;
      rolloutFunction: "linear";
      rolloutMilestones: Array<BarekeyRolloutMilestone>;
    };

export type BarekeyGetOptions = {
  dynamic?: true | { ttl: number };
  seed?: string;
  key?: string;
};

export type BarekeyJsonConfig = {
  organization?: string;
  project?: string;
  environment?: string;
  org?: string;
  stage?: string;
};

export type BarekeyStandardSchemaResult =
  | {
      value: unknown;
      issues?: undefined;
    }
  | {
      issues: ReadonlyArray<{
        message?: string;
        path?: ReadonlyArray<PropertyKey>;
      }>;
      value?: undefined;
    };

export type BarekeyStandardSchemaV1 = {
  readonly ["~standard"]?: {
    readonly version?: number;
    validate(value: unknown): BarekeyStandardSchemaResult | Promise<BarekeyStandardSchemaResult>;
  };
};

type BarekeyBaseClientOptions = {
  requirements?: BarekeyStandardSchemaV1;
};

export type BarekeyClientOptions =
  | (BarekeyBaseClientOptions & {
      organization: string;
      project: string;
      environment: string;
      json?: never;
    })
  | (BarekeyBaseClientOptions & {
      json: BarekeyJsonConfig;
      organization?: never;
      project?: never;
      environment?: never;
    })
  | (BarekeyBaseClientOptions & {
      organization?: never;
      project?: never;
      environment?: never;
      json?: never;
    });

export type BarekeyErrorCode =
  | "FS_NOT_AVAILABLE"
  | "NO_CONFIGURATION_PROVIDED"
  | "INVALID_CONFIGURATION_PROVIDED"
  | "NO_CREDENTIALS_PROVIDED"
  | "INVALID_CREDENTIALS_PROVIDED"
  | "INVALID_DYNAMIC_OPTIONS"
  | "REQUIREMENTS_VALIDATION_FAILED"
  | "NETWORK_ERROR"
  | "COERCE_FAILED"
  | "TEMPORAL_NOT_AVAILABLE"
  | "UNAUTHORIZED"
  | "INVALID_ORG_SCOPE"
  | "ORG_SCOPE_INVALID"
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "VARIABLE_NOT_FOUND"
  | "EVALUATION_FAILED"
  | "USAGE_LIMIT_EXCEEDED"
  | "BILLING_UNAVAILABLE"
  | "DEVICE_CODE_NOT_FOUND"
  | "DEVICE_CODE_EXPIRED"
  | "USER_CODE_INVALID"
  | "INVALID_REFRESH_TOKEN"
  | "UNKNOWN_ERROR";
