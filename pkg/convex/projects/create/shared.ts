import { Either, Schema } from "effect";
import { makeFunctionReference } from "convex/server";

import { ExternalServiceError } from "../../lib/errors/effect";
import type { ProjectSummary } from "../types";

export type CreateForCurrentOrgArgs = {
  expectedOrgSlug: string;
  name: string;
};

export const createForCurrentOrgArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  name: Schema.String,
});

const errorWithMessageSchema = Schema.instanceOf(Error).pipe(
  Schema.filter((error) => error.message.length > 0),
);

export const createForCurrentOrgInternalReference = makeFunctionReference<
  "mutation",
  CreateForCurrentOrgArgs,
  ProjectSummary
>("projects:createForCurrentOrgInternal") as any;

/**
 * Normalizes unknown project-write failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps project create workflows from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toProjectWriteError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  const decodedError = Schema.decodeUnknownEither(errorWithMessageSchema)(error);
  return new ExternalServiceError({
    message: Either.isRight(decodedError) ? decodedError.right.message : fallbackMessage,
    cause: error,
  });
}
