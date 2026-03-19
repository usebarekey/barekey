import type { AuditEventInput } from "../types";
import type { ClerkWebhookData, ClerkWebhookEnvelope } from "./schema";
import { readMembershipSubject } from "./membership";
import { readOrgInfoFromClerkWebhook } from "./org";

/**
 * Converts one decoded Clerk webhook into an audit event input when supported.
 *
 * @param event The decoded Clerk webhook event.
 * @returns The audit event input, or `null` when the event should be ignored.
 * @remarks Unsupported or organization-less Clerk events are intentionally dropped without persistence.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toClerkWebhookAuditEventInput(
  event: ClerkWebhookEnvelope,
): AuditEventInput | null {
  const { type, data: rawData } = event;
  const org = readOrgInfoFromClerkWebhook(rawData);
  if (org === null) {
    return null;
  }

  if (
    type === "organization.created" ||
    type === "organization.updated" ||
    type === "organization.deleted"
  ) {
    const isDeleted = type === "organization.deleted";
    return {
      orgId: org.orgId,
      orgSlug: org.orgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: type.replace("organization", "workspace"),
      category: "workspace",
      actorSource: "clerk_webhook",
      actorClerkUserId: rawData.created_by ?? null,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "workspace",
      subjectId: org.orgId,
      subjectName: org.orgName ?? org.orgSlug,
      title: isDeleted
        ? `Deleted workspace ${org.orgName ?? org.orgSlug}`
        : type === "organization.created"
          ? `Created workspace ${org.orgName ?? org.orgSlug}`
          : `Updated workspace ${org.orgName ?? org.orgSlug}`,
      description: isDeleted
        ? `Workspace ${org.orgName ?? org.orgSlug} was deleted in Clerk.`
        : type === "organization.created"
          ? `Workspace ${org.orgName ?? org.orgSlug} was created in Clerk.`
          : `Workspace ${org.orgName ?? org.orgSlug} profile or image changed in Clerk.`,
      severity: "info",
      payloadJson: JSON.stringify({
        name: org.orgName,
        slug: org.orgSlug,
        hasImage: rawData.has_image ?? null,
        imageUrl: rawData.image_url ?? null,
      }),
      retentionTierOverride: null,
    };
  }

  if (
    type === "organizationMembership.created" ||
    type === "organizationMembership.updated" ||
    type === "organizationMembership.deleted"
  ) {
    const subject = readMembershipSubject(rawData);
    return {
      orgId: org.orgId,
      orgSlug: org.orgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: type,
      category: "membership",
      actorSource: "clerk_webhook",
      actorClerkUserId: subject.userId,
      actorDisplayName: subject.displayName,
      actorEmail: subject.identifier,
      subjectType: "membership",
      subjectId: subject.userId,
      subjectName: subject.displayName ?? subject.identifier,
      title:
        type === "organizationMembership.created"
          ? "Added workspace member"
          : type === "organizationMembership.deleted"
            ? "Removed workspace member"
            : "Updated workspace member",
      description: `${subject.displayName ?? subject.identifier ?? "A member"} ${type === "organizationMembership.created" ? "joined" : type === "organizationMembership.deleted" ? "left or was removed from" : "changed role in"} ${org.orgSlug}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        role: rawData.role ?? null,
        identifier: subject.identifier,
        userId: subject.userId,
      }),
      retentionTierOverride: null,
    };
  }

  if (
    type === "organizationInvitation.created" ||
    type === "organizationInvitation.revoked" ||
    type === "organizationInvitation.accepted" ||
    type === "organizationInvitation.deleted"
  ) {
    const email = rawData.email_address ?? null;
    return {
      orgId: org.orgId,
      orgSlug: org.orgSlug,
      projectId: null,
      projectSlug: null,
      stageSlug: null,
      eventType: type,
      category: "invitation",
      actorSource: "clerk_webhook",
      actorClerkUserId: rawData.user_id ?? null,
      actorDisplayName: null,
      actorEmail: email,
      subjectType: "invitation",
      subjectId: rawData.id ?? null,
      subjectName: email,
      title:
        type === "organizationInvitation.created"
          ? "Created workspace invitation"
          : type === "organizationInvitation.accepted"
            ? "Accepted workspace invitation"
            : type === "organizationInvitation.deleted"
              ? "Deleted workspace invitation"
              : "Revoked workspace invitation",
      description: `${email ?? "An invite"} was ${type === "organizationInvitation.created" ? "created for" : type === "organizationInvitation.accepted" ? "accepted in" : type === "organizationInvitation.deleted" ? "deleted from" : "revoked from"} ${org.orgSlug}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        email,
        role: rawData.role ?? null,
        status: rawData.status ?? null,
      }),
      retentionTierOverride: null,
    };
  }

  return null;
}
