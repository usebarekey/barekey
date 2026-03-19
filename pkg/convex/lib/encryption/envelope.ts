import { EncryptionError } from "../errors/effect";
import {
  CIPHERTEXT_VERSION,
  XCHACHA20_NONCE_BYTES_LENGTH,
} from "./constants";
import { base64ToBytes, bytesToBase64 } from "./base64";

/**
 * Encodes a versioned XChaCha20 ciphertext envelope for storage.
 *
 * @param nonceBytes The 24-byte XChaCha20 nonce.
 * @param encryptedBytes The ciphertext bytes produced by the cipher.
 * @returns The serialized `xcp1.<nonceB64>.<ciphertextB64>` payload.
 * @remarks This throws when the nonce length does not match the XChaCha20 requirement.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function encodeCiphertextEnvelope(
  nonceBytes: Uint8Array,
  encryptedBytes: Uint8Array,
): string {
  if (nonceBytes.length !== XCHACHA20_NONCE_BYTES_LENGTH) {
    throw new EncryptionError({
      message: `XChaCha20 nonce must be exactly ${XCHACHA20_NONCE_BYTES_LENGTH} bytes.`,
    });
  }

  return `${CIPHERTEXT_VERSION}.${bytesToBase64(nonceBytes)}.${bytesToBase64(encryptedBytes)}`;
}

/**
 * Decodes a stored XChaCha20 ciphertext envelope back into nonce and ciphertext bytes.
 *
 * @param payload The serialized ciphertext envelope string.
 * @returns The decoded envelope parts.
 * @remarks This validates the version tag, field count, and nonce length before returning.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function decodeCiphertextEnvelope(payload: string): {
  version: typeof CIPHERTEXT_VERSION;
  nonceBytes: Uint8Array;
  encryptedBytes: Uint8Array;
} {
  const [version, nonceBase64, encryptedBase64] = payload.split(".", 3);
  if (
    version !== CIPHERTEXT_VERSION ||
    !nonceBase64 ||
    !encryptedBase64 ||
    payload.split(".").length !== 3
  ) {
    throw new EncryptionError({
      message: "Encrypted payload format is invalid.",
    });
  }

  const nonceBytes = base64ToBytes(nonceBase64);
  if (nonceBytes.length !== XCHACHA20_NONCE_BYTES_LENGTH) {
    throw new EncryptionError({
      message: `XChaCha20 nonce must be exactly ${XCHACHA20_NONCE_BYTES_LENGTH} bytes.`,
    });
  }

  return {
    version,
    nonceBytes,
    encryptedBytes: base64ToBytes(encryptedBase64),
  };
}
