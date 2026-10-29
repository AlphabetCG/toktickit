import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { StaffTicketDetail } from "../../src/screens/StaffTicketDetail.js";
import { StatusHistory } from "../../src/components/StatusHistory.js";
import * as api from "../../src/api.js";

// UI-15…UI-22 (docs/lab-04/tests.md §2.7). Contract: ui-spec §2.8, §7.4, §7.5, §8.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return {
    ...real,
    getTicket: vi.fn(),
    getAssignees: vi.fn(),
    getComments: vi.fn(),
    getActions: vi.fn(),
    getStatusHistory: vi.fn(),
    setTicketStatus: vi.fn(),
    setTicketOwner: vi.fn(),
    setItPriority: vi.fn(),
  };
});
vi.mock("../../src/auth.js", () => {
  const user = { id: 4, name: "Anong Srisai", email: "a@t.test", role: "IT_STAFF" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const getTicket = vi.mocked(api.getTicket);
const getActions = vi.mocked(api.getActions);
const getStatusHistory = vi.mocked(api.getStatusHistory);
const setTicketStatus = vi.mocked(api.setTicketStatus);

const UNMET = [
  { code: "noCompletedAction", message: "Complete at least one action." },
  { code: "openAction", message: "Finish or cancel 1 open action." },
];

const ticket = (over: Partial<api.TicketDetail> = {}): api.TicketDetail => ({
  id: 12,
  ticketNumber: "TKT-2026-000012",
  summary: "Laptop battery drains quickly",
  description: "The battery drops from full to nearly empty within an hour.",
  requester: { id: 1, name: "Somchai Prasert", email: "s@t.test" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  itPriority: "MEDIUM",
  currentStatus: "IN_PROGRESS",
  owner: null,
  ticketDate: "2026-09-01T09:14:00.000Z",
  resolutionSignalledAt: null,
  createdAt: "2026-09-01T09:14:00.000Z",
  updatedAt: "2026-09-03T11:02:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
  version: 3,
  resolvedAt: null,
  resolutionGate: { satisfied: false, unmet: UNMET },
  permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"],
  ...over,
});

const planned: api.ActionTaken = {
  id: 31,
  ticketId: 12,
  actionAt: "2026-09-02T02:30:00.000Z",
  description: "Replace the laptop battery",
  result: "",
  status: "PLANNED",
  performedBy: { id: 4, name: "Anong Srisai" },
  createdBy: { id: 4, name: "Anong Srisai" },
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
  version: 1,
  completedAt: null,
  createdAt: "2026-09-02T02:20:00.000Z",
  updatedAt: "2026-09-02T02:20:00.000Z",
};

const HISTORY: api.StatusHistoryEntry[] = [
  { id: 1, fromStatus: null, toStatus: "NEW", changedAt: "2026-09-01T09:14:00.000Z", actor: { kind: "requester", id: 1, name: "Somchai Prasert" } },
  { id: 2, fromStatus: "NEW", toStatus: "IN_PROGRESS", changedAt: "2026-09-02T01:00:00.000Z", actor: { kind: "staff", id: 4, name: "Anong Srisai" } },
];

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/staff/tickets/12"]}>
      <Routes>
        <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

const operations = () => screen.getByRole("region", { name: "Ticket Operations" });
const statusSelect = () => within(operations()).getByLabelText("Status") as HTMLSelectElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getAssignees).mockResolvedValue([{ id: 4, name: "Anong Srisai", role: "IT_STAFF" }]);
  vi.mocked(api.getComments).mockResolvedValue([]);
  getActions.mockResolvedValue([planned]);
  getStatusHistory.mockResolvedValue(HISTORY);
});

// UI-15 — AC-29
it("UI-15: with the gate unmet, Resolved is not offered and the reasons are listed", async () => {
  getTicket.mockResolvedValue(ticket());
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });
  expect(within(statusSelect()).queryByRole("option", { name: "Resolved" })).not.toBeInTheDocument();
  const gate = within(operations()).getByText("To resolve this ticket:").closest(".zg-gate")!;
  expect(gate).toHaveTextContent("Complete at least one action.");
  expect(gate).toHaveTextContent("Finish or cancel 1 open action.");
});

// UI-16 — AC-29
it("UI-16: with the gate met, Resolved is offered and no reasons are listed", async () => {
  getTicket.mockResolvedValue(
    ticket({
      resolutionGate: { satisfied: true, unmet: [] },
      permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    })
  );
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });
  expect(within(statusSelect()).getByRole("option", { name: "Resolved" })).toBeInTheDocument();
  expect(within(operations()).queryByText("To resolve this ticket:")).not.toBeInTheDocument();
});

it("hides the gate list when Resolved is not reachable from the current status", async () => {
  getTicket.mockResolvedValue(ticket({ currentStatus: "NEW", permittedTransitions: ["OPEN", "IN_PROGRESS", "CANCELLED"] }));
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });
  expect(within(operations()).queryByText("To resolve this ticket:")).not.toBeInTheDocument();
});

// UI-17 — AC-30, FR-08
it("UI-17: a change sends expectedVersion and refreshes the badge, the options, and the history without a reload", async () => {
  getTicket.mockResolvedValue(ticket());
  setTicketStatus.mockResolvedValue({
    id: 12,
    currentStatus: "WAITING_FOR_REQUESTER",
    version: 4,
    resolvedAt: null,
    permittedTransitions: ["IN_PROGRESS", "CANCELLED"],
    cancelledActions: 0,
  });
  const user = userEvent.setup();
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });
  await screen.findByText("New → In Progress", { exact: false }).catch(() => undefined);
  const historyCalls = getStatusHistory.mock.calls.length;

  await user.selectOptions(statusSelect(), "WAITING_FOR_REQUESTER");
  await user.click(within(operations()).getByRole("button", { name: "Apply" }));

  expect(setTicketStatus).toHaveBeenCalledWith(12, "WAITING_FOR_REQUESTER", 3);
  await waitFor(() => expect(screen.getAllByText("Waiting for Requester")[0]).toHaveClass("zg-badge"));
  expect(within(statusSelect()).getByRole("option", { name: "In Progress" })).toBeInTheDocument();
  expect(within(statusSelect()).queryByRole("option", { name: "Waiting for Requester" })).not.toBeInTheDocument();
  await waitFor(() => expect(getStatusHistory.mock.calls.length).toBeGreaterThan(historyCalls));
  expect(getTicket).toHaveBeenCalledTimes(1); // no page reload
});

// UI-18 — AC-40
it("UI-18: a stale status change shows the conflict banner and keeps the chosen target", async () => {
  getTicket.mockResolvedValue(ticket());
  setTicketStatus.mockRejectedValue(
    new api.ConflictError("This ticket was changed by someone else. Reload to see the latest version.", "stale", {
      version: 4,
      currentStatus: "WAITING_FOR_REQUESTER",
      owner: null,
      itPriority: "HIGH",
    })
  );
  const user = userEvent.setup();
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });
  await user.selectOptions(statusSelect(), "CANCELLED");
  await user.selectOptions(statusSelect(), "WAITING_FOR_REQUESTER");
  await user.click(within(operations()).getByRole("button", { name: "Apply" }));

  const banner = await within(operations()).findByRole("alert");
  expect(banner).toHaveClass("zg-callout--conflict");
  expect(banner).toHaveTextContent("This ticket was changed by someone else.");
  expect(banner).toHaveTextContent("Status is now Waiting for Requester.");
  expect(statusSelect()).toHaveValue("WAITING_FOR_REQUESTER");

  getTicket.mockResolvedValue(ticket({ currentStatus: "WAITING_FOR_REQUESTER", version: 4, permittedTransitions: ["IN_PROGRESS", "CANCELLED"] }));
  await user.click(within(banner).getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(within(operations()).queryByRole("alert")).not.toBeInTheDocument());
  expect(getTicket).toHaveBeenCalledTimes(2);
});

// UI-19 — FR-09, BR-34
it("UI-19: history is oldest first and a backfilled entry reads Recorded at upgrade", async () => {
  getStatusHistory.mockResolvedValue([
    { id: 5, fromStatus: null, toStatus: "OPEN", changedAt: "2026-08-30T01:00:00.000Z", actor: { kind: "system" } },
    ...HISTORY,
  ]);
  render(<StatusHistory ticketId={12} viewer="staff" />);
  const items = await screen.findAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent("Open");
  expect(within(items[0]).getByText("Recorded at upgrade")).toBeInTheDocument();
  expect(items[1]).toHaveTextContent("Somchai Prasert");
  expect(items[2]).toHaveTextContent("Anong Srisai");
  // The arrow is text, read as "to" (ui-spec §2.8).
  expect(within(items[2]).getByText("to")).toHaveClass("zg-visually-hidden");
  expect(screen.getByRole("region", { name: "Status history" })).toBeInTheDocument();
});

// UI-20 — AC-36
it("UI-20: the Requester sees IT Support for staff changes and You for their own", async () => {
  getStatusHistory.mockResolvedValue([
    { ...HISTORY[0] },
    { ...HISTORY[1], actor: { kind: "staff" } },
  ]);
  render(<StatusHistory ticketId={12} viewer="requester" currentUserId={1} />);
  const items = await screen.findAllByRole("listitem");
  expect(within(items[0]).getByText("You")).toBeInTheDocument();
  expect(within(items[1]).getByText("IT Support")).toBeInTheDocument();
  expect(screen.queryByText("Anong Srisai")).not.toBeInTheDocument();
});

// UI-21 — BR-24, BR-20
it("UI-21: the cancel confirmation says how many open actions will also be cancelled", async () => {
  getTicket.mockResolvedValue(ticket());
  const user = userEvent.setup();
  renderDetail();
  await screen.findByText("Replace the laptop battery");
  await user.selectOptions(statusSelect(), "CANCELLED");
  await user.click(within(operations()).getByRole("button", { name: "Apply" }));
  const confirm = screen.getByRole("dialog", { name: "Cancel ticket" });
  expect(confirm).toHaveTextContent("1 open action will also be cancelled.");
});

// UI-22 — BR-27
it("UI-22: a gate refusal from the server lists the reasons and refreshes the Ticket", async () => {
  getTicket.mockResolvedValue(
    ticket({ resolutionGate: { satisfied: true, unmet: [] }, permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"] })
  );
  const unmet = [{ code: "openAction", message: "Finish or cancel 1 open action." }];
  setTicketStatus.mockRejectedValue(new api.ConflictError("This ticket cannot be resolved yet.", "resolutionGate", undefined, unmet));
  const user = userEvent.setup();
  renderDetail();
  await screen.findByRole("region", { name: "Ticket Operations" });

  getTicket.mockResolvedValue(ticket({ resolutionGate: { satisfied: false, unmet }, permittedTransitions: ["WAITING_FOR_REQUESTER", "CANCELLED"] }));
  await user.selectOptions(statusSelect(), "RESOLVED");
  await user.click(within(operations()).getByRole("button", { name: "Apply" }));

  await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
  const gate = await within(operations()).findByText("To resolve this ticket:");
  expect(gate.closest(".zg-gate")).toHaveTextContent("Finish or cancel 1 open action.");
  expect(within(statusSelect()).queryByRole("option", { name: "Resolved" })).not.toBeInTheDocument();
});
