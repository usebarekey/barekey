import type { Id } from "../_generated/dataModel";
import type { DeclaredVariableType } from "../lib/declared/types";
import type { RolloutFunction, RolloutMilestone } from "../lib/rollout";
import type { VariableVisibility } from "../lib/visibility";

export type ScheduledCreateEntry =
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

export type ScheduledUpdateEntry =
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };
