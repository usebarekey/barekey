import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { normalizeDeclaredType } from "./declared_types";
import {
  isRolloutFunction,
  resolveRolloutChance,
  type RolloutFunction,
  type RolloutMatchedRule,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "./rollout";

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

type DeclaredType = "string" | "boolean" | "int64" | "float" | "date" | "json";

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
  status: number;
  code: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE";
  message: string;
};

function normalizeName(value: string): string {
  return value.trim();
}

export function readOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseSingleRequest(payload: unknown): EvaluateSingleRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const name = typeof input.name === "string" ? normalizeName(input.name) : "";

  if (projectSlug.length === 0 || stageSlug.length === 0 || name.length === 0) {
    return null;
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    name,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}

export function parseBatchRequest(payload: unknown): EvaluateBatchRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const names = Array.isArray(input.names)
    ? input.names
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeName(value))
    : [];

  if (projectSlug.length === 0 || stageSlug.length === 0 || names.length === 0) {
    return null;
  }

  const unique = new Set<string>();
  for (const name of names) {
    if (name.length === 0 || unique.has(name)) {
      return null;
    }
    unique.add(name);
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    names,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}

export function parseListRequest(payload: unknown): EnvListRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
  };
}

export function parseDefinitionsRequest(payload: unknown): EnvDefinitionsRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  const rawNames = Array.isArray(input.names) ? input.names : null;
  const names =
    rawNames === null
      ? undefined
      : rawNames
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalizeName(value));

  if (rawNames !== null && (names === undefined || names.length !== rawNames.length)) {
    return null;
  }

  if (names !== undefined) {
    const uniqueNames = new Set<string>();
    for (const name of names) {
      if (name.length === 0 || uniqueNames.has(name)) {
        return null;
      }
      uniqueNames.add(name);
    }
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    names,
  };
}

export function parseWriteRequest(payload: unknown): EnvWriteRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  const modeValue = typeof input.mode === "string" ? input.mode.trim() : "upsert";
  const mode: EnvWriteMode = modeValue === "create_only" ? "create_only" : "upsert";

  const rawEntries = Array.isArray(input.entries) ? input.entries : [];
  const entries: EnvWriteRequest["entries"] = [];
  for (const rawEntry of rawEntries) {
    if (typeof rawEntry !== "object" || rawEntry === null) {
      return null;
    }
    const entry = rawEntry as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const visibilityRaw =
      typeof entry.visibility === "string" ? entry.visibility.trim().toLowerCase() : "private";
    if (visibilityRaw !== "public" && visibilityRaw !== "private" && visibilityRaw.length !== 0) {
      return null;
    }
    const visibility: EnvVisibility = visibilityRaw === "public" ? "public" : "private";
    const declaredTypeRaw = typeof entry.declaredType === "string" ? entry.declaredType : "string";
    if (name.length === 0) {
      return null;
    }
    let declaredType: EnvWriteRequest["entries"][number]["declaredType"];
    try {
      declaredType = normalizeDeclaredType(declaredTypeRaw);
    } catch {
      return null;
    }
    if (kind === "secret") {
      if (typeof entry.value !== "string") {
        return null;
      }
      entries.push({
        name,
        visibility,
        kind: "secret",
        declaredType,
        value: entry.value,
      });
      continue;
    }
    if (kind === "ab_roll") {
      if (
        typeof entry.valueA !== "string" ||
        typeof entry.valueB !== "string" ||
        typeof entry.chance !== "number" ||
        !Number.isFinite(entry.chance) ||
        entry.chance < 0 ||
        entry.chance > 1
      ) {
        return null;
      }
      entries.push({
        name,
        visibility,
        kind: "ab_roll",
        declaredType,
        valueA: entry.valueA,
        valueB: entry.valueB,
        chance: entry.chance,
      });
      continue;
    }
    if (kind === "rollout") {
      if (
        typeof entry.valueA !== "string" ||
        typeof entry.valueB !== "string" ||
        typeof entry.rolloutFunction !== "string" ||
        !isRolloutFunction(entry.rolloutFunction) ||
        !Array.isArray(entry.rolloutMilestones)
      ) {
        return null;
      }
      const rolloutMilestones = entry.rolloutMilestones
        .map((milestone) => {
          if (typeof milestone !== "object" || milestone === null) {
            return null;
          }
          const value = milestone as Record<string, unknown>;
          if (
            typeof value.at !== "string" ||
            typeof value.percentage !== "number" ||
            !Number.isFinite(value.percentage)
          ) {
            return null;
          }
          return {
            at: value.at,
            percentage: value.percentage,
          };
        })
        .filter((milestone): milestone is RolloutMilestone => milestone !== null);
      if (rolloutMilestones.length !== entry.rolloutMilestones.length) {
        return null;
      }
      try {
        entries.push({
          name,
          visibility,
          kind: "rollout",
          declaredType,
          valueA: entry.valueA,
          valueB: entry.valueB,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones: validateRolloutMilestones(rolloutMilestones),
        });
      } catch {
        return null;
      }
      continue;
    }
    return null;
  }

  const deletes = Array.isArray(input.deletes)
    ? input.deletes
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const seenNames = new Set<string>();
  for (const entry of entries) {
    if (seenNames.has(entry.name)) {
      return null;
    }
    seenNames.add(entry.name);
  }
  for (const name of deletes) {
    if (seenNames.has(name)) {
      return null;
    }
    seenNames.add(name);
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    mode,
    entries,
    deletes,
  };
}

export function classifyReserveError(error: unknown): ReserveErrorClassification {
  const message =
    error instanceof Error ? error.message : "Billing service is temporarily unavailable.";
  if (
    message === "Usage limit exceeded for this workspace plan." ||
    message === "This workspace is without a plan. Choose a billing plan to enable projects."
  ) {
    return {
      status: 402,
      code: "USAGE_LIMIT_EXCEEDED",
      message,
    };
  }
  return {
    status: 503,
    code: "BILLING_UNAVAILABLE",
    message: "Billing service is temporarily unavailable.",
  };
}

export function readBillingRequestKey(
  request: Request,
  requestId: string,
  scope: string,
): string {
  const headerValue = request.headers.get("x-barekey-request-key")?.trim();
  const suffix = headerValue && headerValue.length > 0 ? headerValue : requestId;
  return `${scope}:${suffix}`;
}

async function deterministicBucket(input: string): Promise<number> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const value =
    ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return (value >>> 0) / 4294967296;
}

export async function resolveVariableValue(input: {
  variable: DecryptedVariable;
  visibility: EnvVisibility;
  seed?: string;
  key?: string;
}): Promise<ResolvedVariableValue> {
  if (input.variable.kind === "secret") {
    return {
      name: input.variable.name,
      kind: "secret",
      declaredType: input.variable.declaredType,
      visibility: input.visibility,
      value: input.variable.value,
    };
  }

  const seed = input.seed?.trim() ?? "";
  const key = input.key?.trim() ?? "";
  const bucket =
    seed.length > 0 || key.length > 0
      ? await deterministicBucket(`${input.variable.kind}:${input.variable.name}:${seed}:${key}`)
      : Math.random();

  if (input.variable.kind === "ab_roll") {
    const chance = input.variable.chance;
    return {
      name: input.variable.name,
      kind: "ab_roll",
      declaredType: input.variable.declaredType,
      visibility: input.visibility,
      value: bucket < chance ? input.variable.valueA : input.variable.valueB,
      decision: {
        bucket,
        chance,
        seed: seed.length > 0 ? seed : undefined,
        key: key.length > 0 ? key : undefined,
        matchedRule: "ab_roll",
      },
    };
  }

  const { chance, matchedRule } = resolveRolloutChance({
    function: input.variable.rolloutFunction,
    milestones: input.variable.rolloutMilestones,
    nowMs: Date.now(),
  });
  return {
    name: input.variable.name,
    kind: "rollout",
    declaredType: input.variable.declaredType,
    visibility: input.visibility,
    value: bucket < chance ? input.variable.valueB : input.variable.valueA,
    decision: {
      bucket,
      chance,
      seed: seed.length > 0 ? seed : undefined,
      key: key.length > 0 ? key : undefined,
      matchedRule,
    },
  };
}

export function buildVariableDefinition(
  variable: DecryptedVariable,
  visibility: EnvVisibility,
): VariableDefinition {
  if (variable.kind === "secret") {
    return {
      name: variable.name,
      kind: "secret",
      declaredType: variable.declaredType,
      visibility,
      value: variable.value,
    };
  }

  if (variable.kind === "ab_roll") {
    return {
      name: variable.name,
      kind: "ab_roll",
      declaredType: variable.declaredType,
      visibility,
      valueA: variable.valueA,
      valueB: variable.valueB,
      chance: variable.chance,
    };
  }

  return {
    name: variable.name,
    kind: "rollout",
    declaredType: variable.declaredType,
    visibility,
    valueA: variable.valueA,
    valueB: variable.valueB,
    rolloutFunction: variable.rolloutFunction,
    rolloutMilestones: variable.rolloutMilestones,
  };
}

export async function resolveDefinitionsForRows(
  ctx: {
    runMutation(functionReference: unknown, args: Record<string, unknown>): Promise<unknown>;
  },
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    rows: Array<ResolvedVariableRow>;
  },
): Promise<Array<VariableDefinition>> {
  const definitions: Array<VariableDefinition> = [];
  for (const row of input.rows) {
    const decrypted = (await ctx.runMutation(
      internal.project_variables.decryptValueForOrgProjectStageInternal,
      {
        orgId: input.orgId,
        projectSlug: input.projectSlug,
        stageSlug: input.stageSlug,
        variableId: row.id,
      },
    )) as DecryptedVariable;
    definitions.push(buildVariableDefinition(decrypted, row.visibility));
  }
  return definitions;
}
