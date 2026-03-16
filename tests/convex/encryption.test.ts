import { describe, expect, test } from "bun:test";

import {
  decodeCiphertextEnvelope,
  decryptUtf8WithKey,
  encodeCiphertextEnvelope,
  encryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
} from "../../pkg/convex/lib/encryption";
import { encryptedPayloadByteLength } from "../../pkg/convex/lib/project_variables_shared";

function randomKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

describe("encryptUtf8WithKey", () => {
  test("round-trips UTF-8 plaintext through xcp1 envelopes", () => {
    const key = randomKey();
    const plaintext = "hello xchacha secret";

    const encrypted = encryptUtf8WithKey(key, plaintext);

    expect(encrypted.startsWith("xcp1.")).toBeTrue();
    expect(decryptUtf8WithKey(key, encrypted)).toBe(plaintext);
  });

  test("fails decryption with the wrong key", () => {
    const encrypted = encryptUtf8WithKey(randomKey(), "top secret");

    expect(() => decryptUtf8WithKey(randomKey(), encrypted)).toThrow("Failed to decrypt payload.");
  });

  test("counts encrypted payload bytes using the new xcp1 format", () => {
    const encryptedValue = encryptUtf8WithKey(randomKey(), "payload");

    expect(
      encryptedPayloadByteLength({
        encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
      }),
    ).toBe(new TextEncoder().encode(encryptedValue).length);
  });
});

describe("ciphertext envelope", () => {
  test("rejects malformed payload versions", () => {
    expect(() => decodeCiphertextEnvelope("aesgcm.nonce.ciphertext")).toThrow(
      "Encrypted payload format is invalid.",
    );
  });

  test("rejects nonce lengths that are not 24 bytes", () => {
    expect(() => encodeCiphertextEnvelope(new Uint8Array(12), new Uint8Array([1, 2, 3]))).toThrow(
      "XChaCha20 nonce must be exactly 24 bytes.",
    );
  });
});

describe("DEK wrapping", () => {
  test("wraps and unwraps raw DEK bytes with the master key", () => {
    const masterKey = randomKey();
    const dekBytes = randomKey();

    const wrapped = wrapDekWithMasterKey(masterKey, dekBytes);

    expect(unwrapDekWithMasterKey(masterKey, wrapped)).toEqual(dekBytes);
  });
});
