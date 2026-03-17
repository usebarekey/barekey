import { Effect } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { AuditEventInput } from "../../audit/types";
import type { ExternalServiceError } from "../effect_errors";
import { AuditService } from "./services";

/**
 * Appends a single audit event through the shared runtime audit service.
 *
 * @param payload The audit event payload to append.
 * @returns An Effect that succeeds with the inserted audit event id.
 * @remarks This is the Effect-native audit write entrypoint for domain programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function appendAuditEventEffect(
  payload: AuditEventInput,
): Effect.Effect<Id<"auditEvents">, ExternalServiceError, AuditService> {
  return Effect.gen(function* () {
    const audit = yield* AuditService;
    return yield* audit.append(payload);
  });
}
