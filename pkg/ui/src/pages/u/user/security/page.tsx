import { useAuth, useClerk, useSessionList, useUser } from "@clerk/react-router";
import {
  IconAlertTriangle,
  IconBrandGithubFilled,
  IconBrandGoogleFilled,
  IconClock,
  IconLink,
  IconLogout2,
  IconShieldCheck,
  IconTrash,
  IconUnlink,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDateTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Not available";
  }

  return new Date(timestampMs).toLocaleString();
}

function formatSessionIdForDisplay(sessionId: string): string {
  if (sessionId.length <= 16) {
    return sessionId;
  }

  return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
}

function getProviderIcon(provider: string, sizeClass = "size-8") {
  const normalizedProvider = provider.toLowerCase();
  if (normalizedProvider.includes("github")) {
    return <IconBrandGithubFilled className={sizeClass} />;
  }
  if (normalizedProvider.includes("google")) {
    return <IconBrandGoogleFilled className={sizeClass} />;
  }

  return <IconLink className={sizeClass} />;
}

function formatProviderName(provider: string): string {
  const normalizedProvider = provider.trim().toLowerCase();
  if (normalizedProvider.includes("github")) {
    return "GitHub";
  }
  if (normalizedProvider.includes("google")) {
    return "Google";
  }

  return provider
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

export function Page() {
  const clerk = useClerk();
  const { sessionId: activeSessionId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { sessions, isLoaded: isSessionsLoaded } = useSessionList();
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingOtherSessions, setIsRevokingOtherSessions] = useState(false);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const externalAccounts = user?.externalAccounts ?? [];
  const availableSessions = sessions ?? [];
  const linkedProviderLabels = externalAccounts.map((account) => account.provider.toLowerCase());
  const unlinkedProviders = [
    { strategy: "oauth_github", label: "GitHub", match: "github" },
    { strategy: "oauth_google", label: "Google", match: "google" },
  ].filter((provider) =>
    linkedProviderLabels.every((linkedProvider) => !linkedProvider.includes(provider.match)),
  );

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      setDeleteCountdown(5);
      return;
    }

    if (deleteCountdown <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDeleteCountdown((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [deleteCountdown, isDeleteDialogOpen]);

  async function handleUnlinkAccount(accountId: string) {
    if (!user) {
      return;
    }

    const account = user.externalAccounts.find((item) => item.id === accountId);
    if (!account) {
      return;
    }

    setUnlinkingAccountId(accountId);
    setUnlinkError(null);
    try {
      await account.destroy();
      await user.reload();
    } catch (error: unknown) {
      setUnlinkError(error instanceof Error ? error.message : "Failed to unlink account.");
    } finally {
      setUnlinkingAccountId(null);
    }
  }

  async function handleLinkProvider(strategy: "oauth_github" | "oauth_google") {
    if (!user) {
      return;
    }

    setLinkingProvider(strategy);
    setLinkError(null);
    try {
      await user.createExternalAccount({
        strategy,
        redirectUrl: window.location.href,
      });
    } catch (error: unknown) {
      setLinkError(error instanceof Error ? error.message : "Failed to start provider linking.");
      setLinkingProvider(null);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    if (sessionId === activeSessionId) {
      setSessionActionError("Use sign out to end the current session.");
      return;
    }

    const nextSession = availableSessions.find((session) => session.id === sessionId);
    if (!nextSession) {
      return;
    }

    setRevokingSessionId(sessionId);
    setSessionActionError(null);
    try {
      await nextSession.remove();
    } catch (error: unknown) {
      setSessionActionError(error instanceof Error ? error.message : "Failed to revoke session.");
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function handleRevokeOtherSessions() {
    const otherSessions = availableSessions.filter((session) => session.id !== activeSessionId);
    if (otherSessions.length === 0) {
      return;
    }

    setIsRevokingOtherSessions(true);
    setSessionActionError(null);
    try {
      for (const session of otherSessions) {
        await session.remove();
      }
    } catch (error: unknown) {
      setSessionActionError(
        error instanceof Error ? error.message : "Failed to revoke all other sessions.",
      );
    } finally {
      setIsRevokingOtherSessions(false);
    }
  }

  function handleOpenDeleteDialog() {
    if (!user || user.deleteSelfEnabled === false || isDeletingAccount) {
      return;
    }

    setDeleteError(null);
    setDeleteCountdown(5);
    setIsDeleteDialogOpen(true);
  }

  async function handleDeleteAccount() {
    if (!user) {
      return;
    }
    if (!user.deleteSelfEnabled) {
      setDeleteError("Account deletion is disabled for this environment.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await user.delete();
      await clerk.signOut({ redirectUrl: "/auth/sso" });
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete account.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  const otherSessionsCount = availableSessions.filter(
    (session) => session.id !== activeSessionId,
  ).length;

  return (
    <div className="space-y-4">
      <section id="linked-accounts" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked accounts</CardTitle>
            <CardDescription>
              Manage connected identity providers for this account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!isUserLoaded ? (
              <p className="text-sm text-muted-foreground">Loading linked account details...</p>
            ) : externalAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked third-party accounts.</p>
            ) : (
              externalAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border bg-background/70 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      {getProviderIcon(account.provider)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{formatProviderName(account.provider)}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.emailAddress ?? "No email shared"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unlinkingAccountId === account.id}
                    onClick={() => {
                      void handleUnlinkAccount(account.id);
                    }}
                  >
                    <IconUnlink className="size-3.5" />
                    {unlinkingAccountId === account.id ? "Unlinking..." : "Unlink"}
                  </Button>
                </div>
              ))
            )}
            {unlinkError ? <p className="text-sm text-destructive">{unlinkError}</p> : null}
            {unlinkedProviders.length > 0 ? (
              <div className="rounded-lg border bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Available to link</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unlinkedProviders.map((provider) => (
                    <Button
                      key={provider.strategy}
                      variant="outline"
                      size="sm"
                      disabled={linkingProvider === provider.strategy}
                      onClick={() => {
                        void handleLinkProvider(
                          provider.strategy as "oauth_github" | "oauth_google",
                        );
                      }}
                    >
                      {getProviderIcon(provider.label, "size-4")}
                      {linkingProvider === provider.strategy
                        ? "Redirecting..."
                        : `Link ${provider.label}`}
                    </Button>
                  ))}
                </div>
                {linkError ? <p className="mt-2 text-sm text-destructive">{linkError}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="sessions" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions</CardTitle>
            <CardDescription>
              Review device sessions and revoke access you no longer trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isSessionsLoaded ? (
              <p className="text-sm text-muted-foreground">Loading sessions...</p>
            ) : availableSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No device sessions available.</p>
            ) : (
              availableSessions.map((session) => {
                const isCurrentSession = session.id === activeSessionId;

                return (
                  <div
                    key={session.id}
                    className="rounded-lg border bg-background/70 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs text-muted-foreground">
                        Session {formatSessionIdForDisplay(session.id)}
                      </p>
                      <div className="flex items-center gap-2">
                        {isCurrentSession ? (
                          <Badge variant="outline" className="gap-1.5">
                            <IconShieldCheck className="size-3.5" />
                            Current session
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="secondary">
                              <IconShieldCheck className="mr-1 size-3.5" />
                              {session.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={revokingSessionId === session.id}
                              onClick={() => {
                                void handleRevokeSession(session.id);
                              }}
                            >
                              <IconLogout2 className="size-3.5" />
                              {revokingSessionId === session.id ? "Revoking..." : "Revoke"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <IconClock className="size-3.5" />
                      Last active:{" "}
                      {isCurrentSession
                        ? "Now"
                        : formatDateTime(
                            session.lastActiveAt ? session.lastActiveAt.getTime() : null,
                          )}
                    </p>
                  </div>
                );
              })
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                disabled={!isSessionsLoaded || isRevokingOtherSessions || otherSessionsCount === 0}
                onClick={() => {
                  void handleRevokeOtherSessions();
                }}
              >
                <IconLogout2 className="size-4" />
                {isRevokingOtherSessions ? "Revoking..." : "Revoke other sessions"}
              </Button>
              {sessionActionError ? (
                <p className="text-sm text-destructive">{sessionActionError}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="danger-zone" className="scroll-mt-24">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <IconAlertTriangle className="size-4" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Delete your account permanently. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently deleting your account signs you out and removes access to all workspaces.
            </p>
            <Button
              variant="destructive"
              disabled={!user || isDeletingAccount || user.deleteSelfEnabled === false}
              onClick={handleOpenDeleteDialog}
            >
              <IconTrash className="size-4" />
              Delete account
            </Button>
            {user?.deleteSelfEnabled === false ? (
              <p className="text-sm text-muted-foreground">
                Account deletion is currently disabled.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (isDeletingAccount) {
            return;
          }
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteCountdown(5);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account and can not be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {deleteCountdown > 0
                ? `Delete unlocks in ${deleteCountdown} ${deleteCountdown === 1 ? "second" : "seconds"}.`
                : "Delete is unlocked now."}{" "}
              After deletion you will be signed out immediately.
            </p>
            {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDeleteAccount();
              }}
              disabled={
                isDeletingAccount ||
                deleteCountdown > 0 ||
                !user ||
                user.deleteSelfEnabled === false
              }
            >
              <IconTrash className="size-4" />
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
