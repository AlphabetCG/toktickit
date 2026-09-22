import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie, TEST_PASSWORD } from "../helpers/auth.js";

// API-01…API-10 (docs/lab-03/tests.md §2.2). Requires a migrated + seeded database.
const prisma = new PrismaClient();

const E = {
  normal: "auth.normal@toktickit.test",
  change: "auth.change@toktickit.test",
  deact: "auth.deact@toktickit.test",
  sessions: "auth.sessions@toktickit.test",
  weak: "auth.weak@toktickit.test",
  unknown: "auth.nobody@toktickit.test",
};

const login = (email: string, password: string) =>
  request(app).post("/api/auth/login").send({ email, password });

beforeAll(async () => {
  await ensureUser(prisma, { email: E.normal, role: "REQUESTER" });
  await ensureUser(prisma, { email: E.change, role: "REQUESTER", mustChangePassword: true });
  await ensureUser(prisma, { email: E.deact, role: "REQUESTER", isActive: false });
  await ensureUser(prisma, { email: E.sessions, role: "REQUESTER" });
  await ensureUser(prisma, { email: E.weak, role: "REQUESTER" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// API-01 — AC-01
it("API-01: valid login establishes a session and returns identity without a password field", async () => {
  const res = await login(E.normal, TEST_PASSWORD);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ email: E.normal, role: "REQUESTER", mustChangePassword: false });
  expect(res.body.id).toEqual(expect.any(Number));
  expect(res.headers["set-cookie"]?.[0]).toContain("toktickit_session=");
  // No password material — the mustChangePassword flag is fine, but no password
  // value or hash may appear.
  expect(res.body).not.toHaveProperty("passwordHash");
  expect(res.body).not.toHaveProperty("password");
  expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // no bcrypt hash
});

// API-02 — AC-02, BR-02
it("API-02: a change-required user is blocked by the gate until the password is saved", async () => {
  const cookie = await loginCookie(E.change);
  const blocked = await request(app).get("/api/categories").set("Cookie", cookie);
  expect(blocked.status).toBe(403);
  expect(blocked.body.passwordChangeRequired).toBe(true);

  const changed = await request(app)
    .post("/api/auth/password")
    .set("Cookie", cookie)
    .send({ currentPassword: TEST_PASSWORD, newPassword: "FreshLongPass!2026" });
  expect(changed.status).toBe(200);

  const allowed = await request(app).get("/api/categories").set("Cookie", cookie);
  expect(allowed.status).toBe(200);
});

// API-03 / API-04 / API-06 — AC-03…AC-06, BR-05, BR-06
describe("uniform failure responses", () => {
  it("API-03: a wrong password returns 401 with the uniform message and no session", async () => {
    const res = await login(E.normal, "definitely-wrong-password");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Email or password is incorrect." });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("API-04: an unknown email is byte-identical to a wrong password", async () => {
    const wrong = await login(E.normal, "definitely-wrong-password");
    const unknown = await login(E.unknown, "whatever-password");
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("API-06: a deactivated account with a wrong password is byte-identical too", async () => {
    const wrong = await login(E.normal, "definitely-wrong-password");
    const deactWrong = await login(E.deact, "definitely-wrong-password");
    expect(deactWrong.status).toBe(wrong.status);
    expect(deactWrong.body).toEqual(wrong.body);
  });
});

// API-05 — AC-05, BR-06
it("API-05: a deactivated account with the correct password is refused by name and gets no session", async () => {
  const res = await login(E.deact, TEST_PASSWORD);
  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/deactivated/i);
  expect(res.headers["set-cookie"]).toBeUndefined();
});

// API-07 — AC-07, BR-08
it("API-07: logout deletes the session and the next request is 401", async () => {
  const cookie = await loginCookie(E.normal);
  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);

  const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
  expect(out.status).toBe(200);

  expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  // A second logout on the now-dead session is 401.
  expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(401);
});

// API-08 — AC-08
it("API-08: a weak new password is rejected and the old one still authenticates", async () => {
  const cookie = await loginCookie(E.weak);
  const res = await request(app)
    .post("/api/auth/password")
    .set("Cookie", cookie)
    .send({ currentPassword: TEST_PASSWORD, newPassword: "short" });
  expect(res.status).toBe(400);
  expect(res.body.fields.newPassword).toMatch(/12/);
  // The old password still works.
  expect((await login(E.weak, TEST_PASSWORD)).status).toBe(200);
});

// API-09 — AC-09, BR-11
it("API-09: changing the password invalidates the user's other sessions", async () => {
  const first = await loginCookie(E.sessions);
  const second = await loginCookie(E.sessions);

  const change = await request(app)
    .post("/api/auth/password")
    .set("Cookie", second)
    .send({ currentPassword: TEST_PASSWORD, newPassword: "RotatedSecret!2026" });
  expect(change.status).toBe(200);

  // The other (first) session is now dead; the changing session survives.
  expect((await request(app).get("/api/auth/me").set("Cookie", first)).status).toBe(401);
  expect((await request(app).get("/api/auth/me").set("Cookie", second)).status).toBe(200);
  // The new password authenticates.
  expect((await login(E.sessions, "RotatedSecret!2026")).status).toBe(200);
});

// API-10 — AC-11, BR-09
it("API-10: the session cookie carries HttpOnly, SameSite=Lax, and Path=/", async () => {
  const res = await login(E.normal, TEST_PASSWORD);
  const cookie = res.headers["set-cookie"][0];
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(cookie).toMatch(/Path=\//i);
});
