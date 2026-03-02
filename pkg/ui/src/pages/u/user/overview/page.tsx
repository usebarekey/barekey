import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Page() {
  const { userSlug = "user" } = useParams();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isLoading = currentUser === undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Account overview</CardTitle>
          <CardDescription>Profile details for your Barekey account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading account details...</p>
          ) : currentUser ? (
            <>
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span>Ready</span>
              </p>
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span>{currentUser.displayName ?? "Not set"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span>{currentUser.email ?? "Not set"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Profile path:</span>{" "}
                <span className="font-mono">/u/{userSlug}</span>
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Your account record is still being prepared.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
