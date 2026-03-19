import type { ClerkWebhookData } from "./schema";

/**
 * Resolves organization information from a Clerk webhook payload.
 *
 * @param data The normalized Clerk webhook data object.
 * @returns The organization id, slug, and optional name when they can be resolved.
 * @remarks This supports multiple Clerk payload shapes used across org, membership, and invitation events.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readOrgInfoFromClerkWebhook(data: ClerkWebhookData): {
  orgId: string;
  orgSlug: string;
  orgName: string | null;
} | null {
  const organization = data.organization ?? null;
  if (organization !== null) {
    const orgId = organization.id ?? null;
    const orgSlug = organization.slug ?? null;
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: organization.name ?? null,
      };
    }
  }

  const publicOrg = data.public_organization_data ?? null;
  if (publicOrg !== null) {
    const orgId = data.organization_id ?? null;
    const orgSlug = publicOrg.slug ?? null;
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: publicOrg.name ?? null,
      };
    }
  }

  const orgId = data.id ?? data.organization_id ?? null;
  const orgSlug = data.slug ?? orgId;
  if (orgId === null || orgSlug === null) {
    return null;
  }

  return {
    orgId,
    orgSlug,
    orgName: data.name ?? null,
  };
}
