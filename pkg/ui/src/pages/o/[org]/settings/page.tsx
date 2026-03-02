import { useQuery } from "convex/react";
import {
  IconArrowRight,
  IconDoorEnter,
  IconShieldLock,
  IconUsers,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import slugify from "slugify";

import { api } from "@convex/_generated/api";
import {
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { generateGradientDataUrl } from "@/lib/generate-gradient";
import { displayName, initials } from "@/lib/org-utils";
import { generateOrganizationSlugCandidateFromName } from "@/lib/slugs";

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

function normalizeOrganizationSlugBase(value: string): string {
  const normalized = slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  })
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 32)
    .replace(/-+$/, "");

  return normalized.length > 0 ? normalized : "org";
}

function buildAutoOrganizationSlug(name: string, currentSlug: string | null | undefined): string {
  const base = normalizeOrganizationSlugBase(name);
  const suffixMatch = currentSlug?.match(/-(\d{4})$/);
  if (suffixMatch) {
    return `${base}-${suffixMatch[1]}`;
  }
  return generateOrganizationSlugCandidateFromName(name);
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const navigate = useNavigate();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [isRemovingByMembershipId, setIsRemovingByMembershipId] = useState<Record<string, boolean>>({});
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const { organization, membership, memberships, invitations } = useOrganization({
    memberships: {
      pageSize: 50,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 1,
      keepPreviousData: true,
    },
  });
  const isWorkspaceLinked = orgClaims?.orgId != null;
  const memberCount = memberships?.count ?? 0;
  const inviteCount = invitations?.count ?? 0;
  const memberRows = memberships?.data ?? [];
  const currentUserId = membership?.publicUserData?.userId ?? null;
  const isOrgAdmin = (membership?.role ?? orgClaims?.orgRole) === "org:admin";
  const autoSlugPreview = buildAutoOrganizationSlug(nameDraft, organization?.slug ?? orgSlug);

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

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Settings`;
  }, [organization?.name, orgSlug]);

  useEffect(() => {
    setNameDraft(organization?.name ?? "");
  }, [organization?.name]);

  async function handleSaveProfile() {
    if (!organization || isUpdatingProfile) {
      return;
    }

    const trimmedName = nameDraft.trim();
    if (trimmedName.length === 0) {
      setProfileError("Organization name is required.");
      setProfileSuccess(null);
      return;
    }

    const preferredSlug = buildAutoOrganizationSlug(trimmedName, organization.slug ?? orgSlug);

    setIsUpdatingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      let updatedOrganization: typeof organization | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const nextSlug =
          attempt === 0
            ? preferredSlug
            : generateOrganizationSlugCandidateFromName(trimmedName);
        try {
          updatedOrganization = await organization.update({
            name: trimmedName,
            slug: nextSlug,
          });
          break;
        } catch (error: unknown) {
          if (!isClerkIdentifierExistsError(error)) {
            throw error;
          }
          lastError = error;
        }
      }

      if (updatedOrganization === null) {
        throw lastError ?? new Error("Unable to update workspace profile.");
      }

      setProfileSuccess("Workspace profile updated.");
      if (updatedOrganization.slug && updatedOrganization.slug !== orgSlug) {
        void navigate(`/o/${updatedOrganization.slug}/settings`, { replace: true });
      }
    } catch (error: unknown) {
      setProfileError(getClerkErrorMessage(error, "Unable to update workspace profile."));
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function handleSetLogo(file: File | null) {
    if (!organization || isUpdatingLogo) {
      return;
    }

    setIsUpdatingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      await organization.setLogo({ file });
      setLogoSuccess(file ? "Logo updated." : "Logo removed.");
    } catch (error: unknown) {
      setLogoError(getClerkErrorMessage(error, "Unable to update workspace logo."));
    } finally {
      setIsUpdatingLogo(false);
    }
  }

  async function handleLogoInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    await handleSetLogo(file);
  }

  async function handleRemoveMember(memberId: string, userId: string, memberName: string) {
    if (!organization || isRemovingByMembershipId[memberId]) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${memberName} from this workspace?`)
    ) {
      return;
    }

    setRemoveError(null);
    setIsRemovingByMembershipId((previous) => ({
      ...previous,
      [memberId]: true,
    }));

    try {
      await organization.removeMember(userId);
    } catch (error: unknown) {
      setRemoveError(getClerkErrorMessage(error, "Unable to remove member right now."));
    } finally {
      setIsRemovingByMembershipId((previous) => {
        const { [memberId]: _, ...rest } = previous;
        return rest;
      });
    }
  }

  async function handleLeaveWorkspace() {
    if (!membership || isLeaving) {
      return;
    }

    const workspaceName = organization?.name?.trim() || orgSlug;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Leave workspace "${workspaceName}"? You can rejoin if invited again.`)
    ) {
      return;
    }

    setIsLeaving(true);
    setLeaveError(null);
    try {
      await membership.destroy();
      void navigate("/o/select");
    } catch (error: unknown) {
      setLeaveError(error instanceof Error ? error.message : "Unable to leave workspace right now.");
    } finally {
      setIsLeaving(false);
    }
  }

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
      />

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <OrgSectionCard
            title="Organization navigation"
            description="Primary destinations for organization management."
          >
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/overview`} />}
              >
                Overview
                <IconArrowRight />
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/members`} />}
              >
                Members
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
                variant="outline"
                className="justify-between"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/billing`} />}
              >
                Billing
                <IconArrowRight />
              </Button>
            </div>
          </OrgSectionCard>

          <OrgSectionCard
            title="Advanced diagnostics"
            description="Troubleshooting details for workspace routing and access."
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
                      <p>
                        If values are missing, switch workspaces from the sidebar and refresh.
                      </p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </OrgSectionCard>
        </div>

        <div className="space-y-4">
          <OrgSectionCard
            title="Organization billing"
            description="Plan tiers for organization usage."
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border bg-background/70 p-5">
                <p className="org-kicker text-muted-foreground">Free</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">0$</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-5">
                <p className="org-kicker text-muted-foreground">Pro</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">5$</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-5">
                <p className="org-kicker text-muted-foreground">Max</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">25$</p>
              </div>
            </div>
          </OrgSectionCard>

          <OrgSectionCard
            title="Workspace profile"
            description="Manage workspace details, memberships, and domain policies."
          >
            <div className="space-y-4">
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="org-kicker text-muted-foreground">General</p>
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="workspace-name" className="text-sm font-medium">
                    Workspace name
                  </label>
                  <Input
                    id="workspace-name"
                    value={nameDraft}
                    disabled={!organization || isUpdatingProfile}
                    onChange={(event) => setNameDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSaveProfile();
                      }
                    }}
                  />
                </div>

                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Current slug:</span>{" "}
                    <span className="font-mono">{organization?.slug ?? orgSlug}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Updated slug:</span>{" "}
                    <span className="font-mono">{autoSlugPreview}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Your role:</span>{" "}
                    <span className="font-mono">
                      {(membership?.roleName || membership?.role || "unknown").replace(/^org:/, "")}
                    </span>
                  </p>
                </div>

                {profileError ? (
                  <p className="text-sm text-destructive">{profileError}</p>
                ) : null}
                {profileSuccess ? (
                  <p className="text-sm text-muted-foreground">{profileSuccess}</p>
                ) : null}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveProfile}
                  disabled={!organization || isUpdatingProfile || nameDraft.trim().length === 0}
                >
                  {isUpdatingProfile ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <p className="org-kicker text-muted-foreground">Workspace image</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage src={organization?.imageUrl ?? undefined} />
                  <AvatarFallback>
                    {initials(organization?.name ?? orgSlug) || "OR"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleLogoInputChange(event);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!organization || isUpdatingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {isUpdatingLogo ? "Uploading..." : "Upload image"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!organization || !organization.hasImage || isUpdatingLogo}
                    onClick={() => {
                      void handleSetLogo(null);
                    }}
                  >
                    Remove image
                  </Button>
                </div>
              </div>
              {logoError ? <p className="mt-2 text-sm text-destructive">{logoError}</p> : null}
              {logoSuccess ? (
                <p className="mt-2 text-sm text-muted-foreground">{logoSuccess}</p>
              ) : null}
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <p className="org-kicker text-muted-foreground">Access</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <IconUsers className="mr-1 size-3.5" />
                  {memberships ? memberCount : "..."} members
                </Badge>
                <Badge variant="outline">{invitations ? inviteCount : "..."} pending invites</Badge>
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link to={`/o/${orgSlug}/members`} />}
                >
                  Manage members and invites
                  <IconArrowRight />
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <p className="org-kicker text-muted-foreground">Member access control</p>
              {!isOrgAdmin ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Only admins can remove members from this workspace.
                </p>
              ) : memberRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No members found.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {memberRows.map((memberRow) => {
                    const publicUserData = memberRow.publicUserData;
                    const userId = publicUserData?.userId ?? null;
                    const memberLabel = displayName({
                      firstName: publicUserData?.firstName ?? null,
                      lastName: publicUserData?.lastName ?? null,
                      identifier: publicUserData?.identifier ?? "member",
                    });
                    const avatarSrc =
                      publicUserData?.imageUrl ?? generateGradientDataUrl(userId ?? memberRow.id);
                    const isCurrentUser = userId != null && userId === currentUserId;
                    const isRemoving = isRemovingByMembershipId[memberRow.id] === true;

                    return (
                      <div
                        key={memberRow.id}
                        className="flex flex-col gap-2 rounded-lg border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar size="sm">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback>{initials(memberLabel) || "MB"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{memberLabel}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {publicUserData?.identifier ?? "Unknown identifier"} ·{" "}
                              {memberRow.roleName || memberRow.role}
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={isCurrentUser || isRemoving || userId == null}
                          onClick={() => {
                            if (!userId) {
                              return;
                            }
                            void handleRemoveMember(memberRow.id, userId, memberLabel);
                          }}
                        >
                          {isCurrentUser ? "You" : isRemoving ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {removeError ? <p className="mt-2 text-sm text-destructive">{removeError}</p> : null}
            </div>

            <div className="rounded-xl border bg-background/70 p-4">
              <p className="org-kicker text-muted-foreground">Domain policies</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Domain restrictions are configured by workspace admins. Use diagnostics below to verify workspace linkage if access rules do not apply as expected.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-destructive/25 bg-destructive/5">
              <div className="flex items-start gap-2 px-3 py-3">
                <IconShieldLock className="mt-0.5 size-4 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">Danger zone</p>
                  <p className="text-sm text-muted-foreground">
                    Leaving removes your direct access to this workspace until invited again.
                  </p>
                </div>
              </div>
              {leaveError ? (
                <p className="px-3 pb-2 text-sm text-destructive">{leaveError}</p>
              ) : null}
              <div className="border-t border-destructive/20 px-3 py-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleLeaveWorkspace}
                  disabled={!membership || isLeaving}
                >
                  {isLeaving ? "Leaving..." : "Leave workspace"}
                </Button>
              </div>
            </div>
            </div>
          </OrgSectionCard>
        </div>
      </div>
    </div>
  );
}
