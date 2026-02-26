import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">Organization Overview</p>
      <p className="text-sm text-muted-foreground">
        Workspace for <span className="font-mono">{orgSlug}</span>.
      </p>
      {orgClaims ? (
        <p className="text-sm text-muted-foreground">
          Active role: <span className="font-mono">{orgClaims.orgRole ?? "none"}</span>
        </p>
      ) : null}
    </div>
  );
}
