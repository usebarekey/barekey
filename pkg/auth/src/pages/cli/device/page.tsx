import { SignedIn, SignedOut, SignInButton, useAuth, useUser } from "@clerk/react-router";
import { IconDeviceLaptop, IconLock, IconUser } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTheme } from "theme-watcher";

import barekeyDarkPng from "@/assets/barekey-dark.png";
import barekeyLightPng from "@/assets/barekey-light.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_BAREKEY_API_URL = "https://api.barekey.dev";
const USER_CODE_LENGTH = 8;

function normalizeUserCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, USER_CODE_LENGTH).toUpperCase();
}

function normalizeClientName(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
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

function DetailRow(props: {
  icon: typeof IconUser;
  label: string;
  value: string;
}) {
  const Icon = props.icon;

  return (
    <div className="flex items-start gap-3 border-b border-border/80 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground">
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{props.label}</div>
        <div className="mt-1 truncate text-sm font-medium text-foreground">{props.value}</div>
      </div>
    </div>
  );
}

function DeviceCodeDisplay(props: { userCode: string }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {Array.from({ length: USER_CODE_LENGTH }).map((_, index) => {
        const isDivider = index === 4;
        return (
          <div key={index} className="flex items-center gap-2 sm:gap-3">
            {isDivider ? (
              <div
                aria-hidden="true"
                className="flex h-14 items-center justify-center px-0.5 font-mono text-lg font-medium text-muted-foreground sm:h-16 sm:text-xl"
              >
                -
              </div>
            ) : null}
            <div className="flex h-14 w-11 items-center justify-center rounded-lg border border-border bg-background font-mono text-lg font-semibold text-foreground sm:h-16 sm:w-12 sm:text-xl">
              {props.userCode[index] ?? "•"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Page() {
  const [searchParams] = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { resolvedTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const userCode = useMemo(() => {
    const value = searchParams.get("user_code") ?? searchParams.get("userCode") ?? "";
    return normalizeUserCode(value.trim());
  }, [searchParams]);
  const clientName = useMemo(() => {
    return normalizeClientName(searchParams.get("client_name") ?? searchParams.get("clientName"));
  }, [searchParams]);
  const isValidCode = userCode.length === USER_CODE_LENGTH;
  const signedInAs = user?.primaryEmailAddress?.emailAddress ?? user?.id ?? "";
  const deviceLabel = clientName ?? "This computer";
  const logoSrc = resolvedTheme === "dark" ? barekeyLightPng : barekeyDarkPng;

  useEffect(() => {
    setIsReady(false);
    const timeoutId = window.setTimeout(() => {
      setIsReady(true);
    }, 500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  async function handleApprove(): Promise<void> {
    if (!isSignedIn || !isValidCode || isSubmitting || !isReady) {
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken({
        template: "convex",
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
        },
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

      toast.success("CLI sign-in approved. Return to your terminal.");
    } catch (error: unknown) {
      toast.error(toUiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <div className="flex flex-1 items-center py-2 sm:py-6">
          <Card className="w-full rounded-xl border border-border/90 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[minmax(0,1.3fr)_22rem]">
                <section className="border-b border-border/80 p-6 sm:p-8 lg:border-r lg:border-b-0">
                  <div className="max-w-2xl">
                    <img src={logoSrc} alt="Barekey" className="mb-8 w-10 rounded-md" />
                    <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[2.5rem]">
                      Approve CLI sign-in
                    </h1>
                    <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted-foreground">
                      Check the device code before you continue. This links your current browser
                      session to the terminal waiting for approval.
                    </p>

                    <div className="mt-10 rounded-xl border border-border/80 bg-muted/25 p-5 sm:p-6">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                        <IconLock className="size-4 text-muted-foreground" strokeWidth={1.8} />
                        Device code
                      </div>
                      <DeviceCodeDisplay userCode={userCode} />
                      {!isValidCode ? (
                        <p className="mt-4 text-sm text-destructive">
                          Missing or invalid device code. Open the fresh link from your terminal.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <SignedOut>
                        <SignInButton mode="modal">
                          <Button className="h-11 px-5 text-sm font-medium" disabled={!isReady}>
                            {isReady ? "Sign in to continue" : "Preparing..."}
                          </Button>
                        </SignInButton>
                      </SignedOut>

                      <SignedIn>
                        <Button
                          className="h-11 px-5 text-sm font-medium"
                          onClick={() => {
                            void handleApprove();
                          }}
                          disabled={isSubmitting || !isValidCode || !isReady}
                        >
                          {isSubmitting ? "Authorizing..." : isReady ? "Approve sign-in" : "Preparing..."}
                        </Button>
                      </SignedIn>
                    </div>
                  </div>
                </section>

                <aside className="p-6 sm:p-8">
                  <div className="rounded-xl border border-border/80 bg-background p-5">
                    <div className="mb-5 text-sm font-medium text-foreground">Request details</div>

                    <DetailRow icon={IconDeviceLaptop} label="Computer" value={deviceLabel} />

                    <SignedIn>
                      <DetailRow icon={IconUser} label="Logged in as" value={signedInAs} />
                    </SignedIn>
                  </div>
                </aside>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
