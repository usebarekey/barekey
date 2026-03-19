import { Effect } from "effect";

import type { ActionCtx } from "../../_generated/server";
import { runMutationEffect } from "../../lib/convex/functions";
import { applyStorageDeltaForOrgInternalReference } from "../../payments/refs";
import {
  applyPreparedVariableWritesForOrgProjectStageInternalReference,
  measurePreparedVariableWritesForOrgProjectStageInternalReference,
} from "../refs";
import { toProjectVariableExternalServiceError } from "../errors";
import type { WriteWithUsageResult } from "../types";

/**
 * Measures the storage delta for one prepared variable write.
 *
 * @param ctx The Convex action context.
 * @param input The org/project/stage scope and prepared write payloads.
 * @returns The measured storage delta in bytes.
 * @remarks This delegates to the internal measurement mutation used by metered writes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function measurePreparedVariableWriteEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    creates: Array<any>;
    updates: Array<any>;
    deletes: Array<any>;
  },
) {
  return runMutationEffect<
    { storageDeltaBytes: number },
    ReturnType<typeof toProjectVariableExternalServiceError>
  >(
    ctx,
    measurePreparedVariableWritesForOrgProjectStageInternalReference,
    input,
    (error) =>
      toProjectVariableExternalServiceError(
        "Failed to measure the prepared variable write.",
        error,
      ),
  );
}

/**
 * Applies the prepared variable write payload to the target stage.
 *
 * @param ctx The Convex action context.
 * @param input The org/project/stage scope and prepared write payloads.
 * @returns The created, updated, and deleted counts from the write.
 * @remarks This delegates to the internal prepared-write mutation after billing checks are done.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function applyPreparedVariableWriteEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    clerkUserId: string;
    projectSlug: string;
    stageSlug: string;
    creates: Array<any>;
    updates: Array<any>;
    deletes: Array<any>;
  },
) {
  return runMutationEffect<
    WriteWithUsageResult,
    ReturnType<typeof toProjectVariableExternalServiceError>
  >(
    ctx,
    applyPreparedVariableWritesForOrgProjectStageInternalReference,
    input,
    (error) =>
      toProjectVariableExternalServiceError(
        "Failed to apply the prepared variable write.",
        error,
      ),
  );
}

/**
 * Applies the final storage delta to the billing mirror for a prepared write.
 *
 * @param ctx The Convex action context.
 * @param input The organization id and delta bytes to persist.
 * @returns An Effect that completes after the storage mirror mutation runs.
 * @remarks This keeps the storage billing mirror in sync with the committed write.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function applyPreparedVariableStorageDeltaEffect(
  ctx: ActionCtx,
  input: {
    orgId: string;
    deltaBytes: number;
  },
) {
  return runMutationEffect<
    unknown,
    ReturnType<typeof toProjectVariableExternalServiceError>
  >(
    ctx,
    applyStorageDeltaForOrgInternalReference,
    input,
    (error) =>
      toProjectVariableExternalServiceError(
        "Failed to apply the final storage delta for the variable write.",
        error,
      ),
  );
}
