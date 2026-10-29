// Dashboard calculation rules (specification §5.8). Pure, so the active set and
// the window boundaries can be asserted directly (UNIT-06, UNIT-07).
import type { Status } from "./transitions.js";

/** BR-46: "open" on every dashboard means one of these five. */
export const ACTIVE_STATUSES: readonly Status[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

const DAY_MS = 24 * 3_600_000;

/**
 * BR-49: a rolling window — "last 7 days" is `now − 168 h` — so no calendar day
 * or time zone affects a count. A record exactly on the boundary is inside.
 */
export function windowStart(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function isWithinWindow(at: Date, now: Date, days: number): boolean {
  return at.getTime() >= windowStart(now, days).getTime();
}

/** Dashboard list text is cut to this length, ellipsis included (api-spec §6.1). */
export const SUMMARY_TEXT_MAX = 120;

export function cutText(text: string, max = SUMMARY_TEXT_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
