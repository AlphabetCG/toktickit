import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UserManagement } from "../../src/screens/UserManagement.js";
import * as api from "../../src/api.js";

// UI-26…UI-30 (docs/lab-03/tests.md §2.5). Contract: ui-spec §6.5, api-spec §8.
vi.mock("../../src/api.js");
vi.mock("../../src/auth.js", () => {
  const user = { id: 1, name: "Arthit Admin", email: "arthit@t.test", role: "ADMINISTRATOR" as const, mustChangePassword: false };
  return {
    useAuth: () => ({ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
    AuthProvider: ({ children }: { children?: unknown }) => children,
  };
});

const listUsers = vi.mocked(api.listUsers);
const createUser = vi.mocked(api.createUser);
const updateUser = vi.mocked(api.updateUser);
const setInitialPassword = vi.mocked(api.setInitialPassword);

const USERS: api.AdminUser[] = [
  { id: 1, name: "Arthit Admin", email: "arthit@t.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
  { id: 2, name: "Anong Srisai", email: "anong@t.test", role: "IT_STAFF", isActive: true, mustChangePassword: false },
  { id: 3, name: "Prasit Noi", email: "prasit@t.test", role: "REQUESTER", isActive: false, mustChangePassword: true },
  { id: 4, name: "Kittipong Sae-Lim", email: "kit@t.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false },
];

function renderScreen() {
  return render(
    <MemoryRouter>
      <UserManagement />
    </MemoryRouter>
  );
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;
const dialog = () => screen.getByRole("dialog");

describe("User Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsers.mockResolvedValue(USERS);
  });

  // UI-26 — AC-43
  it("UI-26: each row shows Name, Email, Role, Status as a word, and an Edit action", async () => {
    renderScreen();
    const headers = (await screen.findAllByRole("columnheader")).map((h) => h.textContent);
    expect(headers.slice(0, 4)).toEqual(["Name", "Email", "Role", "Status"]);

    const prasit = await rowOf("Prasit Noi");
    expect(within(prasit).getByText("prasit@t.test")).toBeInTheDocument();
    expect(within(prasit).getByText("Requester")).toBeInTheDocument();
    expect(within(prasit).getByText("Inactive")).toBeInTheDocument();
    expect(within(prasit).getByRole("button", { name: "Edit Prasit Noi" })).toBeInTheDocument();
    expect(within(await rowOf("Anong Srisai")).getByText("Active")).toBeInTheDocument();
  });

  // UI-27 — AC-44, AC-45
  it("UI-27: searching and picking a role each send the matching request", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Anong Srisai");

    await user.type(screen.getByLabelText("Search users"), "anong");
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith({ search: "anong", role: "" }));

    await user.selectOptions(screen.getByLabelText("Filter by role"), "IT_STAFF");
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith({ search: "anong", role: "IT_STAFF" }));
  });

  // UI-28 — AC-46, AC-48
  it("UI-28: the create form validates inline, offers exactly one role, and sends nothing until valid", async () => {
    const user = userEvent.setup();
    createUser.mockResolvedValue({ ...USERS[1], id: 9, name: "Wanida Chaiyo", mustChangePassword: true });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "+ Create user" }));
    await user.click(within(dialog()).getByRole("button", { name: "Create user" }));

    expect(within(dialog()).getByLabelText(/Name/)).toHaveAccessibleDescription(/1–120 characters/);
    expect(within(dialog()).getByLabelText(/Email/)).toHaveAccessibleDescription(/valid email/);
    expect(within(dialog()).getByLabelText(/^Role/)).toHaveAccessibleDescription(/Choose a role/);
    expect(within(dialog()).getByLabelText(/Initial password/)).toHaveAccessibleDescription(/at least 12/);
    expect(createUser).not.toHaveBeenCalled();

    // One role, always: a single select, never checkboxes.
    expect(within(dialog()).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(dialog()).getByLabelText(/^Role/).tagName).toBe("SELECT");

    await user.type(within(dialog()).getByLabelText(/Name/), "Wanida Chaiyo");
    await user.type(within(dialog()).getByLabelText(/Email/), "wanida@t.test");
    await user.selectOptions(within(dialog()).getByLabelText(/^Role/), "IT_STAFF");
    await user.type(within(dialog()).getByLabelText(/Initial password/), "FreshInitial!2026");
    await user.click(within(dialog()).getByRole("button", { name: "Create user" }));

    expect(createUser).toHaveBeenCalledWith({
      name: "Wanida Chaiyo",
      email: "wanida@t.test",
      role: "IT_STAFF",
      isActive: true,
      initialPassword: "FreshInitial!2026",
    });
    expect(await screen.findByText(/must choose a new password at their first sign-in/)).toBeInTheDocument();
  });

  // UI-29 — AC-47, AC-49, AC-50
  describe("UI-29: each guard refusal shows its specific message beside its control", () => {
    it("a duplicate email lands beside the Email field", async () => {
      const user = userEvent.setup();
      updateUser.mockRejectedValue(new Error("That email address is already registered."));
      renderScreen();

      await user.click(within(await rowOf("Anong Srisai")).getByRole("button", { name: "Edit Anong Srisai" }));
      await user.click(within(dialog()).getByRole("button", { name: "Save" }));

      expect(await within(dialog()).findByText("That email address is already registered.")).toBeInTheDocument();
      expect(within(dialog()).getByLabelText(/Email/)).toHaveAccessibleDescription("That email address is already registered.");
    });

    it("the last-Administrator refusal lands beside Status when deactivating", async () => {
      const user = userEvent.setup();
      updateUser.mockRejectedValue(new Error("The system must keep at least one active administrator."));
      renderScreen();

      await user.click(within(await rowOf("Kittipong Sae-Lim")).getByRole("button", { name: /Edit/ }));
      await user.click(within(dialog()).getByLabelText("Inactive"));
      await user.click(within(dialog()).getByRole("button", { name: "Save" }));

      const status = within(dialog()).getByRole("group", { name: "Status" });
      expect(await within(status).findByText("The system must keep at least one active administrator.")).toBeInTheDocument();
    });

    it("the last-Administrator refusal lands beside Role when demoting", async () => {
      const user = userEvent.setup();
      updateUser.mockRejectedValue(new Error("The system must keep at least one active administrator."));
      renderScreen();

      await user.click(within(await rowOf("Kittipong Sae-Lim")).getByRole("button", { name: /Edit/ }));
      await user.selectOptions(within(dialog()).getByLabelText(/^Role/), "IT_STAFF");
      await user.click(within(dialog()).getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(within(dialog()).getByLabelText(/^Role/)).toHaveAccessibleDescription(
          "The system must keep at least one active administrator."
        )
      );
    });
  });

  it("anticipates the self-guards: your own Role and Status are disabled with an explanation", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(within(await rowOf("Arthit Admin")).getByRole("button", { name: "Edit Arthit Admin" }));

    const role = within(dialog()).getByLabelText(/^Role/);
    expect(role).toBeDisabled();
    expect(role).toHaveAccessibleDescription("You cannot change your own role.");
    expect(within(dialog()).getByLabelText("Inactive")).toBeDisabled();
    expect(within(dialog()).getByText("You cannot deactivate your own account.")).toBeInTheDocument();
  });

  // UI-30 — AC-51
  it("UI-30: a new initial password is confirmed and reports the consequence", async () => {
    const user = userEvent.setup();
    setInitialPassword.mockResolvedValue({ id: 2, mustChangePassword: true });
    renderScreen();

    await user.click(within(await rowOf("Anong Srisai")).getByRole("button", { name: "Edit Anong Srisai" }));
    await user.click(within(dialog()).getByRole("button", { name: "Set new initial password" }));

    const confirm = screen.getByRole("dialog", { name: "Set new initial password" });
    expect(confirm).toHaveTextContent("They will be signed out and must choose a new password at their next sign-in.");
    expect(setInitialPassword).not.toHaveBeenCalled();

    await user.type(within(confirm).getByLabelText(/New initial password/), "FreshInitial!2026");
    await user.click(within(confirm).getByRole("button", { name: "Set password" }));

    expect(setInitialPassword).toHaveBeenCalledWith(2, "FreshInitial!2026");
    expect(await screen.findByText(/must choose a new password at their next sign-in/)).toBeInTheDocument();
  });

  it("offers no delete control anywhere (BR-57)", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText("Anong Srisai");
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();

    await user.click(within(await rowOf("Anong Srisai")).getByRole("button", { name: "Edit Anong Srisai" }));
    expect(within(dialog()).queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it("shows a forbidden state on a role refusal", async () => {
    listUsers.mockRejectedValue(new api.ForbiddenError());
    renderScreen();
    expect(await screen.findByRole("heading", { name: /don't have access to User Management/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
