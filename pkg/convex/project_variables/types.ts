import type { Id } from "../_generated/dataModel";
import type { DeclaredVariableType } from "../lib/declared_types";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../lib/project_variable_schedules";
import type { RolloutFunction, RolloutMilestone } from "../lib/rollout";
import type { VariableVisibility } from "../lib/visibility";

export type DraftWriteResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

export type PreparedWriteCreateEntry = ProjectVariablePreparedCreateEntry;

export type PreparedWriteUpdateEntry = ProjectVariablePreparedUpdateEntry;

export type PreparedWriteMutationResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  storageDeltaBytes: number;
  creates: Array<PreparedWriteCreateEntry>;
  updates: Array<PreparedWriteUpdateEntry>;
  deletes: Array<Id<"projectVariables">>;
};

export type WriteWithUsageResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

export type PreparedDraftCreateEntry = {
  name: string;
  visibility: VariableVisibility;
  kind: "secret";
  declaredType: DeclaredVariableType;
  encryptedValue: string;
};

export type PreparedDraftUpdateEntry = {
  id: Id<"projectVariables">;
  visibility: VariableVisibility;
  kind: "secret";
  declaredType: DeclaredVariableType;
  encryptedValue: string;
};

export type PreparedDraft = {
  orgId: string;
  storageDeltaBytes: number;
  creates: Array<PreparedDraftCreateEntry>;
  updates: Array<PreparedDraftUpdateEntry>;
  deletes: Array<Id<"projectVariables">>;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

export type ExistingCiphertextVariableRow = {
  _id: Id<"projectVariables">;
  name: string;
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
};

export type DecryptedVariableValue =
  | {
      id: Id<"projectVariables">;
      name: string;
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      id: Id<"projectVariables">;
      name: string;
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      id: Id<"projectVariables">;
      name: string;
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };
