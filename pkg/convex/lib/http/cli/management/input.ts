import { Either, Schema } from "effect";

const trimmedStringSchema = Schema.String;
const nonEmptyStringSchema = Schema.String.pipe(Schema.minLength(1));

const orgScopedSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
});

const createOrgSchema = Schema.Struct({
  name: nonEmptyStringSchema,
  slug: Schema.optional(Schema.NullOr(nonEmptyStringSchema)),
});

const projectListSchema = orgScopedSchema;

const projectCreateSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

const projectDeleteSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: nonEmptyStringSchema,
});

const stageListSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: nonEmptyStringSchema,
});

const stageCreateSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

const stageRenameSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: nonEmptyStringSchema,
  stageSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

const stageDeleteSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: nonEmptyStringSchema,
  stageSlug: nonEmptyStringSchema,
});

const billingStatusSchema = orgScopedSchema;

const auditListSchema = Schema.Struct({
  orgSlug: nonEmptyStringSchema,
  projectSlug: Schema.optional(Schema.NullOr(nonEmptyStringSchema)),
  beforeOccurredAtMs: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.finite()))),
  limit: Schema.optional(Schema.NullOr(Schema.Number.pipe(Schema.finite()))),
  category: Schema.optional(Schema.NullOr(Schema.String)),
  actorSource: Schema.optional(Schema.NullOr(Schema.String)),
  sensitiveOnly: Schema.optional(Schema.NullOr(Schema.Boolean)),
});

function decodeOrNull<A>(schema: Schema.Schema<A, any>, payload: unknown): A | null {
  const decoded = Schema.decodeUnknownEither(schema as unknown as Schema.Schema<A, any, never>)(payload);
  return Either.isRight(decoded) ? decoded.right : null;
}

/**
 * Decodes one CLI org-create payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized org-create payload, or `null`.
 * @remarks CLI management routes keep their HTTP validation schema-first and fail closed on invalid bodies.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliOrgCreateBody(payload: unknown): {
  name: string;
  slug: string | null;
} | null {
  const decoded = decodeOrNull(createOrgSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    name: decoded.name,
    slug: decoded.slug ?? null,
  };
}

/**
 * Decodes one CLI project-list payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized project-list payload, or `null`.
 * @remarks Management routes use the requested org slug to re-check CLI workspace access.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliProjectListBody(payload: unknown): {
  orgSlug: string;
} | null {
  return decodeOrNull(projectListSchema, payload);
}

/**
 * Decodes one CLI project-create payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized project-create payload, or `null`.
 * @remarks Project creation requires an organization slug plus a non-empty project name.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliProjectCreateBody(payload: unknown): {
  orgSlug: string;
  name: string;
} | null {
  return decodeOrNull(projectCreateSchema, payload);
}

/**
 * Decodes one CLI project-delete payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized project-delete payload, or `null`.
 * @remarks Project deletion requires explicit organization and project targeting.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliProjectDeleteBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string;
} | null {
  return decodeOrNull(projectDeleteSchema, payload);
}

/**
 * Decodes one CLI stage-list payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized stage-list payload, or `null`.
 * @remarks Stage routes always scope reads to an explicit org and project pair.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliStageListBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string;
} | null {
  return decodeOrNull(stageListSchema, payload);
}

/**
 * Decodes one CLI stage-create payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized stage-create payload, or `null`.
 * @remarks Stage creation requires explicit org/project targeting and a non-empty stage name.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliStageCreateBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string;
  name: string;
} | null {
  return decodeOrNull(stageCreateSchema, payload);
}

/**
 * Decodes one CLI stage-rename payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized stage-rename payload, or `null`.
 * @remarks Stage rename keeps slugs immutable and only changes the display name.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliStageRenameBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
  name: string;
} | null {
  return decodeOrNull(stageRenameSchema, payload);
}

/**
 * Decodes one CLI stage-delete payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized stage-delete payload, or `null`.
 * @remarks Stage deletion requires explicit org/project/stage targeting.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliStageDeleteBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
} | null {
  return decodeOrNull(stageDeleteSchema, payload);
}

/**
 * Decodes one CLI billing-status payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized billing-status payload, or `null`.
 * @remarks Billing status is organization-scoped and therefore reuses the shared org-scoped contract.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliBillingStatusBody(payload: unknown): {
  orgSlug: string;
} | null {
  return decodeOrNull(billingStatusSchema, payload);
}

/**
 * Decodes one CLI audit-list payload.
 *
 * @param payload The untrusted JSON request body.
 * @returns The normalized audit-list payload, or `null`.
 * @remarks Optional filters stay nullable so the HTTP boundary preserves the current audit query defaults.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodeCliAuditListBody(payload: unknown): {
  orgSlug: string;
  projectSlug: string | null;
  beforeOccurredAtMs: number | null;
  limit: number | null;
  category: string | null;
  actorSource: string | null;
  sensitiveOnly: boolean;
} | null {
  const decoded = decodeOrNull(auditListSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    orgSlug: decoded.orgSlug,
    projectSlug: decoded.projectSlug ?? null,
    beforeOccurredAtMs: decoded.beforeOccurredAtMs ?? null,
    limit: decoded.limit ?? null,
    category: decoded.category ?? null,
    actorSource: decoded.actorSource ?? null,
    sensitiveOnly: decoded.sensitiveOnly ?? false,
  };
}
