import { useOrganizationList } from "@clerk/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  IconBuildingSkyscraper,
  IconPalette,
  IconTrash,
  IconUserCircle,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "theme-watcher";

import { FloatingDraftToolbar } from "@/components/custom/floating-draft-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  getCurrentUserAccountRef,
  getCurrentUserFreePlanCreditRef,
  getCurrentUserPreferencesRef,
  revokeCurrentUserFreePlanCreditRef,
  upsertCurrentUserPreferencesRef,
} from "@/lib/convex-refs";
import { LandingPreference, PreferredTheme } from "@/lib/user-preferences";

const THEME_LABELS: Record<string, string> = {
  [PreferredTheme.System]: "System",
  [PreferredTheme.Light]: "Light",
  [PreferredTheme.Dark]: "Dark",
};

export function Page() {
  const { setTheme } = useTheme();
  const { userMemberships } = useOrganizationList({ userMemberships: true });
  const currentUser = useQuery(getCurrentUserAccountRef, {});
  const freePlanCredit = useQuery(getCurrentUserFreePlanCreditRef, {});
  const preferences = useQuery(getCurrentUserPreferencesRef, {});
  const revokeFreePlanCredit = useAction(revokeCurrentUserFreePlanCreditRef);
  const upsertPreferences = useMutation(upsertCurrentUserPreferencesRef);

  const [preferredTheme, setPreferredTheme] = useState<string>(
    PreferredTheme.System,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [revokeCountdown, setRevokeCountdown] = useState(5);
  const [isRevokingCredit, setIsRevokingCredit] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const draftToolbarRef = useRef<HTMLDivElement | null>(null);

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );

  useEffect(() => {
    if (preferences === undefined || hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    setPreferredTheme(preferences?.preferredTheme ?? PreferredTheme.System);
  }, [preferences]);

  useEffect(() => {
    if (!isRevokeDialogOpen) {
      setRevokeCountdown(5);
      return;
    }

    if (revokeCountdown <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRevokeCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [isRevokeDialogOpen, revokeCountdown]);

  const isPreferencesLoading = preferences === undefined;
  const isDisabled = isSaving || isPreferencesLoading;
  const savedPreferredTheme =
    preferences?.preferredTheme ?? PreferredTheme.System;
  const isDirty = !isPreferencesLoading && savedPreferredTheme !== preferredTheme;
  const isFreePlanCreditInUse = Boolean(freePlanCredit?.assignedOrgId);

  function shakeDraftToolbar() {
    draftToolbarRef.current?.animate(
      [
        { transform: "translateX(0px)" },
        { transform: "translateX(-10px)" },
        { transform: "translateX(10px)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(0px)" },
      ],
      {
        duration: 260,
        iterations: 2,
        easing: "ease-in-out",
      },
    );
  }

  useUnsavedChangesGuard({
    hasUnsavedChanges: isDirty,
    onBlockedAttempt: shakeDraftToolbar,
  });

  const assignedWorkspaceName = (() => {
    if (!freePlanCredit || !freePlanCredit.assignedOrgSlug) {
      return null;
    }
    const matched = selectableMemberships.find(
      (membership) =>
        membership.organization.slug === freePlanCredit.assignedOrgSlug,
    );
    return matched?.organization.name ?? null;
  })();
  const assignedWorkspaceLabel = freePlanCredit?.assignedOrgSlug
    ? assignedWorkspaceName ?? freePlanCredit.assignedOrgSlug
    : "Not assigned to any workspace";

  async function handleSavePreferences() {
    if (isDisabled || !isDirty) {
      return;
    }

    const isThemeValid =
      preferredTheme === PreferredTheme.System ||
      preferredTheme === PreferredTheme.Light ||
      preferredTheme === PreferredTheme.Dark;
    if (!isThemeValid) {
      setSaveError("Invalid preferences selected.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await upsertPreferences({
        preferredTheme,
        defaultOrgSlug: preferences?.defaultOrgSlug ?? null,
        landingPreference:
          preferences?.landingPreference ?? LandingPreference.AccountOverview,
      });
      setTheme(preferredTheme);
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update preferences.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscardPreferences() {
    setPreferredTheme(savedPreferredTheme);
    setSaveError(null);
  }

  function handleOpenRevokeDialog() {
    if (!isFreePlanCreditInUse || isRevokingCredit) {
      return;
    }

    setRevokeError(null);
    setRevokeCountdown(5);
    setIsRevokeDialogOpen(true);
  }

  async function handleRevokeFreeCredit() {
    if (!freePlanCredit || freePlanCredit.assignedOrgId === null || isRevokingCredit) {
      return;
    }

    setIsRevokingCredit(true);
    setRevokeError(null);

    try {
      const result = await revokeFreePlanCredit({
        expectedAssignedOrgId: freePlanCredit.assignedOrgId,
        reason: "manual_revoke",
      });

      if (result.reason === "mismatch") {
        setRevokeError("This credit assignment changed. Refresh and try again.");
        return;
      }

      setIsRevokeDialogOpen(false);
      setRevokeCountdown(5);
    } catch (error: unknown) {
      setRevokeError(
        error instanceof Error
          ? error.message
          : "Failed to revoke free workspace credit.",
      );
    } finally {
      setIsRevokingCredit(false);
    }
  }

  return (
    <div className="space-y-6">
      <section id="profile-information" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconUserCircle className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Your account identity and primary contact details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div
                  aria-disabled="true"
                  className="rounded-lg border border-border/70 bg-muted/20 p-3 shadow-inner"
                >
                  <p className="text-xs text-muted-foreground">Display name</p>
                  <p className="mt-2 text-sm font-medium text-foreground/85">
                    {currentUser?.displayName ?? "Not set"}
                  </p>
                </div>
                <div
                  aria-disabled="true"
                  className="rounded-lg border border-border/70 bg-muted/20 p-3 shadow-inner"
                >
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-2 text-sm font-medium text-foreground/85">
                    {currentUser?.email ?? "Not set"}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Profile identity fields are managed by your sign-in provider.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="free-workspace-credit" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconBuildingSkyscraper className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Free Workspace Credit</CardTitle>
                <CardDescription>
                  Your single free workspace credit and where it is currently
                  assigned.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {freePlanCredit === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-72" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {freePlanCredit.remainingCredits}/
                    {freePlanCredit.totalCredits} credit remaining
                  </span>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Assigned workspace
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {assignedWorkspaceLabel}
                  </p>
                </div>
                {isFreePlanCreditInUse ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm font-medium">
                        Revoking this credit leaves the assigned workspace without a plan.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The workspace will be disabled until a paid plan or another free credit is applied.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleOpenRevokeDialog}
                        disabled={isRevokingCredit}
                      >
                        <IconTrash className="size-4" />
                        {isRevokingCredit ? "Revoking..." : "Revoke free credit"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="appearance-defaults" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconPalette className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Appearance Defaults</CardTitle>
                <CardDescription>
                  Choose how your dashboard should look by default.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-sm space-y-2">
              <label className="text-xs text-muted-foreground">Theme</label>
              <Select
                value={preferredTheme}
                onValueChange={(value) => {
                  if (value !== null) {
                    setSaveError(null);
                    setPreferredTheme(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {THEME_LABELS[preferredTheme] ?? preferredTheme}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value={PreferredTheme.System}>System</SelectItem>
                  <SelectItem value={PreferredTheme.Light}>Light</SelectItem>
                  <SelectItem value={PreferredTheme.Dark}>Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={isRevokeDialogOpen}
        onOpenChange={(open) => {
          if (isRevokingCredit) {
            return;
          }
          setIsRevokeDialogOpen(open);
          if (!open) {
            setRevokeCountdown(5);
            setRevokeError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke free workspace credit?</DialogTitle>
            <DialogDescription>
              This removes your free credit from the assigned workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Are you sure? Revoking this credit will leave{" "}
              <span className="font-semibold text-foreground">{assignedWorkspaceLabel}</span>{" "}
              without a plan and disabled.
            </p>
            <p className="text-sm text-muted-foreground">
              {revokeCountdown > 0
                ? `Revoke unlocks in ${revokeCountdown} ${revokeCountdown === 1 ? "second" : "seconds"}.`
                : "Revoke is unlocked now."}
            </p>
            {revokeError ? (
              <p className="text-sm text-destructive">{revokeError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRevokeDialogOpen(false)}
              disabled={isRevokingCredit}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleRevokeFreeCredit();
              }}
              disabled={isRevokingCredit || revokeCountdown > 0 || !isFreePlanCreditInUse}
            >
              <IconTrash className="size-4" />
              {isRevokingCredit ? "Revoking..." : "Revoke free credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloatingDraftToolbar
        isVisible={isDirty}
        message="You have unsaved preference changes."
        isSaving={isSaving}
        saveDisabled={isDisabled}
        onSave={() => {
          void handleSavePreferences();
        }}
        onDiscard={handleDiscardPreferences}
        toolbarRef={draftToolbarRef}
      />
    </div>
  );
}
