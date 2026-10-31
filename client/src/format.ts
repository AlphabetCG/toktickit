// The one place dates and times are formatted (ui-spec §10 P-01), so the same
// moment reads the same on every screen. Locale-aware, in the viewer's time zone.

/** "13 Oct 2026" — a calendar day. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "13 Oct 2026, 16:00" — a moment something happened. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "16:05" — today's time only: the dashboard's "Updated" line (ui-spec §5.1). */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
