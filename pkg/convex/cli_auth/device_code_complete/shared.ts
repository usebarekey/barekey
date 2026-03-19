import { Either, Effect, Schema } from "effect";
import { v } from "convex/values";

import { ValidationError } from "../../lib/errors/effect";

const requiredUserCodeSchema = Schema.Trim.pipe(Schema.minLength(1));

export type CompleteDeviceCodeArgs = {
  userCode: string;
};

export type CompleteDeviceCodeInternalArgs = {
  userCode: string;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
};

export type CompletedDeviceCodeResult = {
  status: "completed";
  orgSlug: string;
};

export const completeDeviceCodeArgsSchema = Schema.Struct({
  userCode: Schema.String,
});

export const completeDeviceCodeInternalArgsSchema = Schema.Struct({
  userCode: Schema.String,
  clerkUserId: Schema.String,
  orgId: Schema.String,
  orgSlug: Schema.String,
});

export const completedDeviceCodeResultSchema = Schema.Struct({
  status: Schema.Literal("completed"),
  orgSlug: Schema.String,
});

export const completeDeviceCodeArgs = {
  userCode: v.string(),
} as const;

export const completeDeviceCodeInternalArgs = {
  userCode: v.string(),
  clerkUserId: v.string(),
  orgId: v.string(),
  orgSlug: v.string(),
} as const;

export const completedDeviceCodeResultValidator = v.object({
  status: v.literal("completed"),
  orgSlug: v.string(),
});

/**
 * Validates and normalizes a CLI user code from untrusted input.
 *
 * @param input The raw user code string.
 * @returns An Effect that succeeds with the canonical uppercased user code.
 * @remarks Empty codes fail with `ValidationError` before any database lookup runs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeUserCodeEffect(
  input: string,
): Effect.Effect<string, ValidationError> {
  const decoded = Schema.decodeUnknownEither(requiredUserCodeSchema)(input);
  return Either.isRight(decoded)
    ? Effect.succeed(decoded.right.toUpperCase())
    : Effect.fail(new ValidationError({ message: "Device code is required." }));
}
