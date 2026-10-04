import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { StatusBadge, RoleBadge, type TicketStatus, type UserRole } from "../../src/components/Badge.js";
import { StaffTicketDetail } from "../../src/screens/StaffTicketDetail.js";
import { InternalNotes } from "../../src/components/InternalNotes.js";
import * as api from "../../src/api.js";

vi.mock("../../src/api.js");
vi.mock("../../src/auth.js", () => {
  const user = { id: 4, name: "Anong Srisai", email: "a@t.test", role: "IT_STAFF" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

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

// STYLE-04 — ui-spec §6.4: on IT Staff Ticket Detail the operational fields use the
// editable control style, and Requester-owned information is read-only text in
// label/value pairs, never a disabled input.
describe("STYLE-04: editable operations vs read-only ticket information", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getAssignees).mockResolvedValue([{ id: 4, name: "Anong Srisai", role: "IT_STAFF" }]);
    vi.mocked(api.getComments).mockResolvedValue([]);
    vi.mocked(api.getTicket).mockResolvedValue({
      id: 12,
      ticketNumber: "TKT-2026-000012",
      summary: "Laptop battery drains quickly",
      description: "The battery drops from full to nearly empty within an hour.",
      requester: { id: 1, name: "Somchai Prasert", email: "s@t.test" },
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "IN_PROGRESS",
      owner: null,
      ticketDate: "2026-09-01T09:14:00.000Z",
      resolutionSignalledAt: null,
      createdAt: "2026-09-01T09:14:00.000Z",
      updatedAt: "2026-09-03T11:02:00.000Z",
      attachments: [],
      internalNotes: [],
      permittedTransitions: ["RESOLVED"],
    });
  });

  it("gives every operational field the editable class, and the information panel no controls", async () => {
    render(
      <MemoryRouter initialEntries={["/staff/tickets/12"]}>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </MemoryRouter>
    );

    for (const label of ["Owner", "IT Priority", "Status"]) {
      const control = await screen.findByLabelText(label);
      expect(control).toHaveClass("zg-field");
      expect(control).not.toHaveClass("zg-field--readonly");
      expect(control).toBeEnabled();
    }

    const info = screen.getByTestId("ticket-information");
    expect(within(info).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(info).queryAllByRole("combobox")).toHaveLength(0);
    expect(within(info).getByText("Somchai Prasert (s@t.test)")).toHaveClass("zg-info__value");
  });
});

// STYLE-05 — AC-42, BR-47: the audience label is present and announced with the input.
describe("STYLE-05: the Internal Note audience marker", () => {
  it("is present beside the composer and programmatically associated with it", () => {
    render(<InternalNotes ticketId={12} initial={[]} />);
    const input = screen.getByLabelText("Add an internal note");
    const marker = screen.getByText("Visible to IT Staff only", { selector: "#note-audience" });

    expect(marker).toBeInTheDocument();
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(marker.id);
    expect(input).toHaveAccessibleDescription(/Visible to IT Staff only/);
  });
});

// STYLE-03 — ui-spec §3.3: each role renders as an outlined badge carrying its name
// as text, with the spec's class names. The Lab 3 shell had emitted enum-derived
// classes (zg-badge--role-it_staff / -administrator) that the spec never defined.
describe("STYLE-03: role badge", () => {
  it.each([
    ["REQUESTER", "Requester", "zg-badge--role-requester"],
    ["IT_STAFF", "IT Staff", "zg-badge--role-staff"],
    ["ADMINISTRATOR", "Administrator", "zg-badge--role-admin"],
  ] as [UserRole, string, string][])("renders %s as the text %s with %s", (value, label, cls) => {
    render(<RoleBadge value={value} />);
    expect(screen.getByText(label)).toHaveClass("zg-badge", cls);
  });

  it("styles every role badge as an outline, distinct from the filled status badges", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src", "theme.css"), "utf8");
    const rule = /\.zg-badge--role-requester,\s*\.zg-badge--role-staff,\s*\.zg-badge--role-admin\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/background:\s*transparent/);
    expect(rule).toMatch(/--zg-border-strong/);
  });
});
