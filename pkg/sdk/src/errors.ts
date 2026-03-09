import type { BarekeyErrorCode, BarekeyTemporalInstant } from "./types.js";

const INT64_MIN = BigInt("-9223372036854775808");
const INT64_MAX = BigInt("9223372036854775807");

type BarekeyErrorInit = {
  message?: string;
  requestId?: string | null;
  status?: number | null;
  cause?: unknown;
};

type BarekeyErrorDescriptor = {
  code: BarekeyErrorCode;
  name: string;
  description: string;
};

const ERROR_DESCRIPTORS = {
  FS_NOT_AVAILABLE: {
    code: "FS_NOT_AVAILABLE",
    name: "FsNotAvailableError",
    description: "A filesystem is not available.",
  },
  NO_CONFIGURATION_PROVIDED: {
    code: "NO_CONFIGURATION_PROVIDED",
    name: "NoConfigurationProvidedError",
    description: "No Barekey configuration was provided.",
  },
  INVALID_CONFIGURATION_PROVIDED: {
    code: "INVALID_CONFIGURATION_PROVIDED",
    name: "InvalidConfigurationProvidedError",
    description: "Invalid Barekey configuration was provided.",
  },
  NO_CREDENTIALS_PROVIDED: {
    code: "NO_CREDENTIALS_PROVIDED",
    name: "NoCredentialsProvidedError",
    description: "No Barekey credentials were provided.",
  },
  INVALID_CREDENTIALS_PROVIDED: {
    code: "INVALID_CREDENTIALS_PROVIDED",
    name: "InvalidCredentialsProvidedError",
    description: "Invalid Barekey credentials were provided.",
  },
  INVALID_DYNAMIC_OPTIONS: {
    code: "INVALID_DYNAMIC_OPTIONS",
    name: "InvalidDynamicOptionsError",
    description: "Invalid dynamic options were provided.",
  },
  REQUIREMENTS_VALIDATION_FAILED: {
    code: "REQUIREMENTS_VALIDATION_FAILED",
    name: "RequirementsValidationFailedError",
    description: "Barekey requirements validation failed.",
  },
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    name: "NetworkError",
    description: "A Barekey network request failed.",
  },
  COERCE_FAILED: {
    code: "COERCE_FAILED",
    name: "CoerceFailedError",
    description: "Barekey could not coerce the resolved value.",
  },
  TEMPORAL_NOT_AVAILABLE: {
    code: "TEMPORAL_NOT_AVAILABLE",
    name: "TemporalNotAvailableError",
    description: "Temporal is not available in this runtime.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    name: "UnauthorizedError",
    description: "The provided Barekey credentials were rejected.",
  },
  INVALID_ORG_SCOPE: {
    code: "INVALID_ORG_SCOPE",
    name: "InvalidOrgScopeError",
    description: "The requested organization scope is invalid.",
  },
  ORG_SCOPE_INVALID: {
    code: "ORG_SCOPE_INVALID",
    name: "OrgScopeInvalidError",
    description: "The authenticated organization scope is invalid.",
  },
  INVALID_JSON: {
    code: "INVALID_JSON",
    name: "InvalidJsonError",
    description: "The Barekey request body was invalid JSON.",
  },
  INVALID_REQUEST: {
    code: "INVALID_REQUEST",
    name: "InvalidRequestError",
    description: "The Barekey request was invalid.",
  },
  VARIABLE_NOT_FOUND: {
    code: "VARIABLE_NOT_FOUND",
    name: "VariableNotFoundError",
    description: "The requested Barekey variable was not found.",
  },
  EVALUATION_FAILED: {
    code: "EVALUATION_FAILED",
    name: "EvaluationFailedError",
    description: "Barekey could not evaluate the requested variable.",
  },
  USAGE_LIMIT_EXCEEDED: {
    code: "USAGE_LIMIT_EXCEEDED",
    name: "UsageLimitExceededError",
    description: "The Barekey usage limit has been exceeded.",
  },
  BILLING_UNAVAILABLE: {
    code: "BILLING_UNAVAILABLE",
    name: "BillingUnavailableError",
    description: "Barekey billing is temporarily unavailable.",
  },
  DEVICE_CODE_NOT_FOUND: {
    code: "DEVICE_CODE_NOT_FOUND",
    name: "DeviceCodeNotFoundError",
    description: "The Barekey device code was not found.",
  },
  DEVICE_CODE_EXPIRED: {
    code: "DEVICE_CODE_EXPIRED",
    name: "DeviceCodeExpiredError",
    description: "The Barekey device code has expired.",
  },
  USER_CODE_INVALID: {
    code: "USER_CODE_INVALID",
    name: "UserCodeInvalidError",
    description: "The Barekey user code is invalid.",
  },
  INVALID_REFRESH_TOKEN: {
    code: "INVALID_REFRESH_TOKEN",
    name: "InvalidRefreshTokenError",
    description: "The Barekey refresh token is invalid.",
  },
  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",
    name: "UnknownError",
    description: "An unknown Barekey error occurred.",
  },
} as const satisfies Record<BarekeyErrorCode, BarekeyErrorDescriptor>;

function toDocsSlug(code: BarekeyErrorCode): string {
  return code.toLowerCase().replaceAll("_", "-");
}

export function docsUrlForErrorCode(code: BarekeyErrorCode): string {
  return `https://docs.barekey.dev/errors/${toDocsSlug(code)}`;
}

export function formatBarekeyErrorMessage(code: BarekeyErrorCode, description: string): string {
  return `[${code}]: ${description}\n${docsUrlForErrorCode(code)}`;
}

export class BarekeyError extends Error {
  readonly code: BarekeyErrorCode;
  readonly docsUrl: string;
  readonly requestId: string | null;
  readonly status: number | null;
  override readonly cause: unknown;

  constructor(input: {
    code: BarekeyErrorCode;
    name: string;
    message: string;
    requestId?: string | null;
    status?: number | null;
    cause?: unknown;
  }) {
    super(formatBarekeyErrorMessage(input.code, input.message));
    this.name = input.name;
    this.code = input.code;
    this.docsUrl = docsUrlForErrorCode(input.code);
    this.requestId = input.requestId ?? null;
    this.status = input.status ?? null;
    this.cause = input.cause;
  }
}

function buildErrorClass<const TCode extends BarekeyErrorCode>(descriptor: {
  code: TCode;
  name: string;
  description: string;
}) {
  return class extends BarekeyError {
    constructor(input: BarekeyErrorInit = {}) {
      super({
        code: descriptor.code,
        name: descriptor.name,
        message: input.message ?? descriptor.description,
        requestId: input.requestId,
        status: input.status,
        cause: input.cause,
      });
    }
  };
}

export const FsNotAvailableError = buildErrorClass(ERROR_DESCRIPTORS.FS_NOT_AVAILABLE);
export const NoConfigurationProvidedError = buildErrorClass(
  ERROR_DESCRIPTORS.NO_CONFIGURATION_PROVIDED,
);
export const InvalidConfigurationProvidedError = buildErrorClass(
  ERROR_DESCRIPTORS.INVALID_CONFIGURATION_PROVIDED,
);
export const NoCredentialsProvidedError = buildErrorClass(
  ERROR_DESCRIPTORS.NO_CREDENTIALS_PROVIDED,
);
export const InvalidCredentialsProvidedError = buildErrorClass(
  ERROR_DESCRIPTORS.INVALID_CREDENTIALS_PROVIDED,
);
export const InvalidDynamicOptionsError = buildErrorClass(
  ERROR_DESCRIPTORS.INVALID_DYNAMIC_OPTIONS,
);
export const RequirementsValidationFailedError = buildErrorClass(
  ERROR_DESCRIPTORS.REQUIREMENTS_VALIDATION_FAILED,
);
export const NetworkError = buildErrorClass(ERROR_DESCRIPTORS.NETWORK_ERROR);
export const CoerceFailedError = buildErrorClass(ERROR_DESCRIPTORS.COERCE_FAILED);
export const TemporalNotAvailableError = buildErrorClass(ERROR_DESCRIPTORS.TEMPORAL_NOT_AVAILABLE);
export const UnauthorizedError = buildErrorClass(ERROR_DESCRIPTORS.UNAUTHORIZED);
export const InvalidOrgScopeError = buildErrorClass(ERROR_DESCRIPTORS.INVALID_ORG_SCOPE);
export const OrgScopeInvalidError = buildErrorClass(ERROR_DESCRIPTORS.ORG_SCOPE_INVALID);
export const InvalidJsonError = buildErrorClass(ERROR_DESCRIPTORS.INVALID_JSON);
export const InvalidRequestError = buildErrorClass(ERROR_DESCRIPTORS.INVALID_REQUEST);
export const VariableNotFoundError = buildErrorClass(ERROR_DESCRIPTORS.VARIABLE_NOT_FOUND);
export const EvaluationFailedError = buildErrorClass(ERROR_DESCRIPTORS.EVALUATION_FAILED);
export const UsageLimitExceededError = buildErrorClass(ERROR_DESCRIPTORS.USAGE_LIMIT_EXCEEDED);
export const BillingUnavailableError = buildErrorClass(ERROR_DESCRIPTORS.BILLING_UNAVAILABLE);
export const DeviceCodeNotFoundError = buildErrorClass(ERROR_DESCRIPTORS.DEVICE_CODE_NOT_FOUND);
export const DeviceCodeExpiredError = buildErrorClass(ERROR_DESCRIPTORS.DEVICE_CODE_EXPIRED);
export const UserCodeInvalidError = buildErrorClass(ERROR_DESCRIPTORS.USER_CODE_INVALID);
export const InvalidRefreshTokenError = buildErrorClass(ERROR_DESCRIPTORS.INVALID_REFRESH_TOKEN);
export const UnknownError = buildErrorClass(ERROR_DESCRIPTORS.UNKNOWN_ERROR);

const ERROR_FACTORIES = {
  FS_NOT_AVAILABLE: (input?: BarekeyErrorInit) => new FsNotAvailableError(input),
  NO_CONFIGURATION_PROVIDED: (input?: BarekeyErrorInit) => new NoConfigurationProvidedError(input),
  INVALID_CONFIGURATION_PROVIDED: (input?: BarekeyErrorInit) =>
    new InvalidConfigurationProvidedError(input),
  NO_CREDENTIALS_PROVIDED: (input?: BarekeyErrorInit) => new NoCredentialsProvidedError(input),
  INVALID_CREDENTIALS_PROVIDED: (input?: BarekeyErrorInit) =>
    new InvalidCredentialsProvidedError(input),
  INVALID_DYNAMIC_OPTIONS: (input?: BarekeyErrorInit) => new InvalidDynamicOptionsError(input),
  REQUIREMENTS_VALIDATION_FAILED: (input?: BarekeyErrorInit) =>
    new RequirementsValidationFailedError(input),
  NETWORK_ERROR: (input?: BarekeyErrorInit) => new NetworkError(input),
  COERCE_FAILED: (input?: BarekeyErrorInit) => new CoerceFailedError(input),
  TEMPORAL_NOT_AVAILABLE: (input?: BarekeyErrorInit) => new TemporalNotAvailableError(input),
  UNAUTHORIZED: (input?: BarekeyErrorInit) => new UnauthorizedError(input),
  INVALID_ORG_SCOPE: (input?: BarekeyErrorInit) => new InvalidOrgScopeError(input),
  ORG_SCOPE_INVALID: (input?: BarekeyErrorInit) => new OrgScopeInvalidError(input),
  INVALID_JSON: (input?: BarekeyErrorInit) => new InvalidJsonError(input),
  INVALID_REQUEST: (input?: BarekeyErrorInit) => new InvalidRequestError(input),
  VARIABLE_NOT_FOUND: (input?: BarekeyErrorInit) => new VariableNotFoundError(input),
  EVALUATION_FAILED: (input?: BarekeyErrorInit) => new EvaluationFailedError(input),
  USAGE_LIMIT_EXCEEDED: (input?: BarekeyErrorInit) => new UsageLimitExceededError(input),
  BILLING_UNAVAILABLE: (input?: BarekeyErrorInit) => new BillingUnavailableError(input),
  DEVICE_CODE_NOT_FOUND: (input?: BarekeyErrorInit) => new DeviceCodeNotFoundError(input),
  DEVICE_CODE_EXPIRED: (input?: BarekeyErrorInit) => new DeviceCodeExpiredError(input),
  USER_CODE_INVALID: (input?: BarekeyErrorInit) => new UserCodeInvalidError(input),
  INVALID_REFRESH_TOKEN: (input?: BarekeyErrorInit) => new InvalidRefreshTokenError(input),
  UNKNOWN_ERROR: (input?: BarekeyErrorInit) => new UnknownError(input),
} as const satisfies Record<BarekeyErrorCode, (input?: BarekeyErrorInit) => BarekeyError>;

export function isBarekeyErrorCode(value: string): value is BarekeyErrorCode {
  return value in ERROR_DESCRIPTORS;
}

export function normalizeErrorCode(value: string): BarekeyErrorCode {
  const normalized = value.trim().toUpperCase();
  return isBarekeyErrorCode(normalized) ? normalized : "UNKNOWN_ERROR";
}

export function createBarekeyErrorFromCode(input: {
  code: string;
  message?: string;
  requestId?: string | null;
  status?: number | null;
  cause?: unknown;
}): BarekeyError {
  const code = normalizeErrorCode(input.code);
  return ERROR_FACTORIES[code]({
    message: input.message,
    requestId: input.requestId,
    status: input.status,
    cause: input.cause,
  });
}

export function parseFloatOrThrow(value: string): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to a float.`,
    });
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to a float.`,
    });
  }
  return parsed;
}

export function parseBigIntOrThrow(value: string): bigint {
  const normalized = value.trim();
  if (normalized.length === 0 || !/^-?(0|[1-9]\d*)$/.test(normalized)) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to an int64.`,
    });
  }
  try {
    const parsed = BigInt(normalized);
    if (parsed < INT64_MIN || parsed > INT64_MAX) {
      throw new CoerceFailedError({
        message: `Barekey could not coerce "${value}" to an int64.`,
      });
    }
    return parsed;
  } catch (error: unknown) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to an int64.`,
      cause: error,
    });
  }
}

export function parseBooleanOrThrow(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new CoerceFailedError({
    message: `Barekey could not coerce "${value}" to a boolean.`,
  });
}

export function parseJsonOrThrow<TJson = unknown>(value: string): TJson {
  try {
    return JSON.parse(value) as TJson;
  } catch (error: unknown) {
    throw new CoerceFailedError({
      message: "Barekey could not coerce the resolved value to JSON.",
      cause: error,
    });
  }
}

export function parseDateOrThrow(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to a Date.`,
    });
  }
  return parsed;
}

export function parseTemporalInstantOrThrow(value: string): BarekeyTemporalInstant {
  const temporalNamespace = (
    globalThis as typeof globalThis & {
      Temporal?: {
        Instant?: {
          from(value: string): BarekeyTemporalInstant;
        };
      };
    }
  ).Temporal;

  if (!temporalNamespace?.Instant) {
    throw new TemporalNotAvailableError();
  }

  try {
    return temporalNamespace.Instant.from(value);
  } catch (error: unknown) {
    throw new CoerceFailedError({
      message: `Barekey could not coerce "${value}" to a Temporal.Instant.`,
      cause: error,
    });
  }
}
