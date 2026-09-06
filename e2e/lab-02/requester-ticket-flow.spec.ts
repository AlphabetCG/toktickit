import { test, expect, type Page } from "@playwright/test";
import {
  REQUESTERS,
  TICKET_NUMBER_RE,
  PNG_1x1,
  runToken,
  selectRequester,
  changeRequester,
  createTicket,
  openCreatedTicket,
} from "./helpers";

// End-to-end journeys (tests.md §2.6). Each test is self-contained: it selects a
// Requester and creates its own data, then asserts against a unique per-run token
// so a database that accumulates rows across runs stays deterministic.

// E2E-01 — AC-01, AC-07, AC-15: the whole intake journey.
test("E2E-01: select Requester, create a Ticket, and find it in My Tickets", async ({ page }) => {
  const token = runToken();
  await selectRequester(page, REQUESTERS.somchai);

  const number = await createTicket(page, {
    summary: `Laptop battery drains quickly ${token}`,
    description: `The battery drops from 100% to 20% in about an hour. Reproduced twice today. ${token}`,
  });
  expect(number).toMatch(TICKET_NUMBER_RE);

  // The official number is found again on the owner's list.
  await page.goto("/tickets");
  await page.getByLabel("Search tickets").fill(token);
  const row = page.locator("tr.zg-row", { hasText: number });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(token);
});

// E2E-02 — AC-04, AC-15: switching Requester clears the previous Requester's data.
test("E2E-02: a Ticket vanishes from the list after switching Requester", async ({ page }) => {
  const token = runToken();
  await selectRequester(page, REQUESTERS.somchai);
  const number = await createTicket(page, {
    summary: `Only Somchai should see this ${token}`,
    description: `Requester-scoping check for the switch journey. ${token}`,
  });

  await page.goto("/tickets");
  await page.getByLabel("Search tickets").fill(token);
  await expect(page.locator("tr.zg-row", { hasText: number })).toHaveCount(1);

  // Switch to a different Requester; the ticket must not appear anywhere.
  await changeRequester(page, REQUESTERS.nadia);
  await page.getByLabel("Search tickets").fill(token);
  await expect(page.locator("tr.zg-row", { hasText: number })).toHaveCount(0);
  await expect(page.getByText(number)).toHaveCount(0);
});

// E2E-03 — AC-26, AC-30, AC-31, AC-32: upload, download, soft-remove, refuse.
test("E2E-03: upload, download, then soft-remove an attachment and lose download", async ({ page }) => {
  const token = runToken();
  await selectRequester(page, REQUESTERS.anong);
  await createTicket(page, {
    summary: `Attachment lifecycle ${token}`,
    description: `Exercises upload, download, and soft removal end to end. ${token}`,
  });
  await openCreatedTicket(page);

  const filename = `evidence-${token}.png`;
  await page.getByLabel("Add attachment").setInputFiles({
    name: filename,
    mimeType: "image/png",
    buffer: PNG_1x1,
  });

  // Active row appears with a working Download control.
  const activeRow = page.locator("li.zg-attachment", { hasText: filename });
  await expect(activeRow).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    activeRow.getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(filename);

  // Soft-remove requires confirmation and a reason (BR-53).
  await activeRow.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Reason for removal/).fill("Uploaded the wrong screenshot");
  await dialog.getByRole("button", { name: "Remove" }).click();

  // The file stays on record, badged Removed with its reason, and exposes no
  // download control at all (BR-08, BR-55).
  const removed = page.getByTestId("removed-attachments");
  await expect(removed.getByText(filename)).toBeVisible();
  await expect(removed.getByText("Removed", { exact: true })).toBeVisible();
  await expect(removed.getByText("Uploaded the wrong screenshot")).toBeVisible();
  await expect(removed.getByRole("button", { name: "Download" })).toHaveCount(0);
});

// E2E-04 — AC-24: a direct URL to another Requester's Ticket is refused.
test("E2E-04: a direct URL to another Requester's Ticket leaks no data", async ({ page }) => {
  const token = runToken();
  await selectRequester(page, REQUESTERS.somchai);
  await createTicket(page, {
    summary: `Private to Somchai ${token}`,
    description: `Only the owner may open this by URL. ${token}`,
  });
  const id = await openCreatedTicket(page);

  // Switch owners, then hit the previous owner's Ticket URL directly.
  await changeRequester(page, REQUESTERS.peter);
  await page.goto(`/tickets/${id}`);

  await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
  await expect(page.getByText(token)).toHaveCount(0); // no summary/description leak
});

// E2E-05 — AC-38: the selection and Create Ticket screens are completable by
// keyboard alone, with a visible focus indicator at every step.
test("E2E-05: complete selection and Create Ticket by keyboard only", async ({ page }) => {
  const token = runToken();

  // --- Selection screen, keyboard only ---
  await page.goto("/select");
  await page.locator("#requester").waitFor();

  await page.keyboard.press("Tab"); // first focusable is the Requester select
  await expectFocused(page, "#requester");
  await page.keyboard.type(REQUESTERS.anong.slice(0, 6)); // native type-ahead
  await expect(page.locator("#requester")).toHaveValue(/\d+/);
  const chosen = await page.locator("#requester option:checked").innerText();
  expect(chosen).toContain(REQUESTERS.anong);

  await page.keyboard.press("Tab"); // Continue button
  await expectFocused(page, ".zg-select-continue");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/tickets");

  // --- Create Ticket form, keyboard only ---
  await page.goto("/tickets/new");
  await page.locator("#categoryId").waitFor();

  await tabUntil(page, "#categoryId");
  await page.keyboard.type("Hardware");
  await expect(page.locator("#categoryId")).toHaveValue(/\d+/);

  await tabUntil(page, "#relatedSystemId");
  await page.keyboard.type("Corporate");
  await expect(page.locator("#relatedSystemId")).toHaveValue(/\d+/);

  // Requested Priority defaults to Medium (a valid choice); the radio group is a
  // single tab stop, so we simply move past it.
  await tabUntil(page, "#summary");
  await page.keyboard.type(`Keyboard-only intake ${token}`);

  await tabUntil(page, "#description");
  await page.keyboard.type(`Filed with the keyboard alone to prove AC-38. ${token}`);

  await tabUntil(page, 'button:has-text("Submit Ticket")');
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.locator(".zg-ticket-number")).toHaveText(TICKET_NUMBER_RE);
});

/** Asserts the given selector is the active element and shows a visible focus ring. */
async function expectFocused(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeFocused();
  const focusVisible = await page.evaluate(() => {
    const el = document.activeElement;
    return !!el && el !== document.body && el.matches(":focus-visible");
  });
  expect(focusVisible).toBeTruthy();
}

/** Presses Tab (bounded) until the target selector holds focus, asserting focus is visible. */
async function tabUntil(page: Page, selector: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await page.locator(selector).evaluate((el) => el === document.activeElement).catch(() => false)) {
      await expectFocused(page, selector);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab focus never reached ${selector} within ${max} presses`);
}
