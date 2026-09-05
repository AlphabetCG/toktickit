import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import { RequesterSelection } from "../../src/screens/RequesterSelection.js";
import { RequesterProvider } from "../../src/requester.js";
import * as api from "../../src/api.js";

// UI-01…UI-04 from docs/lab-02/tests.md. Behaviour contract: ui-spec §8.1.
vi.mock("../../src/api.js");
const getRequesters = vi.mocked(api.getRequesters);

const ACTIVE = [
  { id: 1, name: "Somchai Prasert", email: "somchai.prasert@toktickit.test" },
  { id: 2, name: "Nadia Rahman", email: "nadia.rahman@toktickit.test" },
];

function renderSelection() {
  return render(
    <MemoryRouter initialEntries={["/select"]}>
      <RequesterProvider>
        <RequesterSelection />
      </RequesterProvider>
    </MemoryRouter>
  );
}

describe("Development Requester Selection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // UI-01 — AC-02
  it("UI-01: lists only the active Requesters returned by the API", async () => {
    getRequesters.mockResolvedValue(ACTIVE);
    renderSelection();

    const select = await screen.findByLabelText(/Development Requester/);
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "Choose a requester…",
      "Somchai Prasert — somchai.prasert@toktickit.test",
      "Nadia Rahman — nadia.rahman@toktickit.test",
    ]);
  });

  it("states it is not a login and that authentication arrives in Lab 3 (BR-61)", async () => {
    getRequesters.mockResolvedValue(ACTIVE);
    renderSelection();

    expect(await screen.findByText(/not a login screen/i)).toBeInTheDocument();
    expect(screen.getByText(/Lab 3/i)).toBeInTheDocument();
  });

  it("keeps Continue disabled until a Requester is chosen", async () => {
    getRequesters.mockResolvedValue(ACTIVE);
    renderSelection();

    const cont = await screen.findByRole("button", { name: "Continue" });
    expect(cont).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/Development Requester/), "1");
    expect(cont).toBeEnabled();
  });

  // UI-03 — AC-05, BR-23
  it("UI-03: shows a safe error with retry when the Requester API fails, and cannot be entered", async () => {
    getRequesters.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(ACTIVE);
    renderSelection();

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();

    // Retry recovers.
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
  });

  // UI-04 — AC-06, BR-24
  it("UI-04: shows an explanatory empty state, not an empty dropdown, when no active Requesters", async () => {
    getRequesters.mockResolvedValue([]);
    renderSelection();

    expect(await screen.findByText(/No active Requesters/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  // UI-02 — AC-03, BR-21 (persistence restored on mount; shell shows the name)
  it("UI-02: restores a stored selection on reload and shows the name in the shell", async () => {
    localStorage.setItem("toktickit.requester", JSON.stringify(ACTIVE[0]));
    getRequesters.mockResolvedValue(ACTIVE);

    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: "Change Requester" })).toBeInTheDocument();
    expect(screen.getAllByText("Somchai Prasert").length).toBeGreaterThan(0);
    expect(screen.queryByText(/not a login screen/i)).not.toBeInTheDocument();
  });
});
