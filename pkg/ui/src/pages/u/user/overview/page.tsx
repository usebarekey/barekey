import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Page() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isLoading = currentUser === undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Account overview</CardTitle>
          <CardDescription>Your profile and workspace access status.</CardDescription>
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
            </>
          ) : (
            <p className="text-muted-foreground">Your account record is still being prepared.</p>
          )}
          <Button variant="outline" nativeButton={false} render={<Link to="/o/select" />}>
            Open workspaces
            <IconArrowRight />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
