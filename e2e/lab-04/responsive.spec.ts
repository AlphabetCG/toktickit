import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  createTicketViaApi,
  runToken,
  pageAs,
  setStatus,
  setOwner,
  addAction,
  shot,
  expectNoHorizontalScroll,
  expectTouchSized,
  expectContained,
  VIEWPORTS,
  type Viewport,
  type TestUser,
} from "./helpers";

// RESP-01…RESP-05 (docs/lab-04/tests.md §2.9) and the ui-spec §14 screenshot set.
// The assertions are the graded contract (AC-62): no page-level sideways scroll,
// the §5.3 / §6.3 / §12 arrangements, touch-sized controls on mobile, keyboard
// dialogs, and containment. The screenshots are the evidence the §13 checklist is
// completed against by hand.
//
// Three states cannot be produced honestly on a shared, populated database: an
// all-zero staff dashboard, a dashboard still loading, and a failed dashboard.
// Those shots route the dashboard request: the zero shot fetches the real response
// and zeroes its values and lists, so the shape is the server's own; the loading
// shot holds the request; the failure shot answers 500. tests.md §7 names them.

let requester: TestUser; // has Tickets, including the one with actions
let newcomer: TestUser; // has none (ui-spec §6.2)
let staff: TestUser;
let admin: TestUser;
let detailId: number; // Staff and Requester Ticket Detail with Actions Taken
let conflictId: number;
const token = runToken();

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Resp4 Requester With A Long Address");
  newcomer = await provisionUser("REQUESTER", "Resp4 Newcomer");
  staff = await provisionUser("IT_STAFF", "Resp4 Staff");
  admin = await provisionUser("ADMINISTRATOR", "Resp4 Admin");

  // The detail Ticket: one action in each status, an outstanding follow-up, and
  // open work, so the gate list has three reasons to show.
  ({ id: detailId } = await createTicketViaApi(
    requester,
    `Responsive evidence — external monitor flickers after docking ${token}`
  ));
  await setOwner(staff, detailId, staff.id);
  await setStatus(staff, detailId, "IN_PROGRESS");
  await addAction(staff, detailId, {
    description: "Swapped the HDMI cable for a certified one and re-seated the dock.",
    status: "COMPLETED",
    result: "Flicker reduced but not gone.",
    followUpRequired: true,
    followUpNote: "Test with the vendor's dock firmware 2.4 once it is approved.",
  });
  await addAction(staff, detailId, { description: "Update the dock firmware to 2.4.", status: "IN_PROGRESS" });
  await addAction(staff, detailId, { description: "Replace the monitor if the firmware does not help.", status: "PLANNED" });

  // Other Requester Tickets so their dashboard has figures in every card.
  const waiting = await createTicketViaApi(requester, `Responsive waiting ${token}`);
  await setStatus(staff, waiting.id, "IN_PROGRESS");
  await setStatus(staff, waiting.id, "WAITING_FOR_REQUESTER");
  const resolved = await createTicketViaApi(requester, `Responsive resolved ${token}`);
  await setStatus(staff, resolved.id, "IN_PROGRESS");
  await addAction(staff, resolved.id, { description: "Reinstalled the VPN client.", status: "COMPLETED", result: "Connects on the first try." });
  await setStatus(staff, resolved.id, "RESOLVED");

  ({ id: conflictId } = await createTicketViaApi(requester, `Responsive conflict ${token}`));
  await setStatus(staff, conflictId, "IN_PROGRESS");
});

test.afterAll(retireProvisionedUsers);

const VPS = Object.keys(VIEWPORTS) as Viewport[];

function open(browser: Browser, user: TestUser, vp: Viewport, path?: string): Promise<Page> {
  return pageAs(browser, user, { viewport: VIEWPORTS[vp], path });
}

/** The checks every screen gets at every viewport (RESP-01…RESP-03, RESP-05). */
async function expectSound(page: Page, vp: Viewport, where: string): Promise<void> {
  await expectNoHorizontalScroll(page, `${where} @ ${vp}`);
  await expectContained(page, `${where} @ ${vp}`);
  if (vp === "mobile") await expectTouchSized(page, `${where} @ ${vp}`);
}

/** How many columns the first metric grid lays its cards in. */
async function metricColumns(page: Page): Promise<number> {
  const lefts = await page
    .locator(".zg-metrics")
    .first()
    .locator(":scope > .zg-metric")
    .evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().left)));
  return new Set(lefts).size;
}

async function dashboardReady(page: Page): Promise<void> {
  await expect(page.locator(".zg-metrics").first()).toBeVisible();
}

/** Answers the dashboard request with the server's own body, every figure and list emptied. */
async function zeroDashboard(page: Page, path: string): Promise<void> {
  await page.route(`**${path}`, async (route) => {
    const body = await (await route.fetch()).json();
    const zero = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(zero)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, k === "value" && typeof x === "number" ? 0 : k === "items" ? [] : zero(x)])
            )
          : v;
    await route.fulfill({ json: zero(body) });
  });
}

// --- RESP-01…RESP-03 and RESP-05: dashboards ---------------------------------------

const STAFF_COLUMNS: Record<Viewport, number> = { desktop: 4, tablet: 2, mobile: 2 }; // ui-spec §5.3
const REQUESTER_COLUMNS: Record<Viewport, number> = { desktop: 3, tablet: 3, mobile: 1 }; // ui-spec §6.3

for (const vp of VPS) {
  test(`RESP: IT Staff and Administrator dashboards @ ${vp}`, async ({ browser }) => {
    const page = await open(browser, staff, vp);
    await dashboardReady(page);
    expect(await metricColumns(page), "staff cards per row").toBe(STAFF_COLUMNS[vp]);
    await expectSound(page, vp, "staff dashboard");
    await shot(page, "staff-dashboard", `${vp}-staff-dashboard`);

    const zero = await open(browser, staff, vp);
    await zeroDashboard(zero, "/api/dashboard/staff");
    await zero.reload();
    await dashboardReady(zero);
    await expect(zero.getByRole("link", { name: /^Open and unassigned: 0 / })).toBeVisible();
    await expect(zero.getByText("You have no open actions.")).toBeVisible();
    await expectSound(zero, vp, "staff dashboard, zero");
    await shot(zero, "staff-dashboard", `${vp}-staff-dashboard-zero`);

    const adminPage = await open(browser, admin, vp);
    await dashboardReady(adminPage);
    await expect(adminPage.getByRole("region", { name: "Users" })).toBeVisible();
    expect(await metricColumns(adminPage), "admin cards per row").toBe(STAFF_COLUMNS[vp]);
    await expectSound(adminPage, vp, "admin dashboard");
    await shot(adminPage, "staff-dashboard", `${vp}-admin-dashboard`);
  });

  test(`RESP: Requester dashboard, busy and empty @ ${vp}`, async ({ browser }) => {
    const page = await open(browser, requester, vp);
    await dashboardReady(page);
    expect(await metricColumns(page), "requester cards per row").toBe(REQUESTER_COLUMNS[vp]);
    if (vp === "mobile") {
      // Create ticket spans the content under the greeting (§6.3).
      const create = await page.getByRole("link", { name: "+ Create ticket" }).boundingBox();
      const head = await page.locator(".zg-dashboard__head").boundingBox();
      expect(Math.abs(create!.width - head!.width)).toBeLessThanOrEqual(2);
    }
    await expectSound(page, vp, "requester dashboard");
    await shot(page, "requester-dashboard", `${vp}-requester-dashboard`);

    const empty = await open(browser, newcomer, vp);
    await expect(empty.getByRole("heading", { name: "You haven't raised a ticket yet." })).toBeVisible();
    await expectSound(empty, vp, "requester dashboard, empty");
    await shot(empty, "requester-dashboard", `${vp}-requester-dashboard-empty`);
  });
}

test("RESP: dashboard loading and failure states @ desktop", async ({ browser }) => {
  const loading = await open(browser, staff, "desktop");
  await loading.route("**/api/dashboard/staff", () => undefined); // never answered
  await loading.reload();
  await expect(loading.getByLabel("Loading dashboard…")).toHaveAttribute("aria-busy", "true");
  await shot(loading, "staff-dashboard", "desktop-staff-dashboard-loading");

  const failed = await open(browser, staff, "desktop");
  await failed.route("**/api/dashboard/staff", (r) => r.fulfill({ status: 500, json: { error: "Unable to load the dashboard" } }));
  await failed.reload();
  await expect(failed.getByRole("alert")).toContainText("Try again");
  await expectSound(failed, "desktop", "staff dashboard, failure");
  await shot(failed, "staff-dashboard", "desktop-staff-dashboard-failure");

  const reqFailed = await open(browser, requester, "desktop");
  await reqFailed.route("**/api/dashboard/requester", (r) => r.fulfill({ status: 500, json: { error: "Unable to load the dashboard" } }));
  await reqFailed.reload();
  await expect(reqFailed.getByRole("alert")).toContainText("We couldn't load your dashboard.");
  await shot(reqFailed, "requester-dashboard", "desktop-requester-dashboard-failure");
});

// --- RESP-01…RESP-03 and RESP-05: Ticket Details with Actions Taken -----------------

const rows = (page: Page) => page.getByRole("region", { name: "Actions Taken" }).locator(".zg-action-row");

/** Every section of a Ticket Detail has loaded, so a screenshot shows no placeholder. */
async function detailReady(page: Page): Promise<void> {
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator(".zg-history__entry").first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Mobile: each action is a card, its status badge above its description (§12). */
async function expectActionCards(page: Page): Promise<void> {
  for (const row of await rows(page).all()) {
    expect(await row.evaluate((r) => getComputedStyle(r).flexDirection)).toBe("column");
    const badge = await row.locator(".zg-badge").first().boundingBox();
    const text = await row.locator(".zg-action-row__description").boundingBox();
    expect(badge!.y).toBeLessThan(text!.y);
  }
}

for (const vp of VPS) {
  test(`RESP: Ticket Details with Actions Taken @ ${vp}`, async ({ browser }) => {
    const page = await open(browser, staff, vp, `/staff/tickets/${detailId}`);
    await detailReady(page);
    if (vp === "mobile") await expectActionCards(page);
    await expectSound(page, vp, "staff detail");
    await shot(page, "actions-taken", `${vp}-staff-detail-actions`);

    await page.getByRole("button", { name: "+ Add action" }).click();
    const form = page.getByRole("dialog", { name: "Add action" });
    await expect(form).toBeVisible();
    await expectSound(page, vp, "action form");
    if (vp === "mobile") {
      // A full-screen sheet below 768 px (§12).
      const box = await form.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(VIEWPORTS.mobile.width - 2);
    }
    await shot(page, "actions-taken", `${vp}-action-form-create`, false);

    if (vp === "desktop") {
      await form.getByRole("button", { name: "Save action" }).click();
      await expect(form.locator("#action-description-message")).toHaveText(/./);
      await expectContained(page, "action form, validation");
      await shot(page, "actions-taken", "desktop-action-form-validation", false);
      await form.getByRole("button", { name: "Cancel" }).click();

      const planned = rows(page).filter({ hasText: "Replace the monitor" });
      await planned.getByRole("button", { name: /^More actions for / }).click();
      await planned.getByRole("menuitem", { name: "Cancel action" }).click();
      await expect(page.getByRole("dialog", { name: "Cancel this action?" })).toBeVisible();
      await shot(page, "actions-taken", "desktop-action-cancel-confirm", false);
      await page.getByRole("button", { name: "Keep action" }).click();

      const gate = page.locator(".zg-gate");
      await expect(gate).toContainText("Finish or cancel 2 open actions.");
      await expect(gate).toContainText("Record the requested follow-up as a newer completed action.");
      await gate.scrollIntoViewIfNeeded();
      await shot(page, "actions-taken", "desktop-gate-unmet", false);
    }

    const reqPage = await open(browser, requester, vp, `/tickets/${detailId}`);
    await detailReady(reqPage);
    await expect(rows(reqPage).getByRole("button")).toHaveCount(0);
    if (vp === "mobile") await expectActionCards(reqPage);
    await expectSound(reqPage, vp, "requester detail");
    await shot(reqPage, "actions-taken", `${vp}-requester-detail-actions`);
  });
}

test("RESP: stale conflict banner @ desktop", async ({ browser }) => {
  const first = await open(browser, staff, "desktop", `/staff/tickets/${conflictId}`);
  const second = await open(browser, admin, "desktop", `/staff/tickets/${conflictId}`);
  const ops = (p: Page) => p.getByRole("region", { name: "Ticket Operations" });
  await expect(ops(second).locator("#status")).toBeVisible();
  await ops(first).locator("#status").selectOption("WAITING_FOR_REQUESTER");
  await ops(first).getByRole("button", { name: "Apply" }).click();
  await expect(first.locator(".zg-detail-badges .zg-badge").first()).toHaveText("Waiting for Requester");

  await ops(second).locator("#status").selectOption("WAITING_FOR_REQUESTER");
  await ops(second).getByRole("button", { name: "Apply" }).click();
  await expect(ops(second).getByRole("alert")).toContainText("This ticket was changed by someone else.");
  await expect(ops(second).locator("#status")).toHaveValue("WAITING_FOR_REQUESTER");
  await expectContained(second, "stale conflict");
  await shot(second, "actions-taken", "desktop-stale-conflict", false);
});

// --- RESP-04: keyboard and focus ----------------------------------------------------

/** The focused element shows a ring: an outline or a box-shadow (ui-spec §11). */
async function expectVisibleFocus(page: Page, where: string): Promise<void> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "nothing focused";
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none" ? "ok" : `no ring on ${el.tagName}`;
  });
  expect(ring, where).toBe("ok");
}

/** Tabs forward and backward through a dialog; focus never leaves it. */
async function expectFocusTrapped(page: Page, dialog: Locator, where: string): Promise<void> {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `${where}: ${key} ×${i + 1}`).toBe(true);
    }
    await expectVisibleFocus(page, `${where}: after ${key}`);
  }
}

/** Escape closes the dialog and focus is back on `trigger`. */
async function expectEscapeReturnsTo(page: Page, dialog: Locator, trigger: Locator, where: string): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(dialog, `${where}: closes on Escape`).toBeHidden();
  await expect(trigger, `${where}: focus returns to its trigger`).toBeFocused();
  await expectVisibleFocus(page, `${where}: trigger after close`);
}

test("RESP-04: the action form, cancel-action, and cancel-Ticket dialogs work from the keyboard", async ({ browser }) => {
  const page = await open(browser, staff, "desktop", `/staff/tickets/${detailId}`);
  await expect(rows(page)).toHaveCount(3);

  // Action form — opened with Enter from its trigger.
  const add = page.getByRole("button", { name: "+ Add action" });
  await add.focus();
  await expectVisibleFocus(page, "+ Add action");
  await page.keyboard.press("Enter");
  const form = page.getByRole("dialog", { name: "Add action" });
  await expect(form).toBeVisible();
  await expectFocusTrapped(page, form, "action form");
  await expectEscapeReturnsTo(page, form, add, "action form");

  // Cancel action — from the ⋯ menu, with arrow keys; focus returns to the menu button.
  const planned = rows(page).filter({ hasText: "Replace the monitor" });
  const toggle = planned.getByRole("button", { name: /^More actions for / });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(planned.getByRole("menuitem").first()).toBeFocused();
  const cancelItem = planned.getByRole("menuitem", { name: "Cancel action" });
  for (let i = 0; i < 3 && !(await cancelItem.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(cancelItem).toBeFocused();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", { name: "Cancel this action?" });
  await expect(confirm).toBeVisible();
  await expectFocusTrapped(page, confirm, "cancel-action confirmation");
  await expectEscapeReturnsTo(page, confirm, toggle, "cancel-action confirmation");

  // Cancel Ticket — Apply with Cancelled chosen; focus returns to Apply.
  const ops = page.getByRole("region", { name: "Ticket Operations" });
  await ops.locator("#status").selectOption("CANCELLED");
  const apply = ops.getByRole("button", { name: "Apply" });
  await apply.focus();
  await page.keyboard.press("Enter");
  const cancelTicket = page.getByRole("dialog", { name: "Cancel ticket" });
  await expect(cancelTicket).toContainText("2 open actions will also be cancelled.");
  await expectFocusTrapped(page, cancelTicket, "cancel-Ticket confirmation");
  await expectEscapeReturnsTo(page, cancelTicket, apply, "cancel-Ticket confirmation");
  // Nothing was cancelled.
  await expect(page.locator(".zg-detail-badges .zg-badge").first()).toHaveText("In Progress");
});
