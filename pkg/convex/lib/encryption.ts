import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { Effect } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { EncryptionError } from "./effect_errors";

const CIPHERTEXT_VERSION = "xcp1";
const DEK_BYTES_LENGTH = 32;
const XCHACHA20_NONCE_BYTES_LENGTH = 24;
const MASTER_KEY_ENV_NAME = "BAREKEY_MASTER_KEY_B64";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (cause: unknown) {
    throw new EncryptionError({
      message: "Encrypted payload contains invalid base64 data.",
      cause,
    });
  }
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function requireKeyLength(rawKey: Uint8Array, label: string): Uint8Array {
  if (rawKey.length !== DEK_BYTES_LENGTH) {
    throw new EncryptionError({
      message: `${label} must be exactly 32 bytes.`,
    });
  }

  return rawKey;
}

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

export function encryptUtf8WithKey(rawKey: Uint8Array, plaintext: string): string {
  return Effect.runSync(encryptBytesWithKeyEffect(rawKey, new TextEncoder().encode(plaintext)));
}

export function decryptUtf8WithKey(rawKey: Uint8Array, payload: string): string {
  const plaintextBytes = Effect.runSync(decryptBytesWithKeyEffect(rawKey, payload));
  return new TextDecoder().decode(plaintextBytes);
}

export function wrapDekWithMasterKey(masterKeyBytes: Uint8Array, dekBytes: Uint8Array): string {
  return Effect.runSync(encryptBytesWithKeyEffect(masterKeyBytes, requireKeyLength(dekBytes, "DEK")));
}

export function unwrapDekWithMasterKey(masterKeyBytes: Uint8Array, payload: string): Uint8Array {
  return requireKeyLength(
    Effect.runSync(decryptBytesWithKeyEffect(masterKeyBytes, payload)),
    "Unwrapped DEK",
  );
}

type ProjectKeyRow = {
  _id: string;
  encryptedDek: string;
  createdAtMs: number;
};

function pickCanonicalProjectKeyRow(rows: Array<ProjectKeyRow>): ProjectKeyRow | null {
  if (rows.length === 0) {
    return null;
  }

  return (
    [...rows].sort((left, right) => {
      if (left.createdAtMs !== right.createdAtMs) {
        return left.createdAtMs - right.createdAtMs;
      }
      return String(left._id).localeCompare(String(right._id));
    })[0] ?? null
  );
}

async function listProjectKeyRows(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Array<ProjectKeyRow>> {
  return await ctx.db
    .query("projectKeys")
    .withIndex("by_project_id", (q) => q.eq("projectId", projectId))
    .collect();
}

/**
 * Ensures a project has a DEK wrapped by the master KEK and returns the
 * unwrapped DEK key bytes for one request.
 */
export async function ensureProjectDek(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
  },
): Promise<Uint8Array> {
  const existingKeyRows = await listProjectKeyRows(ctx, args.projectId);
  const existingKeyRow = pickCanonicalProjectKeyRow(existingKeyRows);
  const masterKeyBytes = getMasterKeyBytes();

  if (existingKeyRow !== null) {
    return unwrapDekWithMasterKey(masterKeyBytes, existingKeyRow.encryptedDek);
  }

  const now = Date.now();
  const dekBytes = randomBytes(DEK_BYTES_LENGTH);
  const encryptedDek = wrapDekWithMasterKey(masterKeyBytes, dekBytes);

  await ctx.db.insert("projectKeys", {
    projectId: args.projectId,
    orgId: args.orgId,
    encryptedDek,
    dekVersion: 1,
    rotatedAtMs: now,
    createdAtMs: now,
    updatedAtMs: now,
  });

  return dekBytes;
}

/**
 * Encrypts a variable plaintext value using the project's DEK.
 */
export async function encryptSecretValueForProject(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
    plaintext: string;
  },
): Promise<string> {
  const dekBytes = await ensureProjectDek(ctx, {
    projectId: args.projectId,
    orgId: args.orgId,
  });

  return encryptUtf8WithKey(dekBytes, args.plaintext);
}

/**
 * Decrypts a variable ciphertext value using the current project DEK.
 */
export async function decryptSecretValueForProject(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
    encryptedValue: string;
  },
): Promise<string> {
  const masterKeyBytes = getMasterKeyBytes();
  const keyRows = await listProjectKeyRows(ctx, args.projectId);
  if (keyRows.length === 0) {
    throw new EncryptionError({
      message: "Project DEK is missing.",
    });
  }

  const canonical = pickCanonicalProjectKeyRow(keyRows);
  const orderedRows =
    canonical === null
      ? keyRows
      : [canonical, ...keyRows.filter((row) => row._id !== canonical._id)];

  let lastError: unknown = null;
  for (const row of orderedRows) {
    try {
      const dekBytes = unwrapDekWithMasterKey(masterKeyBytes, row.encryptedDek);
      return decryptUtf8WithKey(dekBytes, args.encryptedValue);
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw (
    lastError ??
    new EncryptionError({
      message: "Failed to decrypt project secret.",
    })
  );
}
