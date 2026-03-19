import { Either, Schema } from "effect";

import type { FeatureUsage } from "../state";

const nonEmptyStringSchema = Schema.String.pipe(Schema.minLength(1));
const optionalNullableStringSchema = Schema.optional(Schema.NullOr(nonEmptyStringSchema));
const optionalNullableFiniteSchema = Schema.optional(Schema.NullOr(Schema.Finite));
const optionalNullableBooleanSchema = Schema.optional(Schema.NullOr(Schema.Boolean));

const autumnProductItemSchema = Schema.Struct({
  price: optionalNullableFiniteSchema,
  billing_units: optionalNullableFiniteSchema,
  feature_id: optionalNullableStringSchema,
  interval: optionalNullableStringSchema,
  interval_count: optionalNullableFiniteSchema,
  included_usage: optionalNullableFiniteSchema,
});

const autumnProductSchema = Schema.Struct({
  id: optionalNullableStringSchema,
  items: Schema.optional(Schema.NullOr(Schema.Array(autumnProductItemSchema))),
});

const autumnProductListSchema = Schema.Struct({
  list: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});

const autumnCustomerProductSchema = Schema.Struct({
  id: optionalNullableStringSchema,
  product_id: optionalNullableStringSchema,
  status: optionalNullableStringSchema,
});

const autumnCustomerSchema = Schema.Struct({
  products: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
});

const autumnFeatureUsageSchema = Schema.Struct({
  allowed: Schema.Boolean,
  usage: optionalNullableFiniteSchema,
  included_usage: optionalNullableFiniteSchema,
  usage_limit: optionalNullableFiniteSchema,
  overage_allowed: optionalNullableBooleanSchema,
  next_reset_at: optionalNullableFiniteSchema,
});

const autumnPortalSchema = Schema.Struct({
  url: optionalNullableStringSchema,
  portal_url: optionalNullableStringSchema,
});

const autumnAttachSchema = Schema.Struct({
  checkout_url: optionalNullableStringSchema,
});

const autumnErrorSchema = Schema.Struct({
  message: optionalNullableStringSchema,
  error: optionalNullableStringSchema,
});
const nonEmptyAutumnErrorMessageSchema = Schema.String.pipe(Schema.minLength(1));
const autumnThrownErrorSchema = Schema.instanceOf(Error).pipe(
  Schema.filter((error) => error.message.length > 0),
);

export type AutumnProductItem = {
  price?: number | null;
  billing_units?: number | null;
  feature_id?: string | null;
  interval?: string | null;
  interval_count?: number | null;
  included_usage?: number | null;
};

export type AutumnProduct = {
  id?: string | null;
  items?: ReadonlyArray<AutumnProductItem> | null;
};
export type AutumnCustomerProduct = {
  id: string;
  status: string;
};

function decodeAutumnOrFallback<A>(
  schema: Schema.Schema<A, any, never>,
  input: unknown,
  fallback: A,
): A {
  const decoded = Schema.decodeUnknownEither(schema)(input);
  return Either.isRight(decoded) ? decoded.right : fallback;
}

/**
 * Decodes Autumn product-list payloads into typed product records.
 *
 * @param input The raw Autumn product-list payload.
 * @returns The decoded products, or an empty list when the payload is invalid.
 * @remarks Invalid payloads are ignored so pricing can safely fall back to baked-in defaults.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeAutumnProductList(input: unknown): ReadonlyArray<AutumnProduct> {
  const decoded = decodeAutumnOrFallback(autumnProductListSchema, input, {
    list: [],
  });
  return (decoded.list ?? []).flatMap((product) => {
    const productResult = Schema.decodeUnknownEither(autumnProductSchema)(product);
    return Either.isRight(productResult) ? [productResult.right] : [];
  });
}

/**
 * Decodes Autumn customer payloads into normalized product rows.
 *
 * @param input The raw Autumn customer payload.
 * @returns The decoded customer products with usable ids and statuses.
 * @remarks Products missing either an id or a status are discarded after schema decoding.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeAutumnCustomerProducts(input: unknown): ReadonlyArray<AutumnCustomerProduct> {
  const decoded = decodeAutumnOrFallback(autumnCustomerSchema, input, {
    products: [],
  });

  return (decoded.products ?? []).flatMap((product) => {
    const productResult = Schema.decodeUnknownEither(autumnCustomerProductSchema)(product);
    if (Either.isLeft(productResult)) {
      return [];
    }

    const id = productResult.right.id ?? productResult.right.product_id ?? null;
    const status = productResult.right.status ?? null;
    return id !== null && status !== null ? [{ id, status }] : [];
  });
}

/**
 * Decodes the billing portal URL from an Autumn portal payload.
 *
 * @param input The raw Autumn portal payload.
 * @returns The decoded portal URL, or `null`.
 * @remarks Autumn may provide the URL under either `url` or `portal_url`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeAutumnPortalUrl(input: unknown): string | null {
  const decoded = decodeAutumnOrFallback(autumnPortalSchema, input, {
    url: null,
    portal_url: null,
  });
  return decoded.url ?? decoded.portal_url ?? null;
}

/**
 * Decodes the checkout URL from an Autumn attach payload.
 *
 * @param input The raw Autumn attach payload.
 * @returns The decoded checkout URL, or `null`.
 * @remarks This is used to distinguish immediate plan application from checkout handoff.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeAutumnCheckoutUrl(input: unknown): string | null {
  const decoded = decodeAutumnOrFallback(autumnAttachSchema, input, {
    checkout_url: null,
  });
  return decoded.checkout_url ?? null;
}

/**
 * Decodes normalized feature-usage state from Autumn usage payloads.
 *
 * @param input The feature id and raw Autumn payload.
 * @returns The decoded feature-usage state, or `null` when the payload is invalid.
 * @remarks This keeps the UI-facing usage shape stable while avoiding raw field probing.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeAutumnFeatureUsage(input: {
  featureId: string;
  data: unknown;
}): FeatureUsage | null {
  const decoded = Schema.decodeUnknownEither(autumnFeatureUsageSchema)(input.data);
  if (Either.isLeft(decoded)) {
    return null;
  }

  return {
    featureId: input.featureId,
    allowed: decoded.right.allowed,
    usage: decoded.right.usage ?? null,
    includedUsage: decoded.right.included_usage ?? null,
    usageLimit: decoded.right.usage_limit ?? null,
    overageAllowed: decoded.right.overage_allowed ?? null,
    nextResetAtMs: decoded.right.next_reset_at ?? null,
  };
}

/**
 * Reads a stable message string from Autumn-style error payloads.
 *
 * @param input The raw Autumn error payload.
 * @returns The decoded message, or `null`.
 * @remarks This prefers schema-decoded object payloads while still supporting thrown strings and `Error` instances.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readAutumnErrorMessage(input: unknown): string | null {
  const decodedString = Schema.decodeUnknownEither(nonEmptyAutumnErrorMessageSchema)(input);
  if (Either.isRight(decodedString)) {
    return decodedString.right;
  }

  const decodedError = Schema.decodeUnknownEither(autumnThrownErrorSchema)(input);
  if (Either.isRight(decodedError)) {
    return decodedError.right.message;
  }

  const decoded = Schema.decodeUnknownEither(autumnErrorSchema)(input);
  if (Either.isLeft(decoded)) {
    return null;
  }

  return decoded.right.message ?? decoded.right.error ?? null;
}
