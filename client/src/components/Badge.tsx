// Meaning is always carried by text; colour only reinforces it (AC-39).

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus = "NEW";

const PRIORITY_LABEL: Record<RequestedPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
};

export function PriorityBadge({ value }: { value: RequestedPriority }) {
  return (
    <span className={`zg-badge zg-badge--priority-${value.toLowerCase()}`}>
      {PRIORITY_LABEL[value]}
    </span>
  );
}

export function StatusBadge({ value }: { value: TicketStatus }) {
  return (
    <span className={`zg-badge zg-badge--status-${value.toLowerCase()}`}>
      {STATUS_LABEL[value]}
    </span>
  );
}

export function RemovedBadge() {
  return <span className="zg-badge zg-badge--removed">Removed</span>;
}
