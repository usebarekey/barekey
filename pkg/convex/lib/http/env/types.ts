import type { Id } from "../../../_generated/dataModel";
import type {
  RolloutFunction,
  RolloutMatchedRule,
  RolloutMilestone,
} from "../../rollout";

export type EnvVisibility = "private" | "public";

export type EvaluateSingleRequest = {
  orgSlug?: string;
  projectSlug: string;
  stageSlug: string;
  name: string;
  key?: string;
  seed?: string;
};

export type EvaluateBatchRequest = {
  orgSlug?: string;
  projectSlug: string;
  stageSlug: string;
  names: Array<string>;
  key?: string;
  seed?: string;
};

export type EnvListRequest = {
  orgSlug?: string;
  projectSlug: string;
  stageSlug: string;
};

export type EnvDefinitionsRequest = {
  orgSlug?: string;
  projectSlug: string;
  stageSlug: string;
  names?: Array<string>;
};

export type EnvWriteMode = "create_only" | "upsert";

export type DeclaredType = "string" | "boolean" | "int64" | "float" | "date" | "json";

export type EnvWriteRequest = {
  orgSlug?: string;
  projectSlug: string;
  stageSlug: string;
  mode: EnvWriteMode;
  entries: Array<
    | {
        name: string;
        visibility: EnvVisibility;
        kind: "secret";
        declaredType: DeclaredType;
        value: string;
      }
    | {
        name: string;
        visibility: EnvVisibility;
        kind: "ab_roll";
        declaredType: DeclaredType;
        valueA: string;
        valueB: string;
        chance: number;
      }
    | {
        name: string;
        visibility: EnvVisibility;
        kind: "rollout";
        declaredType: DeclaredType;
        valueA: string;
        valueB: string;
        rolloutFunction: RolloutFunction;
        rolloutMilestones: Array<RolloutMilestone>;
      }
  >;
  deletes: Array<string>;
};

export type ResolvedVariableRow = {
  id: Id<"projectVariables">;
  projectId: Id<"projects">;
  orgId: string;
  stageSlug: string;
  name: string;
  visibility: EnvVisibility;
  kind: "secret" | "ab_roll" | "rollout";
  declaredType: DeclaredType;
};

export type DecryptedVariable =
  | {
      id: Id<"projectVariables">;
      name: string;
      visibility: EnvVisibility;
      kind: "secret";
      declaredType: DeclaredType;
      value: string;
    }
  | {
      id: Id<"projectVariables">;
      name: string;
      visibility: EnvVisibility;
      kind: "ab_roll";
      declaredType: DeclaredType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      id: Id<"projectVariables">;
      name: string;
      visibility: EnvVisibility;
      kind: "rollout";
      declaredType: DeclaredType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

export type ResolvedVariableValue = {
  name: string;
  kind: "secret" | "ab_roll" | "rollout";
  declaredType: DeclaredType;
  visibility: EnvVisibility;
  value: string;
  decision?: {
    bucket: number;
    chance: number;
    seed?: string;
    key?: string;
    matchedRule: "ab_roll" | RolloutMatchedRule;
  };
};

export type VariableDefinition =
  | {
      name: string;
      kind: "secret";
      declaredType: DeclaredType;
      visibility: EnvVisibility;
      value: string;
    }
  | {
      name: string;
      kind: "ab_roll";
      declaredType: DeclaredType;
      visibility: EnvVisibility;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      name: string;
      kind: "rollout";
      declaredType: DeclaredType;
      visibility: EnvVisibility;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

export type ReserveErrorClassification = {
  isBillingRelated: boolean;
  status: number;
  code: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE";
  message: string;
};
