import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MyTickets } from "../../src/screens/MyTickets.js";
import { RequesterProvider } from "../../src/requester.js";
import * as api from "../../src/api.js";

// UI-12…UI-16 from docs/lab-02/tests.md. Behaviour contract: ui-spec §8.3.
vi.mock("../../src/api.js");
const getTickets = vi.mocked(api.getTickets);
const getCategories = vi.mocked(api.getCategories);
const getRelatedSystems = vi.mocked(api.getRelatedSystems);

const REQUESTER = { id: 1, name: "Somchai", email: "s@toktickit.test" };

const item = (n: number, overrides: Partial<api.TicketListItem> = {}): api.TicketListItem => ({
  id: n,
  ticketNumber: `TKT-2026-${String(n).padStart(6, "0")}`,
  summary: `Summary number ${n}`,
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  ticketDate: "2026-08-26T09:14:00.000Z",
  updatedAt: "2026-08-26T09:14:00.000Z",
  ...overrides,
});

const listResponse = (overrides: Partial<api.TicketListResponse> = {}): api.TicketListResponse => ({
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  ...overrides,
});

function renderList() {
  localStorage.setItem("toktickit.requester", JSON.stringify(REQUESTER));
  return render(
    <MemoryRouter initialEntries={["/tickets"]}>
      <RequesterProvider>
        <MyTickets />
      </RequesterProvider>
    </MemoryRouter>
  );
}

describe("My Tickets", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getCategories.mockResolvedValue([
      { id: 1, name: "Hardware" },
      { id: 2, name: "Software" },
    ]);
    getRelatedSystems.mockResolvedValue([{ id: 7, name: "Corporate Laptop" }]);
  });

  // UI-12 — AC-15
  it("UI-12: renders rows from the API response", async () => {
    getTickets.mockResolvedValue(
      listResponse({ items: [item(1), item(2)], totalItems: 2, totalPages: 1 })
    );
    renderList();

    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("Summary number 1")).toBeInTheDocument();
  });

  // UI-13 — AC-16
  it("UI-13: typing a search term issues a request carrying that parameter", async () => {
    getTickets.mockResolvedValue(listResponse({ items: [item(1)], totalItems: 1, totalPages: 1 }));
    renderList();
    await screen.findByText("TKT-2026-000001");

    await userEvent.type(screen.getByLabelText("Search tickets"), "laptop");

    await waitFor(() =>
      expect(getTickets).toHaveBeenCalledWith(
        REQUESTER.id,
        expect.objectContaining({ search: "laptop" }),
        expect.anything()
      )
    );
  });

  // UI-14 — AC-21, BR-57
  it("UI-14: shows the 'no tickets yet' state with a create action", async () => {
    getTickets.mockResolvedValue(listResponse());
    renderList();

    expect(await screen.findByText(/No tickets yet/i)).toBeInTheDocument();
    // Both the header and the empty state offer a create action.
    expect(screen.getAllByRole("button", { name: /Create Ticket/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/match your filters/i)).not.toBeInTheDocument();
  });

  // UI-15 — AC-22, BR-57, BR-58
  it("UI-15: shows a distinct no-results state with a working Clear filters", async () => {
    getTickets.mockResolvedValue(listResponse());
    renderList();
    await screen.findByText(/No tickets yet/i);

    await userEvent.type(screen.getByLabelText("Search tickets"), "zzz");

    expect(await screen.findByText(/No tickets match your filters/i)).toBeInTheDocument();
    // Clear filters appears in both the toolbar and the no-results panel.
    const clears = screen.getAllByRole("button", { name: "Clear filters" });
    await userEvent.click(clears[0]);

    expect(screen.getByLabelText("Search tickets")).toHaveValue("");
    await waitFor(() =>
      expect(getTickets).toHaveBeenLastCalledWith(
        REQUESTER.id,
        expect.objectContaining({ search: "" }),
        expect.anything()
      )
    );
  });

  // UI-16 — AC-18
  it("UI-16: pagination reflects metadata and requests the chosen page", async () => {
    getTickets.mockResolvedValue(
      listResponse({
        items: Array.from({ length: 10 }, (_, i) => item(i + 1)),
        totalItems: 23,
        totalPages: 3,
      })
    );
    renderList();
    await screen.findByText("TKT-2026-000001");

    expect(screen.getByText(/Showing 1.*10 of 23/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() =>
      expect(getTickets).toHaveBeenLastCalledWith(
        REQUESTER.id,
        expect.objectContaining({ page: 2 }),
        expect.anything()
      )
    );
  });
});
