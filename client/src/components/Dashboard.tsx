import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Metric } from "../api.js";

// Shared dashboard pieces (Lab 4 ui-spec §2.2–§2.4). Every link out of a
// dashboard carries `fromDashboard`, so the list it opens can say why it is
// filtered (§9).
export const FROM_DASHBOARD = { fromDashboard: true };

/**
 * Metric card (§2.2). With an `href` the whole card is one link whose accessible
 * name is the full sentence, so a screen reader never announces a bare number.
 * With `href` null it is a static card — it never pretends to be a link.
 * Zero is shown as 0, in the same weight. An optional `badge` sits beside the
 * label for the card that asks the user to act (§6.1).
 */
export function MetricCard({ label, metric, badge }: { label: string; metric: Metric; badge?: ReactNode }) {
  const body = (
    <>
      <span className="zg-metric__label">
        {label}
        {badge}
      </span>
      <span className="zg-metric__value">{metric.value}</span>
    </>
  );
  if (!metric.href) return <div className="zg-metric zg-metric--static">{body}</div>;
  return (
    <Link className="zg-metric" to={metric.href} state={FROM_DASHBOARD} aria-label={`${label}: ${metric.value} — view list`}>
      {body}
      <span className="zg-metric__cue" aria-hidden="true">
        View list ›
      </span>
    </Link>
  );
}

/** Count strip (§2.3): a row of badge + count links that wraps, never scrolls. */
export function CountStrip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="zg-count-strip">
      <h2 className="zg-count-strip__title">{title}</h2>
      <ul className="zg-count-strip__items">{children}</ul>
    </div>
  );
}

export function CountItem({ badge, metric, name }: { badge: ReactNode; metric: Metric; name: string }) {
  const content = (
    <>
      {badge}
      <span className="zg-count-strip__count">{metric.value}</span>
    </>
  );
  return (
    <li>
      {metric.href ? (
        <Link className="zg-count-strip__item" to={metric.href} state={FROM_DASHBOARD} aria-label={name}>
          {content}
        </Link>
      ) : (
        <span className="zg-count-strip__item" aria-label={name}>
          {content}
        </span>
      )}
    </li>
  );
}

/** Compact list (§2.4): a heading, an optional View all link, at most five rows, its own empty message. */
export function MiniList({
  title,
  viewAllHref,
  empty,
  children,
  count,
}: {
  title: string;
  viewAllHref?: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="zg-panel zg-mini-list" aria-label={title}>
      <div className="zg-mini-list__head">
        <h2 className="zg-section-title zg-mini-list__title">{title}</h2>
        {viewAllHref && (
          <Link className="zg-mini-list__all" to={viewAllHref} state={FROM_DASHBOARD}>
            View all ›
          </Link>
        )}
      </div>
      {count === 0 ? <p className="zg-panel__body">{empty}</p> : <ul className="zg-mini-list__rows">{children}</ul>}
    </section>
  );
}
