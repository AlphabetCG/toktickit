import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RequesterDashboard } from "../../src/screens/RequesterDashboard.js";
import * as api from "../../src/api.js";

// UI-29…UI-32 (docs/lab-04/tests.md §2.7). Contract: ui-spec §2.2–§2.4, §4, §6.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return { ...real, getRequesterDashboard: vi.fn(), getTickets: vi.fn() };
});
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Somchai Prasert", email: "s@t.test", role: "REQUESTER" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});
const getRequesterDashboard = vi.mocked(api.getRequesterDashboard);
const getTickets = vi.mocked(api.getTickets);

const m = (value: number, href: string): api.Metric => ({ value, href });
const summary = (id: number, over: Partial<api.RequesterTicketSummary> = {}): api.RequesterTicketSummary => ({
  id,
  ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
  summary: `Summary ${id}`,
  currentStatus: "WAITING_FOR_REQUESTER",
  updatedAt: "2026-10-13T09:00:00.000Z",
  resolvedAt: null,
  href: `/tickets/${id}`,
  ...over,
});

function data(zero = false): api.RequesterDashboardData {
  const v = (n: number) => (zero ? 0 : n);
  return {
    generatedAt: "2026-10-14T03:05:00.000Z",
    metrics: {
      openTickets: m(v(3), "/tickets?statusGroup=active"),
      waitingForMe: m(v(1), "/tickets?status=WAITING_FOR_REQUESTER"),
      awaitingClosure: m(v(1), "/tickets?status=RESOLVED"),
    },
    needsAttention: { items: zero ? [] : [summary(12)], viewAllHref: "/tickets?status=WAITING_FOR_REQUESTER" },
    recentlyUpdated: {
      items: zero ? [] : [summary(12), summary(9, { currentStatus: "IN_PROGRESS" })],
      viewAllHref: "/tickets?sort=updatedAt&order=desc",
    },
    recentlyResolved: {
      items: zero ? [] : [summary(5, { currentStatus: "RESOLVED", resolvedAt: "2026-10-12T04:00:00.000Z" })],
    },
  };
}

const listOf = (totalItems: number): api.TicketListResponse => ({ items: [], page: 1, pageSize: 10, totalItems, totalPages: 0 });

function renderDashboard() {
  return render(
    <MemoryRouter>
      <RequesterDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getTickets.mockResolvedValue(listOf(3));
});

// UI-29 — FR-12, FR-15
describe("UI-29: three metric cards", () => {
  it("each shows its label and value and links to its list", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();
    for (const [name, href] of [
      ["Open tickets: 3 — view list", "/tickets?statusGroup=active"],
      ["Waiting for you: 1 — view list", "/tickets?status=WAITING_FOR_REQUESTER"],
      ["Resolved, awaiting closure: 1 — view list", "/tickets?status=RESOLVED"],
    ]) {
      expect(await screen.findByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("puts the warning status badge on Waiting for you, the card that asks the Requester to act", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();
    const waiting = await screen.findByRole("link", { name: /^Waiting for you/ });
    expect(within(waiting).getByText("Waiting for Requester")).toHaveClass("zg-badge--status-waiting");
    expect(within(screen.getByRole("link", { name: /^Open tickets/ })).queryByText(/Waiting/)).not.toBeInTheDocument();
  });

  it("offers Create ticket as the page's primary action and greets by first name", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();
    expect(await screen.findByRole("link", { name: "+ Create ticket" })).toHaveAttribute("href", "/tickets/new");
    expect(screen.getByText("Hello, Somchai")).toBeInTheDocument();
  });
});

// UI-30 — FR-12
describe("UI-30: the three lists", () => {
  it("link each row to its Ticket, with View all where a list screen exists", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();

    const attention = await screen.findByRole("region", { name: "Needs your attention" });
    expect(within(attention).getByRole("link", { name: /TKT-2026-000012/ })).toHaveAttribute("href", "/tickets/12");
    expect(within(attention).getByRole("link", { name: "View all ›" })).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");

    const updated = screen.getByRole("region", { name: "Recently updated" });
    expect(within(updated).getAllByRole("link", { name: /TKT-/ }).map((l) => l.getAttribute("href"))).toEqual(["/tickets/12", "/tickets/9"]);
    expect(within(updated).getByRole("link", { name: "View all ›" })).toHaveAttribute("href", "/tickets?sort=updatedAt&order=desc");

    const resolved = screen.getByRole("region", { name: "Recently resolved" });
    expect(within(resolved).getByRole("link", { name: /TKT-2026-000005/ })).toHaveAttribute("href", "/tickets/5");
    expect(within(resolved).getByText(/^Resolved /)).toBeInTheDocument();
    expect(within(resolved).queryByRole("link", { name: "View all ›" })).not.toBeInTheDocument();
  });

  it("place Needs your attention first", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();
    await screen.findByRole("region", { name: "Needs your attention" });
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual([
      "Needs your attention",
      "Recently updated",
      "Recently resolved",
    ]);
  });

  it("show each list's own empty message when the Requester has Tickets but none match", async () => {
    getRequesterDashboard.mockResolvedValue(data(true));
    getTickets.mockResolvedValue(listOf(4));
    renderDashboard();
    expect(await screen.findByText("Nothing needs your attention right now.")).toBeInTheDocument();
    expect(screen.getByText("None of your tickets changed in the last 7 days.")).toBeInTheDocument();
    expect(screen.getByText("No tickets were resolved in the last 30 days.")).toBeInTheDocument();
    expect(screen.queryByText("You haven't raised a ticket yet.")).not.toBeInTheDocument();
  });
});

// UI-31 — AC-45, D-19
describe("UI-31: a Requester with no Tickets", () => {
  it("sees zeros and one empty state with Create ticket in place of the lists", async () => {
    getRequesterDashboard.mockResolvedValue(data(true));
    getTickets.mockResolvedValue(listOf(0));
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "You haven't raised a ticket yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open tickets: 0 — view list" })).toHaveTextContent("0");
    expect(screen.getByRole("link", { name: "Waiting for you: 0 — view list" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Needs your attention" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create ticket" })).toHaveAttribute("href", "/tickets/new");
  });

  it("asks My Tickets only when every figure is zero", async () => {
    getRequesterDashboard.mockResolvedValue(data());
    renderDashboard();
    await screen.findByRole("region", { name: "Needs your attention" });
    expect(getTickets).not.toHaveBeenCalled();
  });
});

// UI-32 — AC-50, FR-21
describe("UI-32: loading and safe failure", () => {
  it("announces a loading placeholder", () => {
    getRequesterDashboard.mockReturnValue(new Promise(() => undefined));
    renderDashboard();
    expect(screen.getByLabelText("Loading dashboard…")).toHaveAttribute("aria-busy", "true");
  });

  it("shows a plain message and Try again, which refetches", async () => {
    getRequesterDashboard.mockRejectedValueOnce(new Error("Dashboard request failed: HTTP 500"));
    getRequesterDashboard.mockResolvedValueOnce(data());
    const user = userEvent.setup();
    renderDashboard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load your dashboard.");
    expect(alert).not.toHaveTextContent("500");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Open tickets: 3/ })).toBeInTheDocument();
    expect(getRequesterDashboard).toHaveBeenCalledTimes(2);
  });

  it("shows the forbidden state on a 403", async () => {
    getRequesterDashboard.mockRejectedValue(new api.ForbiddenError());
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "You don't have access to this dashboard" })).toBeInTheDocument();
  });
});
