import { Data } from "effect";

export class LegacyHandlerError extends Data.TaggedError("LegacyHandlerError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
}> {}

export class AuthError extends Data.TaggedError("AuthError")<{
  readonly message: string;
}> {}

export class BillingError extends Data.TaggedError("BillingError")<{
  readonly message: string;
}> {}

export class EncryptionError extends Data.TaggedError("EncryptionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ExternalServiceError extends Data.TaggedError("ExternalServiceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type BarekeyAppError =
  | AuthError
  | BillingError
  | EncryptionError
  | ExternalServiceError
  | LegacyHandlerError
  | NotFoundError
  | ValidationError;

export function toLegacyHandlerError(error: unknown): LegacyHandlerError {
  if (error instanceof LegacyHandlerError) {
    return error;
  }

  if (error instanceof Error) {
    return new LegacyHandlerError({
      message: error.message,
      cause: error,
    });
  }

  return new LegacyHandlerError({
    message: "Unexpected backend error.",
    cause: error,
  });
}

/**
 * Throws a typed validation error from synchronous compatibility helpers.
 *
 * @param message The validation failure message.
 * @returns This function never returns.
 * @remarks Use this in synchronous parsing helpers that still expose throw-based contracts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function throwValidationError(message: string): never {
  throw new ValidationError({ message });
}

/**
 * Throws a typed billing error from synchronous compatibility helpers.
 *
 * @param message The billing failure message.
 * @returns This function never returns.
 * @remarks This preserves stable billing messages while avoiding anonymous thrown errors.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function throwBillingError(message: string): never {
  throw new BillingError({ message });
}

/**
 * Throws a typed external-service error from synchronous compatibility helpers.
 *
 * @param message The failure message to expose to callers.
 * @param cause The original failure value, when available.
 * @returns This function never returns.
 * @remarks Use this when promise-free adapters still need to surface typed service failures.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function throwExternalServiceError(message: string, cause?: unknown): never {
  throw new ExternalServiceError({ message, cause });
}

/**
 * Throws a typed not-found error from synchronous compatibility helpers.
 *
 * @param message The not-found message.
 * @returns This function never returns.
 * @remarks This keeps missing-row invariants explicit without anonymous thrown errors.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function throwNotFoundError(message: string): never {
  throw new NotFoundError({ message });
}
