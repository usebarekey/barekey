import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

export function Page() {
  const { userSlug = "user" } = useParams();
  const currentUser = useQuery(api.users.getCurrentUser, {});

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">Account Overview</p>
      <p className="text-sm text-muted-foreground">
        User slug: <span className="font-mono">{userSlug}</span>
      </p>
      {currentUser ? (
        <p className="text-sm text-muted-foreground">
          Clerk user: <span className="font-mono">{currentUser.clerkUserId}</span>
        </p>
      ) : null}
      <p>Account pages live under /u, workspaces live under /o.</p>
    </div>
  );
}
