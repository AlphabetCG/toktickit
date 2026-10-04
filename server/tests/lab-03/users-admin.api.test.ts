import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie, TEST_PASSWORD } from "../helpers/auth.js";

// API-29…API-38 (docs/lab-03/tests.md §2.2) and the supporting API-47 / API-48.
const prisma = new PrismaClient();
const TAG = `adm${Date.now()}`;
const NEW_PASSWORD = "FreshInitial!2026";

let adminId: number;
let adminCookie: string;

const asAdmin = {
  get: (path: string) => request(app).get(path).set("Cookie", adminCookie),
  post: (path: string, body: object) => request(app).post(path).set("Cookie", adminCookie).send(body),
  patch: (path: string, body: object) => request(app).patch(path).set("Cookie", adminCookie).send(body),
};

const newUser = (over: object = {}) => ({
  name: "Wanida Chaiyo",
  email: `wanida.${TAG}.${Math.random().toString(36).slice(2, 7)}@toktickit.test`,
  role: "IT_STAFF",
  initialPassword: NEW_PASSWORD,
  ...over,
});

beforeAll(async () => {
  adminId = (await ensureUser(prisma, { email: "adm.main@toktickit.test", name: "Adm Main", role: "ADMINISTRATOR" })).id;
  await ensureUser(prisma, { email: `zz.search.${TAG}@toktickit.test`, name: `Searchable ${TAG}`, role: "REQUESTER" });
  adminCookie = await loginCookie("adm.main@toktickit.test");
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { user: { email: { contains: TAG } } } });
  await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  await prisma.$disconnect();
});

// API-29 — AC-43
it("API-29: lists users with name, email, role, and status, and never a password hash", async () => {
  const res = await asAdmin.get("/api/admin/users");
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  for (const u of res.body) {
    expect(Object.keys(u).sort()).toEqual(["createdAt", "email", "id", "isActive", "mustChangePassword", "name", "role"]);
    expect(u).not.toHaveProperty("passwordHash");
  }
  expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // no bcrypt string anywhere
});

// API-30 — AC-44
describe("API-30: search matches name and email, case-insensitively", () => {
  it("matches on name", async () => {
    const res = await asAdmin.get(`/api/admin/users?search=${encodeURIComponent(`SEARCHABLE ${TAG}`.toLowerCase())}`);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual([`zz.search.${TAG}@toktickit.test`]);
  });

  it("matches on email, in any casing", async () => {
    const res = await asAdmin.get(`/api/admin/users?search=ZZ.SEARCH.${TAG.toUpperCase()}`);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual([`zz.search.${TAG}@toktickit.test`]);
  });
});

// API-31 — AC-45
it("API-31: the role filter returns only that role", async () => {
  for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]) {
    const res = await asAdmin.get(`/api/admin/users?role=${role}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((u: { role: string }) => u.role === role)).toBe(true);
  }
});

// API-32 — AC-46, BR-49
it("API-32: a created user holds exactly one role and is flagged for a password change", async () => {
  const body = newUser({ email: `Mixed.Case.${TAG}@TokTickIT.test`, mustChangePassword: false });
  const res = await asAdmin.post("/api/admin/users", body);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ role: "IT_STAFF", isActive: true, mustChangePassword: true });
  expect(res.body.email).toBe(`mixed.case.${TAG}@toktickit.test`); // stored lower-cased (BR-12)
  expect(res.body).not.toHaveProperty("passwordHash");

  // The initial password works, and the new user lands on the password gate.
  const login = await request(app).post("/api/auth/login").send({ email: body.email, password: NEW_PASSWORD });
  expect(login.status).toBe(200);
  expect(login.body.mustChangePassword).toBe(true);
});

// API-33 — AC-47, BR-51
describe("API-33: a duplicate email is a 409 on create and on edit, in any casing", () => {
  it("rejects a case-differing duplicate on create and writes nothing", async () => {
    const first = newUser();
    expect((await asAdmin.post("/api/admin/users", first)).status).toBe(201);
    const before = await prisma.user.count();

    const dup = await asAdmin.post("/api/admin/users", newUser({ email: first.email.toUpperCase() }));
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: "That email address is already registered." });
    expect(await prisma.user.count()).toBe(before);
  });

  it("rejects a duplicate on edit and leaves the email unchanged", async () => {
    const a = (await asAdmin.post("/api/admin/users", newUser())).body;
    const b = (await asAdmin.post("/api/admin/users", newUser())).body;

    const res = await asAdmin.patch(`/api/admin/users/${b.id}`, { email: `  ${a.email.toUpperCase()} ` });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "That email address is already registered." });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).email).toBe(b.email);
  });

  it("lets a user keep their own email when re-saved", async () => {
    const a = (await asAdmin.post("/api/admin/users", newUser())).body;
    const res = await asAdmin.patch(`/api/admin/users/${a.id}`, { email: a.email.toUpperCase(), name: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: a.email, name: "Renamed" });
  });
});

// API-34 — AC-48, BR-52
describe("API-34: an invalid role is a 400 and writes nothing", () => {
  it.each([["SUPERUSER"], [["REQUESTER", "IT_STAFF"]], [undefined]])("rejects role=%j on create", async (role) => {
    const before = await prisma.user.count();
    const res = await asAdmin.post("/api/admin/users", newUser({ role }));
    expect(res.status).toBe(400);
    expect(res.body.fields.role).toBeTruthy();
    expect(await prisma.user.count()).toBe(before);
  });

  it("rejects an invalid role on edit", async () => {
    const u = (await asAdmin.post("/api/admin/users", newUser())).body;
    const res = await asAdmin.patch(`/api/admin/users/${u.id}`, { role: "ROOT" });
    expect(res.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("IT_STAFF");
  });
});

describe("create validation", () => {
  it("names each invalid field at once", async () => {
    const res = await asAdmin.post("/api/admin/users", { name: " ", email: "not-an-email", role: "IT_STAFF", initialPassword: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(["email", "initialPassword", "name"]);
  });
});

// API-35 — AC-49, BR-54
it("API-35: an Administrator cannot deactivate their own account", async () => {
  const res = await asAdmin.patch(`/api/admin/users/${adminId}`, { isActive: false });
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: "You cannot deactivate your own account." });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).isActive).toBe(true);
});

// API-36 — AC-50, BR-56. The guard cannot fire from a single request: the acting
// Administrator is always active, and self-removal is refused first (API-35,
// AUTHZ-12). Its real path is two Administrators removing each other at once,
// which is exactly what a check counted outside the transaction would get wrong.
describe("API-36: the last active Administrator survives concurrent removal", () => {
  let restore: number[] = [];
  let x: { id: number; cookie: string };
  let y: { id: number; cookie: string };

  // Leave exactly two active Administrators, X and Y, for the duration.
  async function onlyTwoActiveAdmins() {
    const xId = (await ensureUser(prisma, { email: `adm.x.${TAG}@toktickit.test`, name: "Adm X", role: "ADMINISTRATOR" })).id;
    const yId = (await ensureUser(prisma, { email: `adm.y.${TAG}@toktickit.test`, name: "Adm Y", role: "ADMINISTRATOR" })).id;
    x = { id: xId, cookie: await loginCookie(`adm.x.${TAG}@toktickit.test`) };
    y = { id: yId, cookie: await loginCookie(`adm.y.${TAG}@toktickit.test`) };
    const others = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [xId, yId] } },
      select: { id: true },
    });
    restore.push(...others.map((o) => o.id));
    await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: false } });
  }

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: restore } }, data: { isActive: true } });
    restore = [];
  });

  it.each([
    ["deactivate", { isActive: false }],
    ["demote", { role: "IT_STAFF" }],
  ])("when each of the last two tries to %s the other, exactly one succeeds", async (_verb, change) => {
    await onlyTwoActiveAdmins();

    const [xr, yr] = await Promise.all([
      request(app).patch(`/api/admin/users/${y.id}`).set("Cookie", x.cookie).send(change),
      request(app).patch(`/api/admin/users/${x.id}`).set("Cookie", y.cookie).send(change),
    ]);
    const statuses = [xr.status, yr.status];

    // Exactly one wins. The loser is refused by the guard (409) — or, if its
    // session was checked after the winner committed, by gate 1 (401/403).
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    const loser = [xr, yr].find((r) => r.status !== 200)!;
    expect([409, 401, 403]).toContain(loser.status);
    if (loser.status === 409) expect(loser.body).toEqual({ error: "The system must keep at least one active administrator." });

    const stillActiveAdmins = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(stillActiveAdmins).toBeGreaterThanOrEqual(1);

    // Reset X and Y for the next case.
    await prisma.user.updateMany({ where: { id: { in: [x.id, y.id] } }, data: { isActive: true, role: "ADMINISTRATOR" } });
  });
});

// API-37 — AC-51, BR-53
it("API-37: a new initial password re-flags the user and authenticates", async () => {
  const email = `reset.${TAG}@toktickit.test`;
  const target = await ensureUser(prisma, { email, role: "REQUESTER", mustChangePassword: false });

  const res = await asAdmin.post(`/api/admin/users/${target.id}/initial-password`, { initialPassword: NEW_PASSWORD });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ id: target.id, mustChangePassword: true }); // the password is never echoed

  expect((await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD })).status).toBe(401);
  const login = await request(app).post("/api/auth/login").send({ email, password: NEW_PASSWORD });
  expect(login.status).toBe(200);
  expect(login.body.mustChangePassword).toBe(true);
});

// API-38 — AC-52, BR-53
it("API-38: setting an initial password ends the user's existing sessions", async () => {
  const email = `session.${TAG}@toktickit.test`;
  const target = await ensureUser(prisma, { email, role: "IT_STAFF" });
  const theirCookie = await loginCookie(email);
  expect((await request(app).get("/api/auth/me").set("Cookie", theirCookie)).status).toBe(200);

  await asAdmin.post(`/api/admin/users/${target.id}/initial-password`, { initialPassword: NEW_PASSWORD });

  expect((await request(app).get("/api/auth/me").set("Cookie", theirCookie)).status).toBe(401);
  expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
});

it("rejects a weak initial password and leaves the old one working", async () => {
  const email = `weak.${TAG}@toktickit.test`;
  const target = await ensureUser(prisma, { email, role: "REQUESTER" });
  const res = await asAdmin.post(`/api/admin/users/${target.id}/initial-password`, { initialPassword: "short" });
  expect(res.status).toBe(400);
  expect(res.body.fields.initialPassword).toBeTruthy();
  expect((await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD })).status).toBe(200);
});

it("returns 404 for a user that does not exist", async () => {
  expect((await asAdmin.patch("/api/admin/users/999999999", { name: "X" })).body).toEqual({ error: "User not found" });
  expect((await asAdmin.post("/api/admin/users/999999999/initial-password", { initialPassword: NEW_PASSWORD })).status).toBe(404);
});

// API-47 — api-spec §1.3: deactivation takes effect on the user's next request.
it("API-47: deactivating a user ends their live session on the next request", async () => {
  const email = `live.${TAG}@toktickit.test`;
  const target = await ensureUser(prisma, { email, role: "REQUESTER" });
  const theirCookie = await loginCookie(email);

  expect((await asAdmin.patch(`/api/admin/users/${target.id}`, { isActive: false })).status).toBe(200);
  expect((await request(app).get("/api/auth/me").set("Cookie", theirCookie)).status).toBe(401);
});

// API-48 — BR-50: only name, email, role, and activation are editable.
it("API-48: an edit ignores mustChangePassword and password fields", async () => {
  const email = `scope.${TAG}@toktickit.test`;
  const target = await ensureUser(prisma, { email, role: "REQUESTER", mustChangePassword: false });
  const res = await asAdmin.patch(`/api/admin/users/${target.id}`, {
    name: "Scoped",
    mustChangePassword: true,
    passwordHash: "x",
    initialPassword: NEW_PASSWORD,
  });
  expect(res.status).toBe(200);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  expect(row.name).toBe("Scoped");
  expect(row.mustChangePassword).toBe(false);
  expect((await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD })).status).toBe(200);
});
