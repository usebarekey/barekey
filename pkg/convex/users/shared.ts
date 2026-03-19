import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Either, Effect, Schema } from "effect";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dbCollectEffect } from "../lib/convex/db";

const RESERVED_USER_SLUG_BASES = new Set([
  "auth",
  "api",
  "o",
  "u",
  "orgs",
  "new",
  "select",
  "settings",
  "me",
  "@",
]);

export const userRecordFields = {
  clerkUserId: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  email: v.union(v.string(), v.null()),
  displayName: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
};

export const userRecordValidator = v.object(userRecordFields);

export const userRecordSchema = Schema.Struct({
  clerkUserId: Schema.String,
  slug: Schema.String,
  slugBase: Schema.String,
  email: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
});

export const userAccountRecordValidator = v.object({
  ...userRecordFields,
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  lastSeenAtMs: v.number(),
});

export const currentUserFreePlanCreditValidator = v.object({
  totalCredits: v.number(),
  remainingCredits: v.number(),
  assignedOrgId: v.union(v.string(), v.null()),
  assignedOrgSlug: v.union(v.string(), v.null()),
});

export const userAccountRecordSchema = Schema.Struct({
  _id: ConfectId.Id("users"),
  clerkUserId: Schema.String,
  slug: Schema.String,
  slugBase: Schema.String,
  email: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
  createdAtMs: Schema.Number,
  updatedAtMs: Schema.Number,
  lastSeenAtMs: Schema.Number,
});

export type UserRow = {
  _id: Id<"users">;
  clerkUserId: string;
  slug: string;
  slugBase: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  lastSeenAtMs: number;
};

/**
 * Normalizes a slug base from free-form user text.
 *
 * @param value The source email local-part or display name.
 * @returns A lowercase alphanumeric slug base capped to 20 characters.
 * @remarks Reserved user slug bases are rewritten with a `user` suffix.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeSlugBaseFromText(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (normalized.length === 0) {
    return "user";
  }

  if (RESERVED_USER_SLUG_BASES.has(normalized)) {
    return `${normalized}user`.slice(0, 20);
  }

  return normalized;
}

/**
 * Derives the preferred user slug base from identity fields.
 *
 * @param email The Clerk email value, if present.
 * @param name The Clerk display name, if present.
 * @returns A normalized slug base for user creation.
 * @remarks Email local-part wins over display name because it is usually more stable.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function deriveUserSlugBase(
  email: string | undefined,
  name: string | undefined,
): string {
  const emailLocalPart = email?.split("@")[0];
  if (emailLocalPart && emailLocalPart.length > 0) {
    return normalizeSlugBaseFromText(emailLocalPart);
  }

  if (name && name.length > 0) {
    return normalizeSlugBaseFromText(name);
  }

  return "user";
}

/**
 * Generates a zero-padded numeric suffix for user slug allocation.
 *
 * @param length The suffix length to generate.
 * @returns A numeric string of the requested length.
 * @remarks This is used only for candidate generation and does not guarantee uniqueness.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

/**
 * Chooses the canonical row from a possibly duplicated user-like record set.
 *
 * @param rows The rows to evaluate.
 * @returns The oldest stable row, or `null` when no rows exist.
 * @remarks Ties break by row id so canonical selection stays deterministic.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function pickCanonicalUserRow<T extends { _id: string; createdAtMs: number }>(
  rows: Array<T>,
): T | null {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    if (left.createdAtMs !== right.createdAtMs) {
      return left.createdAtMs - right.createdAtMs;
    }
    return String(left._id).localeCompare(String(right._id));
  })[0] ?? null;
}

/**
 * Loads the canonical user row for a Clerk user id.
 *
 * @param ctx The Convex query or mutation context.
 * @param clerkUserId The Clerk user id to resolve.
 * @returns The canonical user row, or `null`.
 * @remarks Duplicate rows collapse to the oldest deterministic record.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCanonicalUserByClerkUserId(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<UserRow | null> {
  const rows = await Effect.runPromise(
    dbCollectEffect<UserRow, Error>(
      ctx,
      "users",
      (query) =>
        query.withIndex("by_clerk_user_id", (indexQuery) =>
          indexQuery.eq("clerkUserId", clerkUserId),
        ),
      (error) => {
        const decodedError = Schema.decodeUnknownEither(Schema.instanceOf(Error))(error);
        return Either.isRight(decodedError)
          ? decodedError.right
          : new Error("Failed to load users by Clerk id.");
      },
    ),
  );
  return pickCanonicalUserRow(rows);
}

/**
 * Loads the canonical user row for a public slug.
 *
 * @param ctx The Convex query or mutation context.
 * @param slug The user slug to resolve.
 * @returns The canonical user row, or `null`.
 * @remarks Duplicate rows collapse to the oldest deterministic record.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCanonicalUserBySlug(
  ctx: QueryCtx | MutationCtx,
  slug: string,
): Promise<UserRow | null> {
  const rows = await Effect.runPromise(
    dbCollectEffect<UserRow, Error>(
      ctx,
      "users",
      (query) => query.withIndex("by_slug", (indexQuery) => indexQuery.eq("slug", slug)),
      (error) => {
        const decodedError = Schema.decodeUnknownEither(Schema.instanceOf(Error))(error);
        return Either.isRight(decodedError)
          ? decodedError.right
          : new Error("Failed to load users by slug.");
      },
    ),
  );
  return pickCanonicalUserRow(rows);
}
