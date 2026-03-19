import { IconBrandGithubFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import { useSignIn } from "@clerk/react-router";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveReturnToPath } from "@/lib/return-to";

type PendingAction = "google" | "github" | null;

const CALLBACK_PATH = "/auth/sso/callback";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeClerkError = error as {
      errors?: Array<{ longMessage?: string; message?: string }>;
      message?: string;
    };

    const firstError = maybeClerkError.errors?.[0];
    if (firstError?.longMessage) return firstError.longMessage;
    if (firstError?.message) return firstError.message;
    if (maybeClerkError.message) return maybeClerkError.message;
  }

  return "Something went wrong. Please try again.";
}

/**
 * Renders the custom auth app sign-in page and starts an OAuth redirect while preserving the original destination.
 *
 * @returns The custom sign-in page.
 * @remarks The callback path carries `return_to` so CLI device approval keeps its original query string after sign-in.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function Page() {
  const { isLoaded, signIn } = useSignIn();
  const [searchParams] = useSearchParams();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = pendingAction !== null;
  const returnTo = resolveReturnToPath(searchParams);
  const callbackPath = `${CALLBACK_PATH}?${new URLSearchParams({ return_to: returnTo }).toString()}`;

  async function signInWithOAuth(strategy: "oauth_google" | "oauth_github") {
    if (!isLoaded) {
      return;
    }

    setError(null);
    setPendingAction(strategy === "oauth_google" ? "google" : "github");

    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: callbackPath,
        redirectUrlComplete: returnTo,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center py-2 sm:py-6">
        <Card className="w-full max-w-md rounded-xl border border-border/90 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
          <CardHeader className="gap-4">
            <div className="space-y-3">
              <Logo className="h-8" />
              <div className="space-y-1">
                <CardTitle>Sign in</CardTitle>
                <CardDescription>
                  Choose the account you want to use to continue to Barekey.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="h-10 w-full"
              disabled={!isLoaded || isBusy}
              onClick={() => {
                void signInWithOAuth("oauth_google");
              }}
            >
              <IconBrandGoogleFilled />
              {pendingAction === "google"
                ? "Continuing with Google..."
                : "Continue using Google"}
            </Button>
            <Button
              variant="outline"
              className="h-10 w-full"
              disabled={!isLoaded || isBusy}
              onClick={() => {
                void signInWithOAuth("oauth_github");
              }}
            >
              <IconBrandGithubFilled />
              {pendingAction === "github"
                ? "Continuing with GitHub..."
                : "Continue using GitHub"}
            </Button>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
