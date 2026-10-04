import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StaffTicketQueue } from "../../src/screens/StaffTicketQueue.js";
import * as api from "../../src/api.js";

// UI-17…UI-20 (docs/lab-03/tests.md §2.5). Contract: ui-spec §6.3, api-spec §7.1.
vi.mock("../../src/api.js");
const getStaffQueue = vi.mocked(api.getStaffQueue);
const getCategories = vi.mocked(api.getCategories);

const ROW = (over: Partial<api.QueueItem> = {}): api.QueueItem => ({
  id: 12,
  ticketNumber: "TKT-2026-000012",
  summary: "Laptop battery drains quickly",
  category: { id: 2, name: "Hardware" },
  requester: { id: 1, name: "Somchai Prasert" },
  owner: { id: 4, name: "Anong Srisai" },
  requestedPriority: "MEDIUM",
  itPriority: "HIGH",
  currentStatus: "IN_PROGRESS",
  resolutionSignalled: false,
  ticketDate: "2026-09-01T09:14:00.000Z",
  updatedAt: "2026-09-03T11:02:00.000Z",
  ...over,
});

const page = (items: api.QueueItem[], totalItems = items.length): api.QueueResponse => ({
  items,
  page: 1,
  pageSize: 20,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / 20)),
  counts: { unassigned: 9, mine: 6 },
});

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={["/staff/tickets"]}>
      <StaffTicketQueue />
    </MemoryRouter>
  );
}

describe("IT Staff Ticket Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCategories.mockResolvedValue([{ id: 2, name: "Hardware" }]);
  });

  // UI-17 — AC-27
  it("UI-17: rows reflect the API, including owner, status, and the Unassigned word", async () => {
    getStaffQueue.mockResolvedValue(
      page([
        ROW(),
        ROW({ id: 13, ticketNumber: "TKT-2026-000013", summary: "VPN drops hourly", owner: null, currentStatus: "NEW", resolutionSignalled: true }),
      ])
    );
    renderQueue();

    const first = (await screen.findByText("TKT-2026-000012")).closest("tr") as HTMLElement;
    expect(within(first).getByText("Anong Srisai")).toBeInTheDocument();
    expect(within(first).getByText("In Progress")).toBeInTheDocument();
    expect(within(first).getByText("High")).toBeInTheDocument();

    const second = screen.getByText("TKT-2026-000013").closest("tr") as HTMLElement;
    expect(within(second).getByText("Unassigned")).toBeInTheDocument(); // a word, not an empty cell
    expect(within(second).getByText("Requester says resolved")).toBeInTheDocument();

    expect(screen.getByText(/9 unassigned · 6 assigned to me/)).toBeInTheDocument();
  });

  // UI-18 — AC-28, AC-29
  it("UI-18: search, status, IT Priority, and owner filters each send the right parameter", async () => {
    const user = userEvent.setup();
    getStaffQueue.mockResolvedValue(page([ROW()]));
    renderQueue();
    await screen.findByText("TKT-2026-000012");

    const lastParams = () => getStaffQueue.mock.calls.at(-1)![0];

    await user.selectOptions(screen.getByLabelText("Filter by status"), "WAITING_FOR_REQUESTER");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "WAITING_FOR_REQUESTER", page: 1 }));

    await user.selectOptions(screen.getByLabelText("Filter by IT priority"), "HIGH");
    await waitFor(() => expect(lastParams()).toMatchObject({ itPriority: "HIGH" }));

    await user.selectOptions(screen.getByLabelText("Filter by owner"), "unassigned");
    await waitFor(() => expect(lastParams()).toMatchObject({ ownerId: "unassigned" }));

    await user.selectOptions(screen.getByLabelText("Filter by owner"), "me");
    await waitFor(() => expect(lastParams()).toMatchObject({ ownerId: "me" }));

    await user.type(screen.getByLabelText("Search tickets"), "battery");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "battery" }));
  });

  // UI-19 — AC-32, BR-57
  describe("UI-19: empty and no-results are distinct", () => {
    it("shows the empty state with no Clear filters when nothing is filtered", async () => {
      getStaffQueue.mockResolvedValue(page([]));
      renderQueue();

      expect(await screen.findByRole("heading", { name: "No tickets in the queue" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    });

    it("shows no-results with a working Clear filters when a filter matches nothing", async () => {
      const user = userEvent.setup();
      getStaffQueue.mockResolvedValue(page([]));
      renderQueue();
      await screen.findByRole("heading", { name: "No tickets in the queue" });

      await user.selectOptions(screen.getByLabelText("Filter by status"), "REOPENED");
      expect(await screen.findByRole("heading", { name: "No tickets match your filters" })).toBeInTheDocument();

      const clear = screen.getAllByRole("button", { name: "Clear filters" });
      expect(clear.length).toBeGreaterThan(0);
      await user.click(clear[clear.length - 1]);
      await waitFor(() => expect(getStaffQueue.mock.calls.at(-1)![0]).toMatchObject({ status: "" }));
      expect(await screen.findByRole("heading", { name: "No tickets in the queue" })).toBeInTheDocument();
    });
  });

  // UI-20 — FR-23
  it("UI-20: a failed load shows a safe message and a working Retry", async () => {
    const user = userEvent.setup();
    getStaffQueue.mockRejectedValueOnce(new Error("Queue request failed: HTTP 500"));
    getStaffQueue.mockResolvedValue(page([ROW()]));
    renderQueue();

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load the ticket queue/i);
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument(); // no raw detail

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("TKT-2026-000012")).toBeInTheDocument();
  });

  // Forbidden state (issue #33 scope): a role refusal is explained, not shown as a
  // generic failure or as the password-change gate.
  it("shows a forbidden state on a role refusal", async () => {
    getStaffQueue.mockRejectedValue(new api.ForbiddenError());
    renderQueue();

    expect(await screen.findByRole("heading", { name: /don't have access to the ticket queue/i })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // ui-spec §10 (found by RESP-02): at tablet width Category and Owner fold into
  // the Summary cell; their own columns carry the class the breakpoint hides.
  it("folds Category and Owner into the Summary cell for the tablet layout", async () => {
    getStaffQueue.mockResolvedValue(page([ROW(), ROW({ id: 13, ticketNumber: "TKT-2026-000013", owner: null })]));
    renderQueue();

    const first = (await screen.findByText("TKT-2026-000012")).closest("tr") as HTMLElement;
    expect(within(first).getByText("Hardware · Anong Srisai")).toHaveClass("zg-cell-summary__meta");
    const second = screen.getByText("TKT-2026-000013").closest("tr") as HTMLElement;
    expect(within(second).getByText("Hardware · Unassigned")).toHaveClass("zg-cell-summary__meta");

    const folded = (label: string) => [
      screen.getByRole("columnheader", { name: label }),
      first.querySelector(`td[data-label="${label}"]`),
    ];
    for (const el of [...folded("Category"), ...folded("Owner")]) expect(el).toHaveClass("zg-col-fold");
  });

  // ui-spec §6.3 (found by RESP-04): on mobile the filters sit behind a
  // "Filters" disclosure that shows how many are active.
  it("puts the filters behind a Filters disclosure that shows the active count", async () => {
    const user = userEvent.setup();
    getStaffQueue.mockResolvedValue(page([ROW()]));
    renderQueue();
    await screen.findByText("TKT-2026-000012");

    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel).toContainElement(screen.getByLabelText("Filter by status"));
    expect(panel).not.toHaveClass("zg-filters--open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveClass("zg-filters--open");

    await user.selectOptions(screen.getByLabelText("Filter by status"), "NEW");
    await user.selectOptions(screen.getByLabelText("Filter by IT priority"), "HIGH");
    expect(screen.getByRole("button", { name: "Filters (2 active)" })).toBe(toggle);
  });
});
