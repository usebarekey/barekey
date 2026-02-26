import { useParams } from "react-router-dom";

export function Page() {
  const { orgSlug = "org" } = useParams();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Members</p>
        <p className="text-sm text-muted-foreground">
          Membership management for <span className="font-mono">{orgSlug}</span>.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Next step</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mount Clerk organization membership management here or build a custom member list backed
            by Clerk API reads.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">MVP policy</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use JWT org claims for regular access and perform live Clerk verification for sensitive
            admin actions.
          </p>
        </div>
      </div>
    </div>
  );
}
