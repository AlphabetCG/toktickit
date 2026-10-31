import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getRequesterDashboard,
  getTickets,
  ForbiddenError,
  type RequesterDashboardData,
  type RequesterTicketSummary,
} from "../api.js";
import { useAuth } from "../auth.js";
import { StatusBadge } from "../components/Badge.js";
import { MetricCard, MiniList } from "../components/Dashboard.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";
import { formatDate, formatDateTime } from "../format.js";

type Load = "loading" | "ready" | "forbidden" | "error";

/** Every figure zero and every list empty: the only case where the Requester might have no Tickets at all. */
function allZero(d: RequesterDashboardData): boolean {
  return (
    Object.values(d.metrics).every((m) => m.value === 0) &&
    d.needsAttention.items.length + d.recentlyUpdated.items.length + d.recentlyResolved.items.length === 0
  );
}

function Row({ ticket, meta }: { ticket: RequesterTicketSummary; meta: string }) {
  return (
    <li>
      <Link className="zg-mini-list__row" to={ticket.href}>
        <span className="zg-mini-list__line">
          <span className="zg-mini-list__number">{ticket.ticketNumber}</span>
          <StatusBadge value={ticket.currentStatus} />
        </span>
        <span className="zg-mini-list__text">{ticket.summary}</span>
        <span className="zg-mini-list__meta">{meta}</span>
      </Link>
    </li>
  );
}

/**
 * Requester Dashboard (ui-spec §6). *Needs your attention* comes first and full
 * width, because it is why a Requester opens the page; nothing here repeats My
 * Tickets' search, filters, or paging — *View all* hands over to it.
 */
export function RequesterDashboard() {
  const { user } = useAuth();
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [noTickets, setNoTickets] = useState(false);

  function loadDashboard() {
    setLoad("loading");
    getRequesterDashboard()
      .then(async (d) => {
        // D-19: zeros alone cannot tell "no Tickets yet" from "only old, closed
        // ones", so My Tickets' own total decides. A failed check keeps the lists.
        const none = allZero(d) ? await getTickets({}).then((r) => r.totalItems === 0, () => false) : false;
        setData(d);
        setNoTickets(none);
        setLoad("ready");
      })
      .catch((err) => setLoad(err instanceof ForbiddenError ? "forbidden" : "error"));
  }

  useEffect(loadDashboard, []);

  if (load === "forbidden") {
    return <EmptyState heading="You don't have access to this dashboard" body="This dashboard is for requesters." />;
  }

  return (
    <section className="zg-dashboard">
      <div className="zg-dashboard__head">
        <div>
          <h1 className="zg-page-title">Dashboard</h1>
          {user && <p className="zg-dashboard__greeting">Hello, {user.name.split(" ")[0]}</p>}
        </div>
        <Link className="zg-btn zg-btn--primary zg-dashboard__create" to="/tickets/new">
          + Create ticket
        </Link>
      </div>

      {load === "loading" && <LoadingSkeleton rows={6} label="Loading dashboard…" />}
      {load === "error" && <ErrorCallout message="We couldn't load your dashboard." onRetry={loadDashboard} retryLabel="Try again" />}

      {load === "ready" && data && (
        <>
          <div className="zg-metrics zg-metrics--three">
            <MetricCard label="Open tickets" metric={data.metrics.openTickets} />
            <MetricCard
              label="Waiting for you"
              metric={data.metrics.waitingForMe}
              badge={<StatusBadge value="WAITING_FOR_REQUESTER" />}
            />
            <MetricCard label="Resolved, awaiting closure" metric={data.metrics.awaitingClosure} />
          </div>

          {noTickets ? (
            <EmptyState
              heading="You haven't raised a ticket yet."
              body="When you raise an IT request, its progress will appear here."
              action={
                <Link className="zg-btn zg-btn--primary" to="/tickets/new">
                  Create ticket
                </Link>
              }
            />
          ) : (
            <>
              <MiniList
                title="Needs your attention"
                viewAllHref={data.needsAttention.viewAllHref}
                empty="Nothing needs your attention right now."
                count={data.needsAttention.items.length}
              >
                {data.needsAttention.items.map((t) => (
                  <Row key={t.id} ticket={t} meta="The IT team is waiting for your reply" />
                ))}
              </MiniList>

              <div className="zg-dashboard__pair">
                <MiniList
                  title="Recently updated"
                  viewAllHref={data.recentlyUpdated.viewAllHref}
                  empty="None of your tickets changed in the last 7 days."
                  count={data.recentlyUpdated.items.length}
                >
                  {data.recentlyUpdated.items.map((t) => (
                    <Row key={t.id} ticket={t} meta={`Updated ${formatDateTime(t.updatedAt)}`} />
                  ))}
                </MiniList>

                <MiniList
                  title="Recently resolved"
                  empty="No tickets were resolved in the last 30 days."
                  count={data.recentlyResolved.items.length}
                >
                  {data.recentlyResolved.items.map((t) => (
                    <Row key={t.id} ticket={t} meta={`Resolved ${formatDate(t.resolvedAt ?? t.updatedAt)}`} />
                  ))}
                </MiniList>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
