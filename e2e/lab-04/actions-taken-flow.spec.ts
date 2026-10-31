import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  deactivateUser,
  createTicketViaApi,
  runToken,
  pageAs,
  setOwner,
  addAction,
  type TestUser,
} from "./helpers";

// E2E-01…E2E-03 (docs/lab-04/tests.md §2.11): the Actions Taken journey on the
// real Staff Ticket Detail, against the real API and PostgreSQL.

let requester: TestUser;
let staffA: TestUser;
let staffB: TestUser;
let staffC: TestUser;

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Act Req");
  staffA = await provisionUser("IT_STAFF", "Act Staff A");
  staffB = await provisionUser("IT_STAFF", "Act Staff B");
  staffC = await provisionUser("IT_STAFF", "Act Staff C");
});

test.afterAll(retireProvisionedUsers);

const actions = (page: Page) => page.getByRole("region", { name: "Actions Taken" });
const rowWith = (page: Page, text: string) => actions(page).locator(".zg-action-row", { hasText: text });

/** Opens a row's ⋯ menu and chooses an item (ui-spec §7.2, desktop). */
async function rowMenu(row: Locator, item: string): Promise<void> {
  await row.getByRole("button", { name: /^More actions for / }).click();
  await row.getByRole("menuitem", { name: item }).click();
}

// E2E-01 — AC-01, AC-11
test("E2E-01: IT Staff add, edit, start, and complete an action; the list follows each step", async ({ browser }) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Action lifecycle ${token}`);
  const page = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });

  await expect(actions(page).getByText("No actions recorded yet.")).toBeVisible();

  // Add — Planned by default, performed by the current user.
  await actions(page).getByRole("button", { name: "+ Add action" }).click();
  const form = page.getByRole("dialog", { name: "Add action" });
  await expect(form.getByLabel("Planned")).toBeChecked();
  await expect(form.locator("#action-performer option:checked")).toHaveText(`${staffA.name} (you)`);
  await form.getByLabel(/Action description/).fill(`Check the battery health ${token}`);
  await form.getByRole("button", { name: "Save action" }).click();
  await expect(form).toBeHidden();
  const row = rowWith(page, token);
  await expect(row).toHaveCount(1);
  await expect(row.locator(".zg-badge")).toHaveText("Planned");

  // Edit — the form opens prefilled; the change shows in the list.
  await row.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit action" });
  await expect(edit.getByLabel(/Action description/)).toHaveValue(`Check the battery health ${token}`);
  await edit.getByLabel(/Action description/).fill(`Run the battery diagnostic ${token}`);
  await edit.getByRole("button", { name: "Save action" }).click();
  await expect(edit).toBeHidden();
  await expect(row).toContainText(`Run the battery diagnostic ${token}`);

  // Start.
  await rowMenu(row, "Start");
  await expect(row.locator(".zg-badge")).toHaveText("In progress");

  // Complete — with no Result yet, the form asks for one first (BR-07).
  await rowMenu(row, "Complete");
  const complete = page.getByRole("dialog", { name: "Complete action" });
  await expect(complete.getByLabel(/^Result/)).toBeFocused();
  await complete.getByLabel(/^Result/).fill("Battery at 61 % capacity; replacement ordered.");
  await complete.getByRole("button", { name: "Save action" }).click();
  await expect(complete).toBeHidden();
  await expect(row.locator(".zg-badge")).toHaveText("Completed");
  await expect(row).toContainText("Battery at 61 % capacity");
  // Final: no more controls (BR-15).
  await expect(row.getByRole("button")).toHaveCount(0);

  // Persisted: a reload reads the same row back.
  await page.reload();
  await expect(rowWith(page, token).locator(".zg-badge")).toHaveText("Completed");
});

// E2E-02 — AC-03
test("E2E-02: an action performed by someone other than the Owner; the Requester sees it read-only", async ({ browser }) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Performer not owner ${token}`);
  await setOwner(staffC, id, staffC.id);

  const page = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });
  await actions(page).getByRole("button", { name: "+ Add action" }).click();
  const form = page.getByRole("dialog", { name: "Add action" });
  await form.locator("#action-performer").selectOption({ label: staffB.name });
  await form.getByLabel("Completed").check();
  await form.getByLabel(/Action description/).fill(`Swapped the docking station ${token}`);
  await form.getByLabel(/^Result/).fill("Docking station replaced; both monitors detected.");
  await form.getByRole("button", { name: "Save action" }).click();
  await expect(form).toBeHidden();

  const row = rowWith(page, token);
  await expect(row).toContainText(`Performed by: ${staffB.name}`);
  await expect(row).toContainText(`Recorded by ${staffA.name}`);
  await expect(page.getByRole("region", { name: "Ticket Operations" }).locator("#owner option:checked")).toHaveText(staffC.name);

  // The Requester: B's name, no creator, no controls (BR-18).
  const reqPage = await pageAs(browser, requester, { path: `/tickets/${id}` });
  const reqRow = rowWith(reqPage, token);
  await expect(reqRow).toContainText(staffB.name);
  await expect(reqRow).not.toContainText("Recorded by");
  await expect(reqRow.getByRole("button")).toHaveCount(0);
  await expect(actions(reqPage).getByRole("button", { name: "+ Add action" })).toHaveCount(0);
});

// E2E-03 — AC-14, AC-04
test("E2E-03: cancelling needs confirmation; a performer deactivated mid-session is refused beside the field", async ({
  browser,
}) => {
  const token = runToken();
  const { id } = await createTicketViaApi(requester, `Cancel and inactive ${token}`);
  await addAction(staffA, id, { description: `Planned visit ${token}`, status: "PLANNED" });
  const page = await pageAs(browser, staffA, { path: `/staff/tickets/${id}` });
  const row = rowWith(page, token);

  // Dismissing the confirmation changes nothing.
  await rowMenu(row, "Cancel action");
  const confirm = page.getByRole("dialog", { name: "Cancel this action?" });
  await confirm.getByRole("button", { name: "Keep action" }).click();
  await expect(confirm).toBeHidden();
  await expect(row.locator(".zg-badge")).toHaveText("Planned");

  // Confirming cancels; the row stays, read-only and marked Cancelled.
  await rowMenu(row, "Cancel action");
  await page.getByRole("dialog", { name: "Cancel this action?" }).getByRole("button", { name: "Cancel action" }).click();
  await expect(row.locator(".zg-badge")).toHaveText("Cancelled");
  await expect(row.getByRole("button")).toHaveCount(0);

  // A performer chosen while active, deactivated before the save.
  const leaving = await provisionUser("IT_STAFF", "Act Leaving");
  await page.reload();
  await actions(page).getByRole("button", { name: "+ Add action" }).click();
  const form = page.getByRole("dialog", { name: "Add action" });
  await form.locator("#action-performer").selectOption({ label: leaving.name });
  await form.getByLabel(/Action description/).fill(`Hand over to the leaver ${token}`);
  await deactivateUser(leaving.id);
  await form.getByRole("button", { name: "Save action" }).click();

  await expect(form.locator("#action-performer-message")).toHaveText("Choose an active IT Staff member.");
  await expect(form.locator("#action-performer")).toHaveAttribute("aria-invalid", "true");
  // Nothing was recorded, and what was typed is still there (AC-60).
  await expect(form.getByLabel(/Action description/)).toHaveValue(`Hand over to the leaver ${token}`);
  await expect(rowWith(page, "Hand over to the leaver")).toHaveCount(0);
});
