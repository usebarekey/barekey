import { Either, Schema } from "effect";

import type { Doc } from "../../_generated/dataModel";

const deviceCodeApprovalSchema = Schema.Struct({
  approvedByClerkUserId: Schema.String,
  approvedOrgId: Schema.String,
  approvedOrgSlug: Schema.String,
});

export type ApprovedDeviceCode = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
};

/**
 * Decodes the approved identity payload from one CLI device-code row.
 *
 * @param row The device-code row to inspect.
 * @returns The approved identity payload, or `null` when approval metadata is incomplete.
 * @remarks This replaces hand-written null checks with a schema-decoded approval contract.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeApprovedDeviceCode(
  row: Doc<"cliDeviceCodes">,
): ApprovedDeviceCode | null {
  const decoded = Schema.decodeUnknownEither(deviceCodeApprovalSchema)({
    approvedByClerkUserId: row.approvedByClerkUserId,
    approvedOrgId: row.approvedOrgId,
    approvedOrgSlug: row.approvedOrgSlug,
  });

  return Either.isRight(decoded)
    ? {
        clerkUserId: decoded.right.approvedByClerkUserId,
        orgId: decoded.right.approvedOrgId,
        orgSlug: decoded.right.approvedOrgSlug,
      }
    : null;
}
