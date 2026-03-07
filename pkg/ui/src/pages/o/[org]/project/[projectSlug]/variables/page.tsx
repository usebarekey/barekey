import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconFolderOpen,
  IconKey,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectRouteContext } from "../layout";
import { FloatingDraftToolbar } from "@/components/custom/floating-draft-toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OrgSectionCard } from "@/components/custom/org-workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { parseEnvText, type ParsedEnvIssue } from "@/lib/parse-env-text";
import { Textarea } from "@/components/ui/textarea";

type DeclaredVariableType = "string" | "boolean" | "int64" | "float" | "date" | "json";

type NewVariableDraft = {
  localId: string;
  name: string;
  isRevealed: boolean;
} & VariableDraftValue;

type StageDraftState = {
  newRows: Array<NewVariableDraft>;
  updatedValues: Record<string, VariableDraftValue>;
  deletedIds: Record<string, boolean>;
  revealedValues: Record<string, RevealedVariableValue>;
  revealedIds: Record<string, boolean>;
  decryptingIds: Record<string, boolean>;
};

type SecretDraftValue = {
  kind: "secret";
  declaredType: DeclaredVariableType;
  value: string;
};

type AbRollDraftValue = {
  kind: "ab_roll";
  declaredType: DeclaredVariableType;
  valueA: string;
  valueB: string;
  chance: string;
};

type VariableDraftValue = SecretDraftValue | AbRollDraftValue;

type RevealedVariableValue =
  | {
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    };

type ComposerRowState = {
  name: string;
} & VariableDraftValue;

type ImportIssue = ParsedEnvIssue & {
  source: string;
};

type ImportSummary = {
  importedCount: number;
  createdCount: number;
  overwrittenCount: number;
  issues: Array<ImportIssue>;
};

const VARIABLE_TYPE_OPTIONS: Array<{
  value: DeclaredVariableType;
  label: string;
}> = [
  { value: "string", label: "String" },
  { value: "boolean", label: "Boolean" },
  { value: "int64", label: "Integer (int64)" },
  { value: "float", label: "Float" },
  { value: "date", label: "Date" },
  { value: "json", label: "JSON" },
];

const RFC3339_WITH_TIMEZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeDraftValue(
  declaredType: DeclaredVariableType,
  raw: string,
): string {
  if (declaredType === "string") {
    return raw;
  }
  if (declaredType === "boolean") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return "true";
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return "false";
    }
    throw new Error("Boolean variables must be true or false.");
  }
  if (declaredType === "int64") {
    const trimmed = raw.trim();
    if (!/^-?(0|[1-9]\d*)$/.test(trimmed)) {
      throw new Error("Integer variables must be valid signed 64-bit integers.");
    }
    const parsed = BigInt(trimmed);
    const min = BigInt("-9223372036854775808");
    const max = BigInt("9223372036854775807");
    if (parsed < min || parsed > max) {
      throw new Error("Integer variables must be valid signed 64-bit integers.");
    }
    return parsed.toString();
  }
  if (declaredType === "float") {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
      throw new Error("Float variables must be finite numbers.");
    }
    return trimmed;
  }
  if (declaredType === "date") {
    const trimmed = raw.trim();
    if (!RFC3339_WITH_TIMEZONE_PATTERN.test(trimmed)) {
      throw new Error("Date variables must be ISO 8601 instants with timezone.");
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Date variables must be ISO 8601 instants with timezone.");
    }
    return parsed.toISOString();
  }
  try {
    return JSON.stringify(JSON.parse(raw) as unknown);
  } catch {
    throw new Error("JSON variables must contain valid JSON.");
  }
}

function normalizeDraftPayload(draft: VariableDraftValue): VariableDraftValue {
  if (draft.kind === "secret") {
    return {
      ...draft,
      value: normalizeDraftValue(draft.declaredType, draft.value),
    };
  }

  return {
    ...draft,
    valueA: normalizeDraftValue(draft.declaredType, draft.valueA),
    valueB: normalizeDraftValue(draft.declaredType, draft.valueB),
  };
}

function usesMultilineEditor(declaredType: DeclaredVariableType): boolean {
  return declaredType === "json";
}

function canEditExistingAbRollValue(input: {
  isRevealed: boolean;
  pendingValue: VariableDraftValue | undefined;
}): boolean {
  return input.isRevealed || input.pendingValue?.kind === "ab_roll";
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

function hasTransientStageState(draft: StageDraftState): boolean {
  return (
    Object.keys(draft.revealedValues).length > 0 ||
    Object.keys(draft.revealedIds).length > 0 ||
    Object.keys(draft.decryptingIds).length > 0
  );
}

function hasStoredStageState(draft: StageDraftState): boolean {
  return hasPersistedDraftChanges(draft) || hasTransientStageState(draft);
}

function cloneDraft(draft: StageDraftState): StageDraftState {
  return {
    newRows: draft.newRows.map((row) => ({ ...row })),
    updatedValues: { ...draft.updatedValues },
    deletedIds: { ...draft.deletedIds },
    revealedValues: { ...draft.revealedValues },
    revealedIds: { ...draft.revealedIds },
    decryptingIds: { ...draft.decryptingIds },
  };
}

type VariableDisplayRow =
  | {
      key: string;
      type: "existing";
      id: Id<"projectVariables">;
      name: string;
      kind: "secret" | "ab_roll";
      declaredType: DeclaredVariableType;
      chance: number | null;
      createdAtMs: number;
      updatedAtMs: number;
    }
  | {
      key: string;
      type: "new";
      localId: string;
      name: string;
    } & VariableDraftValue;

function createSecretDraftValue(
  value = "",
  declaredType: DeclaredVariableType = "string",
): SecretDraftValue {
  return {
    kind: "secret",
    declaredType,
    value,
  };
}

function createAbRollDraftValue(
  valueA = "",
  valueB = "",
  chance = "0.5",
  declaredType: DeclaredVariableType = "string",
): AbRollDraftValue {
  return {
    kind: "ab_roll",
    declaredType,
    valueA,
    valueB,
    chance,
  };
}

function createDraftValueByKind(
  kind: "secret" | "ab_roll",
  declaredType: DeclaredVariableType = "string",
): VariableDraftValue {
  return kind === "secret"
    ? createSecretDraftValue("", declaredType)
    : createAbRollDraftValue("", "", "0.5", declaredType);
}

function toComposerRow(
  kind: "secret" | "ab_roll" = "secret",
  declaredType: DeclaredVariableType = "string",
): ComposerRowState {
  return {
    name: "",
    ...createDraftValueByKind(kind, declaredType),
  };
}

function parseChanceValue(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("A/B roll chance must be a number between 0 and 1.");
  }
  return parsed;
}

function formatChanceValue(value: number | null): string {
  return value === null ? "0.5" : String(value);
}

function toDraftValueFromRevealed(value: RevealedVariableValue): VariableDraftValue {
  return value.kind === "secret"
    ? createSecretDraftValue(value.value, value.declaredType)
    : createAbRollDraftValue(
        value.valueA,
        value.valueB,
        formatChanceValue(value.chance),
        value.declaredType,
      );
}

function toDraftValueFromExistingRow(
  row: Extract<VariableDisplayRow, { type: "existing" }>,
): VariableDraftValue {
  return row.kind === "secret"
    ? createSecretDraftValue("", row.declaredType)
    : createAbRollDraftValue("", "", formatChanceValue(row.chance), row.declaredType);
}

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const [selectedStageSlug, setSelectedStageSlug] = useState<string | null>(null);
  const [draftByStage, setDraftByStage] = useState<Record<string, StageDraftState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [composerRow, setComposerRow] = useState<ComposerRowState>(toComposerRow());
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
  const ensureDefaultStages = useMutation(api.project_stages.ensureDefaultStagesForCurrentOrgProject);
  const currentDraft =
    selectedStageSlug === null ? createEmptyDraftState() : draftByStage[selectedStageSlug] ?? createEmptyDraftState();
  const persistedRows = variables ?? [];
  const selectedEnvironment = stages?.find((stage) => stage.slug === selectedStageSlug) ?? null;

  useEffect(() => {
    if (!stages) {
      return;
    }

    const developmentStage = stages.find((stage) => stage.slug === "development");
    const fallback = developmentStage?.slug ?? stages[0]?.slug ?? null;
    if (selectedStageSlug === null) {
      if (fallback !== null) {
        setSelectedStageSlug(fallback);
      }
      return;
    }

    if (!stages.some((stage) => stage.slug === selectedStageSlug)) {
      setSelectedStageSlug(fallback);
    }
  }, [selectedStageSlug, stages]);

  useEffect(() => {
    if (!stages || stages.length > 0) {
      return;
    }

    const projectKey = `${project.orgSlug}/${project.projectSlug}`;
    if (seededProjectsRef.current[projectKey]) {
      return;
    }
    seededProjectsRef.current[projectKey] = true;

    void ensureDefaultStages({
      expectedOrgSlug: project.orgSlug,
      projectSlug: project.projectSlug,
    }).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to initialize default stages.");
    });
  }, [ensureDefaultStages, project.orgSlug, project.projectSlug, stages]);

  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent): void {
      if (!selectedStageSlug) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const isEditableTarget =
          target.closest("input, textarea, [contenteditable='true']") !== null;
        if (isEditableTarget) {
          return;
        }
      }

      const pastedText = event.clipboardData?.getData("text") ?? "";
      if (pastedText.trim().length === 0) {
        return;
      }

      event.preventDefault();
      void importTextSource("clipboard", pastedText);
    }

    window.addEventListener("paste", handleWindowPaste, true);
    return () => window.removeEventListener("paste", handleWindowPaste, true);
  }, [selectedStageSlug, persistedRows]);

  const rows = useMemo(() => {
    const baseRows: Array<VariableDisplayRow> = persistedRows
      .filter((row) => !currentDraft.deletedIds[row.id])
      .map((row) => ({
        key: `existing-${row.id}`,
        type: "existing" as const,
        id: row.id,
        name: row.name,
        kind: row.kind,
        declaredType: row.declaredType,
        chance: row.chance,
        createdAtMs: row.createdAtMs,
        updatedAtMs: row.updatedAtMs,
      }));
    const newRows: Array<VariableDisplayRow> = currentDraft.newRows.map((row) =>
      row.kind === "secret"
        ? {
            key: `new-${row.localId}`,
            type: "new" as const,
            localId: row.localId,
            name: row.name,
            kind: "secret" as const,
            declaredType: row.declaredType,
            value: row.value,
          }
        : {
            key: `new-${row.localId}`,
            type: "new" as const,
            localId: row.localId,
            name: row.name,
            kind: "ab_roll" as const,
            declaredType: row.declaredType,
            valueA: row.valueA,
            valueB: row.valueB,
            chance: row.chance,
          },
    );

    return [...baseRows, ...newRows];
  }, [currentDraft.deletedIds, currentDraft.newRows, persistedRows]);

  function updateCurrentStageDraft(
    updater: (current: StageDraftState) => StageDraftState,
  ): void {
    if (!selectedStageSlug) {
      return;
    }

    setDraftByStage((previous) => {
      const current = previous[selectedStageSlug] ?? createEmptyDraftState();
      const next = updater(cloneDraft(current));
      if (!hasStoredStageState(next)) {
        const { [selectedStageSlug]: _, ...rest } = previous;
        return rest;
      }

      return {
        ...previous,
        [selectedStageSlug]: next,
      };
    });
  }

  function clearCurrentStageDraft(): void {
    if (!selectedStageSlug) {
      return;
    }

    setDraftByStage((previous) => {
      const { [selectedStageSlug]: _, ...rest } = previous;
      return rest;
    });
  }

  function upsertVariableDraftByName(name: string, nextValue: VariableDraftValue): void {
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      return;
    }

    const existingByName = new Map(persistedRows.map((row) => [row.name, row]));
    updateCurrentStageDraft((current) => {
      const existingVariable = existingByName.get(normalizedName);
      if (existingVariable) {
        if (current.deletedIds[existingVariable.id]) {
          delete current.deletedIds[existingVariable.id];
        }
        current.updatedValues[existingVariable.id] = nextValue;
        return current;
      }

      const existingDraftIndex = current.newRows.findIndex((row) => row.name === normalizedName);
      if (existingDraftIndex >= 0) {
        current.newRows[existingDraftIndex] = {
          ...current.newRows[existingDraftIndex],
          ...nextValue,
        };
        return current;
      }

      current.newRows.unshift({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: normalizedName,
        isRevealed: false,
        ...nextValue,
      });
      return current;
    });
  }

  function handleAppendComposerRow(): void {
    if (!selectedStageSlug) {
      return;
    }

    if (composerRow.name.trim().length === 0) {
      toast.error("Name is required to add a variable.");
      return;
    }

    upsertVariableDraftByName(
      composerRow.name,
      composerRow.kind === "secret"
        ? {
            kind: "secret",
            declaredType: composerRow.declaredType,
            value: composerRow.value,
          }
        : {
            kind: "ab_roll",
            declaredType: composerRow.declaredType,
            valueA: composerRow.valueA,
            valueB: composerRow.valueB,
            chance: composerRow.chance,
          },
    );
    setComposerRow(toComposerRow(composerRow.kind, composerRow.declaredType));
  }

  function applyImportedEntries(
    entries: Array<{ name: string; value: string; source: string; lineNumber: number }>,
    issues: Array<ImportIssue>,
  ): void {
    const existingByName = new Map(persistedRows.map((row) => [row.name, row]));
    let importedCount = 0;
    let overwrittenCount = 0;
    let createdCount = 0;

    updateCurrentStageDraft((current) => {
      for (const entry of entries) {
        importedCount += 1;
        const existingVariable = existingByName.get(entry.name);
        if (existingVariable) {
          if (current.deletedIds[existingVariable.id]) {
            delete current.deletedIds[existingVariable.id];
          }
          if (current.updatedValues[existingVariable.id] !== undefined) {
            overwrittenCount += 1;
          }
          current.updatedValues[existingVariable.id] = createSecretDraftValue(
            entry.value,
            existingVariable.declaredType,
          );
          continue;
        }

        const newRowIndex = current.newRows.findIndex((row) => row.name === entry.name);
        if (newRowIndex >= 0) {
          current.newRows[newRowIndex] = {
            ...current.newRows[newRowIndex],
            ...createSecretDraftValue(entry.value, current.newRows[newRowIndex]?.declaredType ?? "string"),
          };
          overwrittenCount += 1;
          continue;
        }

        current.newRows.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: entry.name,
          isRevealed: false,
          ...createSecretDraftValue(entry.value, "string"),
        });
        createdCount += 1;
      }

      return current;
    });

    setImportSummary({
      importedCount,
      createdCount,
      overwrittenCount,
      issues,
    });
  }

  async function importTextSource(source: string, text: string): Promise<void> {
    const parsed = parseEnvText(text);
    const entries = parsed.entries.map((entry) => ({
      name: entry.name,
      value: entry.value,
      source,
      lineNumber: entry.lineNumber,
    }));
    const issues: Array<ImportIssue> = parsed.issues.map((issue) => ({
      ...issue,
      source,
    }));

    applyImportedEntries(entries, issues);
  }

  async function importFiles(files: Array<File>): Promise<void> {
    const allEntries: Array<{ name: string; value: string; source: string; lineNumber: number }> = [];
    const allIssues: Array<ImportIssue> = [];

    for (const file of files) {
      const text = await file.text();
      const parsed = parseEnvText(text);
      allEntries.push(
        ...parsed.entries.map((entry) => ({
          name: entry.name,
          value: entry.value,
          source: file.name,
          lineNumber: entry.lineNumber,
        })),
      );
      allIssues.push(
        ...parsed.issues.map((issue) => ({
          ...issue,
          source: file.name,
        })),
      );
    }

    applyImportedEntries(allEntries, allIssues);
  }

  async function handleSaveAll(): Promise<void> {
    if (!selectedStageSlug || isSaving) {
      return;
    }

    const invalidNewRow = currentDraft.newRows.find((row) => row.name.trim().length === 0);
    if (invalidNewRow) {
      toast.error("Every new variable row needs a name before saving.");
      return;
    }

    let creates: Array<
      | {
          name: string;
          kind: "secret";
          declaredType: DeclaredVariableType;
          value: string;
        }
      | {
          name: string;
          kind: "ab_roll";
          declaredType: DeclaredVariableType;
          valueA: string;
          valueB: string;
          chance: number;
        }
    > = [];
    let updates: Array<
      | {
          id: Id<"projectVariables">;
          kind: "secret";
          declaredType: DeclaredVariableType;
          value: string;
        }
      | {
          id: Id<"projectVariables">;
          kind: "ab_roll";
          declaredType: DeclaredVariableType;
          valueA: string;
          valueB: string;
          chance: number;
        }
    > = [];
    try {
      creates = currentDraft.newRows.map((row) => {
        const normalized = normalizeDraftPayload(row);
        return normalized.kind === "secret"
          ? {
              name: row.name.trim(),
              kind: "secret" as const,
              declaredType: normalized.declaredType,
              value: normalized.value,
            }
          : {
              name: row.name.trim(),
              kind: "ab_roll" as const,
              declaredType: normalized.declaredType,
              valueA: normalized.valueA,
              valueB: normalized.valueB,
              chance: parseChanceValue(normalized.chance),
            };
      });
      updates = persistedRows
        .filter((row) => !currentDraft.deletedIds[row.id] && currentDraft.updatedValues[row.id] !== undefined)
        .map((row) => {
          const draftValue = currentDraft.updatedValues[row.id];
          if (!draftValue) {
            throw new Error("Missing updated value for variable.");
          }

          const normalized = normalizeDraftPayload(draftValue);
          if (normalized.kind === "secret") {
            return {
              id: row.id,
              kind: "secret" as const,
              declaredType: normalized.declaredType,
              value: normalized.value,
            };
          }

          return {
            id: row.id,
            kind: "ab_roll" as const,
            declaredType: normalized.declaredType,
            valueA: normalized.valueA,
            valueB: normalized.valueB,
            chance: parseChanceValue(normalized.chance),
          };
        });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid variable values.");
      return;
    }
    const deletes = persistedRows.filter((row) => currentDraft.deletedIds[row.id]).map((row) => row.id);

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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save variables.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDecryptExisting(variableId: Id<"projectVariables">): Promise<void> {
    if (!selectedStageSlug) {
      return;
    }

    const stageSlug = selectedStageSlug;
    const draft = draftByStage[stageSlug] ?? createEmptyDraftState();
    if (draft.revealedIds[variableId]) {
      updateCurrentStageDraft((current) => {
        delete current.revealedIds[variableId];
        delete current.revealedValues[variableId];
        return current;
      });
      return;
    }

    if (!draft.revealedValues[variableId]) {
      updateCurrentStageDraft((current) => {
        current.decryptingIds[variableId] = true;
        return current;
      });

      try {
        const decrypted = await decryptVariable({
          expectedOrgSlug: project.orgSlug,
          projectSlug: project.projectSlug,
          stageSlug,
          variableId,
        });
        updateCurrentStageDraft((current) => {
          delete current.decryptingIds[variableId];
          current.revealedValues[variableId] =
            decrypted.kind === "secret"
              ? {
                  kind: "secret",
                  declaredType: decrypted.declaredType,
                  value: decrypted.value,
                }
              : {
                  kind: "ab_roll",
                  declaredType: decrypted.declaredType,
                  valueA: decrypted.valueA,
                  valueB: decrypted.valueB,
                  chance: decrypted.chance,
                };
          current.revealedIds[variableId] = true;
          return current;
        });
      } catch (error: unknown) {
        updateCurrentStageDraft((current) => {
          delete current.decryptingIds[variableId];
          return current;
        });
        toast.error(error instanceof Error ? error.message : "Failed to decrypt variable.");
      }
      return;
    }

    updateCurrentStageDraft((current) => {
      current.revealedIds[variableId] = true;
      return current;
    });
  }

  async function loadExistingDraftValue(
    row: Extract<VariableDisplayRow, { type: "existing" }>,
  ): Promise<VariableDraftValue> {
    const pendingValue = currentDraft.updatedValues[row.id];
    if (pendingValue) {
      return pendingValue;
    }

    const revealedValue = currentDraft.revealedValues[row.id];
    if (revealedValue) {
      return toDraftValueFromRevealed(revealedValue);
    }

    if (!selectedStageSlug) {
      throw new Error("Stage is not selected.");
    }

    const decrypted = await decryptVariable({
      expectedOrgSlug: project.orgSlug,
      projectSlug: project.projectSlug,
      stageSlug: selectedStageSlug,
      variableId: row.id,
    });

    return decrypted.kind === "secret"
      ? createSecretDraftValue(decrypted.value, decrypted.declaredType)
      : createAbRollDraftValue(
          decrypted.valueA,
          decrypted.valueB,
          formatChanceValue(decrypted.chance),
          decrypted.declaredType,
        );
  }

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
      {
        duration: 260,
        iterations: 2,
        easing: "ease-in-out",
      },
    );
  }

  useUnsavedChangesGuard({
    hasUnsavedChanges: hasDraft,
    onBlockedAttempt: shakeDraftToolbar,
  });

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
              onValueChange={(next) => {
                setSelectedStageSlug(next);
              }}
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
        <div className="space-y-4">
          {importSummary ? (
            <div className="rounded-xl border bg-background/70 p-3 text-sm">
              <p>
                Imported {importSummary.importedCount} variables: {importSummary.createdCount} new,{" "}
                {importSummary.overwrittenCount} overwritten.
              </p>
              {importSummary.issues.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {importSummary.issues.slice(0, 6).map((issue) => (
                    <p key={`${issue.source}-${issue.lineNumber}-${issue.rawLine}`}>
                      {issue.source}:{issue.lineNumber} - {issue.reason}
                    </p>
                  ))}
                  {importSummary.issues.length > 6 ? (
                    <p>+{importSummary.issues.length - 6} more invalid lines skipped.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!selectedStageSlug ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No environment is available for this project. Add one in Project settings.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Name</TableHead>
                  <TableHead className="w-[40%]">Value</TableHead>
                  <TableHead className="w-[18%]">Config</TableHead>
                  <TableHead className="w-[14%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-secondary/20">
                  <TableCell>
                    <Input
                      value={composerRow.name}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setComposerRow((previous) => ({
                          ...previous,
                          name: value,
                        }));
                      }}
                      placeholder="Add variable name"
                    />
                  </TableCell>
                  <TableCell>
                    {composerRow.kind === "secret" ? (
                      usesMultilineEditor(composerRow.declaredType) ? (
                        <Textarea
                          value={composerRow.value}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setComposerRow((previous) => ({
                              ...previous,
                              value,
                            }));
                          }}
                          placeholder="Add variable value"
                        />
                      ) : (
                        <Input
                          type="password"
                          value={composerRow.value}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setComposerRow((previous) => ({
                              ...previous,
                              value,
                            }));
                          }}
                          placeholder="Add variable value"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAppendComposerRow();
                            }
                          }}
                        />
                      )
                    ) : (
                      <div className="space-y-2">
                        {usesMultilineEditor(composerRow.declaredType) ? (
                          <>
                            <Textarea
                              value={composerRow.valueA}
                              onChange={(event) => {
                                const valueA = event.currentTarget.value;
                                setComposerRow((previous) =>
                                  previous.kind === "ab_roll"
                                    ? {
                                        ...previous,
                                        valueA,
                                      }
                                    : previous,
                                );
                              }}
                              placeholder="Value A"
                            />
                            <Textarea
                              value={composerRow.valueB}
                              onChange={(event) => {
                                const valueB = event.currentTarget.value;
                                setComposerRow((previous) =>
                                  previous.kind === "ab_roll"
                                    ? {
                                        ...previous,
                                        valueB,
                                      }
                                    : previous,
                                );
                              }}
                              placeholder="Value B"
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              type="password"
                              value={composerRow.valueA}
                              onChange={(event) => {
                                const valueA = event.currentTarget.value;
                                setComposerRow((previous) =>
                                  previous.kind === "ab_roll"
                                    ? {
                                        ...previous,
                                        valueA,
                                      }
                                    : previous,
                                );
                              }}
                              placeholder="Value A"
                            />
                            <Input
                              type="password"
                              value={composerRow.valueB}
                              onChange={(event) => {
                                const valueB = event.currentTarget.value;
                                setComposerRow((previous) =>
                                  previous.kind === "ab_roll"
                                    ? {
                                        ...previous,
                                        valueB,
                                      }
                                    : previous,
                                );
                              }}
                              placeholder="Value B"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Select
                        value={composerRow.kind}
                        onValueChange={(next) => {
                          if (next !== "secret" && next !== "ab_roll") {
                            return;
                          }

                          setComposerRow((previous) => ({
                            name: previous.name,
                            ...createDraftValueByKind(next, previous.declaredType),
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full bg-secondary/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="secret">Secret</SelectItem>
                          <SelectItem value="ab_roll">A/B roll</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={composerRow.declaredType}
                        onValueChange={(next) => {
                          const declaredType = next as DeclaredVariableType;
                          setComposerRow((previous) => ({
                            ...previous,
                            declaredType,
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full bg-secondary/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VARIABLE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {composerRow.kind === "ab_roll" ? (
                        <Input
                          value={composerRow.chance}
                          onChange={(event) => {
                            const chance = event.currentTarget.value;
                            setComposerRow((previous) =>
                              previous.kind === "ab_roll"
                                ? {
                                    ...previous,
                                    chance,
                                  }
                                : previous,
                            );
                          }}
                          placeholder="Chance for value A (0-1)"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button
                        size="icon-sm"
                        onClick={handleAppendComposerRow}
                        aria-label="Append variable row"
                      >
                        <IconPlus className="text-primary-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {rows.map((row) => {
                  if (row.type === "existing") {
                    const isRevealed = Boolean(currentDraft.revealedIds[row.id]);
                    const pendingValue = currentDraft.updatedValues[row.id];
                    const revealedValue = currentDraft.revealedValues[row.id];
                    const activeValue =
                      pendingValue ??
                      (isRevealed && revealedValue
                        ? toDraftValueFromRevealed(revealedValue)
                        : toDraftValueFromExistingRow(row));
                    const isDecrypting = Boolean(currentDraft.decryptingIds[row.id]);
                    const canEditHiddenAbRoll = canEditExistingAbRollValue({
                      isRevealed,
                      pendingValue,
                    });

                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <Input value={row.name} disabled />
                        </TableCell>
                        <TableCell>
                          {activeValue.kind === "secret" ? (
                            usesMultilineEditor(activeValue.declaredType) ? (
                              <Textarea
                                value={activeValue.value}
                                placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  updateCurrentStageDraft((current) => {
                                    current.updatedValues[row.id] = {
                                      kind: "secret",
                                      declaredType: activeValue.declaredType,
                                      value,
                                    };
                                    return current;
                                  });
                                }}
                              />
                            ) : (
                              <Input
                                type={isRevealed ? "text" : "password"}
                                value={activeValue.value}
                                placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  updateCurrentStageDraft((current) => {
                                    current.updatedValues[row.id] = {
                                      kind: "secret",
                                      declaredType: activeValue.declaredType,
                                      value,
                                    };
                                    return current;
                                  });
                                }}
                              />
                            )
                          ) : (
                            <div className="space-y-2">
                              {usesMultilineEditor(activeValue.declaredType) ? (
                                <>
                                  <Textarea
                                    value={activeValue.valueA}
                                    placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                    disabled={!canEditHiddenAbRoll}
                                    onChange={(event) => {
                                      const valueA = event.currentTarget.value;
                                      updateCurrentStageDraft((current) => {
                                        const previousValue = current.updatedValues[row.id];
                                        const currentValue =
                                          previousValue?.kind === "ab_roll" ? previousValue : activeValue;
                                        current.updatedValues[row.id] = {
                                          kind: "ab_roll",
                                          declaredType: activeValue.declaredType,
                                          valueA,
                                          valueB: currentValue.valueB,
                                          chance: currentValue.chance,
                                        };
                                        return current;
                                      });
                                    }}
                                  />
                                  <Textarea
                                    value={activeValue.valueB}
                                    placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                    disabled={!canEditHiddenAbRoll}
                                    onChange={(event) => {
                                      const valueB = event.currentTarget.value;
                                      updateCurrentStageDraft((current) => {
                                        const previousValue = current.updatedValues[row.id];
                                        const currentValue =
                                          previousValue?.kind === "ab_roll" ? previousValue : activeValue;
                                        current.updatedValues[row.id] = {
                                          kind: "ab_roll",
                                          declaredType: activeValue.declaredType,
                                          valueA: currentValue.valueA,
                                          valueB,
                                          chance: currentValue.chance,
                                        };
                                        return current;
                                      });
                                    }}
                                  />
                                </>
                              ) : (
                                <>
                                  <Input
                                    type={isRevealed ? "text" : "password"}
                                    value={activeValue.valueA}
                                    placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                    disabled={!canEditHiddenAbRoll}
                                    onChange={(event) => {
                                      const valueA = event.currentTarget.value;
                                      updateCurrentStageDraft((current) => {
                                        const previousValue = current.updatedValues[row.id];
                                        const currentValue =
                                          previousValue?.kind === "ab_roll" ? previousValue : activeValue;
                                        current.updatedValues[row.id] = {
                                          kind: "ab_roll",
                                          declaredType: activeValue.declaredType,
                                          valueA,
                                          valueB: currentValue.valueB,
                                          chance: currentValue.chance,
                                        };
                                        return current;
                                      });
                                    }}
                                  />
                                  <Input
                                    type={isRevealed ? "text" : "password"}
                                    value={activeValue.valueB}
                                    placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                                    disabled={!canEditHiddenAbRoll}
                                    onChange={(event) => {
                                      const valueB = event.currentTarget.value;
                                      updateCurrentStageDraft((current) => {
                                        const previousValue = current.updatedValues[row.id];
                                        const currentValue =
                                          previousValue?.kind === "ab_roll" ? previousValue : activeValue;
                                        current.updatedValues[row.id] = {
                                          kind: "ab_roll",
                                          declaredType: activeValue.declaredType,
                                          valueA: currentValue.valueA,
                                          valueB,
                                          chance: currentValue.chance,
                                        };
                                        return current;
                                      });
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Select
                              value={activeValue.kind}
                              onValueChange={(next) => {
                                if (next !== "secret" && next !== "ab_roll") {
                                  return;
                                }
                                void (async () => {
                                  try {
                                    const editableValue = await loadExistingDraftValue(row);
                                    updateCurrentStageDraft((current) => {
                                      current.updatedValues[row.id] =
                                        next === "secret"
                                          ? createSecretDraftValue(
                                              editableValue.kind === "secret"
                                                ? editableValue.value
                                                : editableValue.valueA,
                                              editableValue.declaredType,
                                            )
                                          : createAbRollDraftValue(
                                              editableValue.kind === "ab_roll"
                                                ? editableValue.valueA
                                                : editableValue.value,
                                              editableValue.kind === "ab_roll"
                                                ? editableValue.valueB
                                                : "",
                                              editableValue.kind === "ab_roll"
                                                ? editableValue.chance
                                                : formatChanceValue(row.chance),
                                              editableValue.declaredType,
                                            );
                                      return current;
                                    });
                                  } catch (error: unknown) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to load the current variable value.",
                                    );
                                  }
                                })();
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="secret">Secret</SelectItem>
                                <SelectItem value="ab_roll">A/B roll</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={activeValue.declaredType}
                              onValueChange={(next) => {
                                const declaredType = next as DeclaredVariableType;
                                if (declaredType === "json" && !isRevealed) {
                                  toast.error("Reveal this value before changing its type to JSON.");
                                  return;
                                }
                                void (async () => {
                                  try {
                                    const editableValue = await loadExistingDraftValue(row);
                                    updateCurrentStageDraft((current) => {
                                      current.updatedValues[row.id] =
                                        editableValue.kind === "secret"
                                          ? {
                                              ...editableValue,
                                              declaredType,
                                            }
                                          : {
                                              ...editableValue,
                                              declaredType,
                                            };
                                      return current;
                                    });
                                  } catch (error: unknown) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to load the current variable value.",
                                    );
                                  }
                                })();
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VARIABLE_TYPE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {activeValue.kind === "ab_roll" ? (
                              <Input
                                value={activeValue.chance}
                                onChange={(event) => {
                                  const chance = event.currentTarget.value;
                                  updateCurrentStageDraft((current) => {
                                    const previousValue = current.updatedValues[row.id];
                                    const currentValue =
                                      previousValue?.kind === "ab_roll" ? previousValue : activeValue;
                                    current.updatedValues[row.id] = {
                                      ...currentValue,
                                      declaredType: activeValue.declaredType,
                                      chance,
                                    };
                                    return current;
                                  });
                                }}
                                placeholder="Chance for value A (0-1)"
                              />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void handleDecryptExisting(row.id);
                              }}
                              disabled={isDecrypting}
                            >
                              <IconKey />
                              {isDecrypting ? "Decrypting..." : isRevealed ? "Hide" : "Decrypt"}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    aria-label={`Actions for ${row.name}`}
                                  />
                                }
                              >
                                <IconChevronDown className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => {
                                    updateCurrentStageDraft((current) => {
                                      current.deletedIds[row.id] = true;
                                      delete current.updatedValues[row.id];
                                      delete current.revealedIds[row.id];
                                      delete current.revealedValues[row.id];
                                      delete current.decryptingIds[row.id];
                                      return current;
                                    });
                                  }}
                                  variant="destructive"
                                >
                                  <IconTrash />
                                  Delete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    updateCurrentStageDraft((current) => {
                                      delete current.deletedIds[row.id];
                                      delete current.updatedValues[row.id];
                                      delete current.revealedIds[row.id];
                                      delete current.revealedValues[row.id];
                                      delete current.decryptingIds[row.id];
                                      return current;
                                    });
                                  }}
                                >
                                  <IconRefresh />
                                  Revert row
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const newRow = currentDraft.newRows.find((candidate) => candidate.localId === row.localId);
                  if (!newRow) {
                    return null;
                  }

                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Input
                          value={newRow.name}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            updateCurrentStageDraft((current) => {
                              const index = current.newRows.findIndex(
                                (candidate) => candidate.localId === row.localId,
                              );
                              if (index >= 0) {
                                current.newRows[index] = {
                                  ...current.newRows[index],
                                  name: value,
                                };
                              }
                              return current;
                            });
                          }}
                          placeholder="DATABASE_URL"
                        />
                      </TableCell>
                      <TableCell>
                        {newRow.kind === "secret" ? (
                          usesMultilineEditor(newRow.declaredType) ? (
                            <Textarea
                              value={newRow.value}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                updateCurrentStageDraft((current) => {
                                  const index = current.newRows.findIndex(
                                    (candidate) => candidate.localId === row.localId,
                                  );
                                  if (index >= 0 && current.newRows[index]?.kind === "secret") {
                                    current.newRows[index] = {
                                      ...current.newRows[index],
                                      value,
                                    };
                                  }
                                  return current;
                                });
                              }}
                              placeholder="Value"
                            />
                          ) : (
                            <Input
                              type={newRow.isRevealed ? "text" : "password"}
                              value={newRow.value}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                updateCurrentStageDraft((current) => {
                                  const index = current.newRows.findIndex(
                                    (candidate) => candidate.localId === row.localId,
                                  );
                                  if (index >= 0 && current.newRows[index]?.kind === "secret") {
                                    current.newRows[index] = {
                                      ...current.newRows[index],
                                      value,
                                    };
                                  }
                                  return current;
                                });
                              }}
                              placeholder="Value"
                            />
                          )
                        ) : (
                          <div className="space-y-2">
                            {usesMultilineEditor(newRow.declaredType) ? (
                              <>
                                <Textarea
                                  value={newRow.valueA}
                                  onChange={(event) => {
                                    const valueA = event.currentTarget.value;
                                    updateCurrentStageDraft((current) => {
                                      const index = current.newRows.findIndex(
                                        (candidate) => candidate.localId === row.localId,
                                      );
                                      if (index >= 0 && current.newRows[index]?.kind === "ab_roll") {
                                        current.newRows[index] = {
                                          ...current.newRows[index],
                                          valueA,
                                        };
                                      }
                                      return current;
                                    });
                                  }}
                                  placeholder="Value A"
                                />
                                <Textarea
                                  value={newRow.valueB}
                                  onChange={(event) => {
                                    const valueB = event.currentTarget.value;
                                    updateCurrentStageDraft((current) => {
                                      const index = current.newRows.findIndex(
                                        (candidate) => candidate.localId === row.localId,
                                      );
                                      if (index >= 0 && current.newRows[index]?.kind === "ab_roll") {
                                        current.newRows[index] = {
                                          ...current.newRows[index],
                                          valueB,
                                        };
                                      }
                                      return current;
                                    });
                                  }}
                                  placeholder="Value B"
                                />
                              </>
                            ) : (
                              <>
                                <Input
                                  type={newRow.isRevealed ? "text" : "password"}
                                  value={newRow.valueA}
                                  onChange={(event) => {
                                    const valueA = event.currentTarget.value;
                                    updateCurrentStageDraft((current) => {
                                      const index = current.newRows.findIndex(
                                        (candidate) => candidate.localId === row.localId,
                                      );
                                      if (index >= 0 && current.newRows[index]?.kind === "ab_roll") {
                                        current.newRows[index] = {
                                          ...current.newRows[index],
                                          valueA,
                                        };
                                      }
                                      return current;
                                    });
                                  }}
                                  placeholder="Value A"
                                />
                                <Input
                                  type={newRow.isRevealed ? "text" : "password"}
                                  value={newRow.valueB}
                                  onChange={(event) => {
                                    const valueB = event.currentTarget.value;
                                    updateCurrentStageDraft((current) => {
                                      const index = current.newRows.findIndex(
                                        (candidate) => candidate.localId === row.localId,
                                      );
                                      if (index >= 0 && current.newRows[index]?.kind === "ab_roll") {
                                        current.newRows[index] = {
                                          ...current.newRows[index],
                                          valueB,
                                        };
                                      }
                                      return current;
                                    });
                                  }}
                                  placeholder="Value B"
                                />
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Select
                            value={newRow.kind}
                            onValueChange={(next) => {
                              if (next !== "secret" && next !== "ab_roll") {
                                return;
                              }

                              updateCurrentStageDraft((current) => {
                                const index = current.newRows.findIndex(
                                  (candidate) => candidate.localId === row.localId,
                                );
                                if (index >= 0) {
                                  current.newRows[index] = {
                                    localId: current.newRows[index].localId,
                                    name: current.newRows[index].name,
                                    isRevealed: current.newRows[index].isRevealed,
                                    ...createDraftValueByKind(next, current.newRows[index].declaredType),
                                  };
                                }
                                return current;
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="secret">Secret</SelectItem>
                              <SelectItem value="ab_roll">A/B roll</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={newRow.declaredType}
                            onValueChange={(next) => {
                              const declaredType = next as DeclaredVariableType;
                              updateCurrentStageDraft((current) => {
                                const index = current.newRows.findIndex(
                                  (candidate) => candidate.localId === row.localId,
                                );
                                if (index >= 0) {
                                  current.newRows[index] = {
                                    ...current.newRows[index],
                                    declaredType,
                                  };
                                }
                                return current;
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VARIABLE_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {newRow.kind === "ab_roll" ? (
                            <Input
                              value={newRow.chance}
                              onChange={(event) => {
                                const chance = event.currentTarget.value;
                                updateCurrentStageDraft((current) => {
                                  const index = current.newRows.findIndex(
                                    (candidate) => candidate.localId === row.localId,
                                  );
                                  if (index >= 0 && current.newRows[index]?.kind === "ab_roll") {
                                    current.newRows[index] = {
                                      ...current.newRows[index],
                                      chance,
                                    };
                                  }
                                  return current;
                                });
                              }}
                              placeholder="Chance for value A (0-1)"
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              updateCurrentStageDraft((current) => {
                                const index = current.newRows.findIndex(
                                  (candidate) => candidate.localId === row.localId,
                                );
                                if (index >= 0) {
                                  current.newRows[index] = {
                                    ...current.newRows[index],
                                    isRevealed: !current.newRows[index].isRevealed,
                                  };
                                }
                                return current;
                              });
                            }}
                          >
                            <IconKey />
                            {newRow.isRevealed ? "Hide" : "Decrypt"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="outline"
                                  aria-label={`Actions for new variable ${newRow.name || row.localId}`}
                                />
                              }
                            >
                              <IconChevronDown className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  updateCurrentStageDraft((current) => {
                                    current.newRows = current.newRows.filter(
                                      (candidate) => candidate.localId !== row.localId,
                                    );
                                    return current;
                                  });
                                }}
                                variant="destructive"
                              >
                                <IconTrash />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  updateCurrentStageDraft((current) => {
                                    current.newRows = current.newRows.filter(
                                      (candidate) => candidate.localId !== row.localId,
                                    );
                                    return current;
                                  });
                                }}
                              >
                                <IconRefresh />
                                Revert row
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No variables in this environment yet. Add a row above, paste env content, or import env files.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}

          <div
            className={`rounded-xl border border-dashed p-3 transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragActive(false);
              const droppedFiles = Array.from(event.dataTransfer.files ?? []);
              if (droppedFiles.length === 0) {
                return;
              }
              void importFiles(droppedFiles);
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
                Drop one or more <span className="font-mono">.env</span> files here or press{" "}
                <span className="font-mono">Ctrl/Cmd+V</span> anywhere on this page to import paste content.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              accept=".env,.txt,.local,.development,.staging,.production"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                if (files.length > 0) {
                  void importFiles(files);
                }
                event.currentTarget.value = "";
              }}
            />
          </div>

        </div>
      </OrgSectionCard>
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
        onSave={() => {
          void handleSaveAll();
        }}
        toolbarRef={draftToolbarRef}
      />
    </div>
  );
}
