import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { Effect } from "effect";

import { EncryptionError } from "../errors/effect";
import { DEK_BYTES_LENGTH, XCHACHA20_NONCE_BYTES_LENGTH } from "./constants";
import { decodeCiphertextEnvelope, encodeCiphertextEnvelope } from "./envelope";
import { randomBytes, requireKeyLength } from "./keys";

function encryptBytesWithKeyEffect(rawKey: Uint8Array, plaintextBytes: Uint8Array) {
  return Effect.try({
    try: () => {
      const keyBytes = requireKeyLength(rawKey, "Encryption key");
      const nonceBytes = randomBytes(XCHACHA20_NONCE_BYTES_LENGTH);
      const encryptedBytes = xchacha20poly1305(keyBytes, nonceBytes).encrypt(plaintextBytes);
      return encodeCiphertextEnvelope(nonceBytes, encryptedBytes);
    },
    catch: (cause) =>
      new EncryptionError({
        message: "Failed to encrypt payload.",
        cause,
      }),
  });
}

function decryptBytesWithKeyEffect(rawKey: Uint8Array, payload: string) {
  return Effect.try({
    try: () => {
      const keyBytes = requireKeyLength(rawKey, "Encryption key");
      const { nonceBytes, encryptedBytes } = decodeCiphertextEnvelope(payload);
      return xchacha20poly1305(keyBytes, nonceBytes).decrypt(encryptedBytes);
    },
    catch: (cause) =>
      new EncryptionError({
        message: "Failed to decrypt payload.",
        cause,
      }),
  });
}

/**
 * Encrypts a UTF-8 plaintext string with a 32-byte key and returns an `xcp1` envelope.
 *
 * @param rawKey The 32-byte encryption key.
 * @param plaintext The UTF-8 plaintext to encrypt.
 * @returns The serialized ciphertext envelope.
 * @remarks This uses XChaCha20-Poly1305 with a fresh 24-byte random nonce for every call.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function encryptUtf8WithKey(rawKey: Uint8Array, plaintext: string): string {
  return Effect.runSync(encryptBytesWithKeyEffect(rawKey, new TextEncoder().encode(plaintext)));
}

/**
 * Decrypts an `xcp1` ciphertext envelope with a 32-byte key and returns the UTF-8 plaintext.
 *
 * @param rawKey The 32-byte encryption key.
 * @param payload The serialized ciphertext envelope.
 * @returns The decrypted UTF-8 plaintext string.
 * @remarks This throws when the payload is malformed, the key length is invalid, or authentication fails.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function decryptUtf8WithKey(rawKey: Uint8Array, payload: string): string {
  const plaintextBytes = Effect.runSync(decryptBytesWithKeyEffect(rawKey, payload));
  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Wraps a 32-byte DEK with the 32-byte master KEK.
 *
 * @param masterKeyBytes The decoded master KEK bytes.
 * @param dekBytes The raw DEK bytes to wrap.
 * @returns The serialized wrapped DEK envelope.
 * @remarks This validates both keys as 32-byte values before encrypting.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function wrapDekWithMasterKey(masterKeyBytes: Uint8Array, dekBytes: Uint8Array): string {
  return Effect.runSync(encryptBytesWithKeyEffect(masterKeyBytes, requireKeyLength(dekBytes, "DEK")));
}

/**
 * Unwraps a stored DEK envelope with the master KEK and validates the result length.
 *
 * @param masterKeyBytes The decoded master KEK bytes.
 * @param payload The serialized wrapped DEK envelope.
 * @returns The unwrapped 32-byte DEK.
 * @remarks This throws when the payload cannot be decrypted or the plaintext is not a valid DEK length.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function unwrapDekWithMasterKey(masterKeyBytes: Uint8Array, payload: string): Uint8Array {
  return requireKeyLength(
    Effect.runSync(decryptBytesWithKeyEffect(masterKeyBytes, payload)),
    "Unwrapped DEK",
  );
}
