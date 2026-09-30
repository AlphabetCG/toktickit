// The ticket status workflow (specification §5.7). Pure and synchronous so every
// cell of the matrix can be asserted directly (UNIT-06…UNIT-08); the status route
// re-checks it inside the writing transaction (BR-35).

export type Status =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

// Rows are the current status; each list is the permitted targets. CLOSED and
// CANCELLED are terminal — no transition leaves them (BR-36).
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export const STATUSES = Object.keys(TRANSITIONS) as Status[];

export const TERMINAL: readonly Status[] = ["CLOSED", "CANCELLED"];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export function isTerminal(status: Status): boolean {
  return TERMINAL.includes(status);
}

export function permittedTransitions(from: Status): Status[] {
  return [...TRANSITIONS[from]];
}

export function isTransitionPermitted(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

// Human-readable names for conflict messages, e.g.
// "Cannot move a Resolved ticket to In Progress." (api-spec §6.3).
export const STATUS_LABEL: Record<Status, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};
