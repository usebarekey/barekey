import { Effect } from "effect";

import type { ActionCtx } from "../../../../_generated/server";
import { ExternalServiceError } from "../../../errors/effect";
import { runMutationEffect } from "../../../convex/functions";
import { upsertOrgBillingSnapshotForOrgInternalReference } from "../../../../payments/refs";

/**
 * Upserts the org billing snapshot.
 *
 * @param ctx The Convex action context.
 * @param input The organization id and current tier to persist.
 * @returns A promise that resolves after the mutation completes.
 * @remarks This is reused across billing flows that change the effective plan state.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function upsertOrgBillingSnapshot(
  ctx: ActionCtx,
  input: {
    orgId: string;
    currentTier: string | null;
  },
) {
  return await Effect.runPromise(
    runMutationEffect(
      ctx,
      upsertOrgBillingSnapshotForOrgInternalReference,
      input,
      (error) =>
        new ExternalServiceError({
          message: "Failed to upsert the org billing snapshot.",
          cause: error,
        }),
    ),
  );
}
