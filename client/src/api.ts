const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Every request sends the session cookie; the acting user is derived from it on
// the server, never from a client-supplied id (Lab 3 auth, BR-03).
const CREDENTIALS: RequestCredentials = "include";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
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
  constructor(fields: Record<string, string>, message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/** Thrown on a 401 so callers can route to the login screen. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

/** Thrown on a 403 password-gate refusal so the app can route to Change Password. */
export class PasswordChangeRequiredError extends Error {
  constructor() {
    super("Password change required");
    this.name = "PasswordChangeRequiredError";
  }
}

/** Thrown on a 404 so Ticket Detail can show its not-found state distinctly. */
export class NotFoundError extends Error {
  constructor() {
    super("Not found");
    this.name = "NotFoundError";
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { credentials: CREDENTIALS, ...init });
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// --- Authentication ----------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await request("/api/auth/login", jsonInit("POST", { email, password }));
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    throw new ValidationError(body.fields ?? {});
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Email or password is incorrect.");
  }
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
  return res.json();
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

// Returns the signed-in user, or null when there is no valid session.
export async function getMe(): Promise<AuthUser | null> {
  const res = await request("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Session check failed: HTTP ${res.status}`);
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await request("/api/auth/password", jsonInit("POST", { currentPassword, newPassword }));
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    throw new ValidationError(body.fields ?? {});
  }
  if (!res.ok) throw new Error(`Change password failed: HTTP ${res.status}`);
}

// Maps a protected-route response to the shared error types so screens can react
// to auth/gate refusals uniformly.
function guard(res: Response): void {
  if (res.status === 401) throw new UnauthenticatedError();
  if (res.status === 403) throw new PasswordChangeRequiredError();
}

// --- Reference data ----------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const res = await request("/api/categories");
  guard(res);
  if (!res.ok) throw new Error(`Categories request failed: HTTP ${res.status}`);
  return res.json();
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await request("/api/related-systems");
  guard(res);
  if (!res.ok) throw new Error(`Related systems request failed: HTTP ${res.status}`);
  return res.json();
}

// --- Tickets -----------------------------------------------------------------

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

export async function getTickets(
  params: TicketListParams,
  opts: { signal?: AbortSignal } = {}
): Promise<TicketListResponse> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const res = await request(`/api/tickets?${qs.toString()}`, { signal: opts.signal });
  guard(res);
  if (!res.ok) throw new Error(`Tickets request failed: HTTP ${res.status}`);
  return res.json();
}

export interface Attachment {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  removedBy: { id: number; name: string } | null;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requester: { id: number; name: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  requestedPriority: RequestedPriority;
  currentStatus: string;
  ticketDate: string;
  resolutionSignalledAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

export async function getTicket(id: number): Promise<TicketDetail> {
  const res = await request(`/api/tickets/${id}`);
  guard(res);
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`Ticket request failed: HTTP ${res.status}`);
  return res.json();
}

export async function getTicketAttachments(ticketId: number): Promise<Attachment[]> {
  const res = await request(`/api/tickets/${ticketId}/attachments`);
  guard(res);
  if (!res.ok) throw new Error(`Attachments request failed: HTTP ${res.status}`);
  return res.json();
}

// Maps the server's rejection statuses to the specific reason the row must show
// (BR-52), so the user never sees a generic "upload failed".
export async function uploadAttachment(ticketId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await request(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: form });
  guard(res);
  if (!res.ok) {
    const messages: Record<number, string> = {
      413: "File exceeds the 5 MB limit.",
      415: "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.",
      409: "Maximum of 5 attachments reached.",
    };
    throw new Error(messages[res.status] ?? "Unable to upload the file. Please try again.");
  }
  return res.json();
}

export async function removeAttachment(attachmentId: number, reason: string): Promise<Attachment> {
  const res = await request(`/api/attachments/${attachmentId}`, jsonInit("DELETE", { reason }));
  guard(res);
  if (!res.ok) throw new Error(`Remove failed: HTTP ${res.status}`);
  return res.json();
}

// Fetches the bytes with the session cookie (a plain <a href> cannot guarantee it)
// and triggers a browser save.
export async function downloadAttachment(attachmentId: number, filename: string): Promise<void> {
  const res = await request(`/api/attachments/${attachmentId}/download`);
  guard(res);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Creates one Ticket. Throws ValidationError on a 400 so the form can show
// per-field messages (BR-44).
export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  const res = await request("/api/tickets", jsonInit("POST", input));
  guard(res);
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    throw new ValidationError(body.fields ?? {});
  }
  if (!res.ok) throw new Error(`Create ticket failed: HTTP ${res.status}`);
  return res.json();
}

// --- Public Comments and the resolution signal (Lab 3 Issue 4) ----------------

export interface Comment {
  id: number;
  body: string;
  author: { id: number; name: string; role: Role };
  createdAt: string;
}

export interface ResolutionSignal {
  resolutionSignalledAt: string;
  resolutionSignalledBy: { id: number; name: string };
  currentStatus: string;
}

export async function getComments(ticketId: number): Promise<Comment[]> {
  const res = await request(`/api/tickets/${ticketId}/comments`);
  guard(res);
  if (!res.ok) throw new Error(`Comments request failed: HTTP ${res.status}`);
  return res.json();
}

// Posts a Public Comment. Throws ValidationError on a 400 so the composer can show
// the field message (BR-44).
export async function postComment(ticketId: number, body: string): Promise<Comment> {
  const res = await request(`/api/tickets/${ticketId}/comments`, jsonInit("POST", { body }));
  guard(res);
  if (res.status === 400) {
    const errBody = await res.json().catch(() => ({}));
    throw new ValidationError(errBody.fields ?? {});
  }
  if (!res.ok) throw new Error(`Post comment failed: HTTP ${res.status}`);
  return res.json();
}

export async function signalResolution(ticketId: number): Promise<ResolutionSignal> {
  const res = await request(`/api/tickets/${ticketId}/resolution-signal`, { method: "POST" });
  guard(res);
  if (!res.ok) throw new Error(`Resolution signal failed: HTTP ${res.status}`);
  return res.json();
}
