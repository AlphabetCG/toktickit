import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../../src/components/AppShell.js";
import type { Role } from "../../src/api.js";

// UI-10…UI-13 (docs/lab-03/tests.md §2.5). The shell renders only the acting
// role's destinations (AC-53), so another role's links are absent from the DOM.
function renderShell(role: Role, onLogout = vi.fn()) {
  render(
    <MemoryRouter>
      <AppShell userName="Test User" role={role} onLogout={onLogout}>
        <p>content</p>
      </AppShell>
    </MemoryRouter>
  );
  return onLogout;
}

describe("Role-specific navigation", () => {
  // UI-10 — AC-53, FR-08
  it("UI-10: a Requester sees My Tickets and Create Ticket, not staff or admin areas", () => {
    renderShell("REQUESTER");
    expect(screen.getByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
  });

  // UI-11 — AC-53
  it("UI-11: IT Staff see the Ticket Queue, not User Management", () => {
    renderShell("IT_STAFF");
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  // UI-12 — AC-53
  it("UI-12: an Administrator sees User Management", () => {
    renderShell("ADMINISTRATOR");
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
  });

  // UI-13 — §7.1
  it("UI-13: the shell shows the name and role badge, and Logout calls the handler", async () => {
    const user = userEvent.setup();
    const onLogout = renderShell("IT_STAFF");

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
