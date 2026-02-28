import { useQuery } from "convex/react";
import {
  IconArrowRight,
  IconDoorEnter,
  IconFingerprint,
  IconMailShare,
  IconServerCog,
} from "@tabler/icons-react";
import { OrganizationProfile, useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
        subtitle={<>Manage team access, domains, and workspace controls.</>}
        tags={
          <>
            <OrgRoleBadge role={membership?.role ?? orgClaims?.orgRole} />
            <Badge variant={hasWorkspaceLink ? "secondary" : "outline"}>
              {hasWorkspaceLink ? "Access ready" : "Needs attention"}
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
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <OrgSectionCard
            title="Workspace controls"
            description="Shortcuts for day-to-day workspace management."
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
            </div>
          </OrgSectionCard>

          <OrgSectionCard
            title="Advanced diagnostics"
            description="Internal values for troubleshooting workspace access."
            className="scroll-mt-20"
          >
            <div id="advanced-diagnostics">
              <Collapsible open={isDiagnosticsOpen} onOpenChange={setIsDiagnosticsOpen}>
                <CollapsibleTrigger className="focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-left outline-none focus-visible:ring-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {isDiagnosticsOpen ? "Hide diagnostics" : "Show diagnostics"}
                    </span>
                    <Badge variant="outline">Advanced</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-3 rounded-xl border bg-background/70 p-3 text-sm text-muted-foreground">
                    <p>
                      Use this panel to check workspace values when navigation or project access does
                      not behave as expected.
                    </p>
                    <div className="space-y-1">
                      <p>
                        <span className="text-foreground">Workspace ID:</span>{" "}
                        <span className="font-mono">{orgClaims?.orgId ?? "missing"}</span>
                      </p>
                      <p>
                        <span className="text-foreground">Workspace slug:</span>{" "}
                        <span className="font-mono">{orgClaims?.orgSlug ?? "missing"}</span>
                      </p>
                      <p>
                        <span className="text-foreground">Workspace role:</span>{" "}
                        <span className="font-mono">
                          {(membership?.roleName || orgClaims?.orgRole || "missing").replace(
                            /^org:/,
                            "",
                          )}
                        </span>
                      </p>
                      <p>
                        <span className="text-foreground">Route aligned:</span>{" "}
                        <span className="font-mono">
                          {orgClaims === undefined
                            ? "loading"
                            : orgClaims.routeMatchesActiveOrg
                              ? "true"
                              : "false"}
                        </span>
                      </p>
                      <p>
                        <span className="text-foreground">Signed in:</span>{" "}
                        <span className="font-mono">
                          {orgClaims === undefined ? "loading" : orgClaims.isSignedIn ? "true" : "false"}
                        </span>
                      </p>
                    </div>
                    {!hasWorkspaceLink && orgClaims !== undefined ? (
                      <p>
                        If workspace values are missing, switch workspaces from the sidebar and
                        refresh.
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
