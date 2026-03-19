import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import {
  BarekeyConfectActionCtx,
  effectInternalAction,
} from "../../confect";
import {
  compensateFeatureUnitsEffect,
  reserveFeatureUnitsEffect,
} from "../../lib/confect/billing";
import { BillingError } from "../../lib/errors/effect";
import {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
} from "../../lib/project_variables/schedules";
import type { ReserveFeatureUnitsResult } from "../../payments/types";
import type { WriteWithUsageResult } from "../types";
import {
  applyPreparedVariableStorageDeltaEffect,
  applyPreparedVariableWriteEffect,
  measurePreparedVariableWriteEffect,
} from "./repo";

type ApplyPreparedVariableWritesWithUsageArgs = {
  orgId: string;
  orgSlug: string | null;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<any>;
  updates: Array<any>;
  deletes: Array<Id<"projectVariables">>;
};

/**
 * Converts a billing reservation response into reserved units or a typed failure.
 *
 * @param reservation The raw reservation response from the billing service.
 * @returns The reserved unit count when billing accepts the request.
 * @remarks This fails for quota-exceeded and unavailable billing responses so callers can recover in the Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function reserveStorageUnitsOrFail(
  reservation: ReserveFeatureUnitsResult,
): Effect.Effect<number, BillingError> {
  if (reservation.errorCode === "USAGE_LIMIT_EXCEEDED") {
    return Effect.fail(
      new BillingError({ message: "Usage limit exceeded for this workspace plan." }),
    );
  }
  if (reservation.errorCode === "BILLING_UNAVAILABLE") {
    return Effect.fail(
      new BillingError({ message: "Billing service is temporarily unavailable." }),
    );
  }

  return Effect.succeed(reservation.reservedUnits);
}

/**
 * Applies a prepared variable write after metering and reserving storage units.
 *
 * @param args The org, project, stage, and prepared write payloads to meter and commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This reserves storage units before commit, compensates on failure, and then applies the final storage delta to billing state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function applyPreparedVariableWritesForOrgProjectStageWithUsageInternalEffect(
  args: ApplyPreparedVariableWritesWithUsageArgs,
): Effect.Effect<WriteWithUsageResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;

    const measurement = yield* measurePreparedVariableWriteEffect(ctx, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      creates: args.creates,
      updates: args.updates,
      deletes: args.deletes,
    });

    let reservedStorageUnits = 0;
    if (measurement.storageDeltaBytes > 0) {
      const reservation = (yield* reserveFeatureUnitsEffect({
        scope: "org",
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        featureId: "storage_bytes",
        units: measurement.storageDeltaBytes,
        reason: "project_variables_write",
      })) as ReserveFeatureUnitsResult;
      reservedStorageUnits = yield* reserveStorageUnitsOrFail(reservation);
    }

    const result = yield* applyPreparedVariableWriteEffect(ctx, {
      orgId: args.orgId,
      clerkUserId: args.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      creates: args.creates,
      updates: args.updates,
      deletes: args.deletes,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          if (reservedStorageUnits > 0) {
            yield* compensateFeatureUnitsEffect({
              scope: "org",
              orgId: args.orgId,
              orgSlug: args.orgSlug,
              featureId: "storage_bytes",
              units: reservedStorageUnits,
              reason: "project_variables_write_rollback",
            }).pipe(Effect.catchAll(() => Effect.succeed({ compensatedUnits: 0 })));
          }

          return yield* Effect.fail(error);
        }),
      ),
    );

    if (measurement.storageDeltaBytes !== 0) {
      yield* applyPreparedVariableStorageDeltaEffect(ctx, {
        orgId: args.orgId,
        deltaBytes: measurement.storageDeltaBytes,
      });
    }

    if (measurement.storageDeltaBytes < 0) {
      yield* compensateFeatureUnitsEffect({
        scope: "org",
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        featureId: "storage_bytes",
        units: Math.abs(measurement.storageDeltaBytes),
        reason: "project_variables_write_negative_delta",
      });
    }

    return {
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      deletedCount: result.deletedCount,
    };
  });
}

/**
 * Applies metered storage checks and then commits a prepared variable write.
 *
 * @param ctx The Convex internal action context.
 * @param args The org, project, stage, and prepared write payloads to meter and commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This reserves storage units before commit, compensates on failure, and then applies the final storage delta to billing state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyPreparedVariableWritesForOrgProjectStageWithUsageInternal = effectInternalAction<
  ApplyPreparedVariableWritesWithUsageArgs,
  WriteWithUsageResult,
  any
>({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    clerkUserId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(projectVariablePreparedCreateValidator),
    updates: v.array(projectVariablePreparedUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: applyPreparedVariableWritesForOrgProjectStageWithUsageInternalEffect,
});
