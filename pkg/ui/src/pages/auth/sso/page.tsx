import { Logo } from "@/components/custom/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBrandGithubFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@clerk/react-router";
import { useState } from "react";

type PendingAction = "google" | "github" | null;

const CALLBACK_PATH = "/auth/sso/callback";
const COMPLETE_REDIRECT_PATH = "/";

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

export function Page() {
  const { isLoaded, signIn } = useSignIn();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = pendingAction !== null;

  async function signInWithOAuth(strategy: "oauth_google" | "oauth_github") {
    if (!isLoaded) return;

    setError(null);
    setPendingAction(strategy === "oauth_google" ? "google" : "github");

    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: CALLBACK_PATH,
        redirectUrlComplete: COMPLETE_REDIRECT_PATH,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setPendingAction(null);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-4">
        <div className="space-y-3">
          <Logo className="h-8" />
          <div className="space-y-1">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Choose the account you want to use to continue.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          variant="outline"
          className="h-10 w-full"
          disabled={!isLoaded || isBusy}
          onClick={() => signInWithOAuth("oauth_google")}
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
          onClick={() => signInWithOAuth("oauth_github")}
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
  );
}
