import { SignedIn, SignedOut, SignInButton, useAuth, useOrganization, useUser } from "@clerk/react-router";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const DEFAULT_BAREKEY_API_URL = "https://api.barekey.dev";
const USER_CODE_LENGTH = 8;

function normalizeUserCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, USER_CODE_LENGTH).toUpperCase();
}

function parseApiErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const value = payload as {
    error?: {
      message?: unknown;
    };
    message?: unknown;
  };

  if (typeof value.error?.message === "string" && value.error.message.trim().length > 0) {
    return value.error.message.trim();
  }

  if (typeof value.message === "string" && value.message.trim().length > 0) {
    return value.message.trim();
  }

  return null;
}

function toUiErrorMessage(error: unknown): string {
  const fallback = "Unable to authorize this device code.";
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return fallback;
  }

  let message = error.message.trim();
  message = message.replace(/^uncaught error:\s*/i, "");
  message = message.replace(/\s+at handler.*$/i, "").trim();

  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("device code has expired")) {
    return "This device code expired. Start login again from your terminal.";
  }
  if (
    normalizedMessage.includes("device code was not found") ||
    normalizedMessage.includes("device code not found") ||
    normalizedMessage.includes("invalid device code")
  ) {
    return "This device code is invalid. Start login again from your terminal.";
  }
  if (normalizedMessage.includes("missing clerk session token")) {
    return "Session expired. Sign in again and retry.";
  }

  return message.length > 0 ? message : fallback;
}

export function Page() {
  const [searchParams] = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userCode = useMemo(() => {
    const value = searchParams.get("user_code") ?? searchParams.get("userCode") ?? "";
    return normalizeUserCode(value.trim());
  }, [searchParams]);
  const isValidCode = userCode.length === USER_CODE_LENGTH;

  async function handleApprove(): Promise<void> {
    if (!isSignedIn || !isValidCode || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken({
        template: "convex"
      });
      if (!token) {
        throw new Error("Missing Clerk session token.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_BAREKEY_API_URL ?? DEFAULT_BAREKEY_API_URL}/v1/cli/device/complete`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userCode,
          }),
        }
      );

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = parseApiErrorMessage(payload) ?? "Unable to authorize this device code.";
        throw new Error(message);
      }

      const result = payload as {
        status: string;
        orgSlug: string;
      };
      toast.success(`Authorized for workspace ${result.orgSlug}. Return to your terminal.`);
    } catch (error: unknown) {
      toast.error(toUiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-8 text-center">
        <header className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Confirm CLI sign-in</h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Confirm this device code to finish signing in from your terminal.
          </p>
        </header>

        <section className="flex flex-col items-center gap-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Device code</p>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: USER_CODE_LENGTH }).map((_, index) => (
              <div
                key={index}
                className="flex h-16 w-14 items-center justify-center rounded-xl border bg-muted/30 text-2xl font-mono font-semibold uppercase"
              >
                {userCode[index] ?? "•"}
              </div>
            ))}
          </div>
          {!isValidCode ? (
            <p className="text-sm text-destructive">
              Missing or invalid device code in URL. Open the fresh link from the CLI.
            </p>
          ) : null}
        </section>

        <SignedOut>
          <div className="flex flex-col items-center gap-3">
            <SignInButton mode="modal">
              <Button className="h-12 w-full text-base sm:w-auto sm:px-8">Sign in to continue</Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col items-center gap-4">
            <p className="text-base text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {user?.primaryEmailAddress?.emailAddress ?? user?.id}
              </span>
            </p>
            <p className="text-base text-muted-foreground">
              Workspace:{" "}
              <span className="font-medium text-foreground">
                {organization?.slug ?? "No workspace selected"}
              </span>
            </p>
            <Button
              className="h-12 w-full text-base sm:w-auto sm:px-8"
              onClick={() => {
                void handleApprove();
              }}
              disabled={isSubmitting || !isValidCode}
            >
              {isSubmitting ? "Authorizing..." : "Confirm and authorize"}
            </Button>
          </div>
        </SignedIn>
      </div>
    </main>
  );
}
