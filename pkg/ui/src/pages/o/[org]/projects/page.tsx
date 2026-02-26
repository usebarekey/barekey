import { useParams } from "react-router-dom";

export function Page() {
  const { orgSlug = "org" } = useParams();

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold">Projects</p>
      <p className="text-sm text-muted-foreground">
        Projects are scoped to <span className="font-mono">{orgSlug}</span>.
      </p>
      <p>123 projects</p>
    </div>
  );
}
