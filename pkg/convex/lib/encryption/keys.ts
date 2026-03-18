import { EncryptionError } from "../errors/effect";
import {
  DEK_BYTES_LENGTH,
  MASTER_KEY_ENV_NAME,
} from "./constants";
import { base64ToBytes } from "./base64";

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function requireKeyLength(rawKey: Uint8Array, label: string): Uint8Array {
  if (rawKey.length !== DEK_BYTES_LENGTH) {
    throw new EncryptionError({
      message: `${label} must be exactly 32 bytes.`,
    });
  }

  return rawKey;
}

/**
 * Loads the master KEK from the configured base64 environment variable.
 *
 * @returns The decoded 32-byte master key.
 * @remarks This throws when the env var is missing, blank, invalid base64, or not exactly 32 bytes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getMasterKeyBytes(): Uint8Array {
  const masterKeyBase64 = process.env.BAREKEY_MASTER_KEY_B64?.trim();
  if (!masterKeyBase64) {
    throw new EncryptionError({
      message: `Missing ${MASTER_KEY_ENV_NAME}.`,
    });
  }

  const bytes = base64ToBytes(masterKeyBase64);
  if (bytes.length !== DEK_BYTES_LENGTH) {
    throw new EncryptionError({
      message: `${MASTER_KEY_ENV_NAME} must decode to exactly 32 bytes.`,
    });
  }

  return bytes;
}
