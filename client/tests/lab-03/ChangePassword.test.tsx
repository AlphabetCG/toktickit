import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ChangePassword } from "../../src/screens/ChangePassword.js";
import * as api from "../../src/api.js";

// UI-06…UI-09 (docs/lab-03/tests.md §2.5).
vi.mock("../../src/api.js");
const changePassword = vi.mocked(api.changePassword);

const refresh = vi.fn().mockResolvedValue(undefined);
let mustChange = true;
vi.mock("../../src/auth.js", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Somchai", email: "s@t.test", role: "REQUESTER", mustChangePassword: mustChange },
    refresh,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children?: unknown }) => children,
}));

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <Routes>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/tickets" element={<div>My Tickets Screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Change Password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mustChange = true;
  });

  // UI-06 — AC-02
  it("UI-06: mandatory mode explains itself and offers no way out", () => {
    renderScreen();
    expect(screen.getByText(/temporary password/i)).toBeInTheDocument();
    // No Cancel escape while a change is mandatory.
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  // UI-07 — BR-10
  it("UI-07: the length rule is shown up front, before any failure", () => {
    renderScreen();
    expect(screen.getByText(/At least 12 characters/i)).toBeInTheDocument();
  });

  // UI-08 — FR-23
  it("UI-08: a mismatched confirmation shows a message and makes no API call", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByLabelText(/Current password/), "ChangeMe123!");
    await user.type(screen.getByLabelText(/New password/), "BrandNewPass!2026");
    await user.type(screen.getByLabelText(/Confirm new password/), "different!2026");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  // UI-09 — AC-02
  it("UI-09: a successful change makes the application reachable", async () => {
    const user = userEvent.setup();
    changePassword.mockResolvedValue(undefined);
    renderScreen();

    await user.type(screen.getByLabelText(/Current password/), "ChangeMe123!");
    await user.type(screen.getByLabelText(/New password/), "BrandNewPass!2026");
    await user.type(screen.getByLabelText(/Confirm new password/), "BrandNewPass!2026");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(changePassword).toHaveBeenCalledWith("ChangeMe123!", "BrandNewPass!2026");
    expect(await screen.findByText("My Tickets Screen")).toBeInTheDocument();
  });

  // The policy is the server's (BR-10). The screen repeats the minimum only so it
  // can show the rule up front (ui-spec §6.2) and fail locally before a round
  // trip. The two constants are declared in separate npm packages, so nothing but
  // this assertion stops them drifting apart when the policy changes.
  it("keeps its PASSWORD_MIN in step with the server's policy", () => {
    const declared = (source: string, name: string): number => {
      const match = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
      if (!match) throw new Error(`${name} is no longer declared as a literal — update this test`);
      return Number(match[1]);
    };

    const client = readFileSync(join(process.cwd(), "src/screens/ChangePassword.tsx"), "utf8");
    const server = readFileSync(join(process.cwd(), "../server/src/password.ts"), "utf8");

    expect(declared(client, "PASSWORD_MIN")).toBe(declared(server, "PASSWORD_MIN"));
  });
});
