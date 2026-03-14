import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconFolderOpen,
  IconLock,
  IconPercentage,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { RolloutFunction, RolloutMilestone } from "@convex/lib/rollout";
import type { ProjectRouteContext } from "../layout";
import { FloatingDraftToolbar } from "@/components/custom/floating-draft-toolbar";
import { RolloutTimelineEditor } from "@/components/custom/rollout-timeline-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgSectionCard } from "@/components/custom/org-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { CodeEditor } from "@/components/custom/code-editor";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { parseEnvText, type ParsedEnvIssue } from "@/lib/parse-env-text";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

type DeclaredVariableType = "string" | "boolean" | "int64" | "float" | "date" | "json";
type VariableVisibility = "private" | "public";

type SecretDraftValue = {
  kind: "secret";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  value: string;
};

type AbRollDraftValue = {
  kind: "ab_roll";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  valueA: string;
  valueB: string;
  chance: string;
};

type RolloutDraftValue = {
  kind: "rollout";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  valueA: string;
  valueB: string;
  rolloutFunction: RolloutFunction;
  rolloutMilestones: Array<RolloutMilestone>;
};

type VariableKind = "secret" | "ab_roll" | "rollout";

type NewVariableDraftValue = SecretDraftValue | AbRollDraftValue | RolloutDraftValue;
type VariableDraftValue = SecretDraftValue | AbRollDraftValue | RolloutDraftValue;

type NewVariableDraft = {
  localId: string;
  name: string;
  isRevealed: boolean;
} & NewVariableDraftValue;

type RevealedVariableValue =
  | { kind: "secret"; declaredType: DeclaredVariableType; value: string }
  | {
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

type StageDraftState = {
  newRows: Array<NewVariableDraft>;
  updatedValues: Record<string, VariableDraftValue>;
  deletedIds: Record<string, boolean>;
  revealedValues: Record<string, RevealedVariableValue>;
  revealedIds: Record<string, boolean>;
  decryptingIds: Record<string, boolean>;
};

type VariableDisplayRow =
  | {
      key: string;
      type: "existing";
      id: Id<"projectVariables">;
      name: string;
      visibility: VariableVisibility;
      kind: "secret" | "ab_roll" | "rollout";
      declaredType: DeclaredVariableType;
      chance: number | null;
      rolloutFunction: RolloutFunction | null;
      rolloutMilestones: Array<RolloutMilestone> | null;
      createdAtMs: number;
      updatedAtMs: number;
    }
  | ({ key: string; type: "new"; localId: string; name: string } & VariableDraftValue);

type ImportIssue = ParsedEnvIssue & { source: string };
type ImportSummary = {
  importedCount: number;
  createdCount: number;
  overwrittenCount: number;
  issues: Array<ImportIssue>;
};

type DialogMode =
  | { mode: "closed" }
  | { mode: "create" }
  | {
      mode: "edit-existing";
      row: Extract<VariableDisplayRow, { type: "existing" }>;
      loading: boolean;
    }
  | { mode: "edit-new"; localId: string };

type DialogSecretForm = {
  name: string;
  kind: "secret";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  value: string;
};

type DialogAbRollForm = {
  name: string;
  kind: "ab_roll";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  valueA: string;
  valueB: string;
  chance: number;
};

type DialogRolloutForm = {
  name: string;
  kind: "rollout";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
  valueA: string;
  valueB: string;
  rolloutFunction: RolloutFunction;
  rolloutMilestones: Array<RolloutMilestone>;
};

type DialogForm = DialogSecretForm | DialogAbRollForm | DialogRolloutForm;

// ─── Constants ──────────────────────────────────────────────────────

const VARIABLE_TYPE_OPTIONS: Array<{ value: DeclaredVariableType; label: string }> = [
  { value: "string", label: "String" },
  { value: "boolean", label: "Boolean" },
  { value: "int64", label: "Integer" },
  { value: "float", label: "Float" },
  { value: "date", label: "Date" },
  { value: "json", label: "JSON" },
];

const KIND_LABELS: Record<VariableKind, string> = {
  secret: "Secret",
  ab_roll: "A/B roll",
  rollout: "Rollout",
};

const VARIABLE_TYPE_LABELS: Record<DeclaredVariableType, string> = {
  string: "String",
  boolean: "Boolean",
  int64: "Integer",
  float: "Float",
  date: "Date",
  json: "JSON",
};

const VISIBILITY_LABELS: Record<VariableVisibility, string> = {
  private: "Private",
  public: "Public",
};

// ─── Helpers ────────────────────────────────────────────────────────

const RFC3339_WITH_TIMEZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const DEFAULT_DIALOG_CHANCE = 0.5;

function normalizeDraftValue(declaredType: DeclaredVariableType, raw: string): string {
  if (declaredType === "string") return raw;
  if (declaredType === "boolean") {
    const n = raw.trim().toLowerCase();
    if (n === "true" || n === "1" || n === "yes") return "true";
    if (n === "false" || n === "0" || n === "no") return "false";
    throw new Error("Boolean variables must be true or false.");
  }
  if (declaredType === "int64") {
    const t = raw.trim();
    if (!/^-?(0|[1-9]\d*)$/.test(t))
      throw new Error("Integer variables must be valid signed 64-bit integers.");
    const parsed = BigInt(t);
    if (parsed < BigInt("-9223372036854775808") || parsed > BigInt("9223372036854775807")) {
      throw new Error("Integer variables must be valid signed 64-bit integers.");
    }
    return parsed.toString();
  }
  if (declaredType === "float") {
    const t = raw.trim();
    if (t.length === 0 || !Number.isFinite(Number(t)))
      throw new Error("Float variables must be finite numbers.");
    return t;
  }
  if (declaredType === "date") {
    const t = raw.trim();
    if (!RFC3339_WITH_TIMEZONE_PATTERN.test(t))
      throw new Error("Date variables must be ISO 8601 with timezone.");
    const parsed = new Date(t);
    if (Number.isNaN(parsed.getTime()))
      throw new Error("Date variables must be ISO 8601 with timezone.");
    return parsed.toISOString();
  }
  try {
    return JSON.stringify(JSON.parse(raw) as unknown);
  } catch {
    throw new Error("JSON variables must contain valid JSON.");
  }
}

function createEmptyDraftState(): StageDraftState {
  return {
    newRows: [],
    updatedValues: {},
    deletedIds: {},
    revealedValues: {},
    revealedIds: {},
    decryptingIds: {},
  };
}

function hasPersistedDraftChanges(draft: StageDraftState): boolean {
  return (
    draft.newRows.length > 0 ||
    Object.keys(draft.updatedValues).length > 0 ||
    Object.keys(draft.deletedIds).length > 0
  );
}

function hasStoredStageState(draft: StageDraftState): boolean {
  return (
    hasPersistedDraftChanges(draft) ||
    Object.keys(draft.revealedValues).length > 0 ||
    Object.keys(draft.revealedIds).length > 0 ||
    Object.keys(draft.decryptingIds).length > 0
  );
}

function cloneDraft(draft: StageDraftState): StageDraftState {
  return {
    newRows: draft.newRows.map((r) => ({ ...r })),
    updatedValues: { ...draft.updatedValues },
    deletedIds: { ...draft.deletedIds },
    revealedValues: { ...draft.revealedValues },
    revealedIds: { ...draft.revealedIds },
    decryptingIds: { ...draft.decryptingIds },
  };
}

function createDefaultRolloutMilestone(
  percentage = 0,
  at = new Date().toISOString(),
): RolloutMilestone {
  return {
    at,
    percentage,
  };
}

function createDefaultDialogForm(kind: VariableKind = "secret"): DialogForm {
  if (kind === "ab_roll") {
    return {
      name: "",
      kind: "ab_roll",
      visibility: "private",
      declaredType: "string",
      valueA: "",
      valueB: "",
      chance: DEFAULT_DIALOG_CHANCE,
    };
  }

  if (kind === "rollout") {
    return {
      name: "",
      kind: "rollout",
      visibility: "private",
      declaredType: "string",
      valueA: "",
      valueB: "",
      rolloutFunction: "linear",
      rolloutMilestones: [createDefaultRolloutMilestone(0)],
    };
  }

  return {
    name: "",
    kind: "secret",
    visibility: "private",
    declaredType: "string",
    value: "",
  };
}

function normalizeChance(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DIALOG_CHANCE;
  }
  return Math.min(Math.max(value, 0), 1);
}

function getInitialRolloutBPercentage(milestones: Array<RolloutMilestone>): number {
  const first = milestones[0];
  if (first === undefined || !Number.isFinite(first.percentage)) {
    return 0;
  }
  return Math.min(Math.max(first.percentage, 0), 100);
}

function convertDialogFormKind(form: DialogForm, nextKind: VariableKind): DialogForm {
  if (form.kind === nextKind) {
    return form;
  }

  if (nextKind === "secret") {
    return {
      name: form.name,
      kind: "secret",
      visibility: form.visibility,
      declaredType: form.declaredType,
      value: form.kind === "secret" ? form.value : form.valueA,
    };
  }

  if (nextKind === "ab_roll") {
    if (form.kind === "secret") {
      return {
        name: form.name,
        kind: "ab_roll",
        visibility: form.visibility,
        declaredType: form.declaredType,
        valueA: form.value,
        valueB: "",
        chance: DEFAULT_DIALOG_CHANCE,
      };
    }

    if (form.kind === "rollout") {
      return {
        name: form.name,
        kind: "ab_roll",
        visibility: form.visibility,
        declaredType: form.declaredType,
        valueA: form.valueA,
        valueB: form.valueB,
        chance: normalizeChance(1 - getInitialRolloutBPercentage(form.rolloutMilestones) / 100),
      };
    }

    return form;
  }

  if (form.kind === "secret") {
    return {
      name: form.name,
      kind: "rollout",
      visibility: form.visibility,
      declaredType: form.declaredType,
      valueA: form.value,
      valueB: "",
      rolloutFunction: "linear",
      rolloutMilestones: [createDefaultRolloutMilestone(0)],
    };
  }

  if (form.kind === "ab_roll") {
    return {
      name: form.name,
      kind: "rollout",
      visibility: form.visibility,
      declaredType: form.declaredType,
      valueA: form.valueA,
      valueB: form.valueB,
      rolloutFunction: "linear",
      rolloutMilestones: [createDefaultRolloutMilestone((1 - normalizeChance(form.chance)) * 100)],
    };
  }

  return form;
}

function cloneRolloutMilestones(value: Array<RolloutMilestone>): Array<RolloutMilestone> {
  return value.map((milestone) => ({
    at: milestone.at,
    percentage: milestone.percentage,
  }));
}

function toDialogFormFromDraftValue(name: string, value: VariableDraftValue): DialogForm {
  if (value.kind === "secret") {
    return {
      name,
      kind: "secret",
      visibility: value.visibility,
      declaredType: value.declaredType,
      value: value.value,
    };
  }

  if (value.kind === "ab_roll") {
    return {
      name,
      kind: "ab_roll",
      visibility: value.visibility,
      declaredType: value.declaredType,
      valueA: value.valueA,
      valueB: value.valueB,
      chance: normalizeChance(Number(value.chance)),
    };
  }

  return {
    name,
    kind: "rollout",
    visibility: value.visibility,
    declaredType: value.declaredType,
    valueA: value.valueA,
    valueB: value.valueB,
    rolloutFunction: value.rolloutFunction,
    rolloutMilestones: cloneRolloutMilestones(value.rolloutMilestones),
  };
}

function toDialogFormFromRevealedValue(
  name: string,
  value: RevealedVariableValue,
  visibility: VariableVisibility,
): DialogForm {
  if (value.kind === "secret") {
    return {
      name,
      kind: "secret",
      visibility,
      declaredType: value.declaredType,
      value: value.value,
    };
  }

  if (value.kind === "ab_roll") {
    return {
      name,
      kind: "ab_roll",
      visibility,
      declaredType: value.declaredType,
      valueA: value.valueA,
      valueB: value.valueB,
      chance: normalizeChance(value.chance),
    };
  }

  return {
    name,
    kind: "rollout",
    visibility,
    declaredType: value.declaredType,
    valueA: value.valueA,
    valueB: value.valueB,
    rolloutFunction: value.rolloutFunction,
    rolloutMilestones: cloneRolloutMilestones(value.rolloutMilestones),
  };
}

function createLoadingDialogForm(
  row: Extract<VariableDisplayRow, { type: "existing" }>,
): DialogForm {
  if (row.kind === "secret") {
    return {
      name: row.name,
      kind: "secret",
      visibility: row.visibility,
      declaredType: row.declaredType,
      value: "",
    };
  }

  if (row.kind === "ab_roll") {
    return {
      name: row.name,
      kind: "ab_roll",
      visibility: row.visibility,
      declaredType: row.declaredType,
      valueA: "",
      valueB: "",
      chance: normalizeChance(row.chance ?? DEFAULT_DIALOG_CHANCE),
    };
  }

  return {
    name: row.name,
    kind: "rollout",
    visibility: row.visibility,
    declaredType: row.declaredType,
    valueA: "",
    valueB: "",
    rolloutFunction: row.rolloutFunction ?? "linear",
    rolloutMilestones: cloneRolloutMilestones(
      row.rolloutMilestones ?? [createDefaultRolloutMilestone(0)],
    ),
  };
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

// ─── Variable Editor Dialog ─────────────────────────────────────────

function VariableEditorDialog({
  dialogState,
  form,
  setForm,
  onApply,
  onClose,
  isExistingKindLocked,
}: {
  dialogState: DialogMode;
  form: DialogForm;
  setForm: React.Dispatch<React.SetStateAction<DialogForm>>;
  onApply: () => void;
  onClose: () => void;
  isExistingKindLocked: boolean;
}) {
  const isOpen = dialogState.mode !== "closed";
  const isCreate = dialogState.mode === "create";
  const isLoading = dialogState.mode === "edit-existing" && dialogState.loading;
  const isJson = form.declaredType === "json";
  const chance = form.kind === "ab_roll" ? normalizeChance(form.chance) : DEFAULT_DIALOG_CHANCE;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add variable" : `Edit ${form.name || "variable"}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a new variable in this stage."
              : "Modify the value, type, or kind of this variable."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <SkeletonPlaceholder
              className="w-28 rounded-md"
              content={<p className="text-sm text-muted-foreground">Decrypting...</p>}
            />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-px w-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="var-name">Name</Label>
              <Input
                id="var-name"
                value={form.name}
                disabled={!isCreate}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setForm((f) => ({ ...f, name: v }));
                }}
                placeholder="DATABASE_URL"
                className="font-mono"
              />
            </div>

            {/* Kind + Type row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  disabled={isExistingKindLocked}
                  onValueChange={(v) => {
                    if (v !== "secret" && v !== "ab_roll" && v !== "rollout") return;
                    setForm((current) => convertDialogFormKind(current, v));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue displayNameMap={KIND_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secret">Secret</SelectItem>
                    <SelectItem value="ab_roll">A/B roll</SelectItem>
                    <SelectItem value="rollout">Rollout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.declaredType}
                  onValueChange={(v) =>
                    setForm((current) => ({
                      ...current,
                      declaredType: v as DeclaredVariableType,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue displayNameMap={VARIABLE_TYPE_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIABLE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) =>
                    setForm((current) => ({
                      ...current,
                      visibility: v as VariableVisibility,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue displayNameMap={VISIBILITY_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Value fields */}
            {form.kind === "secret" ? (
              <div className="space-y-1.5">
                <Label htmlFor="var-value">Value</Label>
                {isJson ? (
                  <CodeEditor
                    id="var-value"
                    value={form.value}
                    onChange={(v) => setForm((f) => ({ ...f, value: v }))}
                    placeholder='{"key": "value"}'
                    className="min-h-28"
                  />
                ) : (
                  <Input
                    id="var-value"
                    value={form.value}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      setForm((f) => ({ ...f, value: v }));
                    }}
                    placeholder="Enter value..."
                    className="font-mono"
                  />
                )}
              </div>
            ) : form.kind === "ab_roll" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="var-value-a">
                      Value A{" "}
                      <span className="text-muted-foreground font-normal">
                        ({Math.round(chance * 100)}%)
                      </span>
                    </Label>
                    {isJson ? (
                      <CodeEditor
                        id="var-value-a"
                        value={form.valueA}
                        onChange={(v) =>
                          setForm((current) =>
                            current.kind === "ab_roll" ? { ...current, valueA: v } : current,
                          )
                        }
                        placeholder="Value A"
                        className="min-h-20"
                      />
                    ) : (
                      <Input
                        id="var-value-a"
                        value={form.valueA}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setForm((current) =>
                            current.kind === "ab_roll" ? { ...current, valueA: v } : current,
                          );
                        }}
                        placeholder="Value A"
                        className="font-mono"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="var-value-b">
                      Value B{" "}
                      <span className="text-muted-foreground font-normal">
                        ({Math.round((1 - chance) * 100)}%)
                      </span>
                    </Label>
                    {isJson ? (
                      <CodeEditor
                        id="var-value-b"
                        value={form.valueB}
                        onChange={(v) =>
                          setForm((current) =>
                            current.kind === "ab_roll" ? { ...current, valueB: v } : current,
                          )
                        }
                        placeholder="Value B"
                        className="min-h-20"
                      />
                    ) : (
                      <Input
                        id="var-value-b"
                        value={form.valueB}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setForm((current) =>
                            current.kind === "ab_roll" ? { ...current, valueB: v } : current,
                          );
                        }}
                        placeholder="Value B"
                        className="font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Chance slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Chance for A</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {chance.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[chance * 100]}
                    min={0}
                    max={100}
                    onValueChange={(vals) => {
                      const v = Array.isArray(vals) ? vals[0] : vals;
                      setForm((current) =>
                        current.kind === "ab_roll"
                          ? { ...current, chance: normalizeChance((v ?? 50) / 100) }
                          : current,
                      );
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Always B</span>
                    <span>Always A</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="var-rollout-value-a">Value A</Label>
                    {isJson ? (
                      <CodeEditor
                        id="var-rollout-value-a"
                        value={form.valueA}
                        onChange={(v) =>
                          setForm((current) =>
                            current.kind === "rollout" ? { ...current, valueA: v } : current,
                          )
                        }
                        placeholder="Value A"
                        className="min-h-20"
                      />
                    ) : (
                      <Input
                        id="var-rollout-value-a"
                        value={form.valueA}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setForm((current) =>
                            current.kind === "rollout" ? { ...current, valueA: v } : current,
                          );
                        }}
                        placeholder="Value A"
                        className="font-mono"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="var-rollout-value-b">Value B</Label>
                    {isJson ? (
                      <CodeEditor
                        id="var-rollout-value-b"
                        value={form.valueB}
                        onChange={(v) =>
                          setForm((current) =>
                            current.kind === "rollout" ? { ...current, valueB: v } : current,
                          )
                        }
                        placeholder="Value B"
                        className="min-h-20"
                      />
                    ) : (
                      <Input
                        id="var-rollout-value-b"
                        value={form.valueB}
                        onChange={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setForm((current) =>
                            current.kind === "rollout" ? { ...current, valueB: v } : current,
                          );
                        }}
                        placeholder="Value B"
                        className="font-mono"
                      />
                    )}
                  </div>
                </div>

                <RolloutTimelineEditor
                  rolloutFunction={form.rolloutFunction}
                  milestones={form.rolloutMilestones}
                  onFunctionChange={(value) =>
                    setForm((current) =>
                      current.kind === "rollout" ? { ...current, rolloutFunction: value } : current,
                    )
                  }
                  onMilestonesChange={(value) =>
                    setForm((current) =>
                      current.kind === "rollout"
                        ? { ...current, rolloutMilestones: value }
                        : current,
                    )
                  }
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onApply} disabled={isLoading}>
            {isCreate ? "Add to draft" : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variable list row ──────────────────────────────────────────────

function VariableRow({
  row,
  isDeleted,
  isModified,
  isNew,
  onClick,
  onDelete,
}: {
  row: VariableDisplayRow;
  isDeleted: boolean;
  isModified: boolean;
  isNew: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const name = row.name || "(unnamed)";
  const kind = row.type === "existing" ? row.kind : row.kind;
  const visibility = row.visibility;
  const declaredType = row.type === "existing" ? row.declaredType : row.declaredType;
  const updatedAtMs = row.type === "existing" ? row.updatedAtMs : null;
  const chance = row.type === "existing" && row.kind === "ab_roll" ? row.chance : null;
  const rolloutFunction =
    row.kind === "rollout"
      ? row.type === "existing"
        ? row.rolloutFunction
        : row.rolloutFunction
      : null;
  const rolloutPointCount =
    row.kind === "rollout"
      ? row.type === "existing"
        ? (row.rolloutMilestones?.length ?? 0)
        : row.rolloutMilestones.length
      : 0;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b px-4 py-3 transition-colors cursor-pointer",
        isDeleted && "opacity-40 line-through",
        !isDeleted && "hover:bg-secondary/40",
      )}
      onClick={isDeleted ? undefined : onClick}
      role="button"
      tabIndex={isDeleted ? -1 : 0}
      onKeyDown={(e) => {
        if (!isDeleted && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Icon */}
      <div className="flex size-8 shrink-0 items-center justify-center border bg-secondary/50">
        {kind === "rollout" ? (
          <IconPercentage className="size-3.5 text-muted-foreground" />
        ) : kind === "ab_roll" ? (
          <IconPercentage className="size-3.5 text-muted-foreground" />
        ) : (
          <IconLock className="size-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm">{name}</span>
          {isNew && (
            <Badge variant="outline" className="text-[10px]">
              new
            </Badge>
          )}
          {isModified && !isNew && (
            <Badge variant="secondary" className="text-[10px]">
              modified
            </Badge>
          )}
          {isDeleted && (
            <Badge variant="destructive" className="text-[10px]">
              deleted
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{VISIBILITY_LABELS[visibility]}</span>
          <span>·</span>
          <span>{KIND_LABELS[kind] ?? kind}</span>
          <span>·</span>
          <span>{declaredType}</span>
          {chance !== null && (
            <>
              <span>·</span>
              <span>
                {Math.round(chance * 100)}/{Math.round((1 - chance) * 100)}
              </span>
            </>
          )}
          {rolloutFunction !== null && (
            <>
              <span>·</span>
              <span>{rolloutFunction.replaceAll("_", " ")}</span>
              <span>·</span>
              <span>
                {rolloutPointCount} point{rolloutPointCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          {updatedAtMs && (
            <>
              <span>·</span>
              <span>{relativeTime(updatedAtMs)}</span>
            </>
          )}
        </div>
      </div>

      {/* Quick delete */}
      {!isDeleted && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${name}`}
        >
          <IconTrash className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const [selectedStageSlug, setSelectedStageSlug] = useState<string | null>(null);
  const [draftByStage, setDraftByStage] = useState<Record<string, StageDraftState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogState, setDialogState] = useState<DialogMode>({ mode: "closed" });
  const [dialogForm, setDialogForm] = useState<DialogForm>(createDefaultDialogForm());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftToolbarRef = useRef<HTMLDivElement | null>(null);
  const seededProjectsRef = useRef<Record<string, boolean>>({});

  const stages = useQuery(api.project_stages.listForCurrentOrgProject, {
    expectedOrgSlug: project.orgSlug,
    projectSlug: project.projectSlug,
  });
  const variables = useQuery(
    api.project_variables.listForCurrentOrgProjectStage,
    selectedStageSlug
      ? {
          expectedOrgSlug: project.orgSlug,
          projectSlug: project.projectSlug,
          stageSlug: selectedStageSlug,
        }
      : "skip",
  );
  const applyDraft = useAction(api.project_variables.applyDraftForCurrentOrgProjectStage);
  const decryptVariable = useMutation(api.project_variables.decryptValueForCurrentOrgProjectStage);
  const ensureDefaultStages = useMutation(
    api.project_stages.ensureDefaultStagesForCurrentOrgProject,
  );

  const currentDraft =
    selectedStageSlug === null
      ? createEmptyDraftState()
      : (draftByStage[selectedStageSlug] ?? createEmptyDraftState());
  const persistedRows = variables ?? [];
  const selectedEnvironment = stages?.find((s) => s.slug === selectedStageSlug) ?? null;

  // ─── Stage initialization ───────────────────────────────────────

  useEffect(() => {
    if (!stages) return;
    const dev = stages.find((s) => s.slug === "development");
    const fallback = dev?.slug ?? stages[0]?.slug ?? null;
    if (selectedStageSlug === null) {
      if (fallback !== null) setSelectedStageSlug(fallback);
      return;
    }
    if (!stages.some((s) => s.slug === selectedStageSlug)) setSelectedStageSlug(fallback);
  }, [selectedStageSlug, stages]);

  useEffect(() => {
    if (!stages || stages.length > 0) return;
    const key = `${project.orgSlug}/${project.projectSlug}`;
    if (seededProjectsRef.current[key]) return;
    seededProjectsRef.current[key] = true;
    void ensureDefaultStages({
      expectedOrgSlug: project.orgSlug,
      projectSlug: project.projectSlug,
    }).catch((e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to initialize stages."),
    );
  }, [ensureDefaultStages, project.orgSlug, project.projectSlug, stages]);

  // ─── Paste handler ──────────────────────────────────────────────

  useEffect(() => {
    function handlePaste(event: ClipboardEvent): void {
      if (!selectedStageSlug) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable='true']")
      )
        return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (text.trim().length === 0) return;
      event.preventDefault();
      void importTextSource("clipboard", text);
    }
    window.addEventListener("paste", handlePaste, true);
    return () => window.removeEventListener("paste", handlePaste, true);
  }, [selectedStageSlug, persistedRows]);

  // ─── Rows ───────────────────────────────────────────────────────

  const rows = useMemo(() => {
    const existing: Array<VariableDisplayRow> = persistedRows.map((r) => ({
      key: `existing-${r.id}`,
      type: "existing" as const,
      id: r.id,
      name: r.name,
      visibility: r.visibility,
      kind: r.kind,
      declaredType: r.declaredType,
      chance: r.chance,
      rolloutFunction: r.rolloutFunction,
      rolloutMilestones: r.rolloutMilestones,
      createdAtMs: r.createdAtMs,
      updatedAtMs: r.updatedAtMs,
    }));
    const newRows: Array<VariableDisplayRow> = currentDraft.newRows.map((r) =>
      r.kind === "secret"
        ? {
            key: `new-${r.localId}`,
            type: "new" as const,
            localId: r.localId,
            name: r.name,
            visibility: r.visibility,
            kind: "secret" as const,
            declaredType: r.declaredType,
            value: r.value,
          }
        : r.kind === "ab_roll"
          ? {
              key: `new-${r.localId}`,
              type: "new" as const,
              localId: r.localId,
              name: r.name,
              visibility: r.visibility,
              kind: "ab_roll" as const,
              declaredType: r.declaredType,
              valueA: r.valueA,
              valueB: r.valueB,
              chance: r.chance,
            }
          : {
              key: `new-${r.localId}`,
              type: "new" as const,
              localId: r.localId,
              name: r.name,
              visibility: r.visibility,
              kind: "rollout" as const,
              declaredType: r.declaredType,
              valueA: r.valueA,
              valueB: r.valueB,
              rolloutFunction: r.rolloutFunction,
              rolloutMilestones: r.rolloutMilestones,
            },
    );
    return [...existing, ...newRows];
  }, [currentDraft.newRows, persistedRows]);

  const filteredRows = useMemo(() => {
    if (searchQuery.trim().length === 0) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  // ─── Draft helpers ──────────────────────────────────────────────

  const updateCurrentStageDraft = useCallback(
    (updater: (current: StageDraftState) => StageDraftState): void => {
      if (!selectedStageSlug) return;
      setDraftByStage((prev) => {
        const current = prev[selectedStageSlug] ?? createEmptyDraftState();
        const next = updater(cloneDraft(current));
        if (!hasStoredStageState(next)) {
          const { [selectedStageSlug]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [selectedStageSlug]: next };
      });
    },
    [selectedStageSlug],
  );

  function clearCurrentStageDraft(): void {
    if (!selectedStageSlug) return;
    setDraftByStage((prev) => {
      const { [selectedStageSlug]: _, ...rest } = prev;
      return rest;
    });
  }

  // ─── Dialog open handlers ───────────────────────────────────────

  function openCreateDialog() {
    setDialogForm(createDefaultDialogForm());
    setDialogState({ mode: "create" });
  }

  async function openEditExistingDialog(row: Extract<VariableDisplayRow, { type: "existing" }>) {
    const pending = currentDraft.updatedValues[row.id];
    if (pending) {
      setDialogForm(toDialogFormFromDraftValue(row.name, pending));
      setDialogState({ mode: "edit-existing", row, loading: false });
      return;
    }

    setDialogState({ mode: "edit-existing", row, loading: true });
    setDialogForm(createLoadingDialogForm(row));

    try {
      const decrypted = await decryptVariable({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
        stageSlug: selectedStageSlug!,
        variableId: row.id,
      });

      updateCurrentStageDraft((current) => {
        current.revealedValues[row.id] =
          decrypted.kind === "secret"
            ? { kind: "secret", declaredType: decrypted.declaredType, value: decrypted.value }
            : decrypted.kind === "ab_roll"
              ? {
                  kind: "ab_roll",
                  declaredType: decrypted.declaredType,
                  valueA: decrypted.valueA,
                  valueB: decrypted.valueB,
                  chance: decrypted.chance,
                }
              : {
                  kind: "rollout",
                  declaredType: decrypted.declaredType,
                  valueA: decrypted.valueA,
                  valueB: decrypted.valueB,
                  rolloutFunction: decrypted.rolloutFunction,
                  rolloutMilestones: decrypted.rolloutMilestones,
                };
        current.revealedIds[row.id] = true;
        return current;
      });

      setDialogForm(toDialogFormFromRevealedValue(row.name, decrypted, row.visibility));
      setDialogState({ mode: "edit-existing", row, loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to decrypt variable.");
      setDialogState({ mode: "closed" });
    }
  }

  function openEditNewDialog(localId: string) {
    const draft = currentDraft.newRows.find((r) => r.localId === localId);
    if (!draft) return;
    setDialogForm(toDialogFormFromDraftValue(draft.name, draft));
    setDialogState({ mode: "edit-new", localId });
  }

  // ─── Dialog apply ───────────────────────────────────────────────

  function handleDialogApply() {
    if (dialogState.mode === "create") {
      const trimmedName = dialogForm.name.trim();
      if (trimmedName.length === 0) {
        toast.error("Name is required.");
        return;
      }
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newRow: NewVariableDraft =
        dialogForm.kind === "secret"
          ? {
              localId,
              name: trimmedName,
              isRevealed: true,
              kind: "secret",
              visibility: dialogForm.visibility,
              declaredType: dialogForm.declaredType,
              value: dialogForm.value,
            }
          : dialogForm.kind === "ab_roll"
            ? {
                localId,
                name: trimmedName,
                isRevealed: true,
                kind: "ab_roll",
                visibility: dialogForm.visibility,
                declaredType: dialogForm.declaredType,
                valueA: dialogForm.valueA,
                valueB: dialogForm.valueB,
                chance: String(dialogForm.chance),
              }
            : {
                localId,
                name: trimmedName,
                isRevealed: true,
                kind: "rollout",
                visibility: dialogForm.visibility,
                declaredType: dialogForm.declaredType,
                valueA: dialogForm.valueA,
                valueB: dialogForm.valueB,
                rolloutFunction: dialogForm.rolloutFunction,
                rolloutMilestones: cloneRolloutMilestones(dialogForm.rolloutMilestones),
              };

      updateCurrentStageDraft((current) => {
        current.newRows.unshift(newRow);
        return current;
      });
    } else if (dialogState.mode === "edit-existing") {
      const row = dialogState.row;
      const draftValue: VariableDraftValue =
        dialogForm.kind === "secret"
          ? {
              kind: "secret",
              visibility: dialogForm.visibility,
              declaredType: dialogForm.declaredType,
              value: dialogForm.value,
            }
          : dialogForm.kind === "ab_roll"
            ? {
                kind: "ab_roll",
                visibility: dialogForm.visibility,
                declaredType: dialogForm.declaredType,
                valueA: dialogForm.valueA,
                valueB: dialogForm.valueB,
                chance: String(dialogForm.chance),
              }
            : {
                kind: "rollout",
                visibility: dialogForm.visibility,
                declaredType: dialogForm.declaredType,
                valueA: dialogForm.valueA,
                valueB: dialogForm.valueB,
                rolloutFunction: dialogForm.rolloutFunction,
                rolloutMilestones: cloneRolloutMilestones(dialogForm.rolloutMilestones),
              };

      updateCurrentStageDraft((current) => {
        current.updatedValues[row.id] = draftValue;
        return current;
      });
    } else if (dialogState.mode === "edit-new") {
      const localId = dialogState.localId;
      updateCurrentStageDraft((current) => {
        const idx = current.newRows.findIndex((r) => r.localId === localId);
        if (idx < 0) return current;
        current.newRows[idx] =
          dialogForm.kind === "secret"
            ? {
                ...current.newRows[idx],
                name: dialogForm.name.trim(),
                kind: "secret",
                visibility: dialogForm.visibility,
                declaredType: dialogForm.declaredType,
                value: dialogForm.value,
              }
            : dialogForm.kind === "ab_roll"
              ? {
                  ...current.newRows[idx],
                  name: dialogForm.name.trim(),
                  kind: "ab_roll",
                  visibility: dialogForm.visibility,
                  declaredType: dialogForm.declaredType,
                  valueA: dialogForm.valueA,
                  valueB: dialogForm.valueB,
                  chance: String(dialogForm.chance),
                }
              : {
                  ...current.newRows[idx],
                  name: dialogForm.name.trim(),
                  kind: "rollout",
                  visibility: dialogForm.visibility,
                  declaredType: dialogForm.declaredType,
                  valueA: dialogForm.valueA,
                  valueB: dialogForm.valueB,
                  rolloutFunction: dialogForm.rolloutFunction,
                  rolloutMilestones: cloneRolloutMilestones(dialogForm.rolloutMilestones),
                };
        return current;
      });
    }
    setDialogState({ mode: "closed" });
  }

  // ─── Delete handler ─────────────────────────────────────────────

  function handleDeleteRow(row: VariableDisplayRow) {
    if (row.type === "existing") {
      updateCurrentStageDraft((current) => {
        current.deletedIds[row.id] = true;
        delete current.updatedValues[row.id];
        delete current.revealedIds[row.id];
        delete current.revealedValues[row.id];
        return current;
      });
    } else {
      updateCurrentStageDraft((current) => {
        current.newRows = current.newRows.filter((r) => r.localId !== row.localId);
        return current;
      });
    }
  }

  // ─── Import ─────────────────────────────────────────────────────

  function applyImportedEntries(
    entries: Array<{ name: string; value: string; source: string; lineNumber: number }>,
    issues: Array<ImportIssue>,
  ): void {
    const existingByName = new Map(persistedRows.map((r) => [r.name, r]));
    let importedCount = 0;
    let overwrittenCount = 0;
    let createdCount = 0;

    updateCurrentStageDraft((current) => {
      for (const entry of entries) {
        importedCount += 1;
        const existing = existingByName.get(entry.name);
        if (existing) {
          if (current.deletedIds[existing.id]) delete current.deletedIds[existing.id];
          if (current.updatedValues[existing.id] !== undefined) overwrittenCount += 1;
          current.updatedValues[existing.id] = {
            kind: "secret",
            visibility: existing.visibility,
            declaredType: existing.declaredType,
            value: entry.value,
          };
          continue;
        }
        const newIdx = current.newRows.findIndex((r) => r.name === entry.name);
        if (newIdx >= 0) {
          current.newRows[newIdx] = {
            localId: current.newRows[newIdx].localId,
            name: current.newRows[newIdx].name,
            isRevealed: current.newRows[newIdx].isRevealed,
            kind: "secret",
            visibility: current.newRows[newIdx].visibility,
            declaredType: current.newRows[newIdx].declaredType,
            value: entry.value,
          };
          overwrittenCount += 1;
          continue;
        }
        current.newRows.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: entry.name,
          isRevealed: false,
          kind: "secret",
          visibility: "private",
          declaredType: "string",
          value: entry.value,
        });
        createdCount += 1;
      }
      return current;
    });
    setImportSummary({ importedCount, createdCount, overwrittenCount, issues });
  }

  async function importTextSource(source: string, text: string): Promise<void> {
    const parsed = parseEnvText(text);
    applyImportedEntries(
      parsed.entries.map((e) => ({
        name: e.name,
        value: e.value,
        source,
        lineNumber: e.lineNumber,
      })),
      parsed.issues.map((i) => ({ ...i, source })),
    );
  }

  async function importFiles(files: Array<File>): Promise<void> {
    const allEntries: Array<{ name: string; value: string; source: string; lineNumber: number }> =
      [];
    const allIssues: Array<ImportIssue> = [];
    for (const file of files) {
      const text = await file.text();
      const parsed = parseEnvText(text);
      allEntries.push(
        ...parsed.entries.map((e) => ({
          name: e.name,
          value: e.value,
          source: file.name,
          lineNumber: e.lineNumber,
        })),
      );
      allIssues.push(...parsed.issues.map((i) => ({ ...i, source: file.name })));
    }
    applyImportedEntries(allEntries, allIssues);
  }

  // ─── Save all ───────────────────────────────────────────────────

  async function handleSaveAll(): Promise<void> {
    if (!selectedStageSlug || isSaving) return;

    const invalidNewRow = currentDraft.newRows.find((r) => r.name.trim().length === 0);
    if (invalidNewRow) {
      toast.error("Every new variable needs a name before saving.");
      return;
    }

    let creates: Array<
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
        }
    > = [];
    let updates: Array<
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
        }
    > = [];

    try {
      creates = currentDraft.newRows.map((row) => {
        if (row.kind === "secret") {
          return {
            name: row.name.trim(),
            visibility: row.visibility,
            kind: "secret" as const,
            declaredType: row.declaredType,
            value: normalizeDraftValue(row.declaredType, row.value),
          };
        }
        if (row.kind === "ab_roll") {
          return {
            name: row.name.trim(),
            visibility: row.visibility,
            kind: "ab_roll" as const,
            declaredType: row.declaredType,
            valueA: normalizeDraftValue(row.declaredType, row.valueA),
            valueB: normalizeDraftValue(row.declaredType, row.valueB),
            chance: Number(row.chance),
          };
        }
        return {
          name: row.name.trim(),
          visibility: row.visibility,
          kind: "rollout" as const,
          declaredType: row.declaredType,
          valueA: normalizeDraftValue(row.declaredType, row.valueA),
          valueB: normalizeDraftValue(row.declaredType, row.valueB),
          rolloutFunction: row.rolloutFunction,
          rolloutMilestones: cloneRolloutMilestones(row.rolloutMilestones),
        };
      });
      updates = persistedRows
        .filter(
          (r) => !currentDraft.deletedIds[r.id] && currentDraft.updatedValues[r.id] !== undefined,
        )
        .map((r) => {
          const dv = currentDraft.updatedValues[r.id]!;
          if (dv.kind === "secret") {
            return {
              id: r.id,
              visibility: dv.visibility,
              kind: "secret" as const,
              declaredType: dv.declaredType,
              value: normalizeDraftValue(dv.declaredType, dv.value),
            };
          }
          if (dv.kind === "ab_roll") {
            return {
              id: r.id,
              visibility: dv.visibility,
              kind: "ab_roll" as const,
              declaredType: dv.declaredType,
              valueA: normalizeDraftValue(dv.declaredType, dv.valueA),
              valueB: normalizeDraftValue(dv.declaredType, dv.valueB),
              chance: Number(dv.chance),
            };
          }
          return {
            id: r.id,
            visibility: dv.visibility,
            kind: "rollout" as const,
            declaredType: dv.declaredType,
            valueA: normalizeDraftValue(dv.declaredType, dv.valueA),
            valueB: normalizeDraftValue(dv.declaredType, dv.valueB),
            rolloutFunction: dv.rolloutFunction,
            rolloutMilestones: cloneRolloutMilestones(dv.rolloutMilestones),
          };
        });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid variable values.");
      return;
    }

    const deletes = persistedRows.filter((r) => currentDraft.deletedIds[r.id]).map((r) => r.id);
    if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
      toast.info("No changes to save.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await applyDraft({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
        stageSlug: selectedStageSlug,
        creates,
        updates,
        deletes,
      });
      clearCurrentStageDraft();
      setImportSummary(null);
      toast.success(
        `Saved ${result.createdCount} created, ${result.updatedCount} updated, ${result.deletedCount} deleted.`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save variables.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Guards ─────────────────────────────────────────────────────

  const hasDraft = hasPersistedDraftChanges(currentDraft);

  function shakeDraftToolbar() {
    draftToolbarRef.current?.animate(
      [
        { transform: "translateX(0px)" },
        { transform: "translateX(-10px)" },
        { transform: "translateX(10px)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(0px)" },
      ],
      { duration: 260, iterations: 2, easing: "ease-in-out" },
    );
  }

  useUnsavedChangesGuard({ hasUnsavedChanges: hasDraft, onBlockedAttempt: shakeDraftToolbar });

  // ─── Render ─────────────────────────────────────────────────────

  const deletedCount = Object.keys(currentDraft.deletedIds).length;
  const modifiedCount = Object.keys(currentDraft.updatedValues).length;
  const newCount = currentDraft.newRows.length;

  return (
    <div className="space-y-4">
      <OrgSectionCard
        title="Variables"
        description="Manage project variables by environment. Import by paste, drag-and-drop, or file picker."
        action={
          <div className="flex items-center gap-2 rounded-lg border bg-background/75 px-2 py-1.5">
            <span className="pl-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Environment
            </span>
            <Select
              value={selectedStageSlug ?? ""}
              onValueChange={(next) => setSelectedStageSlug(next)}
            >
              <SelectTrigger className="h-8 min-w-56 border-transparent bg-transparent shadow-none">
                {selectedEnvironment ? (
                  <span className="truncate">{selectedEnvironment.name}</span>
                ) : (
                  <SelectValue placeholder="Select environment" />
                )}
              </SelectTrigger>
              <SelectContent>
                {(stages ?? []).map((stage) => (
                  <SelectItem key={stage.id} value={stage.slug}>
                    <span>{stage.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="space-y-3">
          {importSummary && (
            <div className="rounded-xl border bg-background/70 p-3 text-sm">
              <p>
                Imported {importSummary.importedCount} variables: {importSummary.createdCount} new,{" "}
                {importSummary.overwrittenCount} overwritten.
              </p>
              {importSummary.issues.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {importSummary.issues.slice(0, 6).map((issue) => (
                    <p key={`${issue.source}-${issue.lineNumber}-${issue.rawLine}`}>
                      {issue.source}:{issue.lineNumber} - {issue.reason}
                    </p>
                  ))}
                  {importSummary.issues.length > 6 && (
                    <p>+{importSummary.issues.length - 6} more invalid lines skipped.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!selectedStageSlug ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No environment is available for this project. Add one in Project settings.
            </div>
          ) : (
            <>
              {/* Toolbar: search + add */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <IconSearch className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    placeholder="Search variables..."
                    className="pl-9"
                  />
                </div>
                <Button onClick={openCreateDialog} size="sm">
                  <IconPlus className="size-3.5" />
                  Add variable
                </Button>
              </div>

              {/* Draft summary badges */}
              {hasDraft && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Pending:</span>
                  {newCount > 0 && <Badge variant="outline">{newCount} new</Badge>}
                  {modifiedCount > 0 && <Badge variant="secondary">{modifiedCount} modified</Badge>}
                  {deletedCount > 0 && <Badge variant="destructive">{deletedCount} deleted</Badge>}
                </div>
              )}

              {/* Variable list */}
              <div className="overflow-hidden rounded-lg border">
                {filteredRows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {rows.length === 0
                      ? 'No variables in this environment yet. Click "Add variable" or import env files.'
                      : "No variables match your search."}
                  </div>
                ) : (
                  filteredRows.map((row) => {
                    const isDeleted =
                      row.type === "existing" && Boolean(currentDraft.deletedIds[row.id]);
                    const isModified =
                      row.type === "existing" && currentDraft.updatedValues[row.id] !== undefined;
                    const isNew = row.type === "new";

                    return (
                      <VariableRow
                        key={row.key}
                        row={row}
                        isDeleted={isDeleted}
                        isModified={isModified}
                        isNew={isNew}
                        onClick={() => {
                          if (row.type === "existing") {
                            void openEditExistingDialog(row);
                          } else {
                            openEditNewDialog(row.localId);
                          }
                        }}
                        onDelete={() => handleDeleteRow(row)}
                      />
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Import area */}
          <div
            className={cn(
              "rounded-xl border border-dashed p-3 transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragActive(false);
              const files = Array.from(e.dataTransfer.files ?? []);
              if (files.length > 0) void importFiles(files);
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedStageSlug}
              >
                <IconFolderOpen />
                Select env files
              </Button>
              <p className="text-xs text-muted-foreground">
                Drop <span className="font-mono">.env</span> files here or press{" "}
                <span className="font-mono">Ctrl/Cmd+V</span> to import.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              accept=".env,.txt,.local,.development,.production"
              onChange={(e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                if (files.length > 0) void importFiles(files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </OrgSectionCard>

      {/* Editor dialog */}
      <VariableEditorDialog
        dialogState={dialogState}
        form={dialogForm}
        setForm={setDialogForm}
        onApply={handleDialogApply}
        onClose={() => setDialogState({ mode: "closed" })}
        isExistingKindLocked={
          dialogState.mode === "edit-existing" && dialogState.row.kind === "rollout"
        }
      />

      {/* Draft save/discard toolbar */}
      <FloatingDraftToolbar
        isVisible={hasDraft}
        message="You have unsaved draft changes."
        isSaving={isSaving}
        discardLabel="Discard all"
        saveLabel="Save all"
        saveDisabled={!selectedStageSlug}
        onDiscard={() => {
          clearCurrentStageDraft();
          setImportSummary(null);
          toast.info("Draft changes discarded.");
        }}
        onSave={() => void handleSaveAll()}
        toolbarRef={draftToolbarRef}
      />
    </div>
  );
}
