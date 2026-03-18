import { v } from "convex/values";

import {
  AuthError,
  BillingError,
  ExternalServiceError,
  ValidationError,
} from "../../lib/errors/effect";
import type { WorkspacePlanStatusResponse } from "../types";

export type WorkspacePlanAssertionArgs = {
  orgId: string;
  orgSlug: string | null;
};

export type WorkspacePlanAssertionResult = {
  orgId: string;
  currentProductId: string;
  currentTier: "free" | "pro" | "max" | null;
};

export const workspacePlanStatusResponseValidator = v.object({
  orgId: v.string(),
  orgRole: v.union(v.string(), v.null()),
  canManageBilling: v.boolean(),
  currentProductId: v.union(v.string(), v.null()),
  currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  currentInterval: v.union(v.literal("monthly"), v.literal("annually"), v.null()),
  currentOverageMode: v.union(
    v.literal("without_overages"),
    v.literal("with_overages"),
    v.null(),
  ),
  isPlanless: v.boolean(),
  billingUnavailable: v.boolean(),
});

export const workspacePlanAssertionResultValidator = v.object({
  orgId: v.string(),
  currentProductId: v.string(),
  currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
});

export type WorkspacePlanEffectError =
  | AuthError
  | BillingError
  | ExternalServiceError
  | ValidationError;

export type { WorkspacePlanStatusResponse };

/**
 * Normalizes unknown workspace-plan failures into the shared backend error model.
 *
 * @param fallbackMessage The message to use when the thrown value is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed backend error suitable for Effect boundaries.
 * @remarks Existing typed auth, validation, billing, and service errors are preserved.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toWorkspacePlanError(
  fallbackMessage: string,
  error: unknown,
): WorkspacePlanEffectError {
  if (
    error instanceof AuthError ||
    error instanceof BillingError ||
    error instanceof ExternalServiceError ||
    error instanceof ValidationError
  ) {
    return error;
  }

  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
