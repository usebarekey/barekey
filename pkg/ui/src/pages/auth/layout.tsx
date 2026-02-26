import { useAuth } from "@clerk/react-router";
import { useConvexAuth } from "convex/react";
import { Navigate, Outlet } from "react-router-dom";

export function Layout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading auth...
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
