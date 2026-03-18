import type { ReserveErrorClassification } from "./types";

/**
 * Classifies billing-reservation failures into stable HTTP-facing error envelopes.
 *
 * @param error The thrown billing reservation error.
 * @returns The normalized billing error classification.
 * @remarks Unknown failures collapse to a generic billing-unavailable response.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function classifyReserveError(error: unknown): ReserveErrorClassification {
  const message =
    error instanceof Error ? error.message : "Billing service is temporarily unavailable.";
  if (
    message === "Usage limit exceeded for this workspace plan." ||
    message === "This workspace is without a plan. Choose a billing plan to enable projects."
  ) {
    return {
      isBillingRelated: true,
      status: 402,
      code: "USAGE_LIMIT_EXCEEDED",
      message,
    };
  }
  if (message === "Billing service is temporarily unavailable.") {
    return {
      isBillingRelated: true,
      status: 503,
      code: "BILLING_UNAVAILABLE",
      message,
    };
  }
  return {
    isBillingRelated: false,
    status: 503,
    code: "BILLING_UNAVAILABLE",
    message: "Billing service is temporarily unavailable.",
  };
}

/**
 * Builds the idempotency key used for billing request logging.
 *
 * @param request The incoming HTTP request.
 * @param requestId The generated request id.
 * @param scope The logical billing scope for the route.
 * @returns The scoped billing request key.
 * @remarks When the client omits `x-barekey-request-key`, the request id becomes the suffix.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readBillingRequestKey(
  request: Request,
  requestId: string,
  scope: string,
): string {
  const headerValue = request.headers.get("x-barekey-request-key")?.trim();
  const suffix = headerValue && headerValue.length > 0 ? headerValue : requestId;
  return `${scope}:${suffix}`;
}
