import { test, expect, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  provisionUser,
  retireProvisionedUsers,
  deactivateUser,
  createTicketViaApi,
  signIn,
  uiLogin,
  runToken,
  INITIAL_PASSWORD,
  type TestUser,
} from "./helpers";

// RESP-01…RESP-04 (docs/lab-03/tests.md §2.7) plus the ui-spec §12 screenshot set.
// The RESP assertions are the graded contract — no page-level sideways scroll at
// any viewport (AC-54), touch-sized controls and queue cards on mobile; the
// screenshots are the human-inspected evidence for the ui-spec §11 checklist.
//
// A few states cannot be produced honestly against a shared, populated database
// (an empty queue, a forbidden queue, a concurrent status conflict, the last
// Administrator). Those screenshots fulfil the server's real response body with
// page.route, and the routed shots are named in tests.md §7.

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;
type Viewport = keyof typeof VIEWPORTS;

const SHOT_ROOT = join(process.cwd(), "artifacts", "lab-03", "screenshots");

// Full page by default. The User Management list holds every account the shared
// development database has accumulated, so its list shots capture the viewport.
async function shot(page: Page, screen: string, name: string, fullPage = true): Promise<void> {
  const dir = join(SHOT_ROOT, screen);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
}

/** AC-54: the page itself never scrolls horizontally (sub-pixel tolerance). */
async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${where}: page must not scroll horizontally`).toBeLessThanOrEqual(1);
}

/** RESP-03: every visible button and single-line field is at least 44 × 44 px below 768 px. */
async function expectTouchSized(page: Page, where: string): Promise<void> {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".zg-btn, input.zg-field, select.zg-field"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { what: el.getAttribute("aria-label") || el.id || el.textContent?.trim() || el.tagName, w: r.width, h: r.height };
      })
      .filter((c) => c.w < 44 || c.h < 44)
  );
  expect(small, `${where}: controls under 44 × 44 px`).toEqual([]);
}

/** No clipping: every visible control sits inside the panel that contains it. */
async function expectControlsInsidePanels(page: Page, where: string): Promise<void> {
  const outside = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".zg-panel .zg-btn, .zg-panel .zg-field"))
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const p = el.closest(".zg-panel")!.getBoundingClientRect();
        return r.left < p.left - 1 || r.right > p.right + 1;
      })
      .map((el) => el.id || el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName)
  );
  expect(outside, `${where}: controls overflowing their panel`).toEqual([]);
}

/** Fields stack: no two visible form controls share a row on mobile. */
async function expectFieldsStacked(page: Page, where: string): Promise<void> {
  const shared = await page.evaluate(() => {
    const tops = Array.from(document.querySelectorAll<HTMLElement>("form .zg-field"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => Math.round(el.getBoundingClientRect().top));
    return tops.length - new Set(tops).size;
  });
  expect(shared, `${where}: fields sharing a row`).toBe(0);
}

let requester: TestUser;
let staff: TestUser;
let admin: TestUser;
let ticketId: number;
const token = runToken();

test.beforeAll(async () => {
  // A deliberately long name and email: an unbroken address once pushed the
  // mobile Staff Ticket Detail 91 px past the viewport.
  requester = await provisionUser("REQUESTER", "Resp Requester With A Long Address");
  staff = await provisionUser("IT_STAFF", "Resp Staff");
  admin = await provisionUser("ADMINISTRATOR", "Resp Admin");
  ({ id: ticketId } = await createTicketViaApi(
    requester,
    `Responsive evidence — a summary long enough to exercise wrapping ${token}`
  ));
});

test.afterAll(retireProvisionedUsers);

async function pageAs(browser: Browser, user: TestUser, viewport: Viewport): Promise<Page> {
  const page = await (await browser.newContext({ viewport: VIEWPORTS[viewport] })).newPage();
  await signIn(page, user);
  return page;
}

// --- RESP-01…RESP-03: every Lab 3 screen at every viewport -----------------------

for (const [label, size] of Object.entries(VIEWPORTS) as [Viewport, (typeof VIEWPORTS)[Viewport]][]) {
  const id = { desktop: "RESP-01", tablet: "RESP-02", mobile: "RESP-03" }[label];

  test(`${id} (${label} ${size.width}×${size.height}): no overflow on any Lab 3 screen`, async ({ browser }) => {
    const mobile = label === "mobile";
    const check = async (page: Page, where: string) => {
      await expectNoHorizontalScroll(page, where);
      await expectControlsInsidePanels(page, where);
      if (mobile) await expectTouchSized(page, where);
    };

    // Login
    const anon = await (await browser.newContext({ viewport: size })).newPage();
    await anon.goto("/login");
    await expect(anon.getByRole("button", { name: "Sign in" })).toBeVisible();
    await check(anon, "Login");
    if (mobile) await expectFieldsStacked(anon, "Login");
    if (label !== "desktop") await shot(anon, "authentication", `${label}-login-initial`);

    // Change Password (mandatory)
    const fresh = await provisionUser("REQUESTER", `Resp First ${label}`, { changed: false });
    await uiLogin(anon, fresh.email, INITIAL_PASSWORD);
    await expect(anon).toHaveURL(/\/change-password$/);
    await check(anon, "Change Password");
    if (mobile) await expectFieldsStacked(anon, "Change Password");

    // Ticket Queue
    const staffPage = await pageAs(browser, staff, label);
    await expect(staffPage.locator("tr.zg-row").first()).toBeVisible();
    await check(staffPage, "Ticket Queue");
    if (label === "tablet") await shot(staffPage, "staff-queue", "tablet-queue");

    // Staff Ticket Detail
    await staffPage.goto(`/staff/tickets/${ticketId}`);
    await expect(staffPage.getByRole("region", { name: "Ticket Operations" })).toBeVisible();
    await check(staffPage, "Staff Ticket Detail");
    if (label !== "desktop") await shot(staffPage, "staff-ticket-detail", `${label}-detail`);

    // User Management
    const adminPage = await pageAs(browser, admin, label);
    await expect(adminPage.getByRole("button", { name: /^Edit / }).first()).toBeVisible();
    await check(adminPage, "User Management");
    if (label !== "desktop") await shot(adminPage, "user-management", `${label}-list`, false);
  });
}

// --- RESP-04: the queue as cards on mobile, filters and pagination usable ---------

test("RESP-04: on mobile the queue renders as cards with usable filters and pagination", async ({ browser }) => {
  const page = await pageAs(browser, staff, "mobile");
  const firstRow = page.locator("tr.zg-row").first();
  await expect(firstRow).toBeVisible();

  // Cards: the header row is hidden and each row is a bordered block carrying
  // its column names as labels.
  await expect(page.locator(".zg-table thead")).toBeHidden();
  const card = await firstRow.evaluate((el) => {
    const s = getComputedStyle(el);
    return { display: s.display, border: parseFloat(s.borderTopWidth), width: el.getBoundingClientRect().width };
  });
  expect(card.display).toBe("block");
  expect(card.border).toBeGreaterThan(0);
  expect(card.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
  const label = await firstRow.locator("td").first().evaluate((td) => getComputedStyle(td, "::before").content);
  expect(label).toContain("Ticket No.");
  await shot(page, "staff-queue", "mobile-queue-cards");

  // Filters collapse behind a disclosure (ui-spec §6.3); opened, they work and
  // the toggle counts what is active.
  const toggle = page.getByRole("button", { name: /^Filters/ });
  await expect(page.getByLabel("Filter by status")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByLabel("Filter by status")).toBeVisible();
  await expectTouchSized(page, "open filters");
  await page.getByLabel("Filter by status").selectOption("NEW");
  await expect(toggle).toHaveText("Filters (1 active)");
  await expect(page.getByRole("button", { name: "Clear filters" }).first()).toBeVisible();
  await expect(page.locator("tr.zg-row").first()).toBeVisible();
  for (const badge of await page.locator("tr.zg-row td[data-label='Status']").allInnerTexts()) expect(badge).toContain("New");
  await expectNoHorizontalScroll(page, "filtered queue");

  // Pagination stays on screen and touch-sized; Next advances when there is a page 2.
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.getByLabel("Rows per page").selectOption("10");
  const pager = page.getByRole("navigation", { name: "Pagination" });
  await pager.scrollIntoViewIfNeeded();
  await expect(pager).toBeInViewport();
  await expectTouchSized(page, "queue pagination");
  const next = pager.getByRole("button", { name: "Next page" });
  await expectNoHorizontalScroll(page, "queue pagination");
  if (await next.isEnabled()) {
    await next.click();
    await expect(pager.locator("[aria-current='page']")).toHaveText("2");
  }
});

// --- Desktop state screenshots (ui-spec §12) ---------------------------------------

test("screenshots: authentication states", async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: VIEWPORTS.desktop })).newPage();
  const dir = "authentication";

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await shot(page, dir, "desktop-login-initial");

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email is required.")).toBeVisible();
  await shot(page, dir, "desktop-login-validation");

  await page.getByLabel("Email").fill(requester.email);
  await page.locator("#password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/incorrect/i)).toBeVisible();
  await shot(page, dir, "desktop-login-failure");

  // Busy: hold the real login request until the screenshot is taken.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/auth/login", async (route) => {
    await held;
    await route.continue();
  });
  await page.locator("#password").fill(requester.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeVisible();
  await shot(page, dir, "desktop-login-busy");
  release();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await page.unroute("**/api/auth/login");

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await shot(page, dir, "desktop-after-logout");

  const gone = await provisionUser("REQUESTER", "Resp Deactivated");
  await deactivateUser(gone.id);
  await uiLogin(page, gone.email, gone.password);
  await expect(page.getByText("This account is deactivated. Contact an administrator.")).toBeVisible();
  await shot(page, dir, "desktop-login-deactivated");

  const fresh = await provisionUser("REQUESTER", "Resp Mandatory", { changed: false });
  await uiLogin(page, fresh.email, INITIAL_PASSWORD);
  await expect(page).toHaveURL(/\/change-password$/);
  await shot(page, dir, "desktop-change-password-mandatory");

  await page.getByLabel("Current password").fill(INITIAL_PASSWORD);
  await page.locator("#newPassword").fill("short");
  await page.getByLabel("Confirm new password").fill("different");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("The two passwords do not match.")).toBeVisible();
  await shot(page, dir, "desktop-change-password-validation");
});

test("screenshots: Ticket Queue states", async ({ browser }) => {
  const page = await pageAs(browser, staff, "desktop");
  const dir = "staff-queue";

  await expect(page.locator("tr.zg-row").first()).toBeVisible();
  await shot(page, dir, "desktop-queue");

  await page.getByLabel("Filter by status").selectOption("NEW");
  await expect(page.locator("tr.zg-row").first()).toBeVisible();
  await shot(page, dir, "desktop-queue-filtered");

  await page.getByLabel("Filter by status").selectOption("");
  await page.getByLabel("Search tickets").fill(`no-such-ticket-${token}`);
  await expect(page.getByText("No tickets match your filters")).toBeVisible();
  await shot(page, dir, "desktop-queue-no-results");

  // Routed: a populated shared database has no empty queue.
  await page.route("**/api/staff/tickets?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0, counts: { unassigned: 0, mine: 0 } }),
    })
  );
  await page.goto("/staff/tickets");
  await expect(page.getByText("No tickets in the queue")).toBeVisible();
  await shot(page, dir, "desktop-queue-empty");

  // Routed: the server's role refusal (AUTHZ-03 proves it for real).
  await page.unroute("**/api/staff/tickets?**");
  await page.route("**/api/staff/tickets?**", (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) })
  );
  await page.goto("/staff/tickets");
  await expect(page.getByText(/don't have access/i)).toBeVisible();
  await shot(page, dir, "desktop-queue-forbidden");
});

test("screenshots: Staff Ticket Detail states", async ({ browser }) => {
  const dir = "staff-ticket-detail";
  const { id } = await createTicketViaApi(requester, `Detail evidence ${runToken()}`);
  const page = await pageAs(browser, staff, "desktop");
  await page.goto(`/staff/tickets/${id}`);
  const ops = page.getByRole("region", { name: "Ticket Operations" });
  await expect(ops).toBeVisible();
  await shot(page, dir, "desktop-detail");
  await ops.screenshot({ path: join(SHOT_ROOT, dir, "desktop-operations-panel.png") });

  await page.getByRole("region", { name: "Public Comments" }).getByLabel("Add a comment").fill("We are looking into this now.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("We are looking into this now.")).toBeVisible();
  await page.getByRole("region", { name: "Internal Notes" }).getByLabel("Add an internal note").fill("Checked the switch port; likely a cabling fault.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Checked the switch port; likely a cabling fault.")).toBeVisible();
  await page.getByRole("region", { name: "Public Comments" }).scrollIntoViewIfNeeded();
  await shot(page, dir, "desktop-comments-and-notes");

  await ops.locator("#status").selectOption("CANCELLED");
  await ops.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("dialog", { name: "Cancel ticket" })).toBeVisible();
  await shot(page, dir, "desktop-status-confirm-cancel");
  await page.getByRole("button", { name: "Keep ticket" }).click();

  // Routed: a concurrent change makes the server answer 409 (API-25 proves it).
  await page.route(`**/api/tickets/${id}/status`, (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Cannot move a Resolved ticket to In Progress." }),
    })
  );
  await ops.locator("#status").selectOption("IN_PROGRESS");
  await ops.getByRole("button", { name: "Apply" }).click();
  await expect(ops.getByText("Cannot move a Resolved ticket to In Progress.")).toBeVisible();
  await shot(page, dir, "desktop-conflict-inline");

  const reqPage = await pageAs(browser, requester, "desktop");
  await reqPage.goto(`/tickets/${id}`);
  await expect(reqPage.getByText("We are looking into this now.")).toBeVisible();
  await expect(reqPage.getByRole("region", { name: "Internal Notes" })).toHaveCount(0);
  await shot(reqPage, dir, "desktop-requester-view-no-notes");
});

test("screenshots: User Management states", async ({ browser }) => {
  const dir = "user-management";
  const page = await pageAs(browser, admin, "desktop");
  await expect(page.getByRole("button", { name: /^Edit / }).first()).toBeVisible();
  await shot(page, dir, "desktop-list", false);

  await page.getByLabel("Search users").fill("Resp");
  await expect(page.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${staff.name}` })).toBeVisible();
  await shot(page, dir, "desktop-search-filtered");

  await page.getByRole("button", { name: "+ Create user" }).click();
  const create = page.getByRole("dialog", { name: "Create user" });
  await create.getByLabel("Name").fill("Duplicate Example");
  await create.getByLabel("Email").fill(staff.email);
  await create.getByLabel("Role").selectOption("REQUESTER");
  await create.getByLabel("Initial password").fill("Duplicate-Pass-1");
  await shot(page, dir, "desktop-create");
  await create.getByRole("button", { name: "Create user" }).click();
  await expect(create.getByText(/already/i)).toBeVisible();
  await shot(page, dir, "desktop-duplicate-email");
  await create.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: `Edit ${staff.name}` }).click();
  const edit = page.getByRole("dialog", { name: "Edit user" });
  await expect(edit).toBeVisible();
  await shot(page, dir, "desktop-edit");
  await edit.getByRole("button", { name: "Set new initial password" }).click();
  await expect(page.getByRole("dialog", { name: "Set new initial password" })).toBeVisible();
  await shot(page, dir, "desktop-initial-password-confirm");
  await page.getByRole("dialog", { name: "Set new initial password" }).getByRole("button", { name: "Cancel" }).click();
  await edit.getByRole("button", { name: "Cancel" }).click();

  // Routed: the last-Administrator refusal needs a concurrent race (API-36, UNIT-11).
  const other = await provisionUser("ADMINISTRATOR", "Resp Other Admin");
  await page.route(`**/api/admin/users/${other.id}`, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "The system must keep at least one active administrator." }),
        })
      : route.continue()
  );
  await page.getByLabel("Search users").fill(other.name);
  await page.getByRole("button", { name: `Edit ${other.name}` }).click();
  await page.getByRole("dialog", { name: "Edit user" }).getByRole("radio", { name: "Inactive" }).check();
  await page.getByRole("dialog", { name: "Edit user" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("The system must keep at least one active administrator.")).toBeVisible();
  await shot(page, dir, "desktop-last-admin-guard");
});
