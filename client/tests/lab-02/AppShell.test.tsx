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

const ACTIVE = [
  { id: 1, name: "Somchai Prasert", email: "somchai.prasert@toktickit.test" },
  { id: 2, name: "Nadia Rahman", email: "nadia.rahman@toktickit.test" },
];

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
  it("UI-06: switching Requester shows the new name and clears the previous Requester's data", async () => {
    const user = userEvent.setup();
    localStorage.setItem("toktickit.requester", JSON.stringify(ACTIVE[0]));
    renderApp("/tickets");

    // Started as Requester A — the scoped screen shows A's identity.
    expect(await screen.findByText(/somchai\.prasert@toktickit\.test/)).toBeInTheDocument();

    // Change Requester → selection screen → pick Requester B → Continue.
    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await user.selectOptions(await screen.findByLabelText(/Development Requester/), "2");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // B is shown; none of A's data survives on screen (BR-22).
    expect(await screen.findByText(/nadia\.rahman@toktickit\.test/)).toBeInTheDocument();
    expect(screen.queryByText(/somchai\.prasert@toktickit\.test/)).not.toBeInTheDocument();
  });
});
