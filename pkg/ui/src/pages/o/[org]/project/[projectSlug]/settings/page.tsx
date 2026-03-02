import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  IconArrowRight,
  IconLock,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Link, useOutletContext } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { OrgSectionCard } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectRouteContext } from "../layout";

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const projectBasePath = `/o/${project.orgSlug}/project/${project.projectSlug}`;
  const [newEnvironmentName, setNewEnvironmentName] = useState("");
  const [renameDraftBySlug, setRenameDraftBySlug] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const stages = useQuery(api.project_stages.listForCurrentOrgProject, {
    expectedOrgSlug: project.orgSlug,
    projectSlug: project.projectSlug,
  });
  const createStage = useMutation(api.project_stages.createForCurrentOrgProject);
  const renameStage = useMutation(api.project_stages.renameForCurrentOrgProject);
  const deleteStage = useMutation(api.project_stages.deleteForCurrentOrgProject);

  async function handleCreateStage() {
    const trimmed = newEnvironmentName.trim();
    if (trimmed.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await createStage({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
        name: trimmed,
      });
      setNewEnvironmentName("");
      setSuccessMessage(`Added environment ${created.name}.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create environment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRenameStage(stageSlug: string, currentName: string) {
    const draftName = (renameDraftBySlug[stageSlug] ?? currentName).trim();
    if (draftName.length === 0 || draftName === currentName || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const renamed = await renameStage({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
        stageSlug,
        name: draftName,
      });
      setRenameDraftBySlug((previous) => {
        const { [stageSlug]: _, ...rest } = previous;
        return rest;
      });
      setSuccessMessage(`Renamed environment to ${renamed.name}.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to rename environment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteStage(stageSlug: string) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteStage({
        expectedOrgSlug: project.orgSlug,
        projectSlug: project.projectSlug,
        stageSlug,
      });
      setSuccessMessage(`Deleted environment ${stageSlug}.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete environment.");
    } finally {
      setIsSaving(false);
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
                onChange={(event) => setNewEnvironmentName(event.currentTarget.value)}
                placeholder="New environment name"
                disabled={isSaving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateStage();
                  }
                }}
              />
              <Button
                onClick={() => void handleCreateStage()}
                disabled={isSaving || newEnvironmentName.trim().length === 0}
              >
                <IconPlus />
                Add environment
              </Button>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-xl border p-3 text-sm text-muted-foreground">{successMessage}</div>
            ) : null}

            <div className="space-y-2">
              {(stages ?? []).map((stage) => {
                const draftName = renameDraftBySlug[stage.slug] ?? stage.name;
                const isRenameDisabled = draftName.trim().length === 0 || draftName.trim() === stage.name || isSaving;

                return (
                  <div key={stage.id} className="rounded-xl border bg-background/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline">{stage.variableCount} vars</Badge>
                        {stage.isDefault ? <Badge variant="outline">Default</Badge> : null}
                        <span className="font-mono text-xs text-muted-foreground">{stage.slug}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={isSaving || stage.variableCount > 0}
                        onClick={() => {
                          void handleDeleteStage(stage.slug);
                        }}
                      >
                        <IconTrash />
                        Delete
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={draftName}
                        disabled={isSaving}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setRenameDraftBySlug((previous) => ({
                            ...previous,
                            [stage.slug]: value,
                          }));
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isRenameDisabled}
                        onClick={() => {
                          void handleRenameStage(stage.slug, stage.name);
                        }}
                      >
                        Rename
                      </Button>
                    </div>
                    {stage.variableCount > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        This environment cannot be deleted until all variables are removed from it.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </OrgSectionCard>

        <OrgSectionCard title="Encryption controls" description="Project-level key lifecycle controls.">
          <div className="rounded-xl border bg-background/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <IconLock className="size-4" />
              Envelope encryption
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Variables are encrypted per project with a wrapped DEK. Rotation controls are coming next.
            </p>
            <Badge variant="outline" className="mt-3">
              Soon
            </Badge>
          </div>
        </OrgSectionCard>
      </div>

      <div className="space-y-4">
        <OrgSectionCard title="Navigation" description="Jump to project pages.">
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-between"
              nativeButton={false}
              render={<Link to={`${projectBasePath}/variables`} />}
            >
              Variables
              <IconArrowRight />
            </Button>
            <Button
              variant="outline"
              className="justify-between"
              nativeButton={false}
              render={<Link to={`${projectBasePath}/overview`} />}
            >
              Overview
              <IconArrowRight />
            </Button>
            <Button
              variant="outline"
              className="justify-between"
              nativeButton={false}
              render={<Link to={`/o/${project.orgSlug}/projects`} />}
            >
              Back to projects
              <IconArrowRight />
            </Button>
          </div>
        </OrgSectionCard>

        <OrgSectionCard title="Config file" description="Root-level runtime config for upcoming CLI support.">
          <pre className="overflow-x-auto rounded-xl border bg-background/70 p-3 text-xs">
{`{
  "apiUrl": "https://api.barekey.dev",
  "orgSlug": "${project.orgSlug}",
  "projectSlug": "${project.projectSlug}",
  "environmentSlug": "development"
}`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Save as <span className="font-mono">barekey.json</span> at repository root.
          </p>
        </OrgSectionCard>

        <OrgSectionCard title="Project metadata" description="Read-only identifiers used by routing and APIs.">
          <div className="space-y-3 rounded-xl border bg-background/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Project name</span>
              <span className="text-sm font-medium">{project.projectName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Project slug</span>
              <span className="font-mono text-sm">{project.projectSlug}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Workspace slug</span>
              <span className="font-mono text-sm">{project.orgSlug}</span>
            </div>
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
