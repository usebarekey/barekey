import { Either, Schema } from "effect";

const optionalClientNameSchema = Schema.optional(
  Schema.NullOr(Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(120))),
);
const requiredDeviceCodeSchema = Schema.Struct({
  deviceCode: Schema.Trim.pipe(Schema.minLength(1)),
});
const requiredRefreshTokenSchema = Schema.Struct({
  refreshToken: Schema.Trim.pipe(Schema.minLength(1)),
});
const requiredUserCodeSchema = Schema.Struct({
  userCode: Schema.Trim.pipe(Schema.minLength(1)),
});
const deviceStartSchema = Schema.Struct({
  clientName: optionalClientNameSchema,
});

/**
 * Decodes the CLI device-start body.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized device-start payload.
 * @remarks Invalid or malformed client-name payloads fall back to `null` to preserve the tolerant start-route behavior.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeCliDeviceStartBody(
  payload: unknown,
): { clientName: string | null } {
  const decoded = Schema.decodeUnknownEither(deviceStartSchema)(payload);
  return Either.isRight(decoded)
    ? {
        clientName: decoded.right.clientName ?? null,
      }
    : {
        clientName: null,
      };
}

/**
 * Decodes the CLI device-complete body.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized device-complete payload, or `null` when the request is invalid.
 * @remarks Required user-code validation is handled with Effect Schema instead of ad hoc property checks.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeCliDeviceCompleteBody(
  payload: unknown,
): { userCode: string } | null {
  const decoded = Schema.decodeUnknownEither(requiredUserCodeSchema)(payload);
  return Either.isRight(decoded)
    ? {
        userCode: decoded.right.userCode,
      }
    : null;
}

/**
 * Decodes the CLI device-poll body.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized device-poll payload, or `null` when the request is invalid.
 * @remarks Required device-code validation is handled with Effect Schema instead of ad hoc property checks.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeCliDevicePollBody(
  payload: unknown,
): { deviceCode: string } | null {
  const decoded = Schema.decodeUnknownEither(requiredDeviceCodeSchema)(payload);
  return Either.isRight(decoded)
    ? {
        deviceCode: decoded.right.deviceCode,
      }
    : null;
}

/**
 * Decodes request bodies that require a refresh token.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized refresh-token payload, or `null` when invalid.
 * @remarks Logout and token-refresh routes share the same required refresh-token contract.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliRefreshTokenBody(
  payload: unknown,
): { refreshToken: string } | null {
  const decoded = Schema.decodeUnknownEither(requiredRefreshTokenSchema)(payload);
  return Either.isRight(decoded)
    ? {
        refreshToken: decoded.right.refreshToken,
      }
    : null;
}
