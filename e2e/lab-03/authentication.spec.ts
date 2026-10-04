import { test, expect, type Page } from "@playwright/test";
import {
  provisionUser,
  retireProvisionedUsers,
  createTicketViaApi,
  uiLogin,
  signIn,
  runToken,
  INITIAL_PASSWORD,
  FINAL_PASSWORD,
  type TestUser,
} from "./helpers";


test.afterAll(retireProvisionedUsers);

// E2E-01…E2E-04 (docs/lab-03/tests.md §2.8) — authentication against the real
// server and database: session lifecycle, the mandatory first-login change, the
// HttpOnly cookie, and keyboard-only completion.

// E2E-01 — AC-01, AC-07, AC-10
test("E2E-01: a Requester logs in, opens their tickets, logs out, and a direct URL then shows Login with no data", async ({
  page,
}) => {
  const requester = await provisionUser("REQUESTER", "Auth Req");
  const summary = `Logout check ${runToken()}`;
  const { id } = await createTicketViaApi(requester, summary);

  await signIn(page, requester);
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByText(summary)).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The cookie is gone and the server-side session is deleted, so a direct URL
  // to the ticket lands on Login and renders none of the ticket's data.
  await page.goto(`/tickets/${id}`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(summary)).toHaveCount(0);
});

// E2E-02 — AC-02
test("E2E-02: a user holding an initial password reaches only the change screen until a valid change", async ({ page }) => {
  const user = await provisionUser("REQUESTER", "First Login", { changed: false });

  await uiLogin(page, user.email, INITIAL_PASSWORD);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("status")).toContainText("temporary password");

  // Every application route is redirected back while the flag is set.
  for (const path of ["/tickets", "/tickets/new", "/staff/tickets", "/admin/users"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/change-password$/);
  }
  await expect(page.getByRole("button", { name: "Logout" })).toHaveCount(0);

  // An invalid change keeps the user here.
  await page.getByLabel("Current password").fill(INITIAL_PASSWORD);
  await page.locator("#newPassword").fill("short");
  await page.getByLabel("Confirm new password").fill("short");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Password must be at least 12 characters.")).toBeVisible();
  await expect(page).toHaveURL(/\/change-password$/);

  // A valid change opens the application.
  await page.locator("#newPassword").fill(FINAL_PASSWORD);
  await page.getByLabel("Confirm new password").fill(FINAL_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(page).toHaveURL(/\/tickets$/);
});

// E2E-03 — AC-11
test("E2E-03: the session cookie is never readable from page JavaScript", async ({ page, context }) => {
  const requester = await provisionUser("REQUESTER", "Cookie");
  await signIn(page, requester);

  // The session exists in the browser and is flagged HttpOnly…
  const session = (await context.cookies()).find((c) => c.name === "toktickit_session");
  expect(session, "an active session cookie").toBeDefined();
  expect(session!.httpOnly).toBe(true);
  expect(session!.value.length).toBeGreaterThan(0);

  // …so the page cannot see it, even though cookies are shared across ports on
  // the same host (localhost:5173 page, localhost:3000 cookie).
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).not.toContain("toktickit_session");
  expect(visible).not.toContain(session!.value);
});

/** The element holding focus shows a visible outline (AC-56: focus visible). */
async function expectFocusVisible(page: Page, label: string): Promise<void> {
  const style = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, visible: el.matches(":focus-visible") };
  });
  expect(style, `${label} holds focus`).not.toBeNull();
  expect(style!.visible, `${label} matches :focus-visible`).toBe(true);
  expect(style!.style, `${label} outline style`).not.toBe("none");
  expect(style!.width, `${label} outline width`).toBeGreaterThan(0);
}

async function tabTo(page: Page, id: string, label: string): Promise<void> {
  await page.keyboard.press("Tab");
  await expect(page.locator(`#${id}`), `${label} receives focus`).toBeFocused();
  await expectFocusVisible(page, label);
}

// E2E-04 — AC-56
test("E2E-04: Login and Change Password complete by keyboard alone with focus visible at every step", async ({ page }) => {
  const user: TestUser = await provisionUser("REQUESTER", "Keyboard", { changed: false });
  await page.goto("/login");
  await page.locator("body").click({ position: { x: 1, y: 1 } }); // start from the document, not a field

  await tabTo(page, "email", "Email");
  await page.keyboard.type(user.email);
  await tabTo(page, "password", "Password");
  await page.keyboard.type(INITIAL_PASSWORD);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  await expectFocusVisible(page, "Sign in");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/change-password$/);
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await tabTo(page, "currentPassword", "Current password");
  await page.keyboard.type(INITIAL_PASSWORD);
  await tabTo(page, "newPassword", "New password");
  await page.keyboard.type(FINAL_PASSWORD);
  await tabTo(page, "confirm", "Confirm new password");
  await page.keyboard.type(FINAL_PASSWORD);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save password" })).toBeFocused();
  await expectFocusVisible(page, "Save password");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
