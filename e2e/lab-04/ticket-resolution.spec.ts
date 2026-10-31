import { test, expect, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  createTicketViaApi,
  runToken,
  pageAs,
  setStatus,
  addAction,
  withApi,
  type TestUser,
} from "./helpers";

// E2E-04…E2E-07 (docs/lab-04/tests.md §2.11): the resolution gate, a stale status
// change between two people, and the Requester's view of the work.

let requester: TestUser;
let staffA: TestUser;
let staffB: TestUser;

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Res Req");
  staffA = await provisionUser("IT_STAFF", "Res Staff A");
  staffB = await provisionUser("IT_STAFF", "Res Staff B");
});

test.afterAll(retireProvisionedUsers);

const ops = (page: Page) => page.getByRole("region", { name: "Ticket Operations" });
const statusOptions = (page: Page) => ops(page).locator("#status option");
const gate = (page: Page) => ops(page).locator(".zg-gate");
const history = (page: Page) => page.getByRole("region", { name: "Status history" });

/** Records a Completed action through the real form. */
async function completeActionInUi(page: Page, description: string): Promise<void> {
  await page.getByRole("region", { name: "Actions Taken" }).getByRole("button", { name: "+ Add action" }).click();
  const form = page.getByRole("dialog", { name: "Add action" });
  await form.getByLabel("Completed").check();
  await form.getByLabel(/Action description/).fill(description);
  await form.getByLabel(/^Result/).fill("Done and checked with the Requester.");
  await form.getByRole("button", { name: "Save action" }).click();
  await expect(form).toBeHidden();
}

// E2E-04 — AC-26, AC-29, AC-30
test("E2E-04: Resolved appears only once work is completed; resolving updates the badge and the history", async ({
  browser,
}) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Resolve me ${token}`);
  await setStatus(staffA, id, "IN_PROGRESS");
  const page = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });

  // No completed work: no Resolved option, and the reason in plain words.
  await expect(statusOptions(page)).toContainText(["Waiting for Requester"]);
  await expect(statusOptions(page).filter({ hasText: "Resolved" })).toHaveCount(0);
  await expect(gate(page)).toContainText("To resolve this ticket:");
  await expect(gate(page)).toContainText("Complete at least one action.");

  // Recording completed work refreshes the gate without a reload (BR-25).
  await completeActionInUi(page, `Replaced the battery ${token}`);
  await expect(statusOptions(page).filter({ hasText: "Resolved" })).toHaveCount(1);
  await expect(gate(page)).toHaveCount(0);

  await ops(page).locator("#status").selectOption("RESOLVED");
  await ops(page).getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".zg-detail-badges .zg-badge").first()).toHaveText("Resolved");
  const last = history(page).locator(".zg-history__entry").last();
  await expect(last).toContainText(/In Progress\s*→\s*to\s*Resolved/);
  await expect(last).toContainText(staffA.name);
});

// E2E-05 — AC-28
test("E2E-05: an outstanding follow-up keeps Resolved unavailable until it is recorded", async ({ browser }) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Follow-up ${token}`);
  await setStatus(staffA, id, "IN_PROGRESS");
  await addAction(staffA, id, {
    description: `Reset the VPN profile ${token}`,
    status: "COMPLETED",
    result: "Profile reset; the Requester will test from home.",
    followUpRequired: true,
    followUpNote: "Confirm the connection holds overnight.",
  });
  const page = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });

  await expect(statusOptions(page).filter({ hasText: "Resolved" })).toHaveCount(0);
  await expect(gate(page)).toContainText("Record the requested follow-up as a newer completed action.");

  await completeActionInUi(page, `Confirmed overnight connection ${token}`);
  await expect(statusOptions(page).filter({ hasText: "Resolved" })).toHaveCount(1);
});

// E2E-06 — AC-37, AC-40
test("E2E-06: two people change one Ticket; the second is refused with the conflict banner and Reload shows the winner", async ({
  browser,
}) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Two people ${token}`);
  await setStatus(staffA, id, "IN_PROGRESS");
  const first = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });
  const second = await pageAs(browser, staffB, { path: `/staff/tickets/${id}` });
  await expect(ops(first).locator("#status")).toBeVisible();
  await expect(ops(second).locator("#status")).toBeVisible();

  await ops(first).locator("#status").selectOption("WAITING_FOR_REQUESTER");
  await ops(first).getByRole("button", { name: "Apply" }).click();
  await expect(first.locator(".zg-detail-badges .zg-badge").first()).toHaveText("Waiting for Requester");

  // The second page still holds the version it read before the first change.
  await ops(second).locator("#status").selectOption("CANCELLED");
  await ops(second).getByRole("button", { name: "Apply" }).click();
  await second.getByRole("dialog", { name: "Cancel ticket" }).getByRole("button", { name: "Cancel ticket" }).click();
  const banner = ops(second).getByRole("alert");
  await expect(banner).toContainText("This ticket was changed by someone else.");
  await expect(second.locator(".zg-detail-badges .zg-badge").first()).toHaveText("In Progress");

  await banner.getByRole("button", { name: "Reload" }).click();
  await expect(second.locator(".zg-detail-badges .zg-badge").first()).toHaveText("Waiting for Requester");
  await expect(ops(second).getByRole("alert")).toHaveCount(0);
  // The loser's change did not happen.
  const status = await withApi(staffB, async (ctx) => (await (await ctx.get(`/api/tickets/${id}`)).json()).currentStatus);
  expect(status).toBe("WAITING_FOR_REQUESTER");
});

// E2E-07 — AC-31, AC-36
test("E2E-07: the Requester signals resolution, sees the work and history as IT Support, and never an Internal Note", async ({
  browser,
}) => {
  const token = runToken();
  const { id, ticketNumber } = await createTicketViaApi(requester, `Requester view ${token}`);
  await setStatus(staffA, id, "IN_PROGRESS");
  await addAction(staffA, id, {
    description: `Updated the printer driver ${token}`,
    status: "COMPLETED",
    result: "Printing works from Word and the browser.",
  });
  const note = `Driver came from the vendor portal ${token}`;
  await withApi(staffA, async (ctx) => {
    expect((await ctx.post(`/api/tickets/${id}/notes`, { data: { body: note } })).status()).toBe(201);
  });

  const page = await pageAs(browser, requester, { path: `/tickets/${id}` });
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();

  // The work: read-only, with its result.
  const actions = page.getByRole("region", { name: "Actions Taken" });
  await expect(actions).toContainText(`Updated the printer driver ${token}`);
  await expect(actions).toContainText("Printing works from Word and the browser.");
  await expect(actions.getByRole("button")).toHaveCount(0);

  // History: oldest first; the staff change reads "IT Support", the creation "You".
  const entries = history(page).locator(".zg-history__entry");
  await expect(entries.first()).toContainText("You");
  await expect(entries.last()).toContainText(/New\s*→\s*to\s*In Progress/);
  await expect(entries.last()).toContainText("IT Support");
  await expect(history(page)).not.toContainText(staffA.name);

  // Signalling resolution records the signal; the status does not change (BR-29).
  await page.getByRole("button", { name: "Problem appears resolved" }).click();
  await page.getByRole("dialog", { name: "Report resolved" }).getByRole("button", { name: "Yes, it looks resolved" }).click();
  await expect(page.getByText("✓ You reported this resolved")).toBeVisible();
  await expect(page.getByText("Current Status").locator("..")).toContainText("In Progress");

  // Never the Internal Note.
  await expect(page.getByText(note)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Internal Notes" })).toHaveCount(0);
});
