// Meaning is always carried by text; colour only reinforces it (AC-39).

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
// The eight-status lifecycle (Lab 3, ui-spec §3.1). Lab 2 only had NEW, which
// left every other status rendering as an empty badge once Lab 3 data existed.
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

const PRIORITY_LABEL: Record<RequestedPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

// Class suffixes are the ui-spec §3.1 names, which are not always the enum value.
const STATUS_CLASS: Record<TicketStatus, string> = {
  NEW: "new",
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  WAITING_FOR_REQUESTER: "waiting",
  RESOLVED: "resolved",
  CLOSED: "closed",
  REOPENED: "reopened",
  CANCELLED: "cancelled",
};

export function PriorityBadge({ value }: { value: RequestedPriority }) {
  return (
    <span className={`zg-badge zg-badge--priority-${value.toLowerCase()}`}>
      {PRIORITY_LABEL[value]}
    </span>
  );
}

// Shared so selects and messages use the exact badge wording.
export function statusLabel(value: TicketStatus): string {
  return STATUS_LABEL[value];
}

export function StatusBadge({ value }: { value: TicketStatus }) {
  return (
    <span className={`zg-badge zg-badge--status-${STATUS_CLASS[value]}`}>
      {STATUS_LABEL[value]}
    </span>
  );
}

export function RemovedBadge() {
  return <span className="zg-badge zg-badge--removed">Removed</span>;
}
