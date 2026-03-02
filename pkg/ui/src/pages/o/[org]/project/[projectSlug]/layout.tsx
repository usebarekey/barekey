import { useQuery } from "convex/react";
import {
  IconArrowLeft,
  IconChartBar,
  IconListDetails,
  IconSettings,
  IconSettingsCog,
} from "@tabler/icons-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";

import { api } from "@convex/_generated/api";
import { OrgPageHero, OrgRoleBadge } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const projectNavItems = [
  { label: "Variables", segment: "variables", icon: IconListDetails },
  { label: "Overview", segment: "overview", icon: IconChartBar },
  { label: "Settings", segment: "settings", icon: IconSettingsCog },
] as const;

export type ProjectRouteContext = {
  orgSlug: string;
  projectSlug: string;
  projectName: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export function Layout() {
  const { orgSlug = "org", projectSlug = "project" } = useParams();
  const { pathname } = useLocation();
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const project = projects?.find((row) => row.slug === projectSlug) ?? null;
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projectBasePath = `/o/${orgSlug}/project/${projectSlug}`;
  const activeSegment = pathname.startsWith(projectBasePath)
    ? pathname.slice(projectBasePath.length).replace(/^\/+/, "").split("/")[0] || "variables"
    : "variables";

  if (projects === undefined || orgClaims === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="rounded-xl border p-5">
        <h1 className="text-lg font-semibold">Project not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The project <span className="font-mono">{projectSlug}</span> is unavailable in this
          workspace.
        </p>
        <div className="mt-4">
          <Button variant="outline" nativeButton={false} render={<Link to={`/o/${orgSlug}/projects`} />}>
            <IconArrowLeft />
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrgPageHero
        title={project.name}
        orgSlug={orgSlug}
        subtitle={<>Project-scoped pages for configuration, secrets, and rollout controls.</>}
        tags={
          <>
            <Badge variant="outline">Project</Badge>
            <Badge variant="outline" className="font-mono">
              {project.slug}
            </Badge>
            <OrgRoleBadge role={orgClaims.orgRole} />
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/projects`} />}
            >
              <IconArrowLeft />
              All projects
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link to={`${projectBasePath}/settings`} />}
            >
              <IconSettings />
              Project settings
            </Button>
          </>
        }
      />

      <nav className="flex flex-wrap gap-2 rounded-xl border bg-card p-2">
        {projectNavItems.map((item) => {
          const href = `${projectBasePath}/${item.segment}`;
          const isActive =
            item.segment === "variables"
              ? activeSegment === "variables"
              : item.segment === "overview"
                ? activeSegment === "overview"
                : pathname.startsWith(href);

          return (
            <NavLink
              key={item.segment}
              to={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
                "hover:border-border hover:bg-muted/55 hover:text-foreground",
                isActive && "border-border bg-background text-foreground shadow-xs",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <Outlet
        context={
          {
            orgSlug,
            projectSlug: project.slug,
            projectName: project.name,
            createdAtMs: project.createdAtMs,
            updatedAtMs: project.updatedAtMs,
          } satisfies ProjectRouteContext
        }
      />
    </div>
  );
}
