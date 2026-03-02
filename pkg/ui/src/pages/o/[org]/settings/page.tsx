import { useQuery } from "convex/react";
import { IconArrowRight, IconDoorEnter } from "@tabler/icons-react";
import { OrganizationProfile, useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { useSyncExternalStore } from "react";

import { api } from "@convex/_generated/api";
import { OrgPageHero, OrgRoleBadge, OrgSectionCard } from "@/components/custom/org-workspace";
import { Button } from "@/components/ui/button";

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
  const isDiagnosticsOpen = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getHashServerSnapshot,
  );
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const { organization, membership } = useOrganization();
  const isWorkspaceLinked = orgClaims?.orgId != null;

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

          {isDiagnosticsOpen ? (
            <OrgSectionCard
              title="Advanced diagnostics"
              description="Troubleshooting details for workspace routing and access."
              className="scroll-mt-20"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearDiagnosticsHash();
                  }}
                >
                  Hide
                </Button>
              }
            >
              <div
                id="advanced-diagnostics"
                className="space-y-3 rounded-xl border bg-background/70 p-3 text-sm text-muted-foreground"
              >
                <p>
                  Use this panel when workspace navigation or project access does not behave as
                  expected.
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
                {!isWorkspaceLinked && orgClaims !== undefined ? (
                  <p>If values are missing, switch workspaces from the sidebar and refresh.</p>
                ) : null}
              </div>
            </OrgSectionCard>
          ) : null}
        </div>

        <OrgSectionCard
          title="Workspace profile"
          description="Manage workspace details, memberships, and domain policies."
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
