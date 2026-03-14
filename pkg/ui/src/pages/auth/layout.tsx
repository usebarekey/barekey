import { useAuth } from "@clerk/react-router";
import { useConvexAuth } from "convex/react";
import { Navigate, Outlet } from "react-router-dom";

import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";

export function Layout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <SkeletonPlaceholder
          className="w-full max-w-sm rounded-xl"
          content={
            <div className="rounded-xl border bg-background/70 px-5 py-4 text-sm text-muted-foreground">
              Loading auth...
            </div>
          }
        />
      </div>
    );
  }

  if (isSignedIn && (isAuthenticated || !isLoading)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Outlet />
    </div>
  );
}
