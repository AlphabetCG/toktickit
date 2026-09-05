import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CreateTicket } from "../../src/screens/CreateTicket.js";
import { RequesterProvider } from "../../src/requester.js";
import * as api from "../../src/api.js";

// UI-07…UI-11 from docs/lab-02/tests.md. Behaviour contract: ui-spec §8.2.
vi.mock("../../src/api.js");
const getCategories = vi.mocked(api.getCategories);
const getRelatedSystems = vi.mocked(api.getRelatedSystems);
const createTicket = vi.mocked(api.createTicket);

const CATEGORIES = [
  { id: 1, name: "Hardware" },
  { id: 2, name: "Software" },
];
const SYSTEMS = [
  { id: 7, name: "Corporate Laptop" },
  { id: 3, name: "VPN" },
];
const REQUESTER = { id: 1, name: "Somchai Prasert", email: "somchai@toktickit.test" };

function renderForm() {
  localStorage.setItem("toktickit.requester", JSON.stringify(REQUESTER));
  return render(
    <MemoryRouter initialEntries={["/tickets/new"]}>
      <RequesterProvider>
        <CreateTicket />
      </RequesterProvider>
    </MemoryRouter>
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText(/Category/), "1");
  await user.selectOptions(screen.getByLabelText(/Related System/), "7");
  await user.type(screen.getByLabelText(/Ticket Summary/), "Battery drains fast");
  await user.type(
    screen.getByLabelText(/Description/),
    "The battery drops from full to nearly empty within an hour of light use."
  );
}

describe("Create Ticket", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getCategories.mockResolvedValue(CATEGORIES);
    getRelatedSystems.mockResolvedValue(SYSTEMS);
  });

  // UI-07 — AC-10
  it("UI-07: renders Category and Related System options from the API", async () => {
    renderForm();

    const category = await screen.findByLabelText(/Category/);
    expect(within(category).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a category…",
      "Hardware",
      "Software",
    ]);

    const system = screen.getByLabelText(/Related System/);
    expect(within(system).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a related system…",
      "Corporate Laptop",
      "VPN",
    ]);
  });

  // UI-08 — AC-11, BR-44
  it("UI-08: an empty Summary shows a field message and makes no API call", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByLabelText(/Category/);

    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText(/Summary must be 5–150 characters/)).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  // UI-09 — AC-13, BR-43
  it("UI-09: a repeated click produces exactly one API call", async () => {
    const user = userEvent.setup();
    let resolve: (t: api.CreatedTicket) => void = () => {};
    createTicket.mockImplementation(() => new Promise((r) => (resolve = r)));

    renderForm();
    await fillValid(user);

    const submit = screen.getByRole("button", { name: "Submit Ticket" });
    await user.click(submit);
    await user.click(submit); // second rapid click while in-flight

    expect(submit).toBeDisabled();
    expect(createTicket).toHaveBeenCalledTimes(1);

    resolve({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      currentStatus: "NEW",
      ticketDate: new Date().toISOString(),
      requesterId: 1,
    });

    // Let the resolved submission settle so no state updates escape the test.
    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
  });

  // UI-10 — AC-14, BR-45, BR-46
  it("UI-10: a submission failure shows a safe error and preserves entered values", async () => {
    const user = userEvent.setup();
    createTicket.mockRejectedValue(new Error("network down"));

    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't create/i);
    expect(screen.getByLabelText(/Ticket Summary/)).toHaveValue("Battery drains fast");
    expect(screen.queryByText(/network down/)).not.toBeInTheDocument(); // no raw detail
  });

  // UI-11 — AC-07
  it("UI-11: the success state shows the Ticket Number and a next action", async () => {
    const user = userEvent.setup();
    createTicket.mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000042",
      currentStatus: "NEW",
      ticketDate: new Date().toISOString(),
      requesterId: 1,
    });

    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create another" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByLabelText(/Ticket Summary/)).not.toBeInTheDocument()
    );
  });
});
