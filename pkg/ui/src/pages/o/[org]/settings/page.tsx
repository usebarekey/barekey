import { useAction, useQuery } from "convex/react";
import { IconDoorEnter, IconTrash, IconUsers } from "@tabler/icons-react";
import { useOrganization, useOrganizationList } from "@clerk/react-router";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import slugify from "slugify";

import { api } from "@convex/_generated/api";
import { OrgSectionCard } from "@/components/custom/org-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { revokeCurrentUserFreePlanCreditRef } from "@/lib/convex-refs";
import { initials } from "@/lib/org-utils";
import { extractRequestId, formatSupportErrorMessage } from "@/lib/support-errors";
import { generateOrganizationSlugCandidateFromName } from "@/lib/slugs";

function isPrivilegedOrgRole(role: string | null | undefined): boolean {
  return role === "org:admin" || role === "org:owner";
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
  const [nameDraft, setNameDraft] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isDeleteOrganizationDialogOpen, setIsDeleteOrganizationDialogOpen] = useState(false);
  const [isDeletingOrganization, setIsDeletingOrganization] = useState(false);
  const [deleteOrganizationError, setDeleteOrganizationError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const { setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const { organization, membership, memberships, invitations } = useOrganization({
    memberships: {
      pageSize: 50,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 10,
      keepPreviousData: true,
    },
  });
  const assertCanDeleteCurrentOrg = useAction(api.orgs.assertCanDeleteCurrentOrg);
  const revokeFreePlanCredit = useAction(revokeCurrentUserFreePlanCreditRef);
  const orgDeletionReadiness = useQuery(api.orgs.getCurrentOrgDeletionReadiness, {
    expectedOrgSlug: orgSlug,
  });

  const memberCount = memberships?.count ?? 0;
  const inviteCount = invitations?.count ?? 0;
  const membershipRows = memberships?.data ?? [];
  const effectiveOrgRole = membership?.role ?? orgClaims?.orgRole ?? null;
  const canDeleteOrganizationByRole =
    effectiveOrgRole === "org:admin" || effectiveOrgRole === "org:owner";
  const privilegedMemberCount = membershipRows.filter((row) => isPrivilegedOrgRole(row.role)).length;
  const isCurrentMemberPrivileged = isPrivilegedOrgRole(membership?.role ?? null);
  const isLeaveBlockedBySoleMember = memberships !== undefined && memberCount <= 1;
  const isLeaveBlockedByNoAdmins = memberships !== undefined && privilegedMemberCount === 0;
  const isLeaveBlockedByLastAdmin =
    memberships !== undefined && isCurrentMemberPrivileged && privilegedMemberCount <= 1;
  const isLeaveWorkspaceBlocked =
    isLeaveBlockedBySoleMember || isLeaveBlockedByNoAdmins || isLeaveBlockedByLastAdmin;
  const leaveBlockedReason = isLeaveBlockedBySoleMember
    ? "You can not leave while you are the only member. Delete the organization instead."
    : isLeaveBlockedByNoAdmins
      ? "You can not leave because this organization currently has no admin. Assign an admin first."
    : isLeaveBlockedByLastAdmin
      ? "You can not leave because this would leave the organization without an admin."
      : null;
  const isDeletePrerequisitesLoading = orgDeletionReadiness === undefined;
  const remainingProjectCount = orgDeletionReadiness?.projectCount ?? 0;
  const areDeletePrerequisitesMet = !isDeletePrerequisitesLoading && remainingProjectCount === 0;
  const isDeleteBlockedByProjects = !isDeletePrerequisitesLoading && remainingProjectCount > 0;
  const isDeleteOrganizationBlocked =
    isDeletePrerequisitesLoading || !areDeletePrerequisitesMet || !canDeleteOrganizationByRole;
  const deleteReadinessLead = isDeletePrerequisitesLoading
    ? "Checking project prerequisites."
    : isDeleteBlockedByProjects
      ? `Delete is blocked until ${remainingProjectCount} project${remainingProjectCount === 1 ? "" : "s"} ${remainingProjectCount === 1 ? "is" : "are"} removed.`
      : null;

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
      setProfileError("Workspace name is required.");
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
          attempt === 0 ? preferredSlug : generateOrganizationSlugCandidateFromName(trimmedName);
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

  async function handleLeaveWorkspace() {
    if (!membership || isLeaving) {
      return;
    }
    if (isLeaveWorkspaceBlocked) {
      setLeaveError(
        leaveBlockedReason ?? "You can not leave this workspace right now.",
      );
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
      setLeaveError(
        error instanceof Error ? error.message : "Unable to leave workspace right now.",
      );
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleDeleteOrganization() {
    if (
      !organization ||
      isDeletingOrganization ||
      !canDeleteOrganizationByRole ||
      !areDeletePrerequisitesMet
    ) {
      return;
    }

    setIsDeletingOrganization(true);
    setDeleteOrganizationError(null);
    try {
      const deleteContext = await assertCanDeleteCurrentOrg({
        expectedOrgSlug: orgSlug,
      });
      const fallbackMembership =
        (userMemberships.data ?? []).find(
          (row) => row.organization.id !== deleteContext.orgId,
        ) ?? null;
      await organization.destroy();
      try {
        await revokeFreePlanCredit({
          expectedAssignedOrgId: deleteContext.orgId,
          reason: "org_deleted",
        });
      } catch {
        // The profile page now exposes manual recovery if this best-effort cleanup fails.
      }

      try {
        if (fallbackMembership?.organization.id && setActive) {
          await setActive({ organization: fallbackMembership.organization.id });
          if (fallbackMembership.organization.slug) {
            void navigate(`/o/${fallbackMembership.organization.slug}/overview`, {
              replace: true,
            });
          } else {
            void navigate("/o/select", { replace: true });
          }
          return;
        }

        if (setActive) {
          await setActive({ organization: null });
        }
      } catch {
        if (setActive) {
          try {
            await setActive({ organization: null });
          } catch {
            // Ignore cleanup fallback errors and continue routing to the selector.
          }
        }
      }

      void navigate("/o/select", { replace: true });
    } catch (error: unknown) {
      const requestId = extractRequestId(error);
      if (requestId) {
        setDeleteOrganizationError(
          formatSupportErrorMessage(
            "An error occurred while deleting the organization.",
            requestId,
          ),
        );
        return;
      }
      setDeleteOrganizationError(
        getClerkErrorMessage(error, "Unable to delete organization right now."),
      );
    } finally {
      setIsDeletingOrganization(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <section id="workspace-profile" className="scroll-mt-24">
        <OrgSectionCard
          title="Workspace profile"
          description="Manage your workspace name and routing slug."
        >
          <div className="space-y-4 rounded-xl border bg-background/70 p-4">
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
                <span className="text-muted-foreground">Workspace slug:</span>{" "}
                <span className="font-mono">{organization?.slug ?? orgSlug}</span>
              </p>
            </div>

            {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
            {profileSuccess ? (
              <p className="text-sm text-muted-foreground">{profileSuccess}</p>
            ) : null}

            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={!organization || isUpdatingProfile || nameDraft.trim().length === 0}
            >
              {isUpdatingProfile ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </OrgSectionCard>
      </section>

      <section id="workspace-image" className="scroll-mt-24">
        <OrgSectionCard
          title="Workspace image"
          description="Upload or remove the workspace avatar."
        >
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage src={organization?.imageUrl ?? undefined} />
                <AvatarFallback>{initials(organization?.name ?? orgSlug) || "OR"}</AvatarFallback>
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
        </OrgSectionCard>
      </section>

      <section id="member-access" className="scroll-mt-24">
        <OrgSectionCard
          title="Member access"
          description="Open members to manage invites, roles, and access."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {memberships ? memberCount : "..."}
              </span>{" "}
              members ·{" "}
              <span className="font-medium text-foreground">
                {invitations ? inviteCount : "..."}
              </span>{" "}
              pending invites
            </p>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/members`} />}
            >
              <IconUsers className="size-4" />
              Manage members
            </Button>
          </div>
        </OrgSectionCard>
      </section>

      <section id="danger-zone" className="scroll-mt-24">
        <OrgSectionCard
          title="Danger zone"
          description="Permanent actions for this organization."
          className="border-destructive/30"
        >
          <div className="overflow-hidden rounded-lg border border-destructive/25 bg-destructive/5">
            <div className="flex items-start gap-2 px-3 py-3">
              <IconDoorEnter className="mt-0.5 size-4 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">Leave workspace</p>
                <p className="text-sm text-muted-foreground">
                  Leaving removes your direct access until invited again.
                </p>
                {leaveBlockedReason ? (
                  <p className="mt-1 text-xs text-muted-foreground">{leaveBlockedReason}</p>
                ) : null}
              </div>
            </div>
            {leaveError ? <p className="px-3 pb-2 text-sm text-destructive">{leaveError}</p> : null}
            <div className="px-3 pb-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleLeaveWorkspace}
                disabled={!membership || isLeaving || isDeletingOrganization || isLeaveWorkspaceBlocked}
              >
                <IconTrash className="size-4" />
                {isLeaving ? "Leaving..." : "Leave workspace"}
              </Button>
            </div>

            <div className="border-t border-destructive/20">
              <div className="flex items-start gap-2 px-3 py-3">
                <IconTrash className="mt-0.5 size-4 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">Delete organization</p>
                  <p className="text-sm text-muted-foreground">
                    {deleteReadinessLead ? (
                      <span className="font-semibold text-muted-foreground">
                        {deleteReadinessLead}{" "}
                      </span>
                    ) : null}
                    Permanently deletes this organization and all associated data.
                  </p>
                  {!canDeleteOrganizationByRole ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only organization admins can delete the organization.
                    </p>
                  ) : null}
                </div>
              </div>
              {deleteOrganizationError ? (
                <p className="px-3 pb-2 text-sm text-destructive">{deleteOrganizationError}</p>
              ) : null}
              <div className="px-3 pb-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setDeleteOrganizationError(null);
                    setIsDeleteOrganizationDialogOpen(true);
                  }}
                  disabled={
                    !organization ||
                    isDeletingOrganization ||
                    isLeaving ||
                    isDeleteOrganizationBlocked
                  }
                >
                  <IconTrash className="size-4" />
                  Delete organization
                </Button>
              </div>
            </div>
          </div>
        </OrgSectionCard>
      </section>

      <Dialog
        open={isDeleteOrganizationDialogOpen}
        onOpenChange={(open) => {
          if (isDeletingOrganization) {
            return;
          }
          setIsDeleteOrganizationDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization?</DialogTitle>
            <DialogDescription>
              This permanently removes this organization and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {areDeletePrerequisitesMet ? (
              <p className="text-sm text-muted-foreground">
                This action permanently deletes this organization and can not be undone.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                To delete this organization, please delete{" "}
                <span className="font-bold text-foreground">
                  {isDeletePrerequisitesLoading ? "..." : remainingProjectCount}
                </span>{" "}
                projects in this organization first. Note that we can not recover or undo this
                operation.
              </p>
            )}
            {!canDeleteOrganizationByRole ? (
              <p className="text-sm text-muted-foreground">
                Only organization admins can delete the organization.
              </p>
            ) : null}
            {deleteOrganizationError ? (
              <p className="text-sm text-destructive">{deleteOrganizationError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOrganizationDialogOpen(false)}
              disabled={isDeletingOrganization}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDeleteOrganization();
              }}
              disabled={
                isDeletingOrganization ||
                isDeletePrerequisitesLoading ||
                !areDeletePrerequisitesMet ||
                !canDeleteOrganizationByRole
              }
            >
              {isDeletingOrganization ? "Deleting..." : "Delete organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
