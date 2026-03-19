import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

import { runMutationEffect } from "../../../../convex/functions";
import type { HttpEnvActionCtx } from "../shared";

const logBillingRequestInternalReference = makeFunctionReference<
  "mutation",
  {
    orgId: string;
    requestKey: string;
    featureId: string;
    units: number;
  },
  {
    inserted: boolean;
  }
>("payments:logBillingRequestInternal") as any;

/**
 * Writes one metered billing-request log entry for an env HTTP route.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org id, request key, feature id, and unit count to log.
 * @returns Whether the request log row was inserted.
 * @remarks Duplicate request keys return `inserted: false` so callers can compensate reserved units.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function logEnvBillingRequest(
  ctx: HttpEnvActionCtx,
  input: {
    orgId: string;
    requestKey: string;
    featureId: string;
    units: number;
  },
): Promise<{ inserted: boolean }> {
  return await Effect.runPromise(
    runMutationEffect(ctx, logBillingRequestInternalReference, input, (error) => error),
  );
}
