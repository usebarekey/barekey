import { type ReactNode, useMemo, useState } from "react";
import { IconChevronRight, IconFilter, IconInbox } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatAuditAbsoluteTime,
  formatAuditActor,
  formatAuditRelativeTime,
  getAuditCategoryLabel,
  getAuditEmptyStateLabel,
  getAuditEventIcon,
  getAuditSeverityBadgeLabel,
  getAuditSeverityIcon,
  getAuditSeverityTone,
  hasAuditPayload,
  parseAuditPayload,
  type AuditEventRow,
} from "@/lib/audit";

function AuditPayloadDetails({ event }: { event: AuditEventRow }) {
  const payload = useMemo(() => parseAuditPayload(event.payloadJson), [event.payloadJson]);
  const entries = payload ? Object.entries(payload) : [];

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No additional metadata is stored for this event.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
      {entries.map(([key, value]) => (
        <div key={key} className="grid gap-1 rounded-lg border bg-background/60 p-3 sm:grid-cols-[150px_1fr]">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {key}
          </div>
          <div className="text-sm text-foreground">
            <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
              {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditFeed({
  events,
  isLoading,
  emptyLabel,
  compact = false,
}: {
  events: Array<AuditEventRow>;
  isLoading: boolean;
  emptyLabel?: ReactNode;
  compact?: boolean;
}) {
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRow | null>(null);

  return (
    <>
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: compact ? 5 : 7 }).map((_, index) => (
            <div key={index} className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-start gap-3">
                <Skeleton className="mt-1 size-8 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  {!compact ? <Skeleton className="h-3 w-5/6" /> : null}
                </div>
              </div>
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-background/70 p-2">
                <IconInbox className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No audit events yet</p>
                <p>{emptyLabel ?? getAuditEmptyStateLabel()}</p>
              </div>
            </div>
          </div>
        ) : (
          events.map((event) => (
            <button
              key={event.id}
              type="button"
              className="group w-full rounded-xl border bg-background/70 p-3 text-left transition-colors hover:border-border hover:bg-background/90"
              onClick={() => {
                setSelectedEvent(event);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border bg-background/80 p-2 text-muted-foreground">
                  {getAuditEventIcon(event.category)}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                    <Badge variant="outline">{getAuditCategoryLabel(event.category)}</Badge>
                    <Badge variant={getAuditSeverityTone(event.severity)}>
                      <span className="mr-1 inline-flex">{getAuditSeverityIcon(event.severity)}</span>
                      {getAuditSeverityBadgeLabel(event.severity)}
                    </Badge>
                    {event.projectSlug ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {event.projectSlug}
                      </Badge>
                    ) : null}
                    {event.stageSlug ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {event.stageSlug}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatAuditActor(event)}</span>
                    <span>&middot;</span>
                    <span title={formatAuditAbsoluteTime(event.occurredAtMs)}>
                      {formatAuditRelativeTime(event.occurredAtMs)}
                    </span>
                    {hasAuditPayload(event) ? (
                      <>
                        <span>&middot;</span>
                        <span className="inline-flex items-center gap-1">
                          <IconFilter className="size-3.5" />
                          Details
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <IconChevronRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))
        )}
      </div>

      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
          {selectedEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.title}</DialogTitle>
                <DialogDescription>
                  {selectedEvent.description}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-2 rounded-xl border bg-background/70 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Actor</p>
                    <p className="mt-1">{formatAuditActor(selectedEvent)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Occurred</p>
                    <p className="mt-1">{formatAuditAbsoluteTime(selectedEvent.occurredAtMs)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Category</p>
                    <p className="mt-1">{getAuditCategoryLabel(selectedEvent.category)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Severity</p>
                    <p className="mt-1">{getAuditSeverityBadgeLabel(selectedEvent.severity)}</p>
                  </div>
                  {selectedEvent.projectSlug ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project</p>
                      <p className="mt-1 font-mono text-xs">{selectedEvent.projectSlug}</p>
                    </div>
                  ) : null}
                  {selectedEvent.stageSlug ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stage</p>
                      <p className="mt-1 font-mono text-xs">{selectedEvent.stageSlug}</p>
                    </div>
                  ) : null}
                </div>
                <AuditPayloadDetails event={selectedEvent} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
