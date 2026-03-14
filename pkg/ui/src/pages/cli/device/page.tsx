import { useMutation } from "convex/react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
  useOrganization,
  useUser,
} from "@clerk/react-router";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";

export function Page() {
  const [searchParams] = useSearchParams();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const completeDeviceCode = useMutation(api.cli_auth.completeDeviceCodeForCurrentUser);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userCode = useMemo(() => {
    const value = searchParams.get("user_code") ?? searchParams.get("userCode") ?? "";
    return value.trim().toUpperCase();
  }, [searchParams]);

  async function handleApprove(): Promise<void> {
    if (!isSignedIn || userCode.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const result = await completeDeviceCode({ userCode });
      setStatusMessage(`Authorized for workspace ${result.orgSlug}. Return to your terminal.`);
    } catch (error: unknown) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to authorize this device code.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Authorize CLI login</CardTitle>
          <CardDescription>
            Confirm this device code to finish signing in from your terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Device code</p>
            <p className="mt-1 font-mono text-base">{userCode || "Missing code"}</p>
          </div>

          <SignedOut>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sign in first to authorize this CLI request.
              </p>
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {user?.primaryEmailAddress?.emailAddress ?? user?.id}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Active workspace:{" "}
                <span className="font-medium text-foreground">
                  {organization?.slug ?? "No workspace selected"}
                </span>
              </p>
              <Button
                onClick={() => {
                  void handleApprove();
                }}
                disabled={isSubmitting || userCode.length === 0}
              >
                {isSubmitting ? (
                  <SkeletonPlaceholder
                    className="inline-block rounded-md"
                    content={<span>Authorize CLI</span>}
                  />
                ) : (
                  "Authorize CLI"
                )}
              </Button>
            </div>
          </SignedIn>

          {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
