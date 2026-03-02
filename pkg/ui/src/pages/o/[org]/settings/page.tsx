import { useQuery } from "convex/react";
import {
  IconArrowRight,
  IconDoorEnter,
  IconFingerprint,
  IconLockSquareRounded,
  IconMailShare,
  IconServerCog,
} from "@tabler/icons-react";
import { OrganizationProfile, useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import { OrgPageHero, OrgRoleBadge, OrgSectionCard } from "@/components/custom/org-workspace";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const hashListeners = new Set<() => void>();

function subscribeToHash(callback: () => void) {
  hashListeners.add(callback);
  window.addEventListener("hashchange", callback);
  return () => {
    hashListeners.delete(callback);
    window.removeEventListener("hashchange", callback);
  };
}

function getHashSnapshot() {
  return typeof window !== "undefined" && window.location.hash === "#advanced-diagnostics";
}

function getHashServerSnapshot() {
  return false;
}

function notifyHashListeners() {
  hashListeners.forEach((cb) => cb());
}

function clearDiagnosticsHash(): void {
  if (typeof window === "undefined" || window.location.hash !== "#advanced-diagnostics") {
    return;
  }

  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  notifyHashListeners();
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const { organization, membership, invitations, domains } = useOrganization({
    invitations: {
      pageSize: 8,
      keepPreviousData: true,
    },
    domains: {
      pageSize: 8,
      keepPreviousData: true,
    },
  });

  const domainCount = domains?.count ?? 0;
  const inviteCount = invitations?.count ?? 0;
  const projectCount = projects?.length ?? 0;
  const hasWorkspaceLink = orgClaims?.orgId != null;

  useEffect(() => {
    function syncDiagnosticsFromHash() {
      if (typeof window === "undefined") {
        return;
      }

      if (window.location.hash === "#advanced-diagnostics") {
        setIsDiagnosticsOpen(true);
      }
    }

    syncDiagnosticsFromHash();
    window.addEventListener("hashchange", syncDiagnosticsFromHash);
    return () => {
      window.removeEventListener("hashchange", syncDiagnosticsFromHash);
    };
  }, []);

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Settings"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={
          <>
            Manage team access, domains, and workspace controls from a single admin surface.
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={membership?.role ?? orgClaims?.orgRole} />
            <Badge variant={hasWorkspaceLink ? "secondary" : "outline"}>
              {hasWorkspaceLink ? "Access ready" : "Needs setup"}
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/members`} />}
            >
              <IconDoorEnter />
              Members
            </Button>
            <Button size="sm" nativeButton={false} render={<Link to={`/o/${orgSlug}/projects`} />}>
              <IconArrowRight />
              Projects
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/settings#advanced-diagnostics`} />}
            >
              Open diagnostics
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrgMetricCard
          label="Projects in workspace"
          value={projects === undefined ? "..." : projectCount}
          hint="Active projects available to your team"
          icon={<IconServerCog className="size-4" />}
        />
        <OrgMetricCard
          label="Pending invites"
          value={invitations ? inviteCount : "..."}
          hint="Outstanding access invitations"
          icon={<IconMailShare className="size-4" />}
          tone={inviteCount > 0 ? "accent" : "muted"}
        />
        <OrgMetricCard
          label="Verified domains"
          value={domains ? domainCount : "..."}
          hint="Domains approved for membership"
          icon={<IconFingerprint className="size-4" />}
        />
        <OrgMetricCard
          label="Current role"
          value={(membership?.roleName || orgClaims?.orgRole || "none").replace(/^org:/, "")}
          hint="Your access level in this workspace"
          icon={<IconLockSquareRounded className="size-4" />}
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <OrgSectionCard
            title="Workspace controls"
            description="Use these shortcuts to manage the workspace day to day."
          >
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/overview`} />}
              >
                Workspace overview
                <IconArrowRight />
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/members`} />}
              >
                Members and invites
                <IconArrowRight />
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/projects`} />}
              >
                Projects
                <IconArrowRight />
              </Button>
              <Button
                variant="ghost"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/settings#advanced-diagnostics`} />}
              >
                Open advanced diagnostics
                <IconArrowRight />
              </Button>
            </div>
          </OrgSectionCard>

          <OrgSectionCard
            title="Advanced diagnostics"
            description="Troubleshoot workspace wiring and identity mapping."
            className="scroll-mt-20"
          >
            <div id="advanced-diagnostics">
              <Collapsible open={isDiagnosticsOpen} onOpenChange={setIsDiagnosticsOpen}>
                <CollapsibleTrigger className="focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-left outline-none focus-visible:ring-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {isDiagnosticsOpen ? "Hide internal diagnostics" : "Show internal diagnostics"}
                    </span>
                    <Badge variant="outline">Advanced</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-3 rounded-xl border bg-background/70 p-3 text-sm text-muted-foreground">
                    <p>
                      This panel exposes raw claims from the Clerk JWT consumed by Convex, including
                      values that scope workspace data.
                    </p>
                    <div className="space-y-1">
                      <p>
                        <span className="text-foreground">org_id:</span>{" "}
                        <span className="font-mono">{orgClaims?.orgId ?? "missing"}</span>
                      </p>
                      <p>
                        <span className="text-foreground">org_slug:</span>{" "}
                        <span className="font-mono">{orgClaims?.orgSlug ?? "missing"}</span>
                      </p>
                      <p>
                        <span className="text-foreground">org_role:</span>{" "}
                        <span className="font-mono">{orgClaims?.orgRole ?? "missing"}</span>
                      </p>
                      <p>
                        <span className="text-foreground">route_matches_active_org:</span>{" "}
                        <span className="font-mono">
                          {orgClaims === undefined
                            ? "loading"
                            : orgClaims.routeMatchesActiveOrg
                              ? "true"
                              : "false"}
                        </span>
                      </p>
                    </div>
                    {!hasWorkspaceLink && orgClaims !== undefined ? (
                      <p>
                        Add org claims to the Clerk Convex JWT template if project-scoped data is not
                        resolving.
                      </p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </OrgSectionCard>
        </div>

        <OrgSectionCard
          title="Organization profile"
          description="Manage organization details, memberships, and domain policies."
          className="overflow-hidden"
        >
          <div className="-mx-4 rounded-t-none border-t bg-background/70 p-2 sm:-mx-3">
            <OrganizationProfile />
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
