// Normalises the IT Staff queue query string (specification §9.3, api-spec §7.1).
// Invalid parameters never fail the request — each falls back to its documented
// default (continuing Lab 2 BR-36). Pure and synchronous for UNIT-05.
import { TICKET_STATUSES } from "./ticketQuery.js";

export const QUEUE_SORT_FIELDS = ["ticketDate", "updatedAt", "itPriority", "ticketNumber"] as const;
export type QueueSortField = (typeof QUEUE_SORT_FIELDS)[number];
export const QUEUE_PAGE_SIZES = [10, 20, 50] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

// `ownerId` is an integer, the literal "unassigned", or "me" (resolved to the
// caller server-side so the client never interpolates its own identity).
export type OwnerFilter = { kind: "user"; id: number } | { kind: "unassigned" } | { kind: "me" };

export interface NormalizedQueueQuery {
  search?: string;
  status?: string;
  itPriority?: string;
  categoryId?: number;
  owner?: OwnerFilter;
  sort: QueueSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}

function toPositiveInt(raw: unknown): number | undefined {
  return typeof raw === "string" && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : undefined;
}

function toOwner(raw: unknown): OwnerFilter | undefined {
  if (raw === "unassigned") return { kind: "unassigned" };
  if (raw === "me") return { kind: "me" };
  const id = toPositiveInt(raw);
  return id ? { kind: "user", id } : undefined;
}

export function normalizeQueueQuery(q: Record<string, unknown>): NormalizedQueueQuery {
  const search = typeof q.search === "string" ? q.search.trim() : "";
  const pageSize = toPositiveInt(q.pageSize);

  return {
    search: search.length > 0 ? search : undefined,
    status: typeof q.status === "string" && (TICKET_STATUSES as readonly string[]).includes(q.status) ? q.status : undefined,
    itPriority: typeof q.itPriority === "string" && PRIORITIES.includes(q.itPriority) ? q.itPriority : undefined,
    categoryId: toPositiveInt(q.categoryId),
    owner: toOwner(q.ownerId),
    sort: QUEUE_SORT_FIELDS.includes(q.sort as QueueSortField) ? (q.sort as QueueSortField) : "updatedAt",
    order: q.order === "asc" ? "asc" : "desc",
    page: toPositiveInt(q.page) ?? 1,
    pageSize: pageSize && (QUEUE_PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 20,
  };
}
