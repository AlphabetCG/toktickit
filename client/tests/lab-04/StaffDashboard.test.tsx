import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StaffDashboard } from "../../src/screens/StaffDashboard.js";
import * as api from "../../src/api.js";

// UI-23…UI-28 (docs/lab-04/tests.md §2.7). Contract: ui-spec §2.2–§2.4, §4, §5.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return { ...real, getStaffDashboard: vi.fn() };
});
vi.mock("../../src/auth.js", () => {
  const user = { id: 4, name: "Anong Srisai", email: "a@t.test", role: "IT_STAFF" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});
const getStaffDashboard = vi.mocked(api.getStaffDashboard);

const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const m = (value: number, href: string | null): api.Metric => ({ value, href });

function data(over: Partial<api.StaffDashboardData> = {}, zero = false): api.StaffDashboardData {
  const v = (n: number) => (zero ? 0 : n);
  return {
    generatedAt: "2026-10-14T09:05:00.000Z",
    metrics: {
      unassignedOpen: m(v(4), "/staff/tickets?ownerId=unassigned&statusGroup=active"),
      mineOpen: m(v(2), "/staff/tickets?ownerId=me&statusGroup=active"),
      myOpenActions: m(v(3), null),
      highPriorityOpen: m(v(1), "/staff/tickets?itPriority=HIGH&statusGroup=active"),
    },
    byStatus: Object.fromEntries(STATUSES.map((s, i) => [s, m(v(i), `/staff/tickets?status=${s}`)])) as api.StaffDashboardData["byStatus"],
    openByItPriority: {
      LOW: m(v(2), "/staff/tickets?itPriority=LOW&statusGroup=active"),
      MEDIUM: m(v(3), "/staff/tickets?itPriority=MEDIUM&statusGroup=active"),
      HIGH: m(v(1), "/staff/tickets?itPriority=HIGH&statusGroup=active"),
    },
    myActions: {
      items: zero
        ? []
        : [
            {
              id: 31,
              status: "PLANNED",
              actionAt: "2026-10-15T02:00:00.000Z",
              description: "Replace the laptop battery.",
              ticket: { id: 12, ticketNumber: "TKT-2026-000012", summary: "Laptop battery drains quickly" },
              href: "/staff/tickets/12",
            },
          ],
    },
    urgent: {
      items: zero
        ? []
        : [
            {
              id: 7,
              ticketNumber: "TKT-2026-000007",
              summary: "VPN down for the whole floor",
              currentStatus: "OPEN",
              itPriority: "HIGH",
              owner: null,
              ticketDate: "2026-10-05T02:00:00.000Z",
              updatedAt: "2026-10-13T09:00:00.000Z",
              href: "/staff/tickets/7",
            },
          ],
      viewAllHref: "/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc",
    },
    recentlyUpdated: {
      items: zero
        ? []
        : [
            {
              id: 12,
              ticketNumber: "TKT-2026-000012",
              summary: "Laptop battery drains quickly",
              currentStatus: "IN_PROGRESS",
              itPriority: "MEDIUM",
              owner: { id: 4, name: "Anong Srisai" },
              ticketDate: "2026-10-01T02:00:00.000Z",
              updatedAt: "2026-10-13T09:00:00.000Z",
              href: "/staff/tickets/12",
            },
          ],
      viewAllHref: "/staff/tickets?sort=updatedAt&order=desc",
    },
    ...over,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <StaffDashboard />
    </MemoryRouter>
  );
}

const region = (name: string) => screen.getByRole("region", { name });

beforeEach(() => vi.clearAllMocks());

// UI-23 — FR-13, FR-15
it("UI-23: each metric card shows its label and value and links to its drill-down", async () => {
  getStaffDashboard.mockResolvedValue(data());
  renderDashboard();
  const card = await screen.findByRole("link", { name: "Open and unassigned: 4 — view list" });
  expect(card).toHaveAttribute("href", "/staff/tickets?ownerId=unassigned&statusGroup=active");
  expect(card).toHaveClass("zg-metric");
  expect(screen.getByRole("link", { name: "Open and assigned to me: 2 — view list" })).toHaveAttribute(
    "href",
    "/staff/tickets?ownerId=me&statusGroup=active"
  );
  expect(screen.getByRole("link", { name: "Open, high priority: 1 — view list" })).toBeInTheDocument();
  // A metric with no list screen is a static card, never a pretend link (BR-51).
  const actions = screen.getByText("My open actions", { selector: ".zg-metric__label" }).closest(".zg-metric")!;
  expect(actions.tagName).toBe("DIV");
  expect(actions).toHaveClass("zg-metric--static");
  expect(actions).toHaveTextContent("3");
  // Count strips: badge + count, one link each.
  expect(screen.getByRole("link", { name: "In Progress: 2 tickets" })).toHaveAttribute("href", "/staff/tickets?status=IN_PROGRESS");
  expect(screen.getByRole("link", { name: "High: 1 open tickets" })).toHaveAttribute(
    "href",
    "/staff/tickets?itPriority=HIGH&statusGroup=active"
  );
});

// UI-24 — FR-13
it("UI-24: every list row links to its Ticket, with View all links", async () => {
  getStaffDashboard.mockResolvedValue(data());
  renderDashboard();
  await screen.findByText("Replace the laptop battery.");
  expect(within(region("My open actions")).getByRole("link", { name: /TKT-2026-000012/ })).toHaveAttribute("href", "/staff/tickets/12");
  const urgent = region("Urgent");
  expect(within(urgent).getByRole("link", { name: /TKT-2026-000007/ })).toHaveAttribute("href", "/staff/tickets/7");
  expect(within(urgent).getByText(/^Unassigned · Opened \d+ days ago$/)).toBeInTheDocument();
  expect(within(urgent).getByRole("link", { name: /View all/ })).toHaveAttribute(
    "href",
    "/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc"
  );
  expect(within(region("Recently updated")).getByRole("link", { name: /View all/ })).toHaveAttribute(
    "href",
    "/staff/tickets?sort=updatedAt&order=desc"
  );
});

// UI-25 — AC-45
it("UI-25: an all-zero dashboard shows 0, never blanks, and every list's empty message", async () => {
  getStaffDashboard.mockResolvedValue(data({}, true));
  renderDashboard();
  expect(await screen.findByRole("link", { name: "Open and unassigned: 0 — view list" })).toHaveTextContent("0");
  expect(screen.getByText("You have no open actions.")).toBeInTheDocument();
  expect(screen.getByText("No open high-priority tickets.")).toBeInTheDocument();
  expect(screen.getByText("No tickets were updated in the last 7 days.")).toBeInTheDocument();
});

// UI-26 — AC-49
describe("UI-26: the Users card", () => {
  it("is absent without userCounts", async () => {
    getStaffDashboard.mockResolvedValue(data());
    renderDashboard();
    await screen.findByRole("link", { name: /Open and unassigned/ });
    expect(screen.queryByRole("region", { name: "Users" })).not.toBeInTheDocument();
  });

  it("renders the counts when present", async () => {
    getStaffDashboard.mockResolvedValue(
      data({
        userCounts: {
          activeByRole: {
            REQUESTER: m(6, "/admin/users?role=REQUESTER"),
            IT_STAFF: m(4, "/admin/users?role=IT_STAFF"),
            ADMINISTRATOR: m(2, "/admin/users?role=ADMINISTRATOR"),
          },
          inactive: m(2, null),
        },
      })
    );
    renderDashboard();
    const users = await screen.findByRole("region", { name: "Users" });
    expect(within(users).getByRole("link", { name: "IT Staff: 4 — view list" })).toHaveAttribute("href", "/admin/users?role=IT_STAFF");
    expect(within(users).getByText("Inactive").closest(".zg-metric")).toHaveTextContent("2");
  });
});

// UI-27 — AC-50
it("UI-27: a failed load shows a plain message and Try again, which refetches", async () => {
  getStaffDashboard.mockRejectedValueOnce(new Error("HTTP 500"));
  getStaffDashboard.mockResolvedValueOnce(data());
  const user = userEvent.setup();
  renderDashboard();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("We couldn't load your dashboard.");
  expect(alert).not.toHaveTextContent("500");
  await user.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("link", { name: /Open and unassigned: 4/ })).toBeInTheDocument();
  expect(getStaffDashboard).toHaveBeenCalledTimes(2);
});

// UI-28 — FR-21
describe("UI-28: loading and forbidden", () => {
  it("announces a loading placeholder", () => {
    getStaffDashboard.mockReturnValue(new Promise(() => undefined));
    renderDashboard();
    expect(screen.getByLabelText("Loading dashboard…")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the forbidden state on a 403", async () => {
    getStaffDashboard.mockRejectedValue(new api.ForbiddenError());
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "You don't have access to this dashboard" })).toBeInTheDocument();
  });
});
