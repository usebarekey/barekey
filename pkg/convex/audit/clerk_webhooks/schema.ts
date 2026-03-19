import { Either, Schema } from "effect";

const nonEmptyStringSchema = Schema.String.pipe(Schema.minLength(1));
const optionalNullableStringSchema = Schema.optional(Schema.NullOr(nonEmptyStringSchema));
const optionalNullableBooleanSchema = Schema.optional(Schema.NullOr(Schema.Boolean));

const clerkOrganizationSchema = Schema.Struct({
  id: optionalNullableStringSchema,
  slug: optionalNullableStringSchema,
  name: optionalNullableStringSchema,
});

const clerkPublicOrganizationSchema = Schema.Struct({
  slug: optionalNullableStringSchema,
  name: optionalNullableStringSchema,
});

const clerkPublicUserSchema = Schema.Struct({
  first_name: optionalNullableStringSchema,
  last_name: optionalNullableStringSchema,
  user_id: optionalNullableStringSchema,
  identifier: optionalNullableStringSchema,
});

const clerkWebhookDataSchema = Schema.Struct({
  id: optionalNullableStringSchema,
  slug: optionalNullableStringSchema,
  name: optionalNullableStringSchema,
  organization_id: optionalNullableStringSchema,
  created_by: optionalNullableStringSchema,
  image_url: optionalNullableStringSchema,
  email_address: optionalNullableStringSchema,
  user_id: optionalNullableStringSchema,
  role: optionalNullableStringSchema,
  status: optionalNullableStringSchema,
  has_image: optionalNullableBooleanSchema,
  organization: Schema.optional(Schema.NullOr(clerkOrganizationSchema)),
  public_organization_data: Schema.optional(Schema.NullOr(clerkPublicOrganizationSchema)),
  public_user_data: Schema.optional(Schema.NullOr(clerkPublicUserSchema)),
});

const clerkWebhookEnvelopeSchema = Schema.Struct({
  type: nonEmptyStringSchema,
  data: clerkWebhookDataSchema,
});

export type ClerkWebhookData = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  organization_id?: string | null;
  created_by?: string | null;
  image_url?: string | null;
  email_address?: string | null;
  user_id?: string | null;
  role?: string | null;
  status?: string | null;
  has_image?: boolean | null;
  organization?: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  } | null;
  public_organization_data?: {
    slug?: string | null;
    name?: string | null;
  } | null;
  public_user_data?: {
    first_name?: string | null;
    last_name?: string | null;
    user_id?: string | null;
    identifier?: string | null;
  } | null;
};

export type ClerkWebhookEnvelope = {
  type: string;
  data: ClerkWebhookData;
};

/**
 * Decodes a Clerk webhook JSON payload into a typed envelope.
 *
 * @param payloadJson The raw webhook JSON string.
 * @returns The decoded Clerk webhook envelope, or `null` when parsing/decoding fails.
 * @remarks This keeps Clerk webhook ingestion schema-driven instead of probing raw parsed objects.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeClerkWebhookEnvelope(payloadJson: string): ClerkWebhookEnvelope | null {
  const decoded = Schema.decodeUnknownEither(
    Schema.parseJson(clerkWebhookEnvelopeSchema),
  )(payloadJson);
  return Either.isRight(decoded) ? decoded.right : null;
}
