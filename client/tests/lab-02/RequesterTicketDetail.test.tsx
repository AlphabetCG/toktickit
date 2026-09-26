import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import * as api from "../../src/api.js";

// UI-17 from docs/lab-02/tests.md. Contract: ui-spec §8.4, AC-23/BR-59.
vi.mock("../../src/api.js");
// The user object is hoisted so its identity is stable across renders — the
// detail screen's load effect depends on it.
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Somchai Prasert", email: "somchai@toktickit.test", role: "REQUESTER" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});
const getTicket = vi.mocked(api.getTicket);
const getComments = vi.mocked(api.getComments);

const TICKET: api.TicketDetail = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Laptop battery drains quickly",
  description: "The battery drops from full to nearly empty within an hour.",
  requester: { id: 1, name: "Somchai", email: "s@toktickit.test" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  ticketDate: "2026-08-26T09:14:00.000Z",
  resolutionSignalledAt: null,
  createdAt: "2026-08-26T09:14:00.000Z",
  updatedAt: "2026-08-26T09:14:00.000Z",
  attachments: [],
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/tickets/1"]}>
        <Routes>
          <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
        </Routes>
    </MemoryRouter>
  );
}

describe("Requester Ticket Detail", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // UI-17 — AC-23, BR-59
  it("renders ticket fields as read-only text, not editable controls", async () => {
    getTicket.mockResolvedValue(TICKET);
    getComments.mockResolvedValue([]);
    renderDetail();

    const summary = await screen.findByText("Laptop battery drains quickly");
    expect(screen.getByText("TKT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText(/Corporate Laptop/)).toBeInTheDocument();

    // The ticket information panel holds no editable control (the Public Comments
    // composer below is legitimately editable and lives outside this panel).
    const infoPanel = summary.closest(".zg-detail-info") as HTMLElement;
    expect(within(infoPanel).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(infoPanel).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a not-found state for another Requester's or a missing ticket", async () => {
    getTicket.mockRejectedValue(new api.NotFoundError());
    getComments.mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByText(/Ticket not found/i)).toBeInTheDocument();
  });
});
