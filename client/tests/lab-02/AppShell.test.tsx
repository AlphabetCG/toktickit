import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

// UI-05 and UI-06 from docs/lab-02/tests.md — the Requester-driven behaviour the
// Issue #12 shell tests handed off to. Contract: BR-19, BR-22.
vi.mock("../../src/api.js");
const getRequesters = vi.mocked(api.getRequesters);
const getTickets = vi.mocked(api.getTickets);
const getCategories = vi.mocked(api.getCategories);
const getRelatedSystems = vi.mocked(api.getRelatedSystems);

const ACTIVE = [
  { id: 1, name: "Somchai Prasert", email: "somchai.prasert@toktickit.test" },
  { id: 2, name: "Nadia Rahman", email: "nadia.rahman@toktickit.test" },
];

const emptyList = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
} satisfies api.TicketListResponse;

function renderApp(path = "/tickets") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Requester context in the app shell", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getRequesters.mockResolvedValue(ACTIVE);
    getTickets.mockResolvedValue(emptyList);
    getCategories.mockResolvedValue([]);
    getRelatedSystems.mockResolvedValue([]);
  });

  // UI-05 — AC-01, BR-19
  it("UI-05: a ticket URL renders the selection screen when no Requester is selected", async () => {
    renderApp("/tickets");

    expect(await screen.findByText(/not a login screen/i)).toBeInTheDocument();
    // The guarded shell is not shown.
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  // UI-06 — AC-04, BR-22
  it("UI-06: switching Requester shows the new name and clears the previous one", async () => {
    const user = userEvent.setup();
    localStorage.setItem("toktickit.requester", JSON.stringify(ACTIVE[0]));
    renderApp("/tickets");

    // Started as Requester A — the shell identity shows A's name.
    expect(await screen.findByText("Somchai Prasert")).toBeInTheDocument();

    // Change Requester → selection screen → pick Requester B → Continue.
    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await user.selectOptions(await screen.findByLabelText(/Development Requester/), "2");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // The shell now shows B; the keyed remount leaves none of A's identity behind.
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.queryByText("Somchai Prasert")).not.toBeInTheDocument();
  });
});
