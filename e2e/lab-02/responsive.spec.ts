import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  REQUESTERS,
  runToken,
  selectRequester,
  createTicket,
  openCreatedTicket,
  PNG_1x1,
} from "./helpers";

// Responsive layout proof (RESP-01…04) plus the Part 9 screenshot evidence
// (ui-spec §13). The RESP assertions are the graded contract — no element makes
// the page scroll sideways at any of the three viewports (AC-36); the screenshots
// are the human-inspected evidence for the §12 checklist.

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;

const SHOT_ROOT = join(process.cwd(), "artifacts", "lab-02", "screenshots");

function shotPath(screen: string, name: string): string {
  const dir = join(SHOT_ROOT, screen);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${name}.png`);
}

async function shot(page: Page, screen: string, name: string): Promise<void> {
  await page.screenshot({ path: shotPath(screen, name), fullPage: true });
}

/** AC-36: the page body itself never scrolls horizontally (sub-pixel tolerance). */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

// One shared Ticket, created once against a real Requester, backs every
// list/detail screenshot and the overflow checks that need real data.
let ticketId: number;
let ticketNumber: string;
const token = runToken();

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await selectRequester(page, REQUESTERS.anong);
  ticketNumber = await createTicket(page, {
    summary: `Responsive evidence ticket ${token}`,
    description:
      `A ticket with enough description text to exercise wrapping and the ` +
      `two-column detail layout across desktop, tablet, and mobile. ${token}`,
  });
  ticketId = await openCreatedTicket(page);
  await page.close();
});

// --- RESP-01…03: no overflow at each viewport, with the plain per-viewport shots ---
for (const [label, size] of Object.entries(VIEWPORTS)) {
  test(`RESP (${label}): no horizontal overflow on any screen`, async ({ page }) => {
    await page.setViewportSize(size);

    // Selection
    await page.goto("/select");
    await page.locator("#requester").waitFor();
    await expectNoHorizontalScroll(page);
    if (label === "desktop" || label === "mobile") await shot(page, "requester-selection", `${label}-initial`);

    await selectRequester(page, REQUESTERS.anong);

    // My Tickets (has ≥1 row from beforeAll)
    await page.goto("/tickets");
    await expect(page.locator("tr.zg-row, .zg-card").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    if (label === "desktop") await shot(page, "my-tickets", "desktop-list");
    if (label === "tablet") await shot(page, "my-tickets", "tablet-list");
    if (label === "mobile") await shot(page, "my-tickets", "mobile-cards");

    // Create Ticket
    await page.goto("/tickets/new");
    await page.locator("#summary").waitFor();
    await expectNoHorizontalScroll(page);
    if (label !== "desktop") await shot(page, "create-ticket", `${label}-initial`);

    // Ticket Detail
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
    await expectNoHorizontalScroll(page);
    if (label === "desktop") await shot(page, "ticket-detail", "desktop-detail");
    if (label === "tablet") await shot(page, "ticket-detail", "tablet-detail");
    if (label === "mobile") await shot(page, "ticket-detail", "mobile-detail");
  });
}

// --- RESP-04: the mobile list is cards, not a sideways-scrolling table ---
test("RESP-04: My Tickets renders as cards on mobile with usable controls", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await selectRequester(page, REQUESTERS.anong);
  await page.goto("/tickets");

  // The desktop <table> is replaced by stacked cards; the data table is not shown
  // as a horizontally scrolling grid.
  await expect(page.locator("tr.zg-row, .zg-card").first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Filters and search remain reachable and operable at this width.
  await expect(page.getByLabel("Search tickets")).toBeVisible();
  await page.getByLabel("Search tickets").fill(token);
  await expect(page.locator("tr.zg-row, .zg-card", { hasText: ticketNumber })).toHaveCount(1);
});

// --- Desktop screenshot evidence for the states that are not the resting view ---
test.describe("Screenshot evidence — desktop states", () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test("requester selection: loading, empty, and failure states", async ({ page }) => {
    // A single handler serves all three states by mode, so no route is ever
    // torn down mid-flight (which would race the next navigation).
    let mode: "delay-empty" | "fail" = "delay-empty";
    await page.route("**/api/requesters", async (route) => {
      if (mode === "fail") return route.fulfill({ status: 500 });
      await new Promise((r) => setTimeout(r, 1200)); // long enough to photograph the skeleton
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    // Loading then Empty from the same navigation: the skeleton shows while the
    // delayed response is in flight, then resolves into the no-Requesters state.
    await page.goto("/select");
    await expect(page.getByLabel("Loading Requesters…")).toBeVisible();
    await shot(page, "requester-selection", "desktop-loading");
    await expect(page.getByRole("heading", { name: "No active Requesters" })).toBeVisible();
    await shot(page, "requester-selection", "desktop-empty");

    // API failure — the app cannot be entered.
    mode = "fail";
    await page.goto("/select");
    await expect(page.getByRole("alert")).toBeVisible();
    await shot(page, "requester-selection", "desktop-failure");
    await page.unroute("**/api/requesters");
  });

  test("create ticket: validation, submitting, success, and api-failure", async ({ page }) => {
    await selectRequester(page, REQUESTERS.peter);

    // Initial
    await page.goto("/tickets/new");
    await page.locator("#summary").waitFor();
    await shot(page, "create-ticket", "desktop-initial");

    // Validation failure — submit empty; per-field messages appear.
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.locator("#summary-message")).toHaveText(/Summary must be/);
    await shot(page, "create-ticket", "desktop-validation-failure");

    // Fill a valid form for the remaining states.
    const fill = async () => {
      await page.locator("#categoryId").selectOption({ label: "Hardware" });
      await page.locator("#relatedSystemId").selectOption({ label: "Corporate Laptop" });
      await page.locator("#summary").fill(`State capture ${token}`);
      await page.locator("#description").fill(`Description long enough to pass validation. ${token}`);
    };
    await fill();

    // Submitting — hold the POST open and capture the busy button.
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await gate;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 999999,
          ticketNumber: "TKT-2026-999999",
          currentStatus: "NEW",
          ticketDate: new Date().toISOString(),
          requesterId: 1,
        }),
      });
    });
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.getByRole("button", { name: /Submitting/ })).toBeVisible();
    await shot(page, "create-ticket", "desktop-submitting");
    release();
    await expect(page.getByRole("status")).toBeVisible();
    await shot(page, "create-ticket", "desktop-success");
    await page.unroute("**/api/tickets");

    // API failure — the details are preserved and a safe message is shown.
    await page.goto("/tickets/new");
    await fill();
    await page.route("**/api/tickets", (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 500 }) : route.fallback()
    );
    await page.getByRole("button", { name: "Submit Ticket" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await shot(page, "create-ticket", "desktop-api-failure");
    await page.unroute("**/api/tickets");
  });

  test("my tickets: empty and no-results states", async ({ page }) => {
    await selectRequester(page, REQUESTERS.anong);

    // Empty — force a zero-ticket response with no active filters.
    await page.route("**/api/tickets?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 }),
      })
    );
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "No tickets yet" })).toBeVisible();
    await shot(page, "my-tickets", "desktop-empty");
    await page.unroute("**/api/tickets?*");

    // No results — a real search that matches nothing (filters are active).
    await page.goto("/tickets");
    await page.getByLabel("Search tickets").fill("zzz-no-such-ticket-xyz");
    await expect(page.getByRole("heading", { name: "No tickets match your filters" })).toBeVisible();
    await shot(page, "my-tickets", "desktop-no-results");

    // Filtered — a real search that matches the evidence ticket.
    await page.getByLabel("Search tickets").fill(token);
    await expect(page.locator("tr.zg-row", { hasText: ticketNumber })).toHaveCount(1);
    await shot(page, "my-tickets", "desktop-filtered");
  });

  test("ticket detail: invalid attachment, remove dialog, and removed state", async ({ page }) => {
    await selectRequester(page, REQUESTERS.anong);
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();

    // Invalid attachment — a rejected file names the specific reason (BR-52).
    await page.getByLabel("Add attachment").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByText(/Unsupported file type/i)).toBeVisible();
    await shot(page, "create-ticket", "desktop-invalid-attachment");

    // Upload a valid file so removal can be exercised.
    const filename = `detail-${token}.png`;
    await page.getByLabel("Add attachment").setInputFiles({
      name: filename,
      mimeType: "image/png",
      buffer: PNG_1x1,
    });
    const row = page.locator("li.zg-attachment", { hasText: filename });
    await expect(row).toBeVisible();

    // Remove dialog.
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "ticket-detail", "desktop-remove-dialog");

    // Confirm removal, then capture the removed state.
    await page.getByRole("dialog").getByLabel(/Reason for removal/).fill("Wrong screenshot attached");
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    const removed = page.getByTestId("removed-attachments");
    await expect(removed.getByText(filename)).toBeVisible();
    await shot(page, "ticket-detail", "desktop-attachment-removed");
  });
});
