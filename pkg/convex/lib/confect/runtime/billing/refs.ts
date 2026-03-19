import { makeFunctionReference } from "convex/server";

import type { ReserveFeatureUnitsResult } from "../../../../payments/types";
import type { BillingCompensationResult } from "../../services";

export const reserveFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: string;
    units: number;
    reason: string;
  },
  ReserveFeatureUnitsResult
>("payments:reserveFeatureUnitsForCurrentOrgInternal") as any;

export const reserveFeatureUnitsForOrgInternalReference = makeFunctionReference<
  "action",
  {
    orgId: string;
    orgSlug: string | null;
    featureId: string;
    units: number;
    reason: string;
  },
  ReserveFeatureUnitsResult
>("payments:reserveFeatureUnitsForOrgInternal") as any;

export const compensateFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: string;
    units: number;
    reason: string;
  },
  BillingCompensationResult
>("payments:compensateFeatureUnitsForCurrentOrgInternal") as any;

export const compensateFeatureUnitsForOrgInternalReference = makeFunctionReference<
  "action",
  {
    orgId: string;
    orgSlug: string | null;
    featureId: string;
    units: number;
    reason: string;
  },
  BillingCompensationResult
>("payments:compensateFeatureUnitsForOrgInternal") as any;
