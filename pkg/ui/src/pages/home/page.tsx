import { SignOutButton, useAuth } from "@clerk/react-router";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEnsureCurrentUserRecord } from "@/hooks/use-ensure-current-user-record";
import { cn } from "@/lib/utils";
import { useConvexAuth } from "convex/react";
import { Link, Navigate } from "react-router-dom";

export function Page() {
  const { isLoaded, isSignedIn, orgSlug } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  useEnsureCurrentUserRecord();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sso" replace />;
  }

  if (!isLoading && isAuthenticated) {
    if (orgSlug) {
      return <Navigate to={`/o/${orgSlug}/overview`} replace />;
    }

    return <Navigate to="/o/select" replace />;
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <h1 className="text-lg font-semibold">Preparing your workspace</h1>
          <p className="text-sm text-muted-foreground">
            You will land in the right workspace automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading ? <p>Checking your access...</p> : null}
          {!isAuthenticated && !isLoading ? (
            <p className="text-muted-foreground">
              We could not finish setup. Refresh this page or sign in again.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <Link to="/auth/sso" className={cn(buttonVariants({ variant: "outline" }))}>
            Sign in
          </Link>
          <SignOutButton redirectUrl="/auth/sso">
            <Button>Sign out</Button>
          </SignOutButton>
        </CardFooter>
      </Card>
    </div>
  );
}
