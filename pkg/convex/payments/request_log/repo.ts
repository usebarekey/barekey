import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbCollectEffect, dbDeleteEffect, dbInsertEffect } from "../../lib/convex/db";
import { ExternalServiceError } from "../../lib/errors/effect";

function toBillingRequestLogError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Loads billing request-log rows for one idempotency key.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization and request key to load.
 * @returns An Effect that succeeds with the matching request-log rows.
 * @remarks This is used to deduplicate metered-usage writes by org/request key.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function listBillingRequestLogRowsEffect(
  ctx: MutationCtx,
  args: {
    orgId: string;
    requestKey: string;
  },
) {
  return dbCollectEffect<Doc<"billingRequestLog">, ExternalServiceError>(
    ctx,
    "billingRequestLog",
    (query) =>
      query.withIndex("by_org_id_and_request_key", (indexQuery) =>
        indexQuery.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      ),
    (error) => toBillingRequestLogError("Failed to load billing request log entries.", error),
  );
}

/**
 * Inserts a billing request-log row for idempotency tracking.
 *
 * @param ctx The Convex mutation context.
 * @param args The row payload to insert.
 * @returns An Effect that succeeds with the inserted row id.
 * @remarks This records the original request metadata before duplicate cleanup.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertBillingRequestLogRowEffect(
  ctx: MutationCtx,
  args: {
    orgId: string;
    requestKey: string;
    featureId: string;
    units: number;
    createdAtMs: number;
  },
) {
  return dbInsertEffect<Id<"billingRequestLog">, ExternalServiceError>(
    ctx,
    "billingRequestLog",
    {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: args.createdAtMs,
    },
    (error) => toBillingRequestLogError("Failed to insert the billing request log entry.", error),
  );
}

/**
 * Deletes one billing request-log row.
 *
 * @param ctx The Convex mutation context.
 * @param args The row id and failure message context.
 * @returns An Effect that succeeds when the row is deleted.
 * @remarks This is used during duplicate cleanup after racing inserts.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deleteBillingRequestLogRowEffect(
  ctx: MutationCtx,
  args: {
    rowId: Id<"billingRequestLog">;
    failureMessage: string;
  },
) {
  return dbDeleteEffect(ctx, args.rowId, (error) =>
    toBillingRequestLogError(args.failureMessage, error),
  );
}
