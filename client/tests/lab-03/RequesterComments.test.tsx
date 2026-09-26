import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequesterTicketDetail } from "../../src/screens/RequesterTicketDetail.js";
import * as api from "../../src/api.js";

// UI-14…UI-16 (docs/lab-03/tests.md §2.5). The Requester's half of the ticket
// conversation, on the Requester Ticket Detail screen.
vi.mock("../../src/api.js");
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Somchai Prasert", email: "s@t.test", role: "REQUESTER" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const getTicket = vi.mocked(api.getTicket);
const getComments = vi.mocked(api.getComments);
const postComment = vi.mocked(api.postComment);
const signalResolution = vi.mocked(api.signalResolution);

const TICKET: api.TicketDetail = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  summary: "Laptop battery drains quickly",
  description: "The battery drops from full to nearly empty within an hour.",
  requester: { id: 1, name: "Somchai Prasert", email: "s@t.test" },
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

describe("Requester comments and resolution signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTicket.mockResolvedValue(TICKET);
    getComments.mockResolvedValue([]);
  });

  // UI-14 — AC-22
  it("UI-14: posting a comment submits, clears the composer, and shows the comment", async () => {
    const user = userEvent.setup();
    postComment.mockResolvedValue({
      id: 5,
      body: "Any update on this?",
      author: { id: 1, name: "Somchai Prasert", role: "REQUESTER" },
      createdAt: new Date().toISOString(),
    });
    renderDetail();

    const box = await screen.findByLabelText("Add a comment");
    await user.type(box, "Any update on this?");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    expect(postComment).toHaveBeenCalledWith(1, "Any update on this?");
    expect(await screen.findByText("Any update on this?")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a comment")).toHaveValue(""); // cleared
  });

  // UI-15 — AC-25
  it("UI-15: signalling resolution confirms, shows the signalled state, and leaves the status badge unchanged", async () => {
    const user = userEvent.setup();
    signalResolution.mockResolvedValue({
      resolutionSignalledAt: new Date().toISOString(),
      resolutionSignalledBy: { id: 1, name: "Somchai Prasert" },
      currentStatus: "NEW",
    });
    renderDetail();

    await user.click(await screen.findByRole("button", { name: "Problem appears resolved" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /looks resolved/i }));

    expect(signalResolution).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/reported this resolved/i)).toBeInTheDocument();
    // The status badge is unchanged (still New), and the action is gone.
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Problem appears resolved" })).not.toBeInTheDocument();
  });

  // UI-16 — AC-24, BR-24
  it("UI-16: the Requester detail shows no Internal Notes region or note composer", async () => {
    renderDetail();
    await screen.findByText("Public Comments");

    expect(screen.queryByText(/Internal Notes?/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Add an internal note/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add note/i })).not.toBeInTheDocument();
  });
});
