import {
  type BillingIntervalValue,
  type BillingTierValue,
} from "../catalog";

export type WorkspacePlanState = {
  currentProductId: string;
  currentTier: BillingTierValue | null;
};

/**
 * Normalizes unknown values into finite numbers.
 *
 * @param input The raw value to inspect.
 * @returns The finite number, or `null`.
 * @remarks This is used when reading Autumn payloads with loose JSON typing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeFiniteNumber(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

/**
 * Normalizes unknown values into non-empty strings.
 *
 * @param input The raw value to inspect.
 * @returns The non-empty string, or `null`.
 * @remarks Empty strings are treated as absent when decoding Autumn payloads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeString(input: unknown): string | null {
  return typeof input === "string" && input.length > 0 ? input : null;
}

/**
 * Detects Autumn's force-checkout upgrade/downgrade error variant.
 *
 * @param error The thrown error payload.
 * @returns `true` when the payload appears to be the known Autumn checkout error.
 * @remarks This is used to branch user-facing billing-plan guidance.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function hasForceCheckoutUpgradeDowngradeError(error: unknown): boolean {
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error) ?? "";
  const normalized = text.toLowerCase();
  return (
    normalized.includes("force_checkout") &&
    normalized.includes("upgrade") &&
    normalized.includes("downgrade")
  );
}

/**
 * Returns whether the current organization role may manage billing.
 *
 * @param role The Clerk org role.
 * @returns `true` for billing-capable org roles.
 * @remarks Billing management is currently limited to org admins and owners.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function isBillingManagerRole(role: string | null): boolean {
  return role === "org:admin" || role === "org:owner";
}

/**
 * Normalizes recurring Autumn prices into monthly USD amounts.
 *
 * @param input The recurring price input.
 * @returns The monthly normalized price.
 * @remarks Yearly prices are divided into 12-month equivalents for UI comparison.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeRecurringPriceToMonthly(input: {
  price: number;
  interval: string | null;
  intervalCount: number | null;
}): number {
  const count = input.intervalCount !== null && input.intervalCount > 0 ? input.intervalCount : 1;
  if (input.interval === "year") {
    return input.price / (count * 12);
  }
  if (input.interval === "month") {
    return input.price / count;
  }
  return input.price;
}

export type CurrentVariantSelection = {
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: import("../catalog").OverageModeValue;
};
