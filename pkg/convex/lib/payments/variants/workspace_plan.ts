import type { ActionCtx } from "../../../_generated/server";
import { throwBillingError, throwExternalServiceError } from "../../errors/effect";
import { getFreePlanCreditForOrgIdInternalReference } from "../../../payments/refs";
import {
  BILLING_UNAVAILABLE_ERROR_MESSAGE,
  BillingTier,
  PLANLESS_WORKSPACE_ERROR_MESSAGE,
  type DefaultVariant,
} from "../catalog";
import { createAutumnClient } from "./client";
import {
  normalizeString,
  type WorkspacePlanState,
} from "./shared";
import {
  readCurrentVariantFromProductId,
} from "./pricing";

type CustomerProduct = {
  id: string;
  status: string;
};

/**
 * Reads normalized customer products from raw Autumn customer payloads.
 *
 * @param customerData The raw Autumn customer payload.
 * @returns The normalized customer products.
 * @remarks Invalid or incomplete product records are ignored.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readCustomerProducts(customerData: unknown): Array<CustomerProduct> {
  if (typeof customerData !== "object" || customerData === null) {
    return [];
  }
  const products = (customerData as { products?: unknown }).products;
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .map((product) => {
      if (typeof product !== "object" || product === null) {
        return null;
      }
      const record = product as Record<string, unknown>;
      const status = normalizeString(record.status);
      const id = normalizeString(record.id) ?? normalizeString(record.product_id);
      if (id === null || status === null) {
        return null;
      }
      return { id, status };
    })
    .filter((value): value is CustomerProduct => value !== null);
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
 * @param ctx The Convex action context.
 * @param input The organization identity.
 * @returns `true` when a free-plan credit is assigned.
 * @remarks This is used to distinguish a real free workspace from a planless org.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function hasFreePlanCreditAssignedToOrg(
  ctx: ActionCtx,
  input: {
    orgId: string;
  },
): Promise<boolean> {
  const credit = await ctx.runQuery(getFreePlanCreditForOrgIdInternalReference, {
    orgId: input.orgId,
  });
  return credit !== null;
}

/**
 * Reads the current workspace plan state for an organization.
 *
 * @param ctx The Convex action context.
 * @param input The organization identity.
 * @returns The current product id and billing tier.
 * @remarks This throws stable billing errors when Autumn is unavailable or the org has no active plan.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function readWorkspacePlanStateForOrg(
  ctx: ActionCtx,
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
    const hasAssignedFreePlanCredit = await hasFreePlanCreditAssignedToOrg(ctx, {
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
