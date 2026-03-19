import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import { appendAuditEventEffect } from "../../lib/confect/audit";
import { ExternalServiceError } from "../../lib/errors/effect";

/**
 * Appends the audit event for one approved CLI device code.
 *
 * @param row The approved device-code row.
 * @param input The approving actor and organization metadata.
 * @returns An Effect that completes when the audit event has been written.
 * @remarks This records one `cli.device_code_approved` event for the completed flow.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function appendDeviceCodeApprovedAuditEffect(
  row: Doc<"cliDeviceCodes">,
  input: {
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
): Effect.Effect<void, ExternalServiceError, any> {
  return appendAuditEventEffect({
    orgId: input.orgId,
    orgSlug: input.orgSlug,
    projectId: null,
    projectSlug: null,
    stageSlug: null,
    eventType: "cli.device_code_approved",
    category: "cli",
    actorSource: "cli",
    actorClerkUserId: input.clerkUserId,
    actorDisplayName: null,
    actorEmail: null,
    subjectType: "cli_session",
    subjectId: row.userCode,
    subjectName: row.clientName ?? "CLI device flow",
    title: "Approved CLI sign-in",
    description: `A CLI device code was approved for workspace ${input.orgSlug}.`,
    severity: "info",
    payloadJson: JSON.stringify({
      userCode: row.userCode,
      clientName: row.clientName,
    }),
    retentionTierOverride: null,
  }).pipe(Effect.asVoid);
}
