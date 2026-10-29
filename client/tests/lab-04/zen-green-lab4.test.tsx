import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionStatusBadge, StatusBadge, type ActionStatus } from "../../src/components/Badge.js";
import { ActionsTaken } from "../../src/components/ActionsTaken.js";
import * as api from "../../src/api.js";

// STYLE-01, STYLE-02, STYLE-04, STYLE-05 (docs/lab-04/tests.md §2.8). STYLE-03,
// the dashboard metric card, arrives with #52.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return { ...real, getActions: vi.fn() };
});
const getActions = vi.mocked(api.getActions);

const css = readFileSync(join(process.cwd(), "src", "theme.css"), "utf8");
const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

const action = (over: Partial<api.ActionTaken> = {}): api.ActionTaken => ({
  id: 1,
  ticketId: 12,
  actionAt: "2026-10-14T02:30:00.000Z",
  description: "Replace the laptop battery",
  result: "",
  status: "PLANNED",
  performedBy: { id: 4, name: "Anong Srisai" },
  createdBy: { id: 4, name: "Anong Srisai" },
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
  version: 1,
  completedAt: null,
  createdAt: "2026-10-14T02:20:00.000Z",
  updatedAt: "2026-10-14T02:20:00.000Z",
  ...over,
});

beforeEach(() => vi.clearAllMocks());

// STYLE-01 — AC-63
describe("STYLE-01: no literal colour in Lab 4 additions", () => {
  it.each(["components/ActionsTaken.tsx", "components/ActionForm.tsx", "components/Dialog.tsx"])(
    "%s contains no colour literal",
    (file) => {
      const source = readFileSync(join(process.cwd(), "src", file), "utf8");
      expect(source.split("\n").filter((line) => LITERAL.test(line))).toEqual([]);
    }
  );

  it("theme.css uses colour literals only to declare --zg-* tokens", () => {
    const hits = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => LITERAL.test(line) && !/^\s*--zg-[\w-]+\s*:/.test(line));
    expect(hits).toEqual([]);
  });
});

// STYLE-02 — AC-63
describe("STYLE-02: the action-status badge", () => {
  it.each([
    ["PLANNED", "Planned", "zg-badge--action-planned"],
    ["IN_PROGRESS", "In progress", "zg-badge--action-in-progress"],
    ["COMPLETED", "Completed", "zg-badge--action-completed"],
    ["CANCELLED", "Cancelled", "zg-badge--action-cancelled"],
  ] as [ActionStatus, string, string][])("%s renders %s through the shared badge", (value, text, cls) => {
    render(<ActionStatusBadge value={value} />);
    const badge = screen.getByText(text);
    expect(badge).toHaveClass("zg-badge", cls);
  });

  it("is square-cornered, unlike the pill-shaped Ticket status badge", () => {
    render(
      <>
        <ActionStatusBadge value="IN_PROGRESS" />
        <StatusBadge value="IN_PROGRESS" />
      </>
    );
    const [actionBadge, ticketBadge] = screen.getAllByText(/In progress/i);
    expect(actionBadge.className).not.toBe(ticketBadge.className);
    const actionRule = /\[class\*="zg-badge--action-"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(actionRule).toMatch(/border-radius:\s*var\(--zg-radius-sm\)/);
    // The shape is the difference ui-spec §2.5 relies on: Ticket statuses are pills.
    const statusRule = /\[class\*="zg-badge--status-"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(statusRule).toMatch(/border-radius:\s*999px/);
  });

  it("strikes through a Cancelled action and still says Cancelled", () => {
    const rule = /\.zg-badge--action-cancelled\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/text-decoration:\s*line-through/);
  });
});

// STYLE-04 — Part 9 checklist
describe("STYLE-04: editable versus read-only", () => {
  it("uses the editable field class in the staff action form", async () => {
    getActions.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <ActionsTaken
        ticketId={12}
        ticketStatus="IN_PROGRESS"
        mode="staff"
        assignees={[{ id: 4, name: "Anong Srisai", role: "IT_STAFF" }]}
        currentUserId={4}
      />
    );
    await user.click(await screen.findByRole("button", { name: "+ Add action" }));
    const form = screen.getByRole("dialog", { name: "Add action" });
    for (const label of [/Action description/, /Performed by/, /Attachment notes/]) {
      const field = within(form).getByLabelText(label);
      expect(field).toHaveClass("zg-field");
      expect(field).not.toHaveClass("zg-field--readonly");
    }
  });

  it("uses the read-only row style for every Requester action and every Completed staff action", async () => {
    getActions.mockResolvedValue([action({ id: 1, status: "COMPLETED", result: "Done." }), action({ id: 2 })]);
    const { unmount } = render(
      <ActionsTaken ticketId={12} ticketStatus="IN_PROGRESS" mode="staff" assignees={[]} currentUserId={4} />
    );
    const staffRows = await screen.findAllByRole("listitem");
    expect(staffRows[0]).toHaveClass("zg-action-row--readonly"); // Completed
    expect(staffRows[1]).not.toHaveClass("zg-action-row--readonly"); // Planned, editable
    unmount();

    render(<ActionsTaken ticketId={12} ticketStatus="IN_PROGRESS" mode="requester" />);
    for (const row of await screen.findAllByRole("listitem")) expect(row).toHaveClass("zg-action-row--readonly");
  });
});

// STYLE-05 — Part 9 checklist
it("STYLE-05: every action-form error sits beneath its own field and is linked by aria-describedby", async () => {
  getActions.mockResolvedValue([]);
  const user = userEvent.setup();
  render(
    <ActionsTaken
      ticketId={12}
      ticketStatus="IN_PROGRESS"
      mode="staff"
      assignees={[{ id: 4, name: "Anong Srisai", role: "IT_STAFF" }]}
      currentUserId={4}
    />
  );
  await user.click(await screen.findByRole("button", { name: "+ Add action" }));
  const form = screen.getByRole("dialog", { name: "Add action" });
  await user.click(within(form).getByLabelText(/Follow-up required/));
  await user.click(within(form).getByLabelText("Completed"));
  await user.click(within(form).getByRole("button", { name: "Save action" }));

  for (const label of [/Action description/, /^Result/, /Follow-up note/]) {
    const field = within(form).getByLabelText(label);
    const messageId = field.getAttribute("aria-describedby")!;
    const message = document.getElementById(messageId)!;
    expect(message).toHaveClass("zg-field-message--error");
    expect(message.textContent).not.toBe("");
    // Beneath its own field: the message follows the control in the same group.
    expect(field.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.closest(".zg-field-group")).toBe(message.closest(".zg-field-group"));
  }
});
