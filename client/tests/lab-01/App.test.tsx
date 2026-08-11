import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

describe("App", () => {
  // Worked example — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // TODO(Issue 4): mock the api module with vi.spyOn(api, "checkSystem")
  // .mockResolvedValue(...) / .mockRejectedValue(...), click the button, then
  // assert the Online list and the Offline message.
  it.todo("shows Online and the seeded categories on success");
  it.todo("shows an Offline error message when the API is unavailable");
});
