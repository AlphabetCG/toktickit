import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStaffDashboard, ForbiddenError, type StaffDashboardData, type TicketStatusValue, type RequestedPriority } from "../api.js";
import { useAuth } from "../auth.js";
import { ActionStatusBadge, PriorityBadge, StatusBadge, statusLabel } from "../components/Badge.js";
import { MetricCard, CountStrip, CountItem, MiniList } from "../components/Dashboard.js";
import { LoadingSkeleton, EmptyState, ErrorCallout } from "../components/States.js";

type Load = "loading" | "ready" | "forbidden" | "error";

const STATUS_ORDER: TicketStatusValue[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const PRIORITY_ORDER: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const PRIORITY_LABEL: Record<RequestedPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const DAY_MS = 86_400_000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function waited(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  return days < 1 ? "Opened today" : `Opened ${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * IT Staff and Administrator Dashboard (ui-spec §5). The cards answer "how
 * much" and the lists "which ones". Every figure comes from the server at load
 * time; "Updated" shows when, so a stale tab is recognisable.
 */
export function StaffDashboard() {
  const { user } = useAuth();
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<StaffDashboardData | null>(null);

  function loadDashboard() {
    setLoad("loading");
    getStaffDashboard()
      .then((d) => {
        setData(d);
        setLoad("ready");
      })
      .catch((err) => setLoad(err instanceof ForbiddenError ? "forbidden" : "error"));
  }

  useEffect(loadDashboard, []);

  if (load === "forbidden") {
    return <EmptyState heading="You don't have access to this dashboard" body="This dashboard is for IT Staff and Administrators." />;
  }

  return (
    <section className="zg-dashboard">
      <div className="zg-dashboard__head">
        <div>
          <h1 className="zg-page-title">Dashboard</h1>
          {user && <p className="zg-dashboard__greeting">{greeting(new Date())}, {user.name.split(" ")[0]}</p>}
        </div>
        {data && load === "ready" && <p className="zg-dashboard__updated">Updated {formatTime(data.generatedAt)}</p>}
      </div>

      {load === "loading" && <LoadingSkeleton rows={6} label="Loading dashboard…" />}
      {load === "error" && <ErrorCallout message="We couldn't load your dashboard." onRetry={loadDashboard} retryLabel="Try again" />}

      {load === "ready" && data && (
        <>
          <div className="zg-metrics">
            <MetricCard label="Open and unassigned" metric={data.metrics.unassignedOpen} />
            <MetricCard label="Open and assigned to me" metric={data.metrics.mineOpen} />
            <MetricCard label="My open actions" metric={data.metrics.myOpenActions} />
            <MetricCard label="Open, high priority" metric={data.metrics.highPriorityOpen} />
          </div>

          <CountStrip title="By status">
            {STATUS_ORDER.map((s) => (
              <CountItem
                key={s}
                badge={<StatusBadge value={s} />}
                metric={data.byStatus[s]}
                name={`${statusLabel(s)}: ${data.byStatus[s].value} tickets`}
              />
            ))}
          </CountStrip>
          <CountStrip title="Open by IT Priority">
            {PRIORITY_ORDER.map((p) => (
              <CountItem
                key={p}
                badge={<PriorityBadge value={p} />}
                metric={data.openByItPriority[p]}
                name={`${PRIORITY_LABEL[p]}: ${data.openByItPriority[p].value} open tickets`}
              />
            ))}
          </CountStrip>

          <div className="zg-dashboard__pair">
            <MiniList title="My open actions" empty="You have no open actions." count={data.myActions.items.length}>
              {data.myActions.items.map((a) => (
                <li key={a.id}>
                  <Link className="zg-mini-list__row" to={a.href}>
                    <span className="zg-mini-list__line">
                      <ActionStatusBadge value={a.status} />
                      <span className="zg-mini-list__meta">{formatWhen(a.actionAt)}</span>
                    </span>
                    <span className="zg-mini-list__text">{a.description}</span>
                    <span className="zg-mini-list__meta">
                      {a.ticket.ticketNumber} · {a.ticket.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </MiniList>

            <MiniList title="Urgent" viewAllHref={data.urgent.viewAllHref} empty="No open high-priority tickets." count={data.urgent.items.length}>
              {data.urgent.items.map((t) => (
                <li key={t.id}>
                  <Link className="zg-mini-list__row" to={t.href}>
                    <span className="zg-mini-list__line">
                      <span className="zg-mini-list__number">{t.ticketNumber}</span>
                      <StatusBadge value={t.currentStatus} />
                    </span>
                    <span className="zg-mini-list__text">{t.summary}</span>
                    <span className="zg-mini-list__meta">
                      {t.owner ? t.owner.name : "Unassigned"} · {waited(t.ticketDate, new Date())}
                    </span>
                  </Link>
                </li>
              ))}
            </MiniList>
          </div>

          <MiniList
            title="Recently updated"
            viewAllHref={data.recentlyUpdated.viewAllHref}
            empty="No tickets were updated in the last 7 days."
            count={data.recentlyUpdated.items.length}
          >
            {data.recentlyUpdated.items.map((t) => (
              <li key={t.id}>
                <Link className="zg-mini-list__row" to={t.href}>
                  <span className="zg-mini-list__line">
                    <span className="zg-mini-list__number">{t.ticketNumber}</span>
                    <StatusBadge value={t.currentStatus} />
                    <PriorityBadge value={t.itPriority} />
                  </span>
                  <span className="zg-mini-list__text">{t.summary}</span>
                  <span className="zg-mini-list__meta">Updated {formatWhen(t.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </MiniList>

          {data.userCounts && (
            <section className="zg-panel zg-dashboard__users" aria-label="Users">
              <h2 className="zg-section-title">Users</h2>
              <div className="zg-metrics zg-metrics--compact">
                <MetricCard label="Requesters" metric={data.userCounts.activeByRole.REQUESTER} />
                <MetricCard label="IT Staff" metric={data.userCounts.activeByRole.IT_STAFF} />
                <MetricCard label="Administrators" metric={data.userCounts.activeByRole.ADMINISTRATOR} />
                <MetricCard label="Inactive" metric={data.userCounts.inactive} />
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
