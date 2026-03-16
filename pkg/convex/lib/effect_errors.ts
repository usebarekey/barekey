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
