import { test, expect, type Browser, type Page } from "@playwright/test";
import { provisionUser, retireProvisionedUsers, signIn, uiLogin, runToken, FINAL_PASSWORD, type TestUser } from "./helpers";


// E2E-07 and E2E-08 (docs/lab-03/tests.md §2.8) — Administrator User Management
// end to end: a created account's first sign-in, a reset initial password, and
// the two Administrator guards.

let admin: TestUser;

test.beforeAll(async () => {
  admin = await provisionUser("ADMINISTRATOR", "Admin");
});

test.afterAll(retireProvisionedUsers);

async function pageAs(browser: Browser, user: TestUser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, user);
  return page;
}

async function openEdit(page: Page, name: string): Promise<void> {
  await page.getByLabel("Search users").fill(name);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
}

/** Signs in with an initial password, is forced to change it, and lands in the app. */
async function completeFirstLogin(page: Page, email: string, initial: string): Promise<void> {
  await uiLogin(page, email, initial);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("status")).toContainText("temporary password");
  await page.getByLabel("Current password").fill(initial);
  await page.locator("#newPassword").fill(FINAL_PASSWORD);
  await page.getByLabel("Confirm new password").fill(FINAL_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

// E2E-07 — AC-46, AC-51
test("E2E-07: an Administrator creates a user who is forced through the password change, and a reset forces it again", async ({
  browser,
}) => {
  const token = runToken();
  const name = `Created Staff ${token}`;
  const email = `created.${token}@toktickit.test`;
  const initial = "Welcome-Initial-1";

  const adminPage = await pageAs(browser, admin);
  await expect(adminPage).toHaveURL(/\/admin\/users$/);

  // AC-46 — create with exactly one role.
  await adminPage.getByRole("button", { name: "+ Create user" }).click();
  const dialog = adminPage.getByRole("dialog", { name: "Create user" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Role").selectOption("IT_STAFF");
  await dialog.getByLabel("Initial password").fill(initial);
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(adminPage.getByRole("status")).toContainText(`Created ${name}`);

  await adminPage.getByLabel("Search users").fill(token);
  const row = adminPage.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("IT Staff");
  await expect(row).toContainText("Active");

  // The new user signs in and is held on the change screen until they choose.
  const userPage = await (await browser.newContext()).newPage();
  await completeFirstLogin(userPage, email, initial);
  await expect(userPage).toHaveURL(/\/staff\/tickets$/);

  // AC-51 — a new initial password ends their session and forces another change.
  await openEdit(adminPage, name);
  await adminPage.getByRole("button", { name: "Set new initial password" }).click();
  const reset = adminPage.getByRole("dialog", { name: "Set new initial password" });
  const second = "Reset-Initial-22";
  await reset.getByLabel("New initial password").fill(second);
  await reset.getByRole("button", { name: "Set password" }).click();
  await expect(adminPage.getByRole("status")).toContainText(`New initial password set for ${name}`);

  await userPage.reload();
  await expect(userPage).toHaveURL(/\/login$/);
  await completeFirstLogin(userPage, email, second);
});

// E2E-08 — AC-49, AC-50
test("E2E-08: self-deactivation and last-Administrator removal are both refused with a visible message", async ({
  browser,
}) => {
  const adminPage = await pageAs(browser, admin);

  // AC-49 — on their own row the Administrator's status and role are locked, and
  // the refusal is stated beside the control before they try.
  await openEdit(adminPage, admin.name);
  const own = adminPage.getByRole("dialog", { name: "Edit user" });
  await expect(own.getByRole("radio", { name: "Inactive" })).toBeDisabled();
  await expect(own.getByLabel("Role")).toBeDisabled();
  await expect(own.getByText("You cannot deactivate your own account.")).toBeVisible();
  await expect(own.getByText("You cannot change your own role.")).toBeVisible();
  await own.getByRole("button", { name: "Cancel" }).click();

  // The server refuses it too, even when the UI is bypassed.
  const direct = await adminPage.request.patch(`http://localhost:3000/api/admin/users/${admin.id}`, {
    data: { isActive: false },
  });
  expect(direct.status()).toBe(409);
  expect(await direct.json()).toEqual({ error: "You cannot deactivate your own account." });

  // AC-50 — UI-level check. With several active Administrators in the shared
  // database, the last-Administrator refusal is reachable only through a
  // concurrent race, which API-36 and UNIT-11 prove server-side. Here the
  // server's exact 409 body is injected to prove the screen states it beside
  // the Status control and leaves the row unchanged.
  const other = await provisionUser("ADMINISTRATOR", "Other Admin");
  await adminPage.route(`**/api/admin/users/${other.id}`, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "The system must keep at least one active administrator." }),
        })
      : route.continue()
  );
  await adminPage.reload();
  await openEdit(adminPage, other.name);
  const edit = adminPage.getByRole("dialog", { name: "Edit user" });
  await edit.getByRole("radio", { name: "Inactive" }).check();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit.getByText("The system must keep at least one active administrator.")).toBeVisible();
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(adminPage.getByRole("row", { name: new RegExp(other.name) })).toContainText("Active");
});
