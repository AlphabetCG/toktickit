const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  currentStatus: string;
  ticketDate: string;
  requesterId: number;
}

/** Thrown when the backend rejects a submission with per-field messages (400). */
export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super("Validation failed");
    this.name = "ValidationError";
    this.fields = fields;
  }
}

// Every scoped request carries the Development Requester identity as a header,
// shaped like the auth header Lab 3 will replace it with (api-spec §1.2).
function scoped(requesterId: number, extra: HeadersInit = {}): HeadersInit {
  return { "X-Requester-Id": String(requesterId), ...extra };
}

// Active Development Requesters for the selection screen. Public endpoint.
export async function getRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) throw new Error(`Requesters request failed: HTTP ${res.status}`);
  return res.json();
}

export async function getCategories(requesterId: number): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`, { headers: scoped(requesterId) });
  if (!res.ok) throw new Error(`Categories request failed: HTTP ${res.status}`);
  return res.json();
}

export async function getRelatedSystems(requesterId: number): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`, { headers: scoped(requesterId) });
  if (!res.ok) throw new Error(`Related systems request failed: HTTP ${res.status}`);
  return res.json();
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  currentStatus: string;
  ticketDate: string;
  updatedAt: string;
}

export interface TicketListResponse {
  items: TicketListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListParams {
  search?: string;
  categoryId?: string;
  relatedSystemId?: string;
  priority?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

// The selected Requester's Tickets, paginated. Accepts an AbortSignal so a slow
// earlier response can be discarded rather than overwriting a newer one.
export async function getTickets(
  requesterId: number,
  params: TicketListParams,
  opts: { signal?: AbortSignal } = {}
): Promise<TicketListResponse> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const res = await fetch(`${API_URL}/api/tickets?${qs.toString()}`, {
    headers: scoped(requesterId),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Tickets request failed: HTTP ${res.status}`);
  return res.json();
}

// Creates one Ticket. Throws ValidationError on a 400 so the form can show
// per-field messages (BR-44), and a plain Error on any other failure so the form
// can show a safe message while preserving entered values (BR-46).
export async function createTicket(
  requesterId: number,
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: scoped(requesterId, { "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    throw new ValidationError(body.fields ?? {});
  }
  if (!res.ok) throw new Error(`Create ticket failed: HTTP ${res.status}`);
  return res.json();
}
