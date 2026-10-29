import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsTaken } from "../../src/components/ActionsTaken.js";
import * as api from "../../src/api.js";

// UI-01…UI-14 (docs/lab-04/tests.md §2.7). Contract: ui-spec §2.5–§2.7, §7.2,
// §7.3, §8.
vi.mock("../../src/api.js", async (importOriginal) => {
  const real = await importOriginal<typeof api>();
  return {
    ...real,
    getActions: vi.fn(),
    createAction: vi.fn(),
    updateAction: vi.fn(),
  };
});

const getActions = vi.mocked(api.getActions);
const createAction = vi.mocked(api.createAction);
const updateAction = vi.mocked(api.updateAction);

const ME = 4;
const ASSIGNEES: api.Assignee[] = [
  { id: 4, name: "Anong Srisai", role: "IT_STAFF" },
  { id: 6, name: "Krit Wongsa", role: "IT_STAFF" },
];

const action = (over: Partial<api.ActionTaken> = {}): api.ActionTaken => ({
  id: 31,
  ticketId: 12,
  actionAt: "2026-10-14T02:30:00.000Z",
  description: "Replace the laptop battery",
  result: "",
  status: "PLANNED",
  performedBy: { id: 6, name: "Krit Wongsa" },
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

const onTicketReload = vi.fn();

function renderStaff(status: api.TicketStatusValue = "IN_PROGRESS") {
  return render(
    <ActionsTaken
      ticketId={12}
      ticketStatus={status}
      mode="staff"
      assignees={ASSIGNEES}
      currentUserId={ME}
      onTicketReload={onTicketReload}
    />
  );
}

function renderRequester() {
  return render(<ActionsTaken ticketId={12} ticketStatus="IN_PROGRESS" mode="requester" />);
}

const section = () => screen.getByRole("region", { name: /Actions Taken/ });
const rows = () => within(section()).getAllByRole("listitem");
const dialog = (name: RegExp | string) => screen.getByRole("dialog", { name });

beforeEach(() => {
  vi.clearAllMocks();
});

// UI-01 — FR-05, AC-17
it("UI-01: renders rows in API order with every field, the status text, and the follow-up marker", async () => {
  getActions.mockResolvedValue([
    action({
      id: 2,
      actionAt: "2026-10-13T08:10:00.000Z",
      description: "Ran battery diagnostics",
      status: "COMPLETED",
      result: "Capacity at 41 %.",
      performedBy: { id: 4, name: "Anong Srisai" },
      followUpRequired: true,
      followUpNote: "Order a replacement battery.",
      attachmentNotes: "see battery-report.pdf",
    }),
    action({ id: 1 }),
  ]);
  renderStaff();

  await screen.findByText("Ran battery diagnostics");
  const [first, second] = rows();
  expect(within(first).getByText("Ran battery diagnostics")).toBeInTheDocument();
  expect(within(first).getByText("Capacity at 41 %.")).toBeInTheDocument();
  expect(within(first).getByText("Completed")).toBeInTheDocument();
  expect(within(first).getByText("Follow-up needed")).toBeInTheDocument();
  expect(within(first).getByText("Order a replacement battery.")).toBeInTheDocument();
  expect(within(first).getByText(/Files: see battery-report\.pdf/)).toBeInTheDocument();
  expect(within(first).getByText("Anong Srisai")).toBeInTheDocument();

  expect(within(second).getByText("Replace the laptop battery")).toBeInTheDocument();
  expect(within(second).getByText("Planned")).toBeInTheDocument();
  expect(within(second).getByText("—")).toBeInTheDocument(); // empty result
  expect(within(second).getByText("Recorded by Anong Srisai")).toBeInTheDocument(); // creator ≠ performer
  expect(within(first).queryByText(/Recorded by/)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Actions Taken (2)" })).toBeInTheDocument();
});

// UI-02 — FR-01, FR-02
it("UI-02: Add action defaults the performer to me and the time to now, and sends one request with a clientRequestId", async () => {
  getActions.mockResolvedValue([]);
  createAction.mockResolvedValue(action({ id: 40, description: "Checked cabling", performedBy: { id: 4, name: "Anong Srisai" } }));
  const user = userEvent.setup();
  renderStaff();

  await user.click(await screen.findByRole("button", { name: "+ Add action" }));
  const form = dialog("Add action");
  const performer = within(form).getByLabelText(/Performed by/) as HTMLSelectElement;
  expect(performer.value).toBe("4");
  expect(within(form).getByRole("option", { name: "Anong Srisai (you)" })).toBeInTheDocument();
  const when = within(form).getByLabelText(/Action date and time/) as HTMLInputElement;
  expect(Math.abs(new Date(when.value).getTime() - Date.now())).toBeLessThan(2 * 60_000);

  await user.type(within(form).getByLabelText(/Action description/), "Checked cabling");
  await user.click(within(form).getByRole("button", { name: "Save action" }));

  await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1));
  const [ticketId, input] = createAction.mock.calls[0];
  expect(ticketId).toBe(12);
  expect(input).toMatchObject({ description: "Checked cabling", status: "PLANNED", performedById: 4 });
  expect(input.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(new Date(input.actionAt).toISOString()).toBe(input.actionAt);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

// UI-03 — AC-06, AC-07, AC-08
it("UI-03: shows each client-side error beneath its field and sends nothing", async () => {
  getActions.mockResolvedValue([]);
  const user = userEvent.setup();
  renderStaff();
  await user.click(await screen.findByRole("button", { name: "+ Add action" }));
  const form = dialog("Add action");

  expect(within(form).queryByLabelText(/Follow-up note/)).not.toBeInTheDocument();
  await user.click(within(form).getByLabelText(/Follow-up required/));
  const note = within(form).getByLabelText(/Follow-up note/);
  expect(note).toHaveFocus(); // revealing it moves focus there (ui-spec §11)
  await user.click(within(form).getByLabelText("Completed"));
  await user.click(within(form).getByRole("button", { name: "Save action" }));

  const description = within(form).getByLabelText(/Action description/);
  expect(description).toHaveAccessibleDescription(/Describe the action/);
  expect(note).toHaveAccessibleDescription(/Describe the follow-up/);
  expect(within(form).getByLabelText(/^Result/)).toHaveAccessibleDescription(/Record the result/);
  expect(description).toHaveFocus(); // first invalid field
  expect(createAction).not.toHaveBeenCalled();
});

// UI-04 — FR-03
it("UI-04: Edit prefills every field and saves with expectedVersion", async () => {
  getActions.mockResolvedValue([
    action({ version: 3, followUpRequired: true, followUpNote: "Call back", attachmentNotes: "photo.jpg", result: "Half done" }),
  ]);
  updateAction.mockResolvedValue(action({ version: 4, description: "Replace the battery and test" }));
  const user = userEvent.setup();
  renderStaff();

  await user.click(await screen.findByRole("button", { name: "Edit" }));
  const form = dialog("Edit action");
  expect(within(form).getByLabelText(/Action description/)).toHaveValue("Replace the laptop battery");
  expect(within(form).getByLabelText(/^Result/)).toHaveValue("Half done");
  expect(within(form).getByLabelText(/Performed by/)).toHaveValue("6");
  expect(within(form).getByLabelText(/Follow-up required/)).toBeChecked();
  expect(within(form).getByLabelText(/Follow-up note/)).toHaveValue("Call back");
  expect(within(form).getByLabelText(/Attachment notes/)).toHaveValue("photo.jpg");
  expect(within(form).queryByLabelText("Planned")).not.toBeInTheDocument(); // status via row controls only

  await user.type(within(form).getByLabelText(/Action description/), " and test");
  await user.click(within(form).getByRole("button", { name: "Save action" }));
  await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1));
  expect(updateAction.mock.calls[0][0]).toBe(31);
  expect(updateAction.mock.calls[0][1]).toMatchObject({ expectedVersion: 3, description: "Replace the laptop battery and test" });
});

// UI-05 — AC-11, FR-04
describe("UI-05: Start and Complete", () => {
  it("offers Start only on a Planned action and Complete on Planned and In progress", async () => {
    getActions.mockResolvedValue([
      action({ id: 1, actionAt: "2026-10-13T01:00:00.000Z", description: "Planned work" }),
      action({ id: 2, actionAt: "2026-10-13T02:00:00.000Z", description: "Work under way", status: "IN_PROGRESS" }),
    ]);
    renderStaff();
    await screen.findByText("Planned work");
    const [planned, inProgress] = rows();
    expect(within(planned).getByRole("menuitem", { name: "Start" })).toBeInTheDocument();
    expect(within(planned).getByRole("menuitem", { name: "Complete" })).toBeInTheDocument();
    expect(within(inProgress).queryByRole("menuitem", { name: "Start" })).not.toBeInTheDocument();
    expect(within(inProgress).getByRole("menuitem", { name: "Complete" })).toBeInTheDocument();
  });

  it("starts with the stored version", async () => {
    getActions.mockResolvedValue([action({ version: 2 })]);
    updateAction.mockResolvedValue(action({ status: "IN_PROGRESS", version: 3 }));
    const user = userEvent.setup();
    renderStaff();
    await user.click(await screen.findByRole("menuitem", { name: "Start" }));
    expect(updateAction).toHaveBeenCalledWith(31, { expectedVersion: 2, status: "IN_PROGRESS" });
    expect(await screen.findByText("In progress")).toBeInTheDocument();
  });

  it("asks for a result first when completing an action that has none", async () => {
    getActions.mockResolvedValue([action({ status: "IN_PROGRESS" })]);
    updateAction.mockResolvedValue(action({ status: "COMPLETED", result: "New battery fitted.", version: 2 }));
    const user = userEvent.setup();
    renderStaff();
    await user.click(await screen.findByRole("menuitem", { name: "Complete" }));
    expect(updateAction).not.toHaveBeenCalled();

    const form = dialog("Complete action");
    const result = within(form).getByLabelText(/^Result/);
    expect(result).toHaveFocus();
    await user.type(result, "New battery fitted.");
    await user.click(within(form).getByRole("button", { name: "Save action" }));
    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith(31, expect.objectContaining({ status: "COMPLETED", result: "New battery fitted.", expectedVersion: 1 }))
    );
  });

  it("completes directly when the action already has a result", async () => {
    getActions.mockResolvedValue([action({ status: "IN_PROGRESS", result: "Fitted." })]);
    updateAction.mockResolvedValue(action({ status: "COMPLETED", result: "Fitted.", version: 2 }));
    const user = userEvent.setup();
    renderStaff();
    await user.click(await screen.findByRole("menuitem", { name: "Complete" }));
    expect(updateAction).toHaveBeenCalledWith(31, { expectedVersion: 1, status: "COMPLETED" });
  });
});

// UI-06 — AC-14, BR-16
it("UI-06: Cancel action asks for confirmation, and dismissing it sends nothing", async () => {
  getActions.mockResolvedValue([action()]);
  updateAction.mockResolvedValue(action({ status: "CANCELLED", version: 2 }));
  const user = userEvent.setup();
  renderStaff();

  await user.click(await screen.findByRole("menuitem", { name: "Cancel action" }));
  const confirm = dialog("Cancel this action?");
  expect(confirm).toHaveTextContent("It will stay in the list as Cancelled and can't be changed afterwards.");
  expect(within(confirm).getByRole("button", { name: "Keep action" })).toHaveFocus();
  await user.click(within(confirm).getByRole("button", { name: "Keep action" }));
  expect(updateAction).not.toHaveBeenCalled();

  await user.click(screen.getByRole("menuitem", { name: "Cancel action" }));
  await user.click(within(dialog("Cancel this action?")).getByRole("button", { name: "Cancel action" }));
  expect(updateAction).toHaveBeenCalledWith(31, { expectedVersion: 1, status: "CANCELLED" });
});

// UI-07 — AC-12, BR-15
it("UI-07: Completed and Cancelled rows offer no controls and use the read-only style", async () => {
  getActions.mockResolvedValue([
    action({ id: 1, status: "COMPLETED", result: "Done." }),
    action({ id: 2, status: "CANCELLED" }),
  ]);
  renderStaff();
  await screen.findAllByText("Replace the laptop battery");
  for (const row of rows()) {
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem")).not.toBeInTheDocument();
    expect(row).toHaveClass("zg-action-row--readonly");
  }
});

// UI-08 — AC-04, AC-60
it("UI-08: a server error on performedById appears beside Performed by and every value is kept", async () => {
  getActions.mockResolvedValue([]);
  createAction.mockRejectedValue(new api.ValidationError({ performedById: "Choose an active IT Staff member." }));
  const user = userEvent.setup();
  renderStaff();
  await user.click(await screen.findByRole("button", { name: "+ Add action" }));
  const form = dialog("Add action");
  await user.selectOptions(within(form).getByLabelText(/Performed by/), "6");
  await user.type(within(form).getByLabelText(/Action description/), "Swap the router");
  await user.type(within(form).getByLabelText(/Attachment notes/), "router.jpg");
  await user.click(within(form).getByRole("button", { name: "Save action" }));

  const performer = within(form).getByLabelText(/Performed by/);
  await waitFor(() => expect(performer).toHaveAccessibleDescription("Choose an active IT Staff member."));
  expect(performer).toHaveValue("6");
  expect(within(form).getByLabelText(/Action description/)).toHaveValue("Swap the router");
  expect(within(form).getByLabelText(/Attachment notes/)).toHaveValue("router.jpg");
});

// UI-09 — AC-19
it("UI-09: markup in a description renders as literal text", async () => {
  getActions.mockResolvedValue([action({ description: "<script>alert(1)</script><b>bold</b>" })]);
  const { container } = renderStaff();
  expect(await screen.findByText("<script>alert(1)</script><b>bold</b>")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
});

// UI-10 — AC-21, BR-18
it("UI-10: the Requester view is read-only, shows the performer, and never a creator", async () => {
  const { createdBy: _createdBy, ...withoutCreator } = action({ performedBy: { id: 6, name: "Krit Wongsa" } });
  getActions.mockResolvedValue([withoutCreator as api.ActionTaken]);
  renderRequester();
  await screen.findByText("Replace the laptop battery");
  expect(screen.getByText("Work the IT team has recorded on this ticket.")).toBeInTheDocument();
  expect(screen.getByText("Krit Wongsa")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  expect(screen.queryByText(/Recorded by/)).not.toBeInTheDocument();
  expect(rows()[0]).toHaveClass("zg-action-row--readonly");
});

it("shows the Requester's own empty message", async () => {
  getActions.mockResolvedValue([]);
  renderRequester();
  expect(await screen.findByText("The IT team hasn't recorded any work yet.")).toBeInTheDocument();
});

// UI-11 — BR-19
describe("UI-11: no new work on an inactive Ticket", () => {
  it.each([
    ["RESOLVED", "Reopen this ticket to record more work."],
    ["CLOSED", "This ticket is closed."],
    ["CANCELLED", "This ticket is closed."],
  ] as const)("%s replaces Add action with an explanation", async (status, sentence) => {
    getActions.mockResolvedValue([action()]);
    renderStaff(status);
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});

// UI-12 — AC-59
it("UI-12: a double click on Save action sends one request and shows the busy label", async () => {
  getActions.mockResolvedValue([]);
  let resolve!: (a: api.ActionTaken) => void;
  createAction.mockReturnValue(new Promise((r) => (resolve = r)));
  const user = userEvent.setup();
  renderStaff();
  await user.click(await screen.findByRole("button", { name: "+ Add action" }));
  const form = dialog("Add action");
  await user.type(within(form).getByLabelText(/Action description/), "Checked cabling");
  const save = within(form).getByRole("button", { name: "Save action" });
  await user.dblClick(save);

  expect(createAction).toHaveBeenCalledTimes(1);
  expect(within(form).getByRole("button", { name: "Saving…" })).toBeDisabled();
  resolve(action({ id: 41 }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

// UI-13 — AC-40
it("UI-13: a stale edit shows the conflict banner with Reload and keeps the entered values", async () => {
  getActions.mockResolvedValue([action()]);
  updateAction.mockRejectedValueOnce(
    new api.ConflictError("This action was changed by someone else. Reload to see the latest version.", "stale", {
      ...action({ status: "IN_PROGRESS", version: 2 }),
    })
  );
  const user = userEvent.setup();
  renderStaff();

  await user.click(await screen.findByRole("button", { name: "Edit" }));
  const form = dialog("Edit action");
  await user.clear(within(form).getByLabelText(/Action description/));
  await user.type(within(form).getByLabelText(/Action description/), "My new wording");
  await user.click(within(form).getByRole("button", { name: "Save action" }));

  const banner = await within(form).findByRole("alert");
  expect(banner).toHaveClass("zg-callout--conflict");
  expect(banner).toHaveTextContent("This action was changed by someone else.");
  expect(banner).toHaveTextContent("Status is now In progress. Your changes are still below.");
  expect(within(form).getByLabelText(/Action description/)).toHaveValue("My new wording");

  getActions.mockResolvedValue([action({ status: "IN_PROGRESS", version: 2 })]);
  updateAction.mockResolvedValueOnce(action({ status: "IN_PROGRESS", version: 3, description: "My new wording" }));
  await user.click(within(banner).getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(within(form).queryByRole("alert")).not.toBeInTheDocument());
  expect(onTicketReload).toHaveBeenCalled();
  expect(within(form).getByLabelText(/Action description/)).toHaveValue("My new wording");

  await user.click(within(form).getByRole("button", { name: "Save action" }));
  await waitFor(() =>
    expect(updateAction).toHaveBeenLastCalledWith(31, expect.objectContaining({ expectedVersion: 2, description: "My new wording" }))
  );
});

// UI-14 — FR-21
describe("UI-14: section states", () => {
  it("shows a skeleton while loading", () => {
    getActions.mockReturnValue(new Promise(() => undefined));
    renderStaff();
    expect(within(section()).getByLabelText("Loading actions…")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the staff empty message", async () => {
    getActions.mockResolvedValue([]);
    renderStaff();
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
    expect(screen.getByText(/Use \+ Add action to record the work\./)).toBeInTheDocument();
  });

  it("shows a safe failure with Try again, in this section only", async () => {
    getActions.mockRejectedValueOnce(new Error("HTTP 500"));
    getActions.mockResolvedValueOnce([action()]);
    const user = userEvent.setup();
    renderStaff();
    const failure = await within(section()).findByRole("alert");
    expect(failure).toHaveTextContent("We couldn't load the actions.");
    expect(failure).not.toHaveTextContent("500");
    await user.click(within(failure).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Replace the laptop battery")).toBeInTheDocument();
  });
});

describe("dialog keyboard behaviour (ui-spec §11)", () => {
  it("closes on Escape and returns focus to the control that opened it", async () => {
    getActions.mockResolvedValue([]);
    const user = userEvent.setup();
    renderStaff();
    const opener = await screen.findByRole("button", { name: "+ Add action" });
    await user.click(opener);
    expect(dialog("Add action")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    getActions.mockResolvedValue([]);
    const user = userEvent.setup();
    renderStaff();
    await user.click(await screen.findByRole("button", { name: "+ Add action" }));
    const form = dialog("Add action");
    for (let i = 0; i < 20; i++) {
      await user.tab();
      expect(form.contains(document.activeElement)).toBe(true);
    }
  });
});
