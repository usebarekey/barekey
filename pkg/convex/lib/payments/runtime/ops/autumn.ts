import { Effect } from "effect";

import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import { ExternalServiceError } from "../../../errors/effect";
import { runActionEffect } from "../../../convex/functions";
import type { FeatureUsage } from "../../state";
import { decodeAutumnFeatureUsage, decodeAutumnPortalUrl } from "../../variants";

function toAutumnRuntimeError(message: string, cause: unknown) {
  return new ExternalServiceError({ message, cause });
}

/**
 * Checks Autumn feature usage and decodes it into the UI-facing usage shape.
 *
 * @param ctx The Convex action context.
 * @param featureId The feature identifier to inspect.
 * @returns The normalized feature usage payload.
 * @remarks Missing or malformed Autumn responses are normalized into a disabled usage payload.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function readFeatureUsageFromAutumn(
  ctx: ActionCtx,
  featureId: string,
): Promise<FeatureUsage> {
  const result = await Effect.runPromise(
    runActionEffect<
      { error: unknown | null; data: unknown | null },
      ExternalServiceError
    >(
      ctx,
      api.autumn.check,
      {
        featureId,
      },
      (error) => toAutumnRuntimeError("Failed to check Autumn feature usage.", error),
    ),
  );

  if (result.error !== null || result.data === null) {
    return {
      featureId,
      allowed: false,
      usage: null,
      includedUsage: null,
      usageLimit: null,
      overageAllowed: null,
      nextResetAtMs: null,
    };
  }

  const decodedUsage = decodeAutumnFeatureUsage({
    featureId,
    data: result.data,
  });
  if (decodedUsage !== null) {
    return decodedUsage;
  }

  return {
    featureId,
    allowed: false,
    usage: null,
    includedUsage: null,
    usageLimit: null,
    overageAllowed: null,
    nextResetAtMs: null,
  };
}

/**
 * Ensures the Autumn billing customer exists.
 *
 * @param ctx The Convex action context.
 * @returns The raw Autumn create-customer result.
 * @remarks Billing handlers use this before portal access and other customer-scoped operations.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function ensureAutumnCustomer(ctx: ActionCtx) {
  return await Effect.runPromise(
    runActionEffect<unknown, ExternalServiceError>(
      ctx,
      api.autumn.createCustomer,
      {
        errorOnNotFound: false,
      },
      (error) => toAutumnRuntimeError("Failed to ensure the Autumn customer.", error),
    ),
  );
}

/**
 * Opens the Autumn billing portal and decodes the portal URL.
 *
 * @param ctx The Convex action context.
 * @param returnUrl The optional portal return URL.
 * @returns The decoded portal URL, or `null` when Autumn does not return one.
 * @remarks This centralizes portal access and response decoding for billing-management flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function openAutumnBillingPortal(
  ctx: ActionCtx,
  returnUrl: string | null,
): Promise<string | null> {
  const portalResult = await Effect.runPromise(
    runActionEffect<
      { error: unknown | null; data: unknown | null },
      ExternalServiceError
    >(
      ctx,
      api.autumn.billingPortal,
      {
        returnUrl: returnUrl ?? undefined,
      },
      (error) => toAutumnRuntimeError("Failed to open the Autumn billing portal.", error),
    ),
  );
  if (portalResult.error !== null || portalResult.data === null) {
    return null;
  }

  return decodeAutumnPortalUrl(portalResult.data);
}
