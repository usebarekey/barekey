import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";

import type { AuditEventInput } from "../../../audit/types";
import { insertAuditEventWithMutationCtx } from "../../../audit/record_insert";
import { ExternalServiceError } from "../../errors/effect";
import type { BarekeyRuntimeCtx } from "./context";
import { hasMutationRunner, isMutationRuntimeCtx } from "./context";
import { toExternalServiceError } from "./errors";

const appendEventInternalReference = makeFunctionReference<
  "mutation",
  AuditEventInput,
  Awaited<ReturnType<typeof insertAuditEventWithMutationCtx>>
>("audit:appendEventInternal") as any;

/**
 * Appends an audit event using the capabilities available on the current runtime context.
 *
 * @param convexCtx The active Convex runtime context.
 * @param payload The audit event payload to insert.
 * @returns An Effect that succeeds with the inserted audit event id.
 * @remarks Mutations write directly through DB helpers; actions delegate to the internal audit mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function appendAuditEventWithRuntimeCtx(
  convexCtx: BarekeyRuntimeCtx,
  payload: AuditEventInput,
) {
  if (isMutationRuntimeCtx(convexCtx)) {
    return Effect.tryPromise({
      try: () => insertAuditEventWithMutationCtx(convexCtx, payload),
      catch: (error) => toExternalServiceError("Failed to append audit event.", error),
    });
  }

  if (hasMutationRunner(convexCtx)) {
    return Effect.tryPromise({
      try: () =>
        convexCtx.runMutation(appendEventInternalReference, payload) as ReturnType<
          typeof insertAuditEventWithMutationCtx
        >,
      catch: (error) => toExternalServiceError("Failed to append audit event.", error),
    });
  }

  return Effect.fail(
    new ExternalServiceError({
      message: "Audit writes require a mutation or action context.",
    }),
  );
}
