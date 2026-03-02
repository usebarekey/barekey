import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const AES_GCM_ALGORITHM = "AES-GCM";
const DEK_BYTES_LENGTH = 32;
const GCM_IV_BYTES_LENGTH = 12;
const MASTER_KEY_ENV_NAME = "BAREKEY_MASTER_KEY_B64";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeCiphertext(ivBytes: Uint8Array, encryptedBytes: Uint8Array): string {
  return `${bytesToBase64(ivBytes)}.${bytesToBase64(encryptedBytes)}`;
}

function decodeCiphertext(payload: string): { ivBytes: Uint8Array; encryptedBytes: Uint8Array } {
  const [ivBase64, encryptedBase64] = payload.split(".", 2);
  if (!ivBase64 || !encryptedBase64) {
    throw new Error("Encrypted payload format is invalid.");
  }

  return {
    ivBytes: base64ToBytes(ivBase64),
    encryptedBytes: base64ToBytes(encryptedBase64),
  };
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function getMasterKeyBytes(): Uint8Array {
  const masterKeyBase64 = process.env[MASTER_KEY_ENV_NAME];
  if (!masterKeyBase64) {
    throw new Error(`Missing ${MASTER_KEY_ENV_NAME}.`);
  }

  const bytes = base64ToBytes(masterKeyBase64);
  if (bytes.length !== DEK_BYTES_LENGTH) {
    throw new Error(`${MASTER_KEY_ENV_NAME} must decode to exactly 32 bytes.`);
  }

  return bytes;
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    {
      name: AES_GCM_ALGORITHM,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptStringWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const ivBytes = randomBytes(GCM_IV_BYTES_LENGTH);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: toArrayBuffer(ivBytes),
    },
    key,
    toArrayBuffer(plaintextBytes),
  );

  return encodeCiphertext(ivBytes, new Uint8Array(encryptedBuffer));
}

async function decryptStringWithKey(key: CryptoKey, payload: string): Promise<string> {
  const { ivBytes, encryptedBytes } = decodeCiphertext(payload);
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: toArrayBuffer(ivBytes),
    },
    key,
    toArrayBuffer(encryptedBytes),
  );

  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Ensures a project has a DEK wrapped by the master KEK and returns the
 * unwrapped DEK key for one request.
 *
 * The returned DEK must never be cached or persisted. This helper unwraps on
 * demand so requests remain stateless and key material stays ephemeral.
 */
export async function ensureProjectDek(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
  },
): Promise<CryptoKey> {
  const existingKeyRow = await ctx.db
    .query("projectKeys")
    .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
    .unique();
  const masterKey = await importAesKey(getMasterKeyBytes());

  if (existingKeyRow !== null) {
    const dekBytesBase64 = await decryptStringWithKey(masterKey, existingKeyRow.encryptedDek);
    return importAesKey(base64ToBytes(dekBytesBase64));
  }

  const now = Date.now();
  const dekBytes = randomBytes(DEK_BYTES_LENGTH);
  const encryptedDek = await encryptStringWithKey(masterKey, bytesToBase64(dekBytes));

  await ctx.db.insert("projectKeys", {
    projectId: args.projectId,
    orgId: args.orgId,
    encryptedDek,
    dekVersion: 1,
    rotatedAtMs: now,
    createdAtMs: now,
    updatedAtMs: now,
  });

  return importAesKey(dekBytes);
}

/**
 * Encrypts a variable plaintext value using the project's DEK.
 *
 * This enforces envelope encryption: values are encrypted with a per-project
 * DEK while the DEK itself is wrapped by the master KEK in the key table.
 */
export async function encryptSecretValueForProject(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
    plaintext: string;
  },
): Promise<string> {
  const dek = await ensureProjectDek(ctx, {
    projectId: args.projectId,
    orgId: args.orgId,
  });

  return encryptStringWithKey(dek, args.plaintext);
}

/**
 * Decrypts a variable ciphertext value using the current project DEK.
 *
 * Decryption is request-scoped and returns plaintext only for immediate UI/API
 * response needs. Callers must not persist the returned plaintext.
 */
export async function decryptSecretValueForProject(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
    encryptedValue: string;
  },
): Promise<string> {
  const dek = await ensureProjectDek(ctx, {
    projectId: args.projectId,
    orgId: args.orgId,
  });

  return decryptStringWithKey(dek, args.encryptedValue);
}
