import { DEFAULT_PROJECT_STAGES, type ProjectSummary } from "../types";
import { appendAuditEventEffect } from "../../lib/confect/audit";

/**
 * Appends the audit event emitted after a project is created.
 *
 * @param input The created project summary plus actor context.
 * @returns An Effect that completes after the audit row is appended.
 * @remarks This writes one project-created audit event for the new project.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function appendProjectCreatedAuditEventEffect(input: {
  project: ProjectSummary;
  actorClerkUserId: string;
}) {
  return appendAuditEventEffect({
    orgId: input.project.orgId,
    orgSlug: input.project.orgSlug,
    projectId: input.project.id,
    projectSlug: input.project.slug,
    stageSlug: null,
    eventType: "project.created",
    category: "project",
    actorSource: "barekey_user",
    actorClerkUserId: input.actorClerkUserId,
    actorDisplayName: null,
    actorEmail: null,
    subjectType: "project",
    subjectId: String(input.project.id),
    subjectName: input.project.name,
    title: `Created project ${input.project.name}`,
    description: `Project ${input.project.name} is ready with development and production stages.`,
    severity: "info",
    payloadJson: JSON.stringify({
      projectSlug: input.project.slug,
      defaultStages: DEFAULT_PROJECT_STAGES.map((stage) => stage.slug),
    }),
    retentionTierOverride: null,
  });
}
