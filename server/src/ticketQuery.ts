// Normalises the My Tickets query string. Invalid parameters never fail the
// request — each falls back to its documented default (BR-36), so a hand-edited
// URL degrades gracefully. Pure and synchronous for UNIT-06.

export const SORT_FIELDS = ["ticketDate", "ticketNumber", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const PAGE_SIZES = [10, 20, 50] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const STATUSES = ["NEW"];

export interface NormalizedTicketQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  priority?: string;
  status?: string;
  sort: SortField;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

// A query value is always a string (or absent) from Express; ignore anything
// that isn't a plain positive integer.
function toPositiveInt(raw: unknown): number | undefined {
  return typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

export function normalizeTicketQuery(q: Record<string, unknown>): NormalizedTicketQuery {
  const search = typeof q.search === "string" ? q.search.trim() : "";

  const page = toPositiveInt(q.page);
  const pageSize = toPositiveInt(q.pageSize);

  return {
    search: search.length > 0 ? search : undefined,
    categoryId: toPositiveInt(q.categoryId),
    relatedSystemId: toPositiveInt(q.relatedSystemId),
    priority: typeof q.priority === "string" && PRIORITIES.includes(q.priority) ? q.priority : undefined,
    status: typeof q.status === "string" && STATUSES.includes(q.status) ? q.status : undefined,
    sort: SORT_FIELDS.includes(q.sort as SortField) ? (q.sort as SortField) : "ticketDate",
    order: q.order === "asc" ? "asc" : "desc",
    page: page && page >= 1 ? page : 1,
    pageSize: pageSize && (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 10,
  };
}
