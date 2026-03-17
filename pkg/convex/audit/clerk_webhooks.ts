import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../confect";
import { readOptionalStringField, safeParseJson } from "./normalization";
import type { AuditEventInput } from "./types";

/**
 * Resolves organization information from a Clerk webhook payload.
 *
 * @param data The normalized Clerk webhook data object.
 * @returns The organization id, slug, and optional name when they can be resolved.
 * @remarks This supports multiple Clerk payload shapes used across org, membership, and invitation events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function readOrgInfoFromClerkWebhook(data: Record<string, unknown>): {
  orgId: string;
  orgSlug: string;
  orgName: string | null;
} | null {
  const organization =
    typeof data.organization === "object" && data.organization !== null
      ? (data.organization as Record<string, unknown>)
      : null;
  if (organization !== null) {
    const orgId = readOptionalStringField(organization, "id");
    const orgSlug = readOptionalStringField(organization, "slug");
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: readOptionalStringField(organization, "name"),
      };
    }
  }

  const publicOrg =
    typeof data.public_organization_data === "object" && data.public_organization_data !== null
      ? (data.public_organization_data as Record<string, unknown>)
      : null;
  if (publicOrg !== null) {
    const orgId = readOptionalStringField(data, "organization_id");
    const orgSlug = readOptionalStringField(publicOrg, "slug");
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: readOptionalStringField(publicOrg, "name"),
      };
    }
  }

  const orgId = readOptionalStringField(data, "id") ?? readOptionalStringField(data, "organization_id");
  const orgSlug = readOptionalStringField(data, "slug") ?? orgId;
  if (orgId === null || orgSlug === null) {
    return null;
  }

  return {
    orgId,
    orgSlug,
    orgName: readOptionalStringField(data, "name"),
  };
}

/**
 * Resolves the membership subject details from a Clerk webhook payload.
 *
 * @param data The normalized Clerk membership webhook data object.
 * @returns The resolved member id, identifier, and display name.
 * @remarks Missing member data is normalized to `null` fields so audit ingestion stays loss-tolerant.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function readMembershipSubject(data: Record<string, unknown>): {
  userId: string | null;
  identifier: string | null;
  displayName: string | null;
} {
  const publicUser =
    typeof data.public_user_data === "object" && data.public_user_data !== null
      ? (data.public_user_data as Record<string, unknown>)
      : null;
  if (publicUser === null) {
    return {
      userId: null,
      identifier: null,
      displayName: null,
    };
  }

  const firstName = readOptionalStringField(publicUser, "first_name");
  const lastName = readOptionalStringField(publicUser, "last_name");
  const displayName =
    [firstName, lastName].filter((value) => value !== null).join(" ").trim() || null;

  return {
    userId: readOptionalStringField(publicUser, "user_id"),
    identifier: readOptionalStringField(publicUser, "identifier"),
    displayName,
  };
}

/**
 * Ingests a Clerk webhook payload into the audit trail when it maps to a supported event.
 *
 * @param ctx The Convex internal action context.
 * @param args The raw webhook payload JSON.
 * @returns Whether the payload was accepted and converted into an audit event.
 * @remarks This delegates persistence to `internal.audit.appendEventInternal` and drops unsupported events silently.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ingestClerkWebhookEventInternal = internalAction({
  args: {
    payloadJson: v.string(),
  },
  returns: v.object({
    accepted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const event = safeParseJson(args.payloadJson);
    if (typeof event !== "object" || event === null) {
      return {
        accepted: false,
      };
    }

    const payload = event as Record<string, unknown>;
    const type = readOptionalStringField(payload, "type");
    const rawData =
      typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : null;
    if (type === null || rawData === null) {
      return {
        accepted: false,
      };
    }

    const org = readOrgInfoFromClerkWebhook(rawData);
    if (org === null) {
      console.warn("Dropping Clerk webhook audit event without resolvable organization.", {
        type,
      });
      return {
        accepted: false,
      };
    }

    let input: AuditEventInput | null = null;
    if (
      type === "organization.created" ||
      type === "organization.updated" ||
      type === "organization.deleted"
    ) {
      const isDeleted = type === "organization.deleted";
      input = {
        orgId: org.orgId,
        orgSlug: org.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: type.replace("organization", "workspace"),
        category: "workspace",
        actorSource: "clerk_webhook",
        actorClerkUserId: readOptionalStringField(rawData, "created_by"),
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
          hasImage: rawData.has_image,
          imageUrl: readOptionalStringField(rawData, "image_url"),
        }),
      };
    } else if (
      type === "organizationMembership.created" ||
      type === "organizationMembership.updated" ||
      type === "organizationMembership.deleted"
    ) {
      const subject = readMembershipSubject(rawData);
      input = {
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
          role: readOptionalStringField(rawData, "role"),
          identifier: subject.identifier,
          userId: subject.userId,
        }),
      };
    } else if (
      type === "organizationInvitation.created" ||
      type === "organizationInvitation.revoked" ||
      type === "organizationInvitation.accepted" ||
      type === "organizationInvitation.deleted"
    ) {
      const email = readOptionalStringField(rawData, "email_address");
      input = {
        orgId: org.orgId,
        orgSlug: org.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: type,
        category: "invitation",
        actorSource: "clerk_webhook",
        actorClerkUserId: readOptionalStringField(rawData, "user_id"),
        actorDisplayName: null,
        actorEmail: email,
        subjectType: "invitation",
        subjectId: readOptionalStringField(rawData, "id"),
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
          role: readOptionalStringField(rawData, "role"),
          status: readOptionalStringField(rawData, "status"),
        }),
      };
    }

    if (input === null) {
      return {
        accepted: false,
      };
    }

    const auditEventInput: AuditEventInput = {
      ...input,
      retentionTierOverride: null,
    };

    const runMutation = ctx.runMutation as (
      functionReference: unknown,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    // @ts-expect-error TypeScript exhausts itself expanding this generated Convex reference.
    const internalApi = internal as any;
    const appendEventInternalReference = internalApi.audit.appendEventInternal as unknown;
    await runMutation(
      appendEventInternalReference,
      auditEventInput as Record<string, unknown>,
    );

    return {
      accepted: true,
    };
  },
});
