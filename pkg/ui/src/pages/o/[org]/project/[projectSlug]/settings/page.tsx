import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import { FloatingDraftToolbar } from "@/components/custom/floating-draft-toolbar";
import { OrgSectionCard } from "@/components/custom/org-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { Input } from "@/components/ui/input";
import type { ProjectRouteContext } from "../layout";

type StageDraftRow = {
  id: string;
  slug: string;
  name: string;
  originalName: string;
  variableCount: number;
  isDefault: boolean;
  isNew: boolean;
  isDeleted: boolean;
};

function hasStageDraftChanges(rows: StageDraftRow[]): boolean {
  return rows.some((row) => {
    if (row.isDeleted || row.isNew) {
      return true;
    }

    return row.name.trim() !== row.originalName;
  });
}

function stageSlugPreview(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized.length > 0 ? normalized : "stage";
}

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const navigate = useNavigate();
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [stageDraftRows, setStageDraftRows] = useState<StageDraftRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const draftToolbarRef = useRef<HTMLDivElement | null>(null);

  const stages = useQuery(api.project_stages.listForCurrentOrgProject, {
    expectedOrgSlug: project.orgSlug,
    projectSlug: project.projectSlug,
  });
  const createStage = useMutation(api.project_stages.createForCurrentOrgProject);
  const renameStage = useMutation(api.project_stages.renameForCurrentOrgProject);
  const deleteStage = useMutation(api.project_stages.deleteForCurrentOrgProject);
  const deleteProject = useMutation(api.projects.deleteForCurrentOrg);
  const hasEnvironmentDraftChanges = hasStageDraftChanges(stageDraftRows);
  const remainingEnvironmentCount = stages?.length ?? 0;
  const remainingVariableCount =
    stages?.reduce((total, stage) => total + stage.variableCount, 0) ?? 0;
  const isDeletePrerequisitesLoading = stages === undefined;
  const areDeletePrerequisitesMet =
    !isDeletePrerequisitesLoading &&
    remainingEnvironmentCount === 0 &&
    remainingVariableCount === 0;

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
    hasUnsavedChanges: hasEnvironmentDraftChanges,
    onBlockedAttempt: shakeDraftToolbar,
  });

  useEffect(() => {
    if (!stages) {
      return;
    }

    setStageDraftRows((previous) => {
      if (hasStageDraftChanges(previous)) {
        return previous;
      }

      return stages.map((stage) => ({
        id: stage.id,
        slug: stage.slug,
        name: stage.name,
        originalName: stage.name,
        variableCount: stage.variableCount,
        isDefault: stage.isDefault,
        isNew: false,
        isDeleted: false,
      }));
    });
  }, [stages]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      setDeleteCountdown(5);
      return;
    }

    if (deleteCountdown <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDeleteCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [deleteCountdown, isDeleteDialogOpen]);

  function handleResetEnvironmentDraft() {
    if (!stages) {
      setStageDraftRows([]);
      return;
    }

    setStageDraftRows(
      stages.map((stage) => ({
        id: stage.id,
        slug: stage.slug,
        name: stage.name,
        originalName: stage.name,
        variableCount: stage.variableCount,
        isDefault: stage.isDefault,
        isNew: false,
        isDeleted: false,
      })),
    );
  }

  function handleAddEnvironmentToDraft() {
    const trimmed = newEnvironmentName.trim();
    if (trimmed.length === 0 || isSaving) {
      return;
    }

    if (trimmed.length > 64) {
      toast.error("Stage name must be 64 characters or fewer.");
      return;
    }

    setStageDraftRows((previous) => [
      ...previous,
      {
        id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        slug: stageSlugPreview(trimmed),
        name: trimmed,
        originalName: "",
        variableCount: 0,
        isDefault: false,
        isNew: true,
        isDeleted: false,
      },
    ]);
    setNewEnvironmentName("");
  }

  function handleToggleEnvironmentDraftDelete(stageId: string) {
    if (isSaving) {
      return;
    }

    const target = stageDraftRows.find((row) => row.id === stageId);
    if (!target) {
      return;
    }

    if (!target.isDeleted && target.variableCount > 0) {
      toast.error("This environment cannot be deleted until all variables are removed from it.");
      return;
    }

    setStageDraftRows((previous) => {
      const next: StageDraftRow[] = [];
      for (const row of previous) {
        if (row.id !== stageId) {
          next.push(row);
          continue;
        }

        if (row.isNew) {
          continue;
        }

        next.push({
          ...row,
          isDeleted: !row.isDeleted,
        });
      }

      return next;
    });
  }

  function handleEnvironmentNameDraftChange(stageId: string, nextName: string) {
    if (isSaving) {
      return;
    }

    setStageDraftRows((previous) =>
      previous.map((row) => {
        if (row.id !== stageId) {
          return row;
        }
        return {
          ...row,
          name: nextName,
        };
      }),
    );
  }

  async function handleSaveEnvironmentDraft() {
    if (isSaving || !hasEnvironmentDraftChanges) {
      return;
    }

    const invalidRow = stageDraftRows.find((row) => !row.isDeleted && row.name.trim().length === 0);
    if (invalidRow) {
      toast.error("Environment name is required.");
      return;
    }

    const tooLongRow = stageDraftRows.find((row) => !row.isDeleted && row.name.trim().length > 64);
    if (tooLongRow) {
      toast.error("Stage name must be 64 characters or fewer.");
      return;
    }

    setIsSaving(true);
    try {
      const deleteRows = stageDraftRows.filter((row) => row.isDeleted && !row.isNew);
      const renameRows = stageDraftRows.filter(
        (row) => !row.isDeleted && !row.isNew && row.name.trim() !== row.originalName,
      );
      const createRows = stageDraftRows.filter((row) => row.isNew && !row.isDeleted);

      for (const row of deleteRows) {
        await deleteStage({
          expectedOrgSlug: project.orgSlug,
          projectSlug: project.projectSlug,
          stageSlug: row.slug,
        });
      }

      for (const row of renameRows) {
        await renameStage({
          expectedOrgSlug: project.orgSlug,
          projectSlug: project.projectSlug,
          stageSlug: row.slug,
          name: row.name.trim(),
        });
      }

      for (const row of createRows) {
        await createStage({
          expectedOrgSlug: project.orgSlug,
          projectSlug: project.projectSlug,
          name: row.name.trim(),
        });
      }

      setNewEnvironmentName("");
      setStageDraftRows([]);
      toast.success("Environment changes saved.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save environment changes.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (isDeletingProject || deleteCountdown > 0 || !areDeletePrerequisitesMet) {
      return;
    }

    setIsDeletingProject(true);
    try {
      await deleteProject({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
      });
      navigate(`/o/${project.orgSlug}/projects`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      setIsDeletingProject(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <OrgSectionCard
          title="Environments"
          description="Every project starts with development, staging, and production. Add more environments as needed."
        >
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newEnvironmentName}
                onChange={(event) => setNewEnvironmentName(event.currentTarget?.value ?? "")}
                placeholder="New environment name"
                disabled={isSaving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddEnvironmentToDraft();
                  }
                }}
              />
              <Button
                onClick={handleAddEnvironmentToDraft}
                disabled={isSaving || newEnvironmentName.trim().length === 0}
              >
                <IconPlus />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {stageDraftRows.map((stage) => {
                return (
                  <div
                    key={stage.id}
                    className={`rounded-xl border bg-background/70 p-3 ${
                      stage.isDeleted || stage.isNew ? "border-dashed" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        {stage.isDeleted ? (
                          <p className="min-w-0 truncate text-sm text-muted-foreground opacity-70">
                            <span className="truncate">{stage.name}</span>{" "}
                            <span className="font-mono text-xs text-muted-foreground">
                              ({stage.slug})
                            </span>
                          </p>
                        ) : (
                          <>
                            <Input
                              value={stage.name}
                              disabled={isSaving}
                              onChange={(event) =>
                                handleEnvironmentNameDraftChange(
                                  stage.id,
                                  event.currentTarget.value,
                                )
                              }
                              className={stage.isNew ? "h-8 max-w-sm opacity-70" : "h-8 max-w-sm"}
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                              ({stage.slug})
                            </span>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className={stage.isDeleted ? "" : "text-destructive"}
                        disabled={
                          isSaving || (!stage.isDeleted && !stage.isNew && stage.variableCount > 0)
                        }
                        onClick={() => {
                          handleToggleEnvironmentDraftDelete(stage.id);
                        }}
                      >
                        {stage.isDeleted ? "Undo" : "Delete"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {stageDraftRows.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No environments yet. Add one to your draft above.
                </div>
              ) : null}
            </div>
          </div>
        </OrgSectionCard>
      </div>

      <div className="space-y-4">
        <OrgSectionCard
          title="Project metadata"
          description="Read-only identifiers used by routing and APIs."
        >
          <div className="overflow-hidden rounded-xl border bg-background/70">
            <table className="w-full border-collapse font-mono text-sm">
              <tbody>
                <tr className="bg-background">
                  <td className="px-4 py-3 text-foreground">PROJECT NAME</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {project.projectName}
                  </td>
                </tr>
                <tr className="bg-muted/25">
                  <td className="px-4 py-3 text-foreground">PROJECT SLUG</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {project.projectSlug}
                  </td>
                </tr>
                <tr className="bg-background">
                  <td className="px-4 py-3 text-foreground">WORKSPACE SLUG</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{project.orgSlug}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </OrgSectionCard>

        <OrgSectionCard
          title="Danger zone"
          description="Permanent actions for this project."
          className="border-destructive/30"
        >
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:text-destructive"
              onClick={() => {
                setDeleteCountdown(5);
                setIsDeleteDialogOpen(true);
              }}
            >
              <IconTrash />
              Delete project
            </Button>
          </div>
        </OrgSectionCard>
      </div>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (isDeletingProject) {
            return;
          }
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteCountdown(5);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This permanently removes this project and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {areDeletePrerequisitesMet ? (
              <p className="text-sm text-muted-foreground">
                All environments and variables have been removed.{" "}
                {deleteCountdown > 0
                  ? `Delete unlocks in ${deleteCountdown} ${deleteCountdown === 1 ? "second" : "seconds"}.`
                  : "Delete is unlocked now."}{" "}
                Note that we can not recover or undo this operation.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                To delete this project, please delete{" "}
                <span className="font-bold text-foreground">
                  {isDeletePrerequisitesLoading ? "..." : remainingEnvironmentCount}
                </span>{" "}
                environments and the{" "}
                <span className="font-bold text-foreground">
                  {isDeletePrerequisitesLoading ? "..." : remainingVariableCount}
                </span>{" "}
                variables for this project. Note that we can not recover or undo this operation.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeletingProject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDeleteProject();
              }}
              disabled={
                isDeletingProject ||
                deleteCountdown > 0 ||
                isDeletePrerequisitesLoading ||
                !areDeletePrerequisitesMet
              }
            >
              {isDeletingProject ? "Deleting..." : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FloatingDraftToolbar
        isVisible={hasEnvironmentDraftChanges}
        message="You have unsaved environment changes."
        isSaving={isSaving}
        onDiscard={handleResetEnvironmentDraft}
        onSave={() => {
          void handleSaveEnvironmentDraft();
        }}
        toolbarRef={draftToolbarRef}
      />
    </div>
  );
}
