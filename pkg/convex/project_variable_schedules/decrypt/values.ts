import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { decryptSecretValueForProject } from "../../lib/encryption";
import { ValidationError } from "../../lib/errors/effect";
import { toScheduleExternalServiceError } from "../errors";

/**
 * Decrypts one scheduled create entry into its UI-facing plaintext shape.
 *
 * @param ctx The Convex mutation context.
 * @param input The project/org scope plus prepared create entry.
 * @returns The decrypted create entry.
 * @remarks This reveals plaintext values transiently for schedule inspection only.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decryptScheduledCreateEffect(
  ctx: MutationCtx,
  input: {
    projectId: Doc<"projects">["_id"];
    orgId: string;
    entry: Doc<"projectVariableSchedules">["preparedCreates"][number];
  },
) {
  return Effect.gen(function* () {
    const entry = input.entry;
    if (entry.kind === "secret") {
      const value = yield* Effect.tryPromise({
        try: () =>
          decryptSecretValueForProject(ctx, {
            projectId: input.projectId,
            orgId: input.orgId,
            encryptedValue: entry.encryptedValue,
          }),
        catch: (error) =>
          toScheduleExternalServiceError("Failed to decrypt a scheduled secret value.", error),
      });
      return {
        name: entry.name,
        visibility: entry.visibility,
        kind: "secret" as const,
        declaredType: entry.declaredType,
        value,
      };
    }

    const valueA = yield* decryptScheduleVariantValueEffect(ctx, {
      projectId: input.projectId,
      orgId: input.orgId,
      encryptedValue: entry.encryptedValueA,
    });
    const valueB = yield* decryptScheduleVariantValueEffect(ctx, {
      projectId: input.projectId,
      orgId: input.orgId,
      encryptedValue: entry.encryptedValueB,
    });

    if (entry.kind === "ab_roll") {
      return {
        name: entry.name,
        visibility: entry.visibility,
        kind: "ab_roll" as const,
        declaredType: entry.declaredType,
        valueA,
        valueB,
        chance: entry.chance,
      };
    }

    return {
      name: entry.name,
      visibility: entry.visibility,
      kind: "rollout" as const,
      declaredType: entry.declaredType,
      valueA,
      valueB,
      rolloutFunction: entry.rolloutFunction,
      rolloutMilestones: entry.rolloutMilestones,
    };
  });
}

/**
 * Decrypts one scheduled update entry into its UI-facing plaintext shape.
 *
 * @param ctx The Convex mutation context.
 * @param input The project/org scope plus prepared update entry.
 * @returns The decrypted update entry.
 * @remarks This validates update-target metadata before revealing any plaintext schedule values.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decryptScheduledUpdateEffect(
  ctx: MutationCtx,
  input: {
    projectId: Doc<"projects">["_id"];
    orgId: string;
    updatesById: Map<Doc<"projectVariables">["_id"], string>;
    entry: Doc<"projectVariableSchedules">["preparedUpdates"][number];
  },
) {
  return Effect.gen(function* () {
    const entry = input.entry;
    const name = input.updatesById.get(entry.id);
    if (name === undefined) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Scheduled update metadata is corrupted.",
        }),
      );
    }

    if (entry.kind === "secret") {
      const value = yield* Effect.tryPromise({
        try: () =>
          decryptSecretValueForProject(ctx, {
            projectId: input.projectId,
            orgId: input.orgId,
            encryptedValue: entry.encryptedValue,
          }),
        catch: (error) =>
          toScheduleExternalServiceError("Failed to decrypt a scheduled secret value.", error),
      });
      return {
        id: entry.id,
        name,
        visibility: entry.visibility,
        kind: "secret" as const,
        declaredType: entry.declaredType,
        value,
      };
    }

    const valueA = yield* decryptScheduleVariantValueEffect(ctx, {
      projectId: input.projectId,
      orgId: input.orgId,
      encryptedValue: entry.encryptedValueA,
    });
    const valueB = yield* decryptScheduleVariantValueEffect(ctx, {
      projectId: input.projectId,
      orgId: input.orgId,
      encryptedValue: entry.encryptedValueB,
    });

    if (entry.kind === "ab_roll") {
      return {
        id: entry.id,
        name,
        visibility: entry.visibility,
        kind: "ab_roll" as const,
        declaredType: entry.declaredType,
        valueA,
        valueB,
        chance: entry.chance,
      };
    }

    return {
      id: entry.id,
      name,
      visibility: entry.visibility,
      kind: "rollout" as const,
      declaredType: entry.declaredType,
      valueA,
      valueB,
      rolloutFunction: entry.rolloutFunction,
      rolloutMilestones: entry.rolloutMilestones,
    };
  });
}

/**
 * Decrypts one variant ciphertext used by a scheduled rollout-style value.
 *
 * @param ctx The Convex mutation context.
 * @param input The project/org scope plus ciphertext.
 * @returns The decrypted plaintext value.
 * @remarks This centralizes the shared error mapping for scheduled variant value decryption.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function decryptScheduleVariantValueEffect(
  ctx: MutationCtx,
  input: {
    projectId: Doc<"projects">["_id"];
    orgId: string;
    encryptedValue: string;
  },
) {
  return Effect.tryPromise({
    try: () =>
      decryptSecretValueForProject(ctx, {
        projectId: input.projectId,
        orgId: input.orgId,
        encryptedValue: input.encryptedValue,
      }),
    catch: (error) =>
      toScheduleExternalServiceError("Failed to decrypt a scheduled variant value.", error),
  });
}
