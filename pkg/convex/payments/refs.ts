import { makeFunctionReference } from "convex/server";

export const applyStorageDeltaForOrgInternalReference = makeFunctionReference(
  "payments:applyStorageDeltaForOrgInternal",
) as any;

export const assertWorkspacePlanForCurrentOrgInternalReference = makeFunctionReference(
  "payments:assertWorkspacePlanForCurrentOrgInternal",
) as any;

export const assertWorkspacePlanForOrgInternalReference = makeFunctionReference(
  "payments:assertWorkspacePlanForOrgInternal",
) as any;

export const compensateFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference(
  "payments:compensateFeatureUnitsForCurrentOrgInternal",
) as any;

export const compensateFeatureUnitsForOrgInternalReference = makeFunctionReference(
  "payments:compensateFeatureUnitsForOrgInternal",
) as any;

export const consumeFreePlanCreditForCurrentOrgInternalReference = makeFunctionReference(
  "payments:consumeFreePlanCreditForCurrentOrgInternal",
) as any;

export const ensureFreePlanCreditForClerkUserInternalReference = makeFunctionReference(
  "payments:ensureFreePlanCreditForClerkUserInternal",
) as any;

export const ensureOrgStorageUsageForOrgInternalReference = makeFunctionReference(
  "payments:ensureOrgStorageUsageForOrgInternal",
) as any;

export const getFreePlanCreditForClerkUserIdInternalReference = makeFunctionReference(
  "payments:getFreePlanCreditForClerkUserIdInternal",
) as any;

export const getFreePlanCreditForOrgIdInternalReference = makeFunctionReference(
  "payments:getFreePlanCreditForOrgIdInternal",
) as any;

export const reserveFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference(
  "payments:reserveFeatureUnitsForCurrentOrgInternal",
) as any;

export const reserveFeatureUnitsForOrgInternalReference = makeFunctionReference(
  "payments:reserveFeatureUnitsForOrgInternal",
) as any;

export const revokeFreePlanCreditByOrgIdInternalReference = makeFunctionReference(
  "payments:revokeFreePlanCreditByOrgIdInternal",
) as any;

export const revokeFreePlanCreditForCurrentOrgInternalReference = makeFunctionReference(
  "payments:revokeFreePlanCreditForCurrentOrgInternal",
) as any;

export const upsertOrgBillingSnapshotForOrgInternalReference = makeFunctionReference(
  "payments:upsertOrgBillingSnapshotForOrgInternal",
) as any;
