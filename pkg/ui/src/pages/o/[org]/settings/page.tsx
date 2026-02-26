import { useQuery } from "convex/react";
import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconDatabaseCog,
  IconDoorEnter,
  IconFingerprint,
  IconLockSquareRounded,
  IconMailShare,
} from "@tabler/icons-react";
import { OrganizationProfile, SignedIn, SignedOut, useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Page() {
  const { orgSlug = "org" } = useParams();
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
  const hasOrgIdClaim = orgClaims?.orgId != null;

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
            Manage workspace identity, member administration, and organization-level configuration
            through Clerk while keeping an eye on the claims your Convex org-scoped APIs rely on.
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={membership?.role ?? orgClaims?.orgRole} />
            <Badge variant={hasOrgIdClaim ? "secondary" : "outline"}>
              {hasOrgIdClaim ? "Convex org claim present" : "Convex org claim missing"}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrgMetricCard
          label="Projects in workspace"
          value={projects === undefined ? "..." : projectCount}
          hint="Org-scoped Convex records"
          icon={<IconDatabaseCog className="size-4" />}
        />
        <OrgMetricCard
          label="Pending invites"
          value={invitations ? inviteCount : "..."}
          hint="Managed in Clerk organization settings"
          icon={<IconMailShare className="size-4" />}
          tone={inviteCount > 0 ? "accent" : "muted"}
        />
        <OrgMetricCard
          label="Verified domains"
          value={domains ? domainCount : "..."}
          hint="Organization domains configured in Clerk"
          icon={<IconFingerprint className="size-4" />}
        />
        <OrgMetricCard
          label="Current role"
          value={(membership?.roleName || orgClaims?.orgRole || "none").replace(/^org:/, "")}
          hint="Role used for admin affordances"
          icon={<IconLockSquareRounded className="size-4" />}
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <OrgSectionCard
            title="Control plane notes"
            description="Operational context for this workspace."
          >
            <div className="space-y-3">
              <div className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <IconAdjustmentsHorizontal />
                    Identity wiring
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  The embedded Clerk settings panel below manages the source-of-truth organization
                  profile and membership administration. Convex project APIs use active org claims
                  (`org_id`) from the Clerk JWT template to scope data.
                </p>
              </div>

              <div className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Convex claim health</p>
                  <Badge variant={hasOrgIdClaim ? "secondary" : "outline"}>
                    {hasOrgIdClaim ? "Ready" : "Action needed"}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
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
                </div>
                {!hasOrgIdClaim && orgClaims !== undefined ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add org claims to the Clerk Convex JWT template to unlock org-scoped pages like
                    Projects and future project detail screens.
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-sm font-medium">Suggested workflow</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Configure org profile and membership policies in Clerk.</li>
                  <li>Verify Convex token org claims are present for active members.</li>
                  <li>Create projects in the Projects page to begin org-scoped resource modeling.</li>
                </ol>
              </div>
            </div>
          </OrgSectionCard>

          <OrgSectionCard title="Navigation" description="Workspace admin shortcuts.">
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
                Project inventory
                <IconArrowRight />
              </Button>
            </div>
          </OrgSectionCard>
        </div>

        <SignedOut>
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            Sign in to manage organization settings.
          </div>
        </SignedOut>

        <SignedIn>
          <OrgSectionCard
            title="Organization profile"
            description="Clerk’s organization management surface embedded in the workspace."
            className="overflow-hidden"
          >
            <div className="-mx-4 rounded-t-none border-t bg-background/70 p-2 sm:-mx-3">
              <OrganizationProfile />
            </div>
          </OrgSectionCard>
        </SignedIn>
      </div>
    </div>
  );
}
