import { OrganizationProfile, SignedIn, SignedOut } from "@clerk/react-router";
import { useParams } from "react-router-dom";

export function Page() {
  const { orgSlug = "org" } = useParams();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Settings</p>
        <p className="text-sm text-muted-foreground">
          Organization settings for <span className="font-mono">{orgSlug}</span>.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Sign in to manage organization settings.
        </div>
      </SignedOut>

      <SignedIn>
        <div className="rounded-xl border p-2">
          <OrganizationProfile />
        </div>
      </SignedIn>
    </div>
  );
}
