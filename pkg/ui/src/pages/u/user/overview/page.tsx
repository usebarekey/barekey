import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";

import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
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
          <CardDescription>Your profile details and account status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">User slug</Badge>
            <span className="font-mono">{userSlug}</span>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading account details...</p>
          ) : currentUser ? (
            <>
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
            <p className="text-muted-foreground">Account record not available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
