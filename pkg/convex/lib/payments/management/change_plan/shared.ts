import { ExternalServiceError } from "../../../errors/effect";

export type ChangePlanForCurrentOrgArgs = {
  expectedOrgSlug: string;
  tier: "free" | "pro" | "max";
  interval: "monthly" | "annually";
  overageMode: "without_overages" | "with_overages";
  successUrl: string | null;
};

export type ChangePlanForCurrentOrgResult = {
  attachedProductId: string;
  checkoutRequired: boolean;
  checkoutUrl: string | null;
  changeOutcome: "applied" | "scheduled" | "submitted";
  effectiveProductId: string | null;
};

export type BillingPlanAuditArgs = {
  orgId: string;
  orgSlug: string | null;
  clerkUserId: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  expectedOrgSlug: string;
  title: string;
  description: string;
  currentProductId: string | null;
  attachedProductId: string;
  effectiveProductId?: string | null;
  changeOutcome: "applied" | "scheduled" | "submitted";
  targetTier: "free" | "pro" | "max";
  targetInterval: "monthly" | "annually";
  targetOverageMode: "without_overages" | "with_overages";
};

/**
 * Normalizes billing plan-change failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the thrown value is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps the checkout, billing snapshot, and audit flows on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toBillingPlanChangeError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
