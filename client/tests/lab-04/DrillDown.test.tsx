import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { StaffTicketQueue } from "../../src/screens/StaffTicketQueue.js";
import { UserManagement } from "../../src/screens/UserManagement.js";
import { MyTickets } from "../../src/screens/MyTickets.js";
import * as api from "../../src/api.js";

// UI-36…UI-39 (docs/lab-04/tests.md §2.7): the query string is the filter state
// (ui-spec §9).
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return {
    ...real,
    getStaffQueue: vi.fn(),
    getCategories: vi.fn(),
    listUsers: vi.fn(),
    getTickets: vi.fn(),
    getRelatedSystems: vi.fn(),
  };
});
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Admin", email: "a@t.test", role: "ADMINISTRATOR" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const getStaffQueue = vi.mocked(api.getStaffQueue);
const listUsers = vi.mocked(api.listUsers);
const getTickets = vi.mocked(api.getTickets);

const EMPTY: api.QueueResponse = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0, counts: { unassigned: 0, mine: 0 } };

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="search">{location.search}</p>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

function renderAt(path: string, element: React.ReactNode, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path.split("?")[0], search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }]}>
      <Routes>
        <Route path="*" element={<>{element}<Probe /></>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getStaffQueue.mockResolvedValue(EMPTY);
  vi.mocked(api.getCategories).mockResolvedValue([]);
  listUsers.mockResolvedValue([]);
  getTickets.mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  vi.mocked(api.getRelatedSystems).mockResolvedValue([]);
});

// UI-36 — FR-16, AC-48
describe("UI-36: My Tickets reads its filters from the URL on first load", () => {
  it("statusGroup=active selects All open and requests it", async () => {
    renderAt("/tickets?statusGroup=active", <MyTickets />);
    await waitFor(() =>
      expect(getTickets).toHaveBeenCalledWith(expect.objectContaining({ statusGroup: "active", status: "" }), expect.anything())
    );
    expect(getTickets).toHaveBeenCalledTimes(1); // no unfiltered request first
    expect(screen.getByLabelText("Filter by status")).toHaveValue("group:active");
    expect(screen.getByRole("option", { name: "All open" })).toBeInTheDocument();
  });

  it("status=WAITING_FOR_REQUESTER selects that status and requests it", async () => {
    renderAt("/tickets?status=WAITING_FOR_REQUESTER", <MyTickets />);
    await waitFor(() =>
      expect(getTickets).toHaveBeenCalledWith(expect.objectContaining({ status: "WAITING_FOR_REQUESTER" }), expect.anything())
    );
    expect(getTickets).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Filter by status")).toHaveValue("WAITING_FOR_REQUESTER");
  });

  it("sort=updatedAt&order=desc (the Recently updated View all) applies the sort", async () => {
    renderAt("/tickets?sort=updatedAt&order=desc", <MyTickets />);
    await waitFor(() =>
      expect(getTickets).toHaveBeenCalledWith(expect.objectContaining({ sort: "updatedAt", order: "desc" }), expect.anything())
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("updatedAt");
  });

  it("ignores values it does not recognise", async () => {
    renderAt("/tickets?status=DONE&statusGroup=closed&priority=URGENT", <MyTickets />);
    await waitFor(() => expect(getTickets).toHaveBeenCalled());
    expect(getTickets.mock.calls[0][0]).toMatchObject({ status: "", statusGroup: "", priority: "" });
  });

  it("says when the list was filtered from the Dashboard", async () => {
    renderAt("/tickets?status=RESOLVED", <MyTickets />, { fromDashboard: true });
    expect(await screen.findByText(/Filtered from Dashboard/)).toBeInTheDocument();
  });
});

// UI-37 — FR-16, AC-48
describe("UI-37: the Queue reads its filters from the URL on first load", () => {
  it("ownerId=me & statusGroup=active", async () => {
    renderAt("/staff/tickets?ownerId=me&statusGroup=active", <StaffTicketQueue />);
    await waitFor(() =>
      expect(getStaffQueue).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "me", statusGroup: "active" }), expect.anything())
    );
    expect(getStaffQueue).toHaveBeenCalledTimes(1); // no unfiltered request first
    expect(screen.getByLabelText("Filter by owner")).toHaveValue("me");
    expect(screen.getByLabelText("Filter by status")).toHaveValue("group:active");
    expect(screen.getByRole("option", { name: "All open" })).toBeInTheDocument();
  });

  it("itPriority=HIGH & sort=ticketDate & order=asc", async () => {
    renderAt("/staff/tickets?itPriority=HIGH&sort=ticketDate&order=asc", <StaffTicketQueue />);
    await waitFor(() =>
      expect(getStaffQueue).toHaveBeenCalledWith(
        expect.objectContaining({ itPriority: "HIGH", sort: "ticketDate", order: "asc" }),
        expect.anything()
      )
    );
    expect(screen.getByLabelText("Filter by IT priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Sort by")).toHaveValue("ticketDate");
  });

  it("ignores values it does not recognise, as the API does", async () => {
    renderAt("/staff/tickets?status=DONE&itPriority=URGENT&statusGroup=closed", <StaffTicketQueue />);
    await waitFor(() => expect(getStaffQueue).toHaveBeenCalled());
    const sent = getStaffQueue.mock.calls[0][0];
    expect(sent).toMatchObject({ status: "", itPriority: "", statusGroup: "" });
  });

  it("says when the list was filtered from the Dashboard", async () => {
    renderAt("/staff/tickets?ownerId=me&statusGroup=active", <StaffTicketQueue />, { fromDashboard: true });
    expect(await screen.findByText(/Filtered from Dashboard/)).toBeInTheDocument();
  });
});

// UI-38 — FR-16
it("UI-38: User Management reads its role filter from the URL on first load", async () => {
  renderAt("/admin/users?role=IT_STAFF", <UserManagement />);
  await waitFor(() => expect(listUsers).toHaveBeenCalledWith({ search: "", role: "IT_STAFF" }));
  expect(listUsers).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Filter by role")).toHaveValue("IT_STAFF");
});

// UI-39 — FR-16
describe("UI-39: changing a filter writes the URL, so Back restores the previous filter", () => {
  it("in the Queue", async () => {
    const user = userEvent.setup();
    renderAt("/staff/tickets?itPriority=HIGH", <StaffTicketQueue />);
    await waitFor(() => expect(getStaffQueue).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText("Filter by IT priority"), "LOW");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("itPriority=LOW"));

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("itPriority=HIGH"));
    expect(screen.getByLabelText("Filter by IT priority")).toHaveValue("HIGH");
    await waitFor(() =>
      expect(getStaffQueue).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: "HIGH" }), expect.anything())
    );
  });

  it("in My Tickets", async () => {
    const user = userEvent.setup();
    renderAt("/tickets?status=RESOLVED", <MyTickets />);
    await waitFor(() => expect(getTickets).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText("Filter by status"), "group:active");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("statusGroup=active"));
    expect(screen.getByTestId("search")).not.toHaveTextContent("status=RESOLVED");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByLabelText("Filter by status")).toHaveValue("RESOLVED"));
    await waitFor(() =>
      expect(getTickets).toHaveBeenLastCalledWith(expect.objectContaining({ status: "RESOLVED" }), expect.anything())
    );
  });

  it("in My Tickets, a filter chosen while a search is pending is kept", async () => {
    const user = userEvent.setup();
    renderAt("/tickets", <MyTickets />);
    await waitFor(() => expect(getTickets).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Search tickets"), "vpn");
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "HIGH");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("search=vpn"));
    expect(screen.getByTestId("search")).toHaveTextContent("priority=HIGH");
  });

  it("in User Management", async () => {
    const user = userEvent.setup();
    renderAt("/admin/users", <UserManagement />);
    await waitFor(() => expect(listUsers).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText("Filter by role"), "ADMINISTRATOR");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("role=ADMINISTRATOR"));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByLabelText("Filter by role")).toHaveValue(""));
  });

  // PR #60 review: the debounced search must write onto the current URL, not the
  // one from when typing started, or it undoes a filter chosen in the meantime.
  it("in the Queue, a filter chosen while a search is pending is kept", async () => {
    const user = userEvent.setup();
    renderAt("/staff/tickets", <StaffTicketQueue />);
    await waitFor(() => expect(getStaffQueue).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Search tickets"), "vpn");
    await user.selectOptions(screen.getByLabelText("Filter by IT priority"), "LOW");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("search=vpn"));
    expect(screen.getByTestId("search")).toHaveTextContent("itPriority=LOW");
  });

  it("in User Management, a role chosen while a search is pending is kept", async () => {
    const user = userEvent.setup();
    renderAt("/admin/users", <UserManagement />);
    await waitFor(() => expect(listUsers).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Search users"), "ann");
    await user.selectOptions(screen.getByLabelText("Filter by role"), "ADMINISTRATOR");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("search=ann"));
    expect(screen.getByTestId("search")).toHaveTextContent("role=ADMINISTRATOR");
  });
});
