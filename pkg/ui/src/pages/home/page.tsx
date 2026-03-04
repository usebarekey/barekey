import { useAuth } from "@clerk/react-router";

import { LandingPage } from "./landing";

export function Page() {
  const { isLoaded, isSignedIn, orgSlug } = useAuth();

  const dashboardPath = orgSlug ? `/o/${orgSlug}/overview` : "/o/select";

  return <LandingPage isSignedIn={isLoaded && !!isSignedIn} dashboardPath={dashboardPath} />;
}
