import { test, expect, request, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  createTicketViaApi,
  uiLogin,
  runToken,
  pageAs,
  watchConsole,
  SERVER_URL,
  INITIAL_PASSWORD,
  FINAL_PASSWORD,
  type TestUser,
} from "./helpers";

// E2E-11 and E2E-12 (docs/lab-04/tests.md §2.11): a representative pass through
// the Lab 1–3 journeys on the Lab 4 build (AC-58, FR-18), and a crawl of every
// destination each role can reach, which must log no console error and lead
// nowhere undefined (AC-61, FR-22).

let requester: TestUser;
let staff: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  requester = await provisionUser("REQUESTER", "Reg Req");
  staff = await provisionUser("IT_STAFF", "Reg Staff");
  admin = await provisionUser("ADMINISTRATOR", "Reg Admin");
});

test.afterAll(retireProvisionedUsers);

// A 1 × 1 PNG: real image bytes, so the server's content check accepts it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

// E2E-11 — AC-58, FR-18
test("E2E-11: the Lab 1–3 journeys still work end to end", async ({ browser, page }) => {
  const token = runToken();

  // Lab 1 — health check.
  const api = await request.newContext({ baseURL: SERVER_URL });
  const health = await api.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok" });
  await api.dispose();

  // Lab 3 — first sign-in forces a password change, then opens the application.
  const newcomer = await provisionUser("REQUESTER", "Reg First Login", { changed: false });
  await uiLogin(page, newcomer.email, INITIAL_PASSWORD);
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("Current password").fill(INITIAL_PASSWORD);
  await page.locator("#newPassword").fill(FINAL_PASSWORD);
  await page.getByLabel("Confirm new password").fill(FINAL_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Lab 2 — Create Ticket, then an attachment on it.
  const req = await pageAs(browser, requester);
  await req.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Create Ticket" }).click();
  await req.getByLabel(/Category/).selectOption({ index: 1 });
  await req.getByLabel(/Related System/).selectOption({ index: 1 });
  await req.getByLabel(/Ticket Summary/).fill(`Regression journey ${token}`);
  await req.getByLabel(/Description/).fill("The second monitor stays black after the laptop wakes from sleep.");
  await req.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(req.getByRole("heading", { name: "✓ Ticket created" })).toBeVisible();
  const ticketNumber = (await req.locator(".zg-ticket-number").textContent())!.trim();
  await req.getByRole("button", { name: "View ticket" }).click();
  await expect(req).toHaveURL(/\/tickets\/\d+$/);
  const id = Number(/\/tickets\/(\d+)$/.exec(req.url())![1]);
  const attachments = req.getByRole("region", { name: "Attachments" });
  await attachments.getByLabel("Add attachment").setInputFiles({ name: `screen-${token}.png`, mimeType: "image/png", buffer: PNG });
  await expect(attachments.getByText(`screen-${token}.png`)).toBeVisible();

  // Lab 2 — My Tickets search finds it.
  await req.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "My Tickets" }).click();
  await req.getByLabel("Search tickets").fill(token);
  await expect(req.getByRole("link", { name: ticketNumber })).toBeVisible();
  await expect(req.locator(".zg-result-count")).toHaveText(/of 1$/);

  // Lab 3 — the Requester comments.
  await req.getByRole("link", { name: ticketNumber }).click();
  const comment = `Still black this morning ${token}`;
  await req.getByRole("region", { name: "Public Comments" }).getByLabel("Add a comment").fill(comment);
  await req.getByRole("button", { name: "Post comment" }).click();
  await expect(req.getByRole("region", { name: "Public Comments" }).getByText(comment)).toBeVisible();

  // Lab 3 — IT Staff claim, set IT Priority, and add an Internal Note.
  const st = await pageAs(browser, staff, { path: `/staff/tickets/${id}` });
  const ops = st.getByRole("region", { name: "Ticket Operations" });
  await ops.getByRole("button", { name: "Claim" }).click();
  await expect(ops.locator("#owner option:checked")).toHaveText(staff.name);
  await ops.locator("#itPriority").selectOption("HIGH");
  await expect(ops.locator("#itPriority")).toHaveValue("HIGH");
  const note = `Checked the dock firmware ${token}`;
  const notes = st.getByRole("region", { name: "Internal Notes" });
  await notes.getByLabel("Add an internal note").fill(note);
  await notes.getByRole("button", { name: "Add note" }).click();
  await expect(notes.getByText(note)).toBeVisible();
  await expect(st.getByRole("region", { name: "Public Comments" }).getByText(comment)).toBeVisible();

  // Lab 3 — the Administrator creates a user.
  const ad = await pageAs(browser, admin);
  await ad.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "User Management" }).click();
  await ad.getByRole("button", { name: "+ Create user" }).click();
  const dialog = ad.getByRole("dialog");
  const name = `Reg Created ${token}`;
  await dialog.getByLabel(/Name/).fill(name);
  await dialog.getByLabel(/Email/).fill(`reg.created.${token}@toktickit.test`);
  await dialog.getByLabel(/^Role/).selectOption("REQUESTER");
  await dialog.getByLabel(/Initial password/).fill(INITIAL_PASSWORD);
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(ad.getByText(`Created ${name}.`)).toBeVisible();
  // Retire the account this journey created, as the helpers do for theirs.
  await ad.getByLabel("Search users").fill(token);
  await ad.getByRole("button", { name: `Edit ${name}` }).click();
  await ad.getByRole("dialog").getByLabel("Inactive", { exact: true }).check();
  await ad.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(ad.getByText(`Saved ${name}.`)).toBeVisible();
});

/** "/staff/tickets/12?x=1" → "/staff/tickets/:id?x=1": one visit per kind of destination. */
const routeKey = (href: string) => href.replace(/\/\d+(?=[/?#]|$)/g, "/:id");

/**
 * Visits every in-app link reachable from the role's navigation, one per kind
 * of destination, and checks that each lands where it points: the catch-all
 * route sends an undefined path to /dashboard, so a redirect there is a broken link.
 */
async function crawl(page: Page): Promise<{ visited: string[]; broken: string[] }> {
  const queue = ["/dashboard"];
  const seen = new Set(queue.map(routeKey));
  const visited: string[] = [];
  const broken: string[] = [];
  while (queue.length > 0 && visited.length < 40) {
    const href = queue.shift()!;
    await page.goto(href);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main h1, main .zg-page-title").first()).toBeVisible();
    visited.push(href);
    const landed = new URL(page.url());
    const wanted = new URL(href, landed.origin);
    if (landed.pathname !== wanted.pathname) broken.push(`${href} → ${landed.pathname}`);

    const links = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const link of links) {
      expect(link, `placeholder link on ${href}`).not.toBe("#");
      if (!link.startsWith("/") || link.startsWith("/api/")) continue;
      const key = routeKey(link);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(link);
      }
    }
  }
  return { visited, broken };
}

// E2E-12 — AC-61, FR-22
test("E2E-12: for every role, every destination loads a defined route and logs no console error", async ({ browser }) => {
  // Data so the lists have rows, and so the crawl reaches a Ticket Detail.
  await createTicketViaApi(requester, `Crawl fixture ${runToken()}`);

  for (const [user, expected] of [
    [requester, ["/tickets", "/tickets/new", "/tickets/:id"]],
    [staff, ["/staff/tickets", "/staff/tickets/:id"]],
    [admin, ["/staff/tickets", "/staff/tickets/:id", "/admin/users"]],
  ] as const) {
    const page = await pageAs(browser, user);
    const errors = watchConsole(page);
    const { visited, broken } = await crawl(page);

    const paths = visited.map((v) => routeKey(v).split("?")[0]);
    expect(paths, `${user.name} reached`).toEqual(expect.arrayContaining([...expected]));
    expect(broken, `${user.name}: links to undefined routes`).toEqual([]);
    expect(errors, `${user.name}: console errors`).toEqual([]);
    await page.context().close();
  }
});
