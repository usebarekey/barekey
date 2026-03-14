import { useQuery } from "convex/react";
import {
  IconFilter,
  IconHistory,
} from "@tabler/icons-react";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { AuditFeed } from "@/components/custom/audit-feed";
import { OrgPageHero, OrgRoleBadge, OrgSectionCard } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  auditActorSourceOptions,
  auditCategoryOptions,
  type AuditEventRow,
} from "@/lib/audit";

const ALL_CATEGORY = "__all_category__";
const ALL_PROJECTS = "__all_projects__";
const ALL_ACTORS = "__all_actors__";

type AuditPageResult = {
  items: Array<AuditEventRow>;
  nextBeforeOccurredAtMs: number | null;
  hasMore: boolean;
};

class AuditEventsErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function AuditEventsSection({
  orgSlug,
  projects,
}: {
  orgSlug: string;
  projects: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
}) {
  const [category, setCategory] = useState<(typeof auditCategoryOptions)[number]["value"] | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [actorSource, setActorSource] = useState<(typeof auditActorSourceOptions)[number]["value"] | null>(null);
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [beforeOccurredAtMs, setBeforeOccurredAtMs] = useState<number | null>(null);
  const [events, setEvents] = useState<Array<AuditEventRow>>([]);

  const categoryDisplayMap = useMemo(() => {
    const map: Record<string, string> = { [ALL_CATEGORY]: "All categories" };
    for (const option of auditCategoryOptions) {
      map[option.value] = option.label;
    }
    return map;
  }, []);

  const projectDisplayMap = useMemo(() => {
    const map: Record<string, string> = { [ALL_PROJECTS]: "All projects" };
    for (const project of projects) {
      map[project.slug] = project.name;
    }
    return map;
  }, [projects]);

  const actorDisplayMap = useMemo(() => {
    const map: Record<string, string> = { [ALL_ACTORS]: "All actors" };
    for (const option of auditActorSourceOptions) {
      map[option.value] = option.label;
    }
    return map;
  }, []);

  const filterKey = useMemo(
    () => JSON.stringify({ category, projectSlug, actorSource, sensitiveOnly }),
    [actorSource, category, projectSlug, sensitiveOnly],
  );

  const page = useQuery(api.audit.listEventsForCurrentOrg, {
    expectedOrgSlug: orgSlug,
    beforeOccurredAtMs,
    limit: 25,
    category,
    projectSlug,
    actorSource,
    sensitiveOnly,
  }) as AuditPageResult | undefined;

  useEffect(() => {
    setBeforeOccurredAtMs(null);
    setEvents([]);
  }, [filterKey]);

  useEffect(() => {
    if (page === undefined) {
      return;
    }

    setEvents((previous) => {
      if (beforeOccurredAtMs === null) {
        return page.items;
      }
      const knownIds = new Set(previous.map((item) => item.id));
      return previous.concat(page.items.filter((item) => !knownIds.has(item.id)));
    });
  }, [beforeOccurredAtMs, page]);

  return (
    <>
      <OrgSectionCard
        title="Filters"
        description="Narrow the activity feed by category, project, actor, or sensitive events."
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <Select
            value={category ?? ALL_CATEGORY}
            onValueChange={(value) => {
              setCategory(value === ALL_CATEGORY ? null : value as (typeof auditCategoryOptions)[number]["value"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder="All categories"
                displayNameMap={categoryDisplayMap}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORY}>All categories</SelectItem>
              {auditCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={projectSlug ?? ALL_PROJECTS}
            onValueChange={(value) => {
              setProjectSlug(value === ALL_PROJECTS ? null : value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder="All projects"
                displayNameMap={projectDisplayMap}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.slug}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actorSource ?? ALL_ACTORS}
            onValueChange={(value) => {
              setActorSource(value === ALL_ACTORS ? null : value as (typeof auditActorSourceOptions)[number]["value"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder="All actors"
                displayNameMap={actorDisplayMap}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTORS}>All actors</SelectItem>
              {auditActorSourceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="w-full"
            variant={sensitiveOnly ? "default" : "outline"}
            onClick={() => {
              setSensitiveOnly((previous) => !previous);
            }}
          >
            <IconFilter className="size-4" />
            Sensitive only
          </Button>
        </div>
      </OrgSectionCard>

      <OrgSectionCard
        title="Workspace events"
        description="Newest activity first. Open any event to inspect the safe metadata stored with it."
        action={
          <Badge variant="outline" className="gap-1">
            <IconHistory className="size-3.5" />
            {events.length.toLocaleString()} loaded
          </Badge>
        }
      >
        <div className="space-y-4">
          <AuditFeed
            events={events}
            isLoading={page === undefined && events.length === 0}
          />
          {page?.hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  if (page.nextBeforeOccurredAtMs !== null) {
                    setBeforeOccurredAtMs(page.nextBeforeOccurredAtMs);
                  }
                }}
              >
                Load older events
              </Button>
            </div>
          ) : null}
        </div>
      </OrgSectionCard>
    </>
  );
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });

  useEffect(() => {
    document.title = `${orgSlug} · Audit`;
  }, [orgSlug]);

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Audit log"
        orgSlug={orgSlug}
        subtitle={
          <>
            Review workspace activity across projects, billing, schedules, membership changes, and
            other sensitive operations.
          </>
        }
        tags={
          <>
            <Badge variant="outline">Org-wide feed</Badge>
            <OrgRoleBadge role={orgClaims?.orgRole} />
          </>
        }
      />

      <AuditEventsErrorBoundary
        fallback={
          <OrgSectionCard
            title="Audit log"
            description="Workspace activity is temporarily unavailable."
          >
            <div className="rounded-xl border border-dashed p-4">
              <SkeletonPlaceholder
                className="inline-block rounded-md"
                content={
                  <p className="text-sm text-muted-foreground">
                    We couldn&apos;t load the audit feed right now. Try refreshing in a moment.
                  </p>
                }
              />
            </div>
          </OrgSectionCard>
        }
      >
        <AuditEventsSection orgSlug={orgSlug} projects={projects ?? []} />
      </AuditEventsErrorBoundary>
    </div>
  );
}
