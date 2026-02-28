import { useAuth } from "@clerk/react-router";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "@convex/_generated/api";

export function useEnsureCurrentUserRecord() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isLoading || !isAuthenticated) {
      return;
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void ensureCurrentUser({}).catch(() => {
      hasRequestedRef.current = false;
    });
  }, [ensureCurrentUser, isAuthenticated, isLoaded, isLoading, isSignedIn]);
}
