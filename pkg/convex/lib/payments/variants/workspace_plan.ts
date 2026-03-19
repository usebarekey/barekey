import type { ActionCtx } from "../../../_generated/server";
import { throwBillingError, throwExternalServiceError } from "../../errors/effect";
import { getFreePlanCreditForOrgIdInternalReference } from "../../../payments/refs";
import {
  BILLING_UNAVAILABLE_ERROR_MESSAGE,
  BillingTier,
  PLANLESS_WORKSPACE_ERROR_MESSAGE,
} from "../catalog";
import { createAutumnClient } from "./client";
import {
  type WorkspacePlanState,
} from "./shared";
import { decodeAutumnCustomerProducts, type AutumnCustomerProduct } from "./schema";
import {
  readCurrentVariantFromProductId,
} from "./pricing";

/**
 * Reads normalized customer products from raw Autumn customer payloads.
 *
 * @param customerData The raw Autumn customer payload.
 * @returns The normalized customer products.
 * @remarks Invalid or incomplete product records are ignored.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readCustomerProducts(customerData: unknown): Array<AutumnCustomerProduct> {
  return [...decodeAutumnCustomerProducts(customerData)];
}

/**
 * Reads the current effective product id from Autumn customer data.
 *
 * @param customerData The raw Autumn customer payload.
 * @returns The current active-like product id, or `null`.
 * @remarks Product precedence favors active, then trialing, past due, and scheduled records.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readCurrentProductId(customerData: unknown): string | null {
  const normalized = readCustomerProducts(customerData);
  const active =
    normalized.find((entry) => entry.status === "active") ??
    normalized.find((entry) => entry.status === "trialing") ??
    normalized.find((entry) => entry.status === "past_due") ??
    normalized.find((entry) => entry.status === "scheduled");
  return active?.id ?? null;
}

/**
 * Ensures Autumn has a customer record for the given org.
 *
 * @param input The organization identity.
 * @returns The raw Autumn create/read result envelope.
 * @remarks Autumn's create call is idempotent for existing customers in this flow.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function ensureAutumnCustomerForOrg(input: {
  orgId: string;
  orgSlug: string | null;
}): Promise<{
  data: unknown;
  error: unknown;
}> {
  const autumn = createAutumnClient();
  const result = await autumn.customers.create({
    id: input.orgId,
    name: input.orgSlug ?? input.orgId,
  });
  return {
    data: result.data,
    error: result.error,
  };
}

/**
 * Returns whether a free-plan credit is currently assigned to the org.
 *
 * @param convexCtx The Convex action context.
 * @param input The organization identity.
 * @returns `true` when a free-plan credit is assigned.
 * @remarks This is used to distinguish a real free workspace from a planless org.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function hasFreePlanCreditAssignedToOrg(
  convexCtx: ActionCtx,
  input: {
    orgId: string;
  },
): Promise<boolean> {
  const credit = await convexCtx.runQuery(getFreePlanCreditForOrgIdInternalReference, {
    orgId: input.orgId,
  });
  return credit !== null;
}

/**
 * Reads the current workspace plan state for an organization.
 *
 * @param convexCtx The Convex action context.
 * @param input The organization identity.
 * @returns The current product id and billing tier.
 * @remarks This throws stable billing errors when Autumn is unavailable or the org has no active plan.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function readWorkspacePlanStateForOrg(
  convexCtx: ActionCtx,
  input: {
    orgId: string;
    orgSlug: string | null;
  },
): Promise<WorkspacePlanState> {
  const customerResult = await ensureAutumnCustomerForOrg(input);
  if (customerResult.error !== null) {
    return throwExternalServiceError(BILLING_UNAVAILABLE_ERROR_MESSAGE, customerResult.error);
  }

  const currentProductId = readCurrentProductId(customerResult.data);
  if (currentProductId === null) {
    return throwBillingError(PLANLESS_WORKSPACE_ERROR_MESSAGE);
  }

  const currentVariant = readCurrentVariantFromProductId(currentProductId);
  if (currentVariant?.tier === BillingTier.Free) {
    const hasAssignedFreePlanCredit = await hasFreePlanCreditAssignedToOrg(convexCtx, {
      orgId: input.orgId,
    });
    if (!hasAssignedFreePlanCredit) {
      return throwBillingError(PLANLESS_WORKSPACE_ERROR_MESSAGE);
    }
  }

  return {
    currentProductId,
    currentTier: currentVariant?.tier ?? null,
  };
}
