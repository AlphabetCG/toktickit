import { test, expect, type Browser, type Page } from "@playwright/test";
import { provisionUser, retireProvisionedUsers, createTicketViaApi, signIn, runToken, type TestUser } from "./helpers";


// E2E-05 and E2E-06 (docs/lab-03/tests.md §2.8) — the IT Staff journey and the
// two-sided conversation, each signed in as a real user in its own browser
// context so the Requester and IT Staff sessions never share a cookie.

let requester: TestUser;
let staff: TestUser;

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Flow Req");
  staff = await provisionUser("IT_STAFF", "Flow Staff");
});

test.afterAll(retireProvisionedUsers);

async function pageAs(browser: Browser, user: TestUser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, user);
  return page;
}

// E2E-05 — AC-33, AC-36, AC-37, AC-40
test("E2E-05: IT Staff claim, prioritise, transition, comment, and note — and the Requester never sees the note", async ({
  browser,
}) => {
  const token = runToken();
  const { id, ticketNumber } = await createTicketViaApi(requester, `Staff journey ${token}`);
  const staffPage = await pageAs(browser, staff);

  // Queue → open the ticket.
  await expect(staffPage).toHaveURL(/\/staff\/tickets$/);
  await staffPage.getByLabel("Search tickets").fill(token);
  await staffPage.getByRole("link", { name: ticketNumber }).first().click();
  await expect(staffPage).toHaveURL(new RegExp(`/staff/tickets/${id}$`));
  await expect(staffPage.getByRole("heading", { name: ticketNumber })).toBeVisible();

  const ops = staffPage.getByRole("region", { name: "Ticket Operations" });

  // AC-33 — claim.
  await ops.getByRole("button", { name: "Claim" }).click();
  await expect(ops.getByRole("button", { name: "Release" })).toBeVisible();
  await expect(ops.locator("#owner option:checked")).toHaveText(staff.name);

  // AC-36 — IT Priority changes; Requested Priority stays Medium.
  await ops.locator("#itPriority").selectOption("HIGH");
  await expect(ops.locator("#itPriority")).toHaveValue("HIGH");

  // AC-37 — a permitted transition.
  await ops.locator("#status").selectOption("IN_PROGRESS");
  await ops.getByRole("button", { name: "Apply" }).click();
  await expect(ops.locator("#status option", { hasText: "Waiting for Requester" })).toHaveCount(1);

  // Public Comment and Internal Note — different verbs, different panels.
  const comment = `Public reply ${token}`;
  const note = `Confidential note ${token}`;
  const comments = staffPage.getByRole("region", { name: "Public Comments" });
  await comments.getByLabel("Add a comment").fill(comment);
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(comments.getByText(comment)).toBeVisible();

  const notes = staffPage.getByRole("region", { name: "Internal Notes" });
  await notes.getByLabel("Add an internal note").fill(note);
  await notes.getByRole("button", { name: "Add note" }).click();
  await expect(notes.getByText(note)).toBeVisible();

  // Everything persisted: a reload reads it back from the server.
  await staffPage.reload();
  await expect(ops.locator("#owner option:checked")).toHaveText(staff.name);
  await expect(ops.locator("#itPriority")).toHaveValue("HIGH");
  await expect(staffPage.getByText("Requested Priority").locator("..")).toContainText("Medium");
  await expect(staffPage.locator(".zg-badge", { hasText: "In Progress" }).first()).toBeVisible();
  await expect(notes.getByText(note)).toBeVisible();

  // AC-40 — the Requester sees the comment and the new status, never the note.
  const reqPage = await pageAs(browser, requester);
  await reqPage.goto(`/tickets/${id}`);
  await expect(reqPage.getByRole("heading", { name: ticketNumber })).toBeVisible();
  await expect(reqPage.getByText(comment)).toBeVisible();
  await expect(reqPage.getByText(note)).toHaveCount(0);
  await expect(reqPage.getByRole("region", { name: "Internal Notes" })).toHaveCount(0);
  await expect(reqPage.getByText(/Visible to IT Staff only/)).toHaveCount(0);
});

// E2E-06 — AC-22, AC-24, AC-25
test("E2E-06: a Requester comments and signals resolution; IT Staff see both; the status is unchanged", async ({
  browser,
}) => {
  const token = runToken();
  const { id, ticketNumber } = await createTicketViaApi(requester, `Conversation ${token}`);

  // Staff leave a note first, so the Requester's view can be checked against it.
  const staffPage = await pageAs(browser, staff);
  await staffPage.goto(`/staff/tickets/${id}`);
  const note = `Staff-only diagnosis ${token}`;
  const notes = staffPage.getByRole("region", { name: "Internal Notes" });
  await notes.getByLabel("Add an internal note").fill(note);
  await notes.getByRole("button", { name: "Add note" }).click();
  await expect(notes.getByText(note)).toBeVisible();

  // AC-22 — the Requester posts a Public Comment.
  const reqPage = await pageAs(browser, requester);
  await reqPage.goto(`/tickets/${id}`);
  await expect(reqPage.getByRole("heading", { name: ticketNumber })).toBeVisible();
  const comment = `Requester follow-up ${token}`;
  const comments = reqPage.getByRole("region", { name: "Public Comments" });
  await comments.getByLabel("Add a comment").fill(comment);
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(comments.getByText(comment)).toBeVisible();

  // AC-25 — the resolution signal is recorded; the status badge stays New.
  await reqPage.getByRole("button", { name: "Problem appears resolved" }).click();
  await reqPage.getByRole("dialog", { name: "Report resolved" }).getByRole("button", { name: "Yes, it looks resolved" }).click();
  await expect(reqPage.getByText("✓ You reported this resolved")).toBeVisible();
  await expect(reqPage.getByText("Current Status").locator("..")).toContainText("New");

  // AC-24 — no trace of the note on the Requester's side.
  await expect(reqPage.getByText(note)).toHaveCount(0);
  await expect(reqPage.getByRole("region", { name: "Internal Notes" })).toHaveCount(0);

  // IT Staff see the comment and the signal; the status is still New.
  await staffPage.reload();
  await expect(staffPage.getByRole("region", { name: "Public Comments" }).getByText(comment)).toBeVisible();
  await expect(staffPage.getByText("Requester says resolved")).toBeVisible();
  await expect(staffPage.locator(".zg-badge", { hasText: /^New$/ }).first()).toBeVisible();
});
