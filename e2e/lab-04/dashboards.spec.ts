import { test, expect, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  createTicketViaApi,
  runToken,
  pageAs,
  setStatus,
  setOwner,
  addAction,
  withApi,
  metricValue,
  listTotal,
  type TestUser,
} from "./helpers";

// E2E-08…E2E-10 (docs/lab-04/tests.md §2.11). Drill-down parity (BR-53): a card's
// number equals the total of the list it opens, read from both screens at the
// same moment against the same shared database.

let requester: TestUser;
let staff: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Dash Req");
  staff = await provisionUser("IT_STAFF", "Dash Staff");
  admin = await provisionUser("ADMINISTRATOR", "Dash Admin");

  // So the cards have something of the users' own to count.
  const token = runToken();
  const mine = await createTicketViaApi(requester, `Dashboard mine ${token}`);
  await setOwner(staff, mine.id, staff.id);
  await withApi(staff, async (ctx) => {
    const version = (await (await ctx.get(`/api/tickets/${mine.id}`)).json()).version;
    expect((await ctx.patch(`/api/tickets/${mine.id}/it-priority`, { data: { itPriority: "HIGH", expectedVersion: version } })).status()).toBe(200);
  });
  await addAction(staff, mine.id, { description: `Planned check ${token}`, status: "PLANNED" });

  const waiting = await createTicketViaApi(requester, `Dashboard waiting ${token}`);
  await setStatus(staff, waiting.id, "IN_PROGRESS");
  await setStatus(staff, waiting.id, "WAITING_FOR_REQUESTER");

  const resolved = await createTicketViaApi(requester, `Dashboard resolved ${token}`);
  await setStatus(staff, resolved.id, "IN_PROGRESS");
  await addAction(staff, resolved.id, { description: `Fixed ${token}`, status: "COMPLETED", result: "Fixed and confirmed." });
  await setStatus(staff, resolved.id, "RESOLVED");
});

test.afterAll(retireProvisionedUsers);

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });

/** Opens each card in turn and compares its number with the list's total. */
async function expectParity(page: Page, cards: { label: string; url: RegExp }[]): Promise<void> {
  for (const card of cards) {
    await page.goto("/dashboard");
    const value = await metricValue(page, card.label);
    await page.getByRole("link", { name: new RegExp(`^${card.label}: `) }).click();
    await expect(page, card.label).toHaveURL(card.url);
    await expect(page.getByText("Filtered from Dashboard")).toBeVisible();
    expect(await listTotal(page), `${card.label}: card ${value} vs list`).toBe(value);
  }
}

// E2E-08 — AC-44, AC-48
test("E2E-08: each staff metric card opens the Queue filtered, with a total equal to the card", async ({ browser }) => {
  const page = await pageAs(browser, staff);
  expect(await metricValue(page, "Open and assigned to me")).toBeGreaterThan(0);
  expect(await metricValue(page, "Open, high priority")).toBeGreaterThan(0);
  // My open actions has no list screen, so its href is null and it is a figure, not a link (api-spec §6.1).
  await expect(page.locator(".zg-metric--static", { hasText: "My open actions" })).toContainText("1");

  await expectParity(page, [
    // The drill-down URLs of api-spec §6.1.
    { label: "Open and unassigned", url: /\/staff\/tickets\?ownerId=unassigned&statusGroup=active$/ },
    { label: "Open and assigned to me", url: /\/staff\/tickets\?ownerId=me&statusGroup=active$/ },
    { label: "Open, high priority", url: /\/staff\/tickets\?itPriority=HIGH&statusGroup=active$/ },
  ]);
});

// E2E-09 — AC-42, AC-48
test("E2E-09: each Requester card opens My Tickets filtered, with a total equal to the card", async ({ browser }) => {
  const page = await pageAs(browser, requester);
  expect(await metricValue(page, "Open tickets")).toBe(2);
  expect(await metricValue(page, "Waiting for you")).toBe(1);
  expect(await metricValue(page, "Resolved, awaiting closure")).toBe(1);

  await expectParity(page, [
    { label: "Open tickets", url: /\/tickets\?statusGroup=active$/ },
    { label: "Waiting for you", url: /\/tickets\?status=WAITING_FOR_REQUESTER$/ },
    { label: "Resolved, awaiting closure", url: /\/tickets\?status=RESOLVED$/ },
  ]);
  await expect(page.getByLabel("Filter by status")).toHaveValue("RESOLVED");
});

// E2E-10 — AC-53, AC-54
test("E2E-10: every role lands on its Dashboard; the Administrator reaches the Queue and a Ticket Detail", async ({
  browser,
}) => {
  for (const [user, items] of [
    [requester, ["Dashboard", "My Tickets", "Create Ticket"]],
    [staff, ["Dashboard", "Ticket Queue"]],
    [admin, ["Dashboard", "Ticket Queue", "User Management"]],
  ] as const) {
    const page = await pageAs(browser, user);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([...items]);
    await expect(nav(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    if (user === admin) {
      // The Users card is the Administrator's alone (AC-49).
      await expect(page.getByRole("region", { name: "Users" })).toBeVisible();
      await nav(page).getByRole("link", { name: "Ticket Queue" }).click();
      await expect(page).toHaveURL(/\/staff\/tickets$/);
      const first = page.locator("tbody tr").first().getByRole("link").first();
      const number = (await first.textContent())!.trim();
      await first.click();
      await expect(page).toHaveURL(/\/staff\/tickets\/\d+$/);
      await expect(page.getByRole("heading", { name: number })).toBeVisible();
      await expect(page.getByRole("region", { name: "Ticket Operations" })).toBeVisible();
    } else if (user === staff) {
      await expect(page.getByRole("region", { name: "Users" })).toHaveCount(0);
    }
    await page.context().close();
  }
});
