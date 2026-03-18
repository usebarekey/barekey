import { httpAction as generatedHttpAction } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";

import { runLegacyHttpHandler } from "./boundary";

/**
 * Registers an HTTP action while normalizing legacy handler failures through the
 * shared Effect runtime.
 *
 * @param handler The legacy HTTP handler.
 * @returns A generated Convex HTTP action.
 * @remarks This delegates runtime provisioning to `runLegacyHttpHandler` while keeping the existing route registration surface unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const httpAction: typeof generatedHttpAction = ((handler: (
  ctx: ActionCtx,
  request: Request,
) => Promise<Response>) =>
  generatedHttpAction(async (ctx, request) => {
    return await runLegacyHttpHandler(handler, ctx as unknown as ActionCtx, request);
  })) as typeof generatedHttpAction;
