import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppShell } from "../../src/components/AppShell.js";
import { RoleRoutes } from "../../src/App.js";
import type { Role } from "../../src/api.js";

// UI-33…UI-35 (docs/lab-04/tests.md §2.7) for every role. Contract: ui-spec §3,
// specification BR-62, BR-63.
vi.mock("../../src/screens/StaffDashboard.js", () => ({ StaffDashboard: () => <p>staff dashboard</p> }));
vi.mock("../../src/screens/RequesterDashboard.js", () => ({ RequesterDashboard: () => <p>requester dashboard</p> }));

function renderShell(role: Role, path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell userName="Test User" role={role} onLogout={vi.fn()}>
        <p>content</p>
      </AppShell>
    </MemoryRouter>
  );
  return within(screen.getByRole("navigation", { name: "Primary" }));
}

const names = (nav: ReturnType<typeof renderShell>) => nav.getAllByRole("link").map((l) => l.textContent);

// UI-33 — AC-53, FR-17
describe("UI-33: Dashboard comes first and is the active item at /dashboard", () => {
  it.each(["IT_STAFF", "ADMINISTRATOR"] as Role[])("%s", (role) => {
    const nav = renderShell(role, "/dashboard");
    expect(names(nav)[0]).toBe("Dashboard");
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveClass("zg-nav-link--active");
    expect(nav.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("REQUESTER", () => {
    const nav = renderShell("REQUESTER", "/dashboard");
    expect(names(nav)).toEqual(["Dashboard", "My Tickets", "Create Ticket"]);
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveClass("zg-nav-link--active");
    expect(nav.getByRole("link", { name: "My Tickets" })).not.toHaveClass("zg-nav-link--active");
    expect(nav.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
  });

  it("makes My Tickets, not Dashboard, active on a Requester's Ticket list", () => {
    const nav = renderShell("REQUESTER", "/tickets");
    expect(nav.getByRole("link", { name: "My Tickets" })).toHaveClass("zg-nav-link--active");
    expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveClass("zg-nav-link--active");
  });

  it("makes Ticket Queue, not Dashboard, active on a Ticket under the queue", () => {
    const nav = renderShell("IT_STAFF", "/staff/tickets/12");
    expect(nav.getByRole("link", { name: "Ticket Queue" })).toHaveClass("zg-nav-link--active");
    expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveClass("zg-nav-link--active");
  });
});

// UI-34 — AC-54, D-04
it("UI-34: an Administrator's navigation is exactly Dashboard, Ticket Queue, User Management", () => {
  expect(names(renderShell("ADMINISTRATOR"))).toEqual(["Dashboard", "Ticket Queue", "User Management"]);
});

it("IT Staff navigation is exactly Dashboard and Ticket Queue", () => {
  expect(names(renderShell("IT_STAFF"))).toEqual(["Dashboard", "Ticket Queue"]);
});

// UI-35 — AC-53, BR-62
describe("UI-35: the root and unknown paths land on /dashboard", () => {
  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }

  it.each([
    ["IT_STAFF", "/"],
    ["IT_STAFF", "/no/such/page"],
    ["ADMINISTRATOR", "/"],
    ["ADMINISTRATOR", "/tickets"],
    ["REQUESTER", "/"],
    ["REQUESTER", "/no/such/page"],
    ["REQUESTER", "/staff/tickets"],
  ])("%s at %s", (role, path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <RoleRoutes role={role} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
    expect(screen.getByText(role === "REQUESTER" ? "requester dashboard" : "staff dashboard")).toBeInTheDocument();
  });
});
