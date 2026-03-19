import { throwValidationError } from "../../../errors/effect";
import {
  DEFAULT_VARIANTS,
  type BillingIntervalValue,
  type BillingTierValue,
  type BillingVariant,
  type DefaultVariant,
  type OverageModeValue,
} from "../../catalog";
import type { CurrentVariantSelection } from "../shared";

/**
 * Resolves the configured product id for a tier/interval/overage selection.
 *
 * @param input The desired billing variant dimensions.
 * @returns The matching Autumn product id.
 * @remarks This throws when the requested combination is not present in the default variant matrix.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function resolveProductId(input: {
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
}): string {
  const match = DEFAULT_VARIANTS.find(
    (entry) =>
      entry.tier === input.tier &&
      entry.interval === input.interval &&
      entry.overageMode === input.overageMode,
  );
  if (!match) {
    return throwValidationError("Unable to resolve the requested billing plan.");
  }
  return match.productId;
}

/**
 * Resolves the matching billing variant from a variant list.
 *
 * @param input The variant list and desired selection dimensions.
 * @returns The matching billing variant.
 * @remarks This throws when no variant matches the requested selection.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function resolveVariant(input: {
  variants: Array<BillingVariant>;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
}): BillingVariant {
  const match = input.variants.find(
    (entry) =>
      entry.tier === input.tier &&
      entry.interval === input.interval &&
      entry.overageMode === input.overageMode,
  );
  if (!match) {
    return throwValidationError("Unable to resolve the requested billing plan.");
  }
  return match;
}

/**
 * Reads the billing-variant dimensions implied by a product id.
 *
 * @param input The Autumn product id.
 * @returns The fallback variant dimensions, or `null`.
 * @remarks This uses the baked-in default variant matrix because Autumn product metadata is not yet normalized for this.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readCurrentVariantFromProductId(
  input: string | null,
): CurrentVariantSelection | null {
  if (input === null) {
    return null;
  }

  const matched = DEFAULT_VARIANTS.find((variant) => variant.productId === input);
  if (!matched) {
    return null;
  }

  return {
    tier: matched.tier,
    interval: matched.interval,
    overageMode: matched.overageMode,
  };
}

/**
 * Reads the baked-in default variant for a product id.
 *
 * @param input The Autumn product id.
 * @returns The default variant, or `null`.
 * @remarks This is used as a stable fallback when Autumn data is unavailable or incomplete.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readDefaultVariantByProductId(input: string | null): DefaultVariant | null {
  if (input === null) {
    return null;
  }
  return DEFAULT_VARIANTS.find((variant) => variant.productId === input) ?? null;
}
