import { IconArrowRight, IconCalendarClock, IconClock, IconSettings } from "@tabler/icons-react";
import { Link, useOutletContext } from "react-router-dom";

import { OrgSectionCard } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectRouteContext } from "../layout";

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function Page() {
  const project = useOutletContext<ProjectRouteContext>();
  const projectBasePath = `/o/${project.orgSlug}/project/${project.projectSlug}`;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <OrgSectionCard
        title="Project identity"
        description="Canonical identifiers for SDK and CLI targeting."
      >
        <div className="space-y-3 rounded-xl border bg-background/70 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Name</p>
            <p className="mt-1 text-sm font-medium">{project.projectName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Slug</p>
            <p className="mt-1 font-mono text-sm">{project.projectSlug}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created</p>
              <p className="mt-2 text-sm">{formatDateTime(project.createdAtMs)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last updated</p>
              <p className="mt-2 text-sm">{formatDateTime(project.updatedAtMs)}</p>
            </div>
          </div>
        </div>
      </OrgSectionCard>

      <div className="space-y-4">
        <OrgSectionCard title="Project pages" description="Navigate project-scoped areas.">
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
              render={<Link to={`${projectBasePath}/settings`} />}
            >
              Project settings
              <IconArrowRight />
            </Button>
            <Button
              variant="outline"
              className="justify-between"
              nativeButton={false}
              render={<Link to={`/o/${project.orgSlug}/projects`} />}
            >
              Back to all projects
              <IconArrowRight />
            </Button>
          </div>
        </OrgSectionCard>

        <OrgSectionCard title="Roadmap" description="Upcoming project-level capabilities.">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <IconSettings className="size-4 text-foreground/70" />
              Secrets and env configuration views
            </p>
            <p className="inline-flex items-center gap-2">
              <IconCalendarClock className="size-4 text-foreground/70" />
              Rotation and key lifecycle audit timeline
            </p>
            <p className="inline-flex items-center gap-2">
              <IconClock className="size-4 text-foreground/70" />
              Deploy-time snapshots and rollback controls
            </p>
            <Badge variant="outline" className="mt-1">
              Project scope initialized
            </Badge>
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
