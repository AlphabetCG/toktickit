import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

// Shared setup for the Lab 3 suite. Every account a spec signs in as is created
// through the real Administrator API (POST /api/admin/users) by the seeded
// Administrator, so the suite never edits a seeded account's password and never
// writes to PostgreSQL behind the server's back.

export const SERVER_URL = "http://localhost:3000";

// The seeded Administrator (server/prisma/seed.ts) — the only seeded account that
// is not flagged for a password change, so it can call the API immediately.
const SEED_ADMIN = { email: "arthit.admin@toktickit.test", password: "ChangeMe123!" };

export const INITIAL_PASSWORD = "Initial-Pass-2026";
export const FINAL_PASSWORD = "Chosen-Pass-2026!";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface TestUser {
  id: number;
  name: string;
  email: string;
  password: string;
}

// A per-run token keeps emails and summaries unique, because the development
// database accumulates rows across runs (tests.md §7).
export function runToken(): string {
  return `e2e${Date.now()}${Math.floor(Math.random() * 1e4)}`;
}

/** An API context signed in as `email` (the session cookie lives in the context). */
export async function apiAs(email: string, password: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: SERVER_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `API login as ${email}`).toBe(200);
  return ctx;
}

/**
 * Creates a user through the Administrator API. With `changed: true` the user also
 * completes the mandatory password change through the API, so a spec can sign in
 * straight to the application; otherwise they still hold the initial password.
 */
export async function provisionUser(
  role: Role,
  label: string,
  { changed = true }: { changed?: boolean } = {}
): Promise<TestUser> {
  const token = runToken();
  const name = `E2E ${label} ${token}`;
  const email = `${label.toLowerCase().replace(/\W+/g, ".")}.${token}@toktickit.test`;

  const admin = await apiAs(SEED_ADMIN.email, SEED_ADMIN.password);
  const created = await admin.post("/api/admin/users", {
    data: { name, email, role, initialPassword: INITIAL_PASSWORD },
  });
  expect(created.status(), "create user").toBe(201);
  const { id } = await created.json();
  await admin.dispose();
  provisioned.push(id);

  if (!changed) return { id, name, email, password: INITIAL_PASSWORD };

  const self = await apiAs(email, INITIAL_PASSWORD);
  const changedRes = await self.post("/api/auth/password", {
    data: { currentPassword: INITIAL_PASSWORD, newPassword: FINAL_PASSWORD },
  });
  expect(changedRes.status(), "password change").toBe(200);
  await self.dispose();
  return { id, name, email, password: FINAL_PASSWORD };
}

// Ids created by this worker, retired in afterAll so the shared development
// database does not accumulate active test accounts — in particular active
// Administrators — across runs. Users are never deleted (BR-57), only deactivated.
const provisioned: number[] = [];

/** Deactivates a user through the Administrator API. */
export async function deactivateUser(id: number): Promise<void> {
  const admin = await apiAs(SEED_ADMIN.email, SEED_ADMIN.password);
  const res = await admin.patch(`/api/admin/users/${id}`, { data: { isActive: false } });
  expect(res.status(), `deactivate user ${id}`).toBe(200);
  await admin.dispose();
}

/** Deactivates every account this spec file provisioned. */
export async function retireProvisionedUsers(): Promise<void> {
  while (provisioned.length > 0) await deactivateUser(provisioned.pop()!);
}

/** Creates a Ticket as `requester` through the API and returns its id and number. */
export async function createTicketViaApi(
  requester: TestUser,
  summary: string
): Promise<{ id: number; ticketNumber: string }> {
  const ctx = await apiAs(requester.email, requester.password);
  const [categories, systems] = await Promise.all([
    ctx.get("/api/categories").then((r) => r.json()),
    ctx.get("/api/related-systems").then((r) => r.json()),
  ]);
  const res = await ctx.post("/api/tickets", {
    data: {
      categoryId: categories[0].id,
      relatedSystemId: systems[0].id,
      requestedPriority: "MEDIUM",
      summary,
      description: `End-to-end fixture ticket with enough description to be valid. ${summary}`,
    },
  });
  expect(res.status(), "create ticket").toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return { id: body.id, ticketNumber: body.ticketNumber };
}

/** Signs in through the real Login screen. */
export async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in and waits until the application shell (the Logout button) is shown. */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await uiLogin(page, user.email, user.password);
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}
