import { Effect } from "effect";
import { v } from "convex/values";

import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import { appendAuditEventEffect } from "../../lib/confect/audit";
import { decodeClerkWebhookEnvelope } from "./schema";
import { toClerkWebhookAuditEventInput } from "./input";

/**
 * Ingests a Clerk webhook payload into the audit trail when it maps to a supported event.
 *
 * @param args The raw webhook payload JSON.
 * @returns Whether the payload was accepted and converted into an audit event.
 * @remarks This delegates persistence to the shared audit service and drops unsupported events silently.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const ingestClerkWebhookEventInternal = effectInternalAction<
  {
    payloadJson: string;
  },
  {
    accepted: boolean;
  },
  any
>({
  args: {
    payloadJson: v.string(),
  },
  returns: v.object({
    accepted: v.boolean(),
  }),
  handler: (args) =>
    Effect.gen(function* () {
      yield* BarekeyConfectActionCtx;

      const event = decodeClerkWebhookEnvelope(args.payloadJson);
      if (event === null) {
        return { accepted: false };
      }

      const auditEventInput = toClerkWebhookAuditEventInput(event);
      if (auditEventInput === null) {
        yield* Effect.sync(() =>
          console.warn("Dropping unsupported or organization-less Clerk webhook audit event.", {
            type: event.type,
          }),
        );
        return { accepted: false };
      }

      yield* appendAuditEventEffect(auditEventInput);
      return { accepted: true };
    }),
});
