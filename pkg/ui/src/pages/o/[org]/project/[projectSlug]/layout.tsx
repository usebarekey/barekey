import { useQuery } from "convex/react";
import {
  IconArrowLeft,
  IconCopy,
  IconDownload,
  IconFileCode,
  IconListDetails,
  IconSettingsCog,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import { CodeBlock } from "@/components/custom/code-block";
import { OrgPageHero, OrgRoleBadge } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const projectNavItems = [
  { label: "Variables", segment: "variables", icon: IconListDetails },
  { label: "Settings", segment: "settings", icon: IconSettingsCog },
] as const;

export type ProjectRouteContext = {
  orgSlug: string;
  projectSlug: string;
  projectName: string;
  createdAtMs: number;
  updatedAtMs: number;
};

function buildRuntimeConfigSnippet(orgSlug: string, projectSlug: string): string {
  return JSON.stringify(
    {
      org: orgSlug,
      project: projectSlug,
      environment: "development",
    },
    null,
    2,
  );
}

export function Layout() {
  const { orgSlug = "org", projectSlug = "project" } = useParams();
  const { pathname } = useLocation();
  const [isRuntimeConfigDialogOpen, setIsRuntimeConfigDialogOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
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
  const runtimeConfigSnippet = useMemo(
    () => buildRuntimeConfigSnippet(orgSlug, projectSlug),
    [orgSlug, projectSlug],
  );

  async function handleCopyRuntimeConfig(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(runtimeConfigSnippet);
      setCopyFeedback("copied");
      return true;
    } catch {
      setCopyFeedback("failed");
      return false;
    }
  }

  function handleDownloadRuntimeConfig() {
    const blob = new Blob([runtimeConfigSnippet], {
      type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "barekey.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

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
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/o/${orgSlug}/projects`} />}
          >
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
      />

      <nav className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2">
        <div className="flex flex-wrap items-center gap-2">
          {projectNavItems.map((item) => {
            const href = `${projectBasePath}/${item.segment}`;
            const isActive =
              item.segment === "variables"
                ? activeSegment === "variables"
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
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            setIsRuntimeConfigDialogOpen(true);
          }}
        >
          <IconFileCode className="size-4" />
          Runtime config
        </Button>
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

      <Dialog
        open={isRuntimeConfigDialogOpen}
        onOpenChange={(open) => {
          setIsRuntimeConfigDialogOpen(open);
          if (!open) {
            setCopyFeedback("idle");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>barekey.json</DialogTitle>
            <DialogDescription>Project runtime defaults for CLI/SDK integration.</DialogDescription>
          </DialogHeader>
          <CodeBlock
            code={runtimeConfigSnippet}
            lang="json"
            className="max-h-[46vh] overflow-auto rounded-xl border bg-card [&_.shiki]:!bg-transparent [&_pre]:!m-0 [&_pre]:!bg-transparent"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                const copied = await handleCopyRuntimeConfig();
                if (copied) {
                  toast.info("Copied to clipboard.", {
                    icon: <IconCopy className="size-4" />,
                  });
                } else {
                  toast.error("Unable to copy snippet.");
                }
                setIsRuntimeConfigDialogOpen(false);
              }}
            >
              <IconCopy className="size-4" />
              {copyFeedback === "copied"
                ? "Copied"
                : copyFeedback === "failed"
                  ? "Copy failed"
                  : "Copy snippet"}
            </Button>
            <Button
              onClick={() => {
                handleDownloadRuntimeConfig();
                toast.info("Downloaded barekey.json.", {
                  icon: <IconDownload className="size-4" />,
                });
                setIsRuntimeConfigDialogOpen(false);
              }}
            >
              <IconDownload className="size-4" />
              Download barekey.json
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
