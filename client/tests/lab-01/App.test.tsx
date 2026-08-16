import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  afterEach(() => vi.restoreAllMocks());

  // Worked example — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // Issue 2: the page reflects the backend status from a real (here mocked) call.
  it("shows System Status Online when the health check succeeds", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue([]);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));
    expect(await screen.findByText(/Online/i)).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("network down"));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));
    expect(await screen.findByText(/Unable to connect to TokTickIT API/i)).toBeInTheDocument();
  });

  // Issue 4: the list comes from the API response, not hard-coded markup.
  it("lists the categories returned by the API on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ]);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));
    expect(await screen.findByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });
});
