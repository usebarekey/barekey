import { Logo } from "@/components/custom/logo";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  IconBrandGithubFilled,
  IconBrandGoogleFilled,
  IconKeyFilled,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSignIn } from "@clerk/react-router";
import { useState } from "react";
import { Link } from "react-router-dom";

type PendingAction = "passkey" | "google" | "github" | null;

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
  const { isLoaded, signIn, setActive } = useSignIn();
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

  async function signInWithPasskey() {
    if (!isLoaded) return;

    if (!("PublicKeyCredential" in window)) {
      setError("Passkeys are not supported in this browser.");
      return;
    }

    setError(null);
    setPendingAction("passkey");

    try {
      const result = await signIn.authenticateWithPasskey({
        flow: "discoverable",
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({
          session: result.createdSessionId,
          redirectUrl: COMPLETE_REDIRECT_PATH,
        });
        return;
      }

      setError("Passkey sign-in requires additional steps. Try another method.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Logo className="h-8" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          className="w-full"
          disabled={!isLoaded || isBusy}
          onClick={signInWithPasskey}
        >
          <IconKeyFilled />
          {pendingAction === "passkey"
            ? "Continuing with Passkey..."
            : "Continue using Passkey"}
        </Button>
        <div className="flex flex-row items-center gap-2">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>
        <Button
          variant="outline"
          className="w-full"
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
          className="w-full"
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
      <CardFooter className="text-xs text-muted-foreground">
        Forgot your password?{" "}
        <Link to="/auth/sso" className="text-primary">
          Reset it
        </Link>
      </CardFooter>
    </Card>
  );
}
