import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { EncryptionError } from "../errors/effect";
import { DEK_BYTES_LENGTH } from "./constants";
import {
  getMasterKeyBytes,
  randomBytes,
} from "./keys";
import {
  decryptUtf8WithKey,
  unwrapDekWithMasterKey,
  wrapDekWithMasterKey,
  encryptUtf8WithKey,
} from "./cipher";

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
 * Ensures a project has a wrapped DEK row and returns the unwrapped DEK bytes for the current request.
 *
 * @param ctx The Convex mutation context.
 * @param args The project and organization identifiers owning the DEK.
 * @returns The unwrapped 32-byte DEK for the project.
 * @remarks This lazily creates the canonical `projectKeys` row when one does not already exist.
 * @lastModified 2026-03-17
 * @author GPT-5.4
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
 *
 * @param ctx The Convex mutation context.
 * @param args The project/org selector and plaintext value to encrypt.
 * @returns The encrypted `xcp1` ciphertext envelope.
 * @remarks This ensures the project has a DEK before encrypting the provided plaintext.
 * @lastModified 2026-03-17
 * @author GPT-5.4
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
 * Decrypts a project variable ciphertext with the current canonical project DEK set.
 *
 * @param ctx The Convex mutation context.
 * @param args The project/org selector and ciphertext value to decrypt.
 * @returns The decrypted UTF-8 plaintext.
 * @remarks This tries the canonical DEK row first and then falls back across remaining rows to tolerate old duplicate keys.
 * @lastModified 2026-03-17
 * @author GPT-5.4
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
