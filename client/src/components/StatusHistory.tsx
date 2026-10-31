import { useEffect, useState } from "react";
import { getStatusHistory, type StatusHistoryEntry } from "../api.js";
import { StatusBadge, type TicketStatus } from "./Badge.js";
import { LoadingSkeleton, ErrorCallout } from "./States.js";
import { formatDateTime } from "../format.js";

type Load = "loading" | "ready" | "error";

interface StatusHistoryProps {
  ticketId: number;
  viewer: "staff" | "requester";
  /** The Requester's own entries read "You" (ui-spec §2.8). */
  currentUserId?: number;
  /** Bumped by the parent after a status change, so the list refetches (AC-30). */
  refreshKey?: number;
}

/**
 * Status history (ui-spec §2.8, §7.5): oldest first, read-only. Staff see who
 * made each change; a Requester sees staff changes as "IT Support" (BR-35); a
 * backfilled entry reads "Recorded at upgrade".
 */
export function StatusHistory({ ticketId, viewer, currentUserId, refreshKey = 0 }: StatusHistoryProps) {
  const [load, setLoad] = useState<Load>("loading");
  const [items, setItems] = useState<StatusHistoryEntry[]>([]);

  function loadHistory() {
    // Wrapped so a synchronous throw, or a non-promise, lands in .catch rather
    // than breaking the whole screen.
    Promise.resolve()
      .then(() => getStatusHistory(ticketId))
      .then((list) => {
        // A missing body is treated as no entries rather than a crash.
        setItems(list ?? []);
        setLoad("ready");
      })
      .catch(() => setLoad("error"));
  }

  useEffect(loadHistory, [ticketId, refreshKey]);

  function actorLabel(actor: StatusHistoryEntry["actor"]) {
    if (actor.kind === "system") return <span className="zg-history__system">Recorded at upgrade</span>;
    if (actor.kind === "staff" && !actor.name) return "IT Support";
    if (viewer === "requester" && actor.kind === "requester" && actor.id === currentUserId) return "You";
    return actor.name;
  }

  return (
    <section className="zg-panel zg-history-panel" aria-label="Status history">
      <h2 className="zg-section-title">Status history</h2>
      {load === "loading" && <LoadingSkeleton rows={2} label="Loading status history…" />}
      {load === "error" && (
        <ErrorCallout message="We couldn't load the status history." onRetry={loadHistory} retryLabel="Try again" />
      )}
      {load === "ready" && (
        <ol className="zg-history">
          {items.map((entry) => (
            <li key={entry.id} className="zg-history__entry">
              <span className="zg-history__when">{formatDateTime(entry.changedAt)}</span>
              <span className="zg-history__change">
                {entry.fromStatus && (
                  <>
                    <StatusBadge value={entry.fromStatus as TicketStatus} />
                    <span aria-hidden="true"> → </span>
                    <span className="zg-visually-hidden">to</span>{" "}
                  </>
                )}
                <StatusBadge value={entry.toStatus as TicketStatus} />
              </span>
              <span className="zg-history__actor">{actorLabel(entry.actor)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
