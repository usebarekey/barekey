import type { ClerkWebhookData } from "./schema";

/**
 * Resolves the membership subject details from a Clerk webhook payload.
 *
 * @param data The normalized Clerk membership webhook data object.
 * @returns The resolved member id, identifier, and display name.
 * @remarks Missing member data is normalized to `null` fields so audit ingestion stays loss-tolerant.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readMembershipSubject(data: ClerkWebhookData): {
  userId: string | null;
  identifier: string | null;
  displayName: string | null;
} {
  const publicUser = data.public_user_data ?? null;
  if (publicUser === null) {
    return {
      userId: null,
      identifier: null,
      displayName: null,
    };
  }

  const firstName = publicUser.first_name ?? null;
  const lastName = publicUser.last_name ?? null;
  const displayName =
    [firstName, lastName].filter((value) => value !== null).join(" ").trim() || null;

  return {
    userId: publicUser.user_id ?? null,
    identifier: publicUser.identifier ?? null,
    displayName,
  };
}
