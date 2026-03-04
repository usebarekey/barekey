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
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatDateTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Not available";
  }

  return new Date(timestampMs).toLocaleString();
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
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const externalAccounts = user?.externalAccounts ?? [];
  const availableSessions = sessions ?? [];
  const passkeys = user?.passkeys ?? [];
  const linkedProviderLabels = externalAccounts.map((account) => account.provider.toLowerCase());
  const unlinkedProviders = [
    { strategy: "oauth_github", label: "GitHub", match: "github" },
    { strategy: "oauth_google", label: "Google", match: "google" },
  ].filter((provider) =>
    linkedProviderLabels.every((linkedProvider) => !linkedProvider.includes(provider.match)),
  );

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
      setSessionActionError(error instanceof Error ? error.message : "Failed to revoke all other sessions.");
    } finally {
      setIsRevokingOtherSessions(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) {
      return;
    }
    if (!user.deleteSelfEnabled) {
      setDeleteError("Account deletion is disabled for this environment.");
      return;
    }
    if (deleteConfirmation !== "DELETE") {
      setDeleteError('Type "DELETE" to confirm account deletion.');
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

  const otherSessionsCount = availableSessions.filter((session) => session.id !== activeSessionId).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Connected accounts, active sessions, and passkey controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Connected accounts</p>
              <p className="mt-1 text-2xl font-semibold">{isUserLoaded ? externalAccounts.length : "..."}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Passkeys</p>
              <p className="mt-1 text-2xl font-semibold">{isUserLoaded ? passkeys.length : "..."}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Active sessions on this device</p>
              <p className="mt-1 text-2xl font-semibold">{isSessionsLoaded ? availableSessions.length : "..."}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
          </div>
          {sessionActionError ? <p className="text-sm text-destructive">{sessionActionError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!isUserLoaded ? (
            <p className="text-sm text-muted-foreground">Loading linked account details...</p>
          ) : externalAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked third-party accounts.</p>
          ) : (
            externalAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border bg-background/70 p-3">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-muted-foreground">{getProviderIcon(account.provider)}</span>
                  <div>
                    <p className="text-sm font-medium">{formatProviderName(account.provider)}</p>
                    <p className="text-xs text-muted-foreground">{account.emailAddress ?? "No email shared"}</p>
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
                      void handleLinkProvider(provider.strategy as "oauth_github" | "oauth_google");
                    }}
                  >
                    {getProviderIcon(provider.label, "size-4")}
                    {linkingProvider === provider.strategy ? "Redirecting..." : `Link ${provider.label}`}
                  </Button>
                ))}
              </div>
              {linkError ? <p className="mt-2 text-sm text-destructive">{linkError}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!isSessionsLoaded ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : availableSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No device sessions available.</p>
          ) : (
            availableSessions.map((session) => (
              <div key={session.id} className="rounded-lg border bg-background/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-muted-foreground">{session.id}</p>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <IconClock className="size-3.5" />
                  Last active: {formatDateTime(session.lastActiveAt ? session.lastActiveAt.getTime() : null)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
          <p className="text-sm text-muted-foreground">Type DELETE to confirm account deletion.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={deleteConfirmation}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value);
              }}
              placeholder="DELETE"
            />
            <Button
              variant="destructive"
              disabled={isDeletingAccount || deleteConfirmation !== "DELETE" || user?.deleteSelfEnabled === false}
              onClick={() => {
                void handleDeleteAccount();
              }}
            >
              <IconTrash className="size-4" />
              {isDeletingAccount ? "Deleting..." : "Delete account"}
            </Button>
          </div>
          {user?.deleteSelfEnabled === false ? (
            <p className="text-sm text-muted-foreground">Account deletion is currently disabled.</p>
          ) : null}
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
