import { useAuth } from "@clerk/react-router";
import { useEffect } from "react";

import { LandingPage } from "./landing";

export function Page() {
  const { isLoaded, isSignedIn, orgSlug } = useAuth();

  const dashboardPath = orgSlug ? `/o/${orgSlug}/overview` : "/o/select";

  useEffect(() => {
    document.title = "Barekey";
  }, []);

  return <LandingPage isSignedIn={isLoaded && !!isSignedIn} dashboardPath={dashboardPath} />;
}
