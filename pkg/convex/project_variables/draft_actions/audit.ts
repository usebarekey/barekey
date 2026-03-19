import { Effect } from "effect";

import { appendAuditEventEffect } from "../../lib/confect/audit";
import type { ActiveOrgIdClaims } from "../../lib/auth";
import { ExternalServiceError } from "../../lib/errors/effect";
import type { DraftWriteResult } from "../types";
import type { ApplyDraftArgs, DraftTouchedEntry } from "./shared";

/**
 * Appends the audit event for one applied staged variable draft.
 *
 * @param activeOrg The active organization claims for the acting user.
 * @param args The applied draft arguments.
 * @param result The final applied write counts.
 * @param touchedEntries The normalized variable summary for the audit payload.
 * @returns An Effect that completes when the audit event has been written.
 * @remarks Private-variable writes are marked sensitive in the audit stream.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function appendDraftAppliedAuditEffect(
  activeOrg: ActiveOrgIdClaims,
  args: ApplyDraftArgs,
  result: DraftWriteResult,
  touchedEntries: Array<DraftTouchedEntry>,
): Effect.Effect<void, ExternalServiceError, any> {
  return appendAuditEventEffect({
    orgId: activeOrg.orgId,
    orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
    projectId: null,
    projectSlug: args.projectSlug,
    stageSlug: args.stageSlug,
    eventType: "variable.draft_applied",
    category: "variable",
    actorSource: "barekey_user",
    actorClerkUserId: activeOrg.clerkUserId,
    actorDisplayName: null,
    actorEmail: null,
    subjectType: "stage",
    subjectId: args.stageSlug,
    subjectName: args.stageSlug,
    title: `Applied ${touchedEntries.length} variable change${touchedEntries.length === 1 ? "" : "s"}`,
    description: `Updated ${args.projectSlug}/${args.stageSlug} with ${result.createdCount} create${result.createdCount === 1 ? "" : "s"}, ${result.updatedCount} update${result.updatedCount === 1 ? "" : "s"}, and ${result.deletedCount} delete${result.deletedCount === 1 ? "" : "s"}.`,
    severity: touchedEntries.some((entry) => entry.visibility === "private")
      ? "sensitive"
      : "info",
    payloadJson: JSON.stringify({
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      counts: result,
      variables: touchedEntries,
    }),
    retentionTierOverride: null,
  }).pipe(Effect.asVoid);
}
