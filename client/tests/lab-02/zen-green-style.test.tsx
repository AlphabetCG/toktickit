import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../../src/components/AppShell.js";
import { PriorityBadge, RemovedBadge, StatusBadge } from "../../src/components/Badge.js";
import { Button } from "../../src/components/Button.js";
import { TextField } from "../../src/components/Field.js";

// STYLE-04 and STYLE-05 from docs/lab-02/tests.md. The visual contract is
// docs/lab-02/ui-spec.md sections 1, 2 and 4.
describe("Zen Green foundation", () => {
  // STYLE-04 — editable and read-only fields must be distinguishable, and the
  // palette must come from tokens rather than literals (ui-spec section 1.1).
  describe("STYLE-04: field states are distinct and token-bound", () => {
    it("gives an editable field the base class only", () => {
      render(<TextField id="summary" label="Summary" value="" onChange={() => {}} />);
      const input = screen.getByLabelText(/Summary/);

      expect(input).toHaveClass("zg-field");
      expect(input).not.toHaveClass("zg-field--readonly");
      expect(input).not.toHaveClass("zg-field--invalid");
    });

    it("marks a read-only field with a distinct class and the readOnly attribute", () => {
      render(
        <TextField id="ticket-number" label="Ticket Number" readOnly value="TKT-2026-000001" />
      );
      const input = screen.getByLabelText(/Ticket Number/);

      expect(input).toHaveClass("zg-field--readonly");
      expect(input).toHaveAttribute("readonly");
    });

    it("marks an invalid field and wires its message for screen readers", () => {
      render(
        <TextField
          id="summary"
          label="Summary"
          required
          invalid
          message="Summary must be 5–150 characters."
          value=""
          onChange={() => {}}
        />
      );
      const input = screen.getByLabelText(/Summary/);

      expect(input).toHaveClass("zg-field--invalid");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription("Summary must be 5–150 characters.");
    });

    it("shows the required asterisk without letting it replace the message", () => {
      render(
        <TextField
          id="summary"
          label="Summary"
          required
          invalid
          message="Summary is required."
          value=""
          onChange={() => {}}
        />
      );

      expect(document.querySelector(".zg-required")).toBeInTheDocument();
      expect(screen.getByText("Summary is required.")).toBeInTheDocument();
      expect(screen.getByLabelText(/Summary/)).toHaveAttribute("aria-required", "true");
    });

    it("declares no literal colour in any component source", () => {
      const dir = join(process.cwd(), "src", "components");
      const offenders = readdirSync(dir)
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
        .filter((f) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(readFileSync(join(dir, f), "utf8")));

      expect(offenders).toEqual([]);
    });
  });

  // STYLE-05 — a submitting action must be both unusable and visibly busy
  // (ui-spec section 4, BR-43).
  describe("STYLE-05: busy buttons are disabled and announced", () => {
    it("renders an idle primary button as enabled", () => {
      render(<Button variant="primary">Submit Ticket</Button>);
      const button = screen.getByRole("button", { name: "Submit Ticket" });

      expect(button).toHaveClass("zg-btn", "zg-btn--primary");
      expect(button).toBeEnabled();
      expect(button).not.toHaveClass("zg-btn--busy");
    });

    it("disables, marks, and relabels a busy button", () => {
      render(
        <Button variant="primary" busy busyLabel="Submitting…">
          Submit Ticket
        </Button>
      );
      const button = screen.getByRole("button", { name: /Submitting/ });

      expect(button).toHaveClass("zg-btn--busy");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("keeps a disabled button out of the tab order and unactivatable", () => {
      render(<Button variant="secondary" disabled>Cancel</Button>);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });
  });

  // STYLE-03 — badges are delivered with the foundation, so their semantics are
  // proven here and re-verified in the ticket list (Issue #16).
  describe("STYLE-03: badges never rely on colour alone", () => {
    it.each([
      ["LOW", "Low"],
      ["MEDIUM", "Medium"],
      ["HIGH", "High"],
    ] as const)("labels the %s priority badge %s", (value, label) => {
      render(<PriorityBadge value={value} />);
      expect(screen.getByText(label)).toHaveClass("zg-badge");
    });

    it("labels the status badge with text", () => {
      render(<StatusBadge value="NEW" />);
      expect(screen.getByText("New")).toHaveClass("zg-badge", "zg-badge--status-new");
    });

    it("labels a removed attachment with text, not only styling", () => {
      render(<RemovedBadge />);
      expect(screen.getByText("Removed")).toHaveClass("zg-badge--removed");
    });
  });

  // The shell's own acceptance criteria for this issue (ui-spec section 7).
  // The Requester-driven behaviour, UI-05 and UI-06, arrives with Issue #14.
  describe("application shell", () => {
    const renderShell = (props = {}) =>
      render(
        <MemoryRouter initialEntries={["/tickets"]}>
          <AppShell {...props}>
            <p>content</p>
          </AppShell>
        </MemoryRouter>
      );

    it("shows the application identity and both navigation destinations", () => {
      renderShell();

      expect(screen.getByText("TokTickIT")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My Tickets" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    });

    it("marks the active page structurally as well as visually", () => {
      renderShell();
      const active = screen.getByRole("link", { name: "My Tickets" });

      expect(active).toHaveAttribute("aria-current", "page");
      expect(active).toHaveClass("zg-nav-link--active");
      expect(screen.getByRole("link", { name: "Create Ticket" })).not.toHaveAttribute(
        "aria-current"
      );
    });

    it("exposes the mobile navigation as a labelled disclosure", async () => {
      renderShell();
      const toggle = screen.getByRole("button", { name: "Menu" });

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("shows the selected Requester and a Change Requester action", () => {
      renderShell({ requesterName: "Somchai Prasert", onChangeRequester: () => {} });

      expect(screen.getByText("Somchai Prasert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
    });

    it("omits the identity area until a Requester has been selected", () => {
      renderShell();
      expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    });
  });
});
