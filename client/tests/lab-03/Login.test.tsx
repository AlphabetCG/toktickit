import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Login } from "../../src/screens/Login.js";

// UI-01…UI-05 (docs/lab-03/tests.md §2.5). The auth context is mocked so signIn
// is a controllable spy; the router shows a sentinel to prove navigation.
const signIn = vi.fn();
vi.mock("../../src/auth.js", () => ({
  useAuth: () => ({ signIn, user: null, loading: false, signOut: vi.fn(), refresh: vi.fn() }),
  AuthProvider: ({ children }: { children?: unknown }) => children,
}));

const requester = { id: 1, name: "Somchai", email: "somchai@toktickit.test", role: "REQUESTER" as const, mustChangePassword: false };

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tickets" element={<div>My Tickets Screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => vi.clearAllMocks());

  // UI-01 — AC-01
  it("UI-01: a valid submission signs in once and routes into the application", async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue(requester);
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), "somchai@toktickit.test");
    await user.type(screen.getByLabelText(/Password/), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith("somchai@toktickit.test", "ChangeMe123!");
    expect(await screen.findByText("My Tickets Screen")).toBeInTheDocument();
  });

  // UI-02 — FR-23
  it("UI-02: an empty field shows a message and makes no API call", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  // UI-03 — BR-43
  it("UI-03: the button is busy while in flight and a double click makes one call", async () => {
    const user = userEvent.setup();
    let resolve: (u: typeof requester) => void = () => {};
    signIn.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), "somchai@toktickit.test");
    await user.type(screen.getByLabelText(/Password/), "ChangeMe123!");
    const button = screen.getByRole("button", { name: /Sign/ });
    await user.click(button);
    await user.click(button); // second rapid click while in-flight

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(signIn).toHaveBeenCalledTimes(1);
    resolve(requester);
  });

  // UI-04 — AC-03
  it("UI-04: a credential failure shows the uniform message and preserves the email", async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValue(new Error("Email or password is incorrect."));
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), "somchai@toktickit.test");
    await user.type(screen.getByLabelText(/Password/), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveValue("somchai@toktickit.test"); // preserved
    expect(screen.getByLabelText(/Password/)).toHaveValue(""); // cleared
  });

  // UI-05 — AC-05
  it("UI-05: a deactivated account shows the distinct deactivation message", async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValue(new Error("This account is deactivated. Contact an administrator."));
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), "kanya.inactive@toktickit.test");
    await user.type(screen.getByLabelText(/Password/), "ChangeMe123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/deactivated/i)).toBeInTheDocument();
  });
});
