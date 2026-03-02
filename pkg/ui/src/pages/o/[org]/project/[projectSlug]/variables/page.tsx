import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconChevronDown,
  IconFolderOpen,
  IconKey,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useOutletContext } from "react-router-dom";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectRouteContext } from "../layout";
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
import { Badge } from "@/components/ui/badge";
import { parseEnvText, type ParsedEnvIssue } from "@/lib/parse-env-text";

type NewVariableDraft = {
  localId: string;
  name: string;
  value: string;
  kind: "secret";
  isRevealed: boolean;
};

type StageDraftState = {
  newRows: Array<NewVariableDraft>;
  updatedValues: Record<string, string>;
  deletedIds: Record<string, boolean>;
  revealedValues: Record<string, string>;
  revealedIds: Record<string, boolean>;
  decryptingIds: Record<string, boolean>;
};

type ComposerRowState = {
  name: string;
  value: string;
  kind: "secret";
};

type ImportIssue = ParsedEnvIssue & {
  source: string;
};

type ImportSummary = {
  importedCount: number;
  createdCount: number;
  overwrittenCount: number;
  issues: Array<ImportIssue>;
};

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

function hasDraftChanges(draft: StageDraftState): boolean {
  return (
    draft.newRows.length > 0 ||
    Object.keys(draft.updatedValues).length > 0 ||
    Object.keys(draft.deletedIds).length > 0
  );
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
      kind: "secret";
      createdAtMs: number;
      updatedAtMs: number;
    }
  | {
      key: string;
      type: "new";
      localId: string;
      name: string;
      kind: "secret";
    };

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const [selectedStageSlug, setSelectedStageSlug] = useState<string | null>(null);
  const [draftByStage, setDraftByStage] = useState<Record<string, StageDraftState>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [composerRow, setComposerRow] = useState<ComposerRowState>({
    name: "",
    value: "",
    kind: "secret",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const applyDraft = useMutation(api.project_variables.applyDraftForCurrentOrgProjectStage);
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
      setErrorMessage(error instanceof Error ? error.message : "Failed to initialize default stages.");
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
      setErrorMessage(null);
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
        createdAtMs: row.createdAtMs,
        updatedAtMs: row.updatedAtMs,
      }));
    const newRows: Array<VariableDisplayRow> = currentDraft.newRows.map((row) => ({
      key: `new-${row.localId}`,
      type: "new" as const,
      localId: row.localId,
      name: row.name,
      kind: row.kind,
    }));

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
      if (!hasDraftChanges(next)) {
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

  function upsertVariableDraftByName(name: string, value: string, kind: "secret"): void {
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
        current.updatedValues[existingVariable.id] = value;
        return current;
      }

      const existingDraftIndex = current.newRows.findIndex((row) => row.name === normalizedName);
      if (existingDraftIndex >= 0) {
        current.newRows[existingDraftIndex] = {
          ...current.newRows[existingDraftIndex],
          value,
          kind,
        };
        return current;
      }

      current.newRows.unshift({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: normalizedName,
        value,
        kind,
        isRevealed: false,
      });
      return current;
    });
  }

  function handleAppendComposerRow(): void {
    if (!selectedStageSlug) {
      return;
    }

    if (composerRow.name.trim().length === 0) {
      setErrorMessage("Name is required to add a variable.");
      return;
    }

    setErrorMessage(null);
    upsertVariableDraftByName(composerRow.name, composerRow.value, composerRow.kind);
    setComposerRow({
      name: "",
      value: "",
      kind: "secret",
    });
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
          current.updatedValues[existingVariable.id] = entry.value;
          continue;
        }

        const newRowIndex = current.newRows.findIndex((row) => row.name === entry.name);
        if (newRowIndex >= 0) {
          current.newRows[newRowIndex] = {
            ...current.newRows[newRowIndex],
            value: entry.value,
          };
          overwrittenCount += 1;
          continue;
        }

        current.newRows.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: entry.name,
          value: entry.value,
          kind: "secret",
          isRevealed: false,
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
      setErrorMessage("Every new variable row needs a name before saving.");
      return;
    }

    const creates = currentDraft.newRows.map((row) => ({
      name: row.name.trim(),
      kind: row.kind,
      value: row.value,
    }));
    const updates = persistedRows
      .filter((row) => !currentDraft.deletedIds[row.id] && currentDraft.updatedValues[row.id] !== undefined)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        value: currentDraft.updatedValues[row.id] ?? "",
      }));
    const deletes = persistedRows.filter((row) => currentDraft.deletedIds[row.id]).map((row) => row.id);

    if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
      setInfoMessage("No changes to save.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setInfoMessage(null);

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
      setInfoMessage(
        `Saved ${result.createdCount} created, ${result.updatedCount} updated, ${result.deletedCount} deleted.`,
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save variables.");
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
          current.revealedValues[variableId] = decrypted.value;
          current.revealedIds[variableId] = true;
          return current;
        });
      } catch (error: unknown) {
        updateCurrentStageDraft((current) => {
          delete current.decryptingIds[variableId];
          return current;
        });
        setErrorMessage(error instanceof Error ? error.message : "Failed to decrypt variable.");
      }
      return;
    }

    updateCurrentStageDraft((current) => {
      current.revealedIds[variableId] = true;
      return current;
    });
  }

  const hasDraft = hasDraftChanges(currentDraft);

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
                setErrorMessage(null);
                setInfoMessage(null);
              }}
            >
              <SelectTrigger className="h-8 min-w-56 border-transparent bg-transparent shadow-none">
                {selectedEnvironment ? (
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{selectedEnvironment.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedEnvironment.slug}
                    </Badge>
                  </div>
                ) : (
                  <SelectValue placeholder="Select environment" />
                )}
              </SelectTrigger>
              <SelectContent>
                {(stages ?? []).map((stage) => (
                  <SelectItem key={stage.id} value={stage.slug}>
                    <div className="flex w-full items-center justify-between gap-4">
                      <span>{stage.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {stage.slug}
                      </Badge>
                    </div>
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

          {errorMessage ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          {infoMessage ? (
            <div className="rounded-xl border p-3 text-sm text-muted-foreground">{infoMessage}</div>
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
                        setComposerRow((previous) => ({
                          ...previous,
                          name: event.currentTarget.value,
                        }));
                      }}
                      placeholder="Add variable name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="password"
                      value={composerRow.value}
                      onChange={(event) => {
                        setComposerRow((previous) => ({
                          ...previous,
                          value: event.currentTarget.value,
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
                  </TableCell>
                  <TableCell>
                    <Select
                      value={composerRow.kind}
                      onValueChange={(next) => {
                        if (next !== "secret") {
                          return;
                        }

                        setComposerRow((previous) => ({
                          ...previous,
                          kind: next,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full bg-secondary/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="secret">Secret</SelectItem>
                      </SelectContent>
                    </Select>
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
                    const shownValue =
                      pendingValue !== undefined
                        ? pendingValue
                        : isRevealed
                          ? currentDraft.revealedValues[row.id] ?? ""
                          : "";
                    const isDecrypting = Boolean(currentDraft.decryptingIds[row.id]);

                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <Input value={row.name} disabled />
                        </TableCell>
                        <TableCell>
                          <Input
                            type={isRevealed ? "text" : "password"}
                            value={shownValue}
                            placeholder={!isRevealed && pendingValue === undefined ? "••••••••••" : ""}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              updateCurrentStageDraft((current) => {
                                current.updatedValues[row.id] = value;
                                return current;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={row.kind} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="secret">Secret</SelectItem>
                            </SelectContent>
                          </Select>
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
                        <Input
                          type={newRow.isRevealed ? "text" : "password"}
                          value={newRow.value}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            updateCurrentStageDraft((current) => {
                              const index = current.newRows.findIndex(
                                (candidate) => candidate.localId === row.localId,
                              );
                              if (index >= 0) {
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
                      </TableCell>
                      <TableCell>
                        <Select
                          value={newRow.kind}
                          onValueChange={(next) => {
                            if (next !== "secret") {
                              return;
                            }

                            updateCurrentStageDraft((current) => {
                              const index = current.newRows.findIndex(
                                (candidate) => candidate.localId === row.localId,
                              );
                              if (index >= 0) {
                                current.newRows[index] = {
                                  ...current.newRows[index],
                                  kind: next,
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
                          </SelectContent>
                        </Select>
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {hasDraft ? "You have unsaved draft changes." : "No unsaved changes."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  clearCurrentStageDraft();
                  setImportSummary(null);
                  setErrorMessage(null);
                  setInfoMessage("Draft changes discarded.");
                }}
                disabled={!hasDraft || isSaving}
              >
                Discard all
              </Button>
              <Button onClick={() => void handleSaveAll()} disabled={!hasDraft || !selectedStageSlug || isSaving}>
                <IconUpload />
                {isSaving ? "Saving..." : "Save all"}
              </Button>
            </div>
          </div>
        </div>
      </OrgSectionCard>

      <OrgSectionCard title="Runtime config" description="Project runtime defaults for future CLI/SDK integration.">
        <pre className="overflow-x-auto rounded-xl border bg-background/70 p-3 text-xs">
{`{
  "apiUrl": "https://api.barekey.dev",
  "orgSlug": "${project.orgSlug}",
  "projectSlug": "${project.projectSlug}",
  "environmentSlug": "${selectedStageSlug ?? "development"}"
}`}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Store this as <span className="font-mono">barekey.json</span> in your repository root.
        </p>
      </OrgSectionCard>
    </div>
  );
}
