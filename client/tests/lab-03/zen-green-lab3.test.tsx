import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, type TicketStatus } from "../../src/components/Badge.js";

// STYLE-02 — ui-spec §3.1 / §7.5: every status in the eight-value lifecycle renders
// through the shared badge with visible text. Lab 2's badge only knew NEW, so any
// other status rendered as an empty chip.
const EXPECTED: [TicketStatus, string, string][] = [
  ["NEW", "New", "zg-badge--status-new"],
  ["OPEN", "Open", "zg-badge--status-open"],
  ["IN_PROGRESS", "In Progress", "zg-badge--status-in-progress"],
  ["WAITING_FOR_REQUESTER", "Waiting for Requester", "zg-badge--status-waiting"],
  ["RESOLVED", "Resolved", "zg-badge--status-resolved"],
  ["REOPENED", "Reopened", "zg-badge--status-reopened"],
  ["CLOSED", "Closed", "zg-badge--status-closed"],
  ["CANCELLED", "Cancelled", "zg-badge--status-cancelled"],
];

describe("STYLE-02: status badge coverage", () => {
  it.each(EXPECTED)("renders %s as the text %s with its ui-spec class", (value, label, cls) => {
    render(<StatusBadge value={value} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveClass("zg-badge", cls);
  });

  it("gives every status a distinct label, so colour is never the only signal", () => {
    const labels = EXPECTED.map(([, label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
