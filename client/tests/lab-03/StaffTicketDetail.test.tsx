import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { StaffTicketDetail } from "../../src/screens/StaffTicketDetail.js";
import * as api from "../../src/api.js";

// UI-21…UI-25 (docs/lab-03/tests.md §2.5). Contract: ui-spec §6.4, §7.2.
vi.mock("../../src/api.js");
vi.mock("../../src/auth.js", () => {
  const user = { id: 4, name: "Anong Srisai", email: "a@t.test", role: "IT_STAFF" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const getTicket = vi.mocked(api.getTicket);
const getAssignees = vi.mocked(api.getAssignees);
const getComments = vi.mocked(api.getComments);
const setTicketOwner = vi.mocked(api.setTicketOwner);
const setItPriority = vi.mocked(api.setItPriority);
const setTicketStatus = vi.mocked(api.setTicketStatus);

const ASSIGNEES: api.Assignee[] = [
  { id: 4, name: "Anong Srisai", role: "IT_STAFF" },
  { id: 9, name: "Kittipong Sae-Lim", role: "ADMINISTRATOR" },
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
  permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  ...over,
});

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

describe("IT Staff Ticket Detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAssignees.mockResolvedValue(ASSIGNEES);
    getComments.mockResolvedValue([]);
  });

  // UI-21 — AC-33, AC-34
  describe("UI-21: ownership controls", () => {
    it("offers Claim when unassigned, and claiming sends the caller's own id", async () => {
      const user = userEvent.setup();
      getTicket.mockResolvedValue(ticket({ owner: null }));
      setTicketOwner.mockResolvedValue({ id: 12, owner: { id: 4, name: "Anong Srisai" } });
      renderDetail();

      await user.click(await within(await screen.findByRole("region", { name: "Ticket Operations" })).findByRole("button", { name: "Claim" }));
      expect(setTicketOwner).toHaveBeenCalledWith(12, 4);
      expect(await within(operations()).findByRole("button", { name: "Release" })).toBeInTheDocument();
      expect(within(operations()).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    });

    it("offers Release when assigned, and the owner select lists only permitted assignees", async () => {
      getTicket.mockResolvedValue(ticket({ owner: { id: 9, name: "Kittipong Sae-Lim" } }));
      renderDetail();

      const select = await within(await screen.findByRole("region", { name: "Ticket Operations" })).findByLabelText("Owner");
      await waitFor(() =>
        expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
          "Unassigned",
          "Anong Srisai",
          "Kittipong Sae-Lim",
        ])
      );
      expect(within(operations()).getByRole("button", { name: "Release" })).toBeInTheDocument();
      expect(within(operations()).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    });

    it("reassigns through the owner select", async () => {
      const user = userEvent.setup();
      getTicket.mockResolvedValue(ticket({ owner: { id: 4, name: "Anong Srisai" } }));
      setTicketOwner.mockResolvedValue({ id: 12, owner: { id: 9, name: "Kittipong Sae-Lim" } });
      renderDetail();

      const select = await within(await screen.findByRole("region", { name: "Ticket Operations" })).findByLabelText("Owner");
      await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
      await user.selectOptions(select, "9");
      expect(setTicketOwner).toHaveBeenCalledWith(12, 9);
    });
  });

  // UI-22 — AC-36
  it("UI-22: changing IT Priority issues the request; Requested Priority stays read-only", async () => {
    const user = userEvent.setup();
    getTicket.mockResolvedValue(ticket());
    setItPriority.mockResolvedValue({ id: 12, itPriority: "HIGH", requestedPriority: "MEDIUM" });
    renderDetail();

    await user.selectOptions(await screen.findByLabelText("IT Priority"), "HIGH");
    expect(setItPriority).toHaveBeenCalledWith(12, "HIGH");

    const info = screen.getByTestId("ticket-information");
    expect(within(info).getByText("Requested Priority")).toBeInTheDocument();
    expect(within(info).queryByRole("combobox")).not.toBeInTheDocument(); // no control for it
  });

  // UI-23 — AC-38, BR-38
  describe("UI-23: status control", () => {
    it("offers only the permitted transitions for the current status", async () => {
      getTicket.mockResolvedValue(ticket());
      renderDetail();

      const select = await screen.findByLabelText("Status");
      expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Choose a new status…",
        "Waiting for Requester",
        "Resolved",
        "Cancelled",
      ]);
    });

    it("requires confirmation before cancelling, and sends nothing until confirmed", async () => {
      const user = userEvent.setup();
      getTicket.mockResolvedValue(ticket());
      setTicketStatus.mockResolvedValue({ id: 12, currentStatus: "CANCELLED", permittedTransitions: [] });
      renderDetail();

      await user.selectOptions(await screen.findByLabelText("Status"), "CANCELLED");
      await user.click(within(operations()).getByRole("button", { name: "Apply" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("Cancelling is permanent. This ticket cannot be reopened.");
      expect(setTicketStatus).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Cancel ticket" }));
      expect(setTicketStatus).toHaveBeenCalledWith(12, "CANCELLED");
    });

    it("applies a non-terminal transition directly", async () => {
      const user = userEvent.setup();
      getTicket.mockResolvedValue(ticket());
      setTicketStatus.mockResolvedValue({
        id: 12,
        currentStatus: "RESOLVED",
        permittedTransitions: ["CLOSED", "REOPENED"],
      });
      renderDetail();

      await user.selectOptions(await screen.findByLabelText("Status"), "RESOLVED");
      await user.click(within(operations()).getByRole("button", { name: "Apply" }));

      expect(setTicketStatus).toHaveBeenCalledWith(12, "RESOLVED");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(within(screen.getByLabelText("Status")).getAllByRole("option").map((o) => o.textContent)).toEqual([
          "Choose a new status…",
          "Closed",
          "Reopened",
        ])
      );
    });

    it("shows a conflict inline and reloads the ticket's real state", async () => {
      const user = userEvent.setup();
      getTicket.mockResolvedValueOnce(ticket());
      getTicket.mockResolvedValueOnce(ticket({ currentStatus: "RESOLVED", permittedTransitions: ["CLOSED", "REOPENED"] }));
      setTicketStatus.mockRejectedValue(new Error("Cannot move a Resolved ticket to Waiting for Requester."));
      renderDetail();

      await user.selectOptions(await screen.findByLabelText("Status"), "WAITING_FOR_REQUESTER");
      await user.click(within(operations()).getByRole("button", { name: "Apply" }));

      expect(await within(operations()).findByRole("alert")).toHaveTextContent(/Cannot move a Resolved ticket/);
      await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
    });
  });

  // UI-24 — AC-42, BR-47
  it("UI-24: Public Comments and Internal Notes are separate regions with a persistent audience label", async () => {
    getTicket.mockResolvedValue(ticket());
    renderDetail();

    const comments = await screen.findByRole("region", { name: "Public Comments" });
    const notes = screen.getByRole("region", { name: "Internal Notes" });
    expect(comments).not.toBe(notes);
    expect(comments.contains(notes)).toBe(false);

    expect(within(notes).getByRole("heading", { name: /Internal Notes · Visible to IT Staff only/ })).toBeInTheDocument();
    const input = within(notes).getByLabelText("Add an internal note");
    expect(input).toHaveAccessibleDescription(/Visible to IT Staff only/);
    expect(within(notes).getByRole("button", { name: "Add note" })).toBeInTheDocument();
    expect(within(notes).queryByRole("button", { name: /Post/ })).not.toBeInTheDocument();
  });

  // UI-25 — AC-41
  it("UI-25: on a CLOSED ticket both composers are disabled with an explanation", async () => {
    getTicket.mockResolvedValue(ticket({ currentStatus: "CLOSED", permittedTransitions: [] }));
    renderDetail();

    const comments = await screen.findByRole("region", { name: "Public Comments" });
    const commentBox = await within(comments).findByLabelText("Add a comment");
    const noteBox = within(screen.getByRole("region", { name: "Internal Notes" })).getByLabelText("Add an internal note");

    for (const box of [commentBox, noteBox]) {
      expect(box).toBeDisabled();
      expect(box).toHaveAccessibleDescription(/closed and can no longer be updated/);
    }
    expect(within(operations()).queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });
});
