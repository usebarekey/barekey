import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { runtimeConfig } from "./runtime_config";

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
  const bytes = base64ToBytes(runtimeConfig.barekeyMasterKeyBase64);
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

async function unwrapProjectDek(masterKey: CryptoKey, encryptedDek: string): Promise<CryptoKey> {
  const dekBytesBase64 = await decryptStringWithKey(masterKey, encryptedDek);
  return importAesKey(base64ToBytes(dekBytesBase64));
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
  const existingKeyRows = await listProjectKeyRows(ctx, args.projectId);
  const existingKeyRow = pickCanonicalProjectKeyRow(existingKeyRows);
  const masterKey = await importAesKey(getMasterKeyBytes());

  if (existingKeyRow !== null) {
    return unwrapProjectDek(masterKey, existingKeyRow.encryptedDek);
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
  const masterKey = await importAesKey(getMasterKeyBytes());
  const keyRows = await listProjectKeyRows(ctx, args.projectId);
  if (keyRows.length === 0) {
    throw new Error("Project DEK is missing.");
  }

  const canonical = pickCanonicalProjectKeyRow(keyRows);
  const orderedRows =
    canonical === null
      ? keyRows
      : [canonical, ...keyRows.filter((row) => row._id !== canonical._id)];

  let lastError: unknown = null;
  for (const row of orderedRows) {
    try {
      const dek = await unwrapProjectDek(masterKey, row.encryptedDek);
      return await decryptStringWithKey(dek, args.encryptedValue);
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to decrypt project secret.");
}
