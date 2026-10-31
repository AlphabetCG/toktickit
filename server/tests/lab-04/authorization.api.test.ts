import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";

// AUTHZ-01…AUTHZ-04, AUTHZ-06…AUTHZ-08 (docs/lab-04/tests.md §2.5) for the
// Actions Taken routes (#49) and the ticket workflow (#51). Every request goes
// straight to the API, so the UI is bypassed entirely. AUTHZ-05 and the two
// dashboard routes of AUTHZ-07 arrived with #52 and #53.
const prisma = new PrismaClient();
const TOKEN = `AZ4${Date.now()}`;

let owner: { id: number; cookie: string };
let other: { id: number; cookie: string };
let staff: { id: number; cookie: string };
let admin: { id: number; cookie: string };
let gated: string;
let ownTicket: number;
let othersTicket: number;
let ownAction: number;
let othersAction: number;

const DAY = 24 * 3_600_000;
const actionBody = { actionAt: new Date(Date.now() - DAY).toISOString(), description: "Diagnosed the fault." };

async function fixtureTicket(requesterId: number, n: number) {
  const [categoryId, relatedSystemId] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }).then((c) => c.id),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }).then((s) => s.id),
  ]);
  return (
    await prisma.ticket.create({
      data: {
        ticketNumber: `${TOKEN}-${n}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${TOKEN} ticket ${n}`,
        description: "Authorization fixture with a long enough description.",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "IN_PROGRESS",
        ticketDate: new Date(Date.now() - 5 * DAY),
      },
    })
  ).id;
}

async function account(email: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  const u = await ensureUser(prisma, { email, name: email.split("@")[0], role });
  return { id: u.id, cookie: await loginCookie(email) };
}

beforeAll(async () => {
  owner = await account("az4.owner@toktickit.test", "REQUESTER");
  other = await account("az4.other@toktickit.test", "REQUESTER");
  staff = await account("az4.staff@toktickit.test", "IT_STAFF");
  admin = await account("az4.admin@toktickit.test", "ADMINISTRATOR");
  await ensureUser(prisma, { email: "az4.gated@toktickit.test", role: "IT_STAFF", mustChangePassword: true });
  gated = await loginCookie("az4.gated@toktickit.test");

  ownTicket = await fixtureTicket(owner.id, 1);
  othersTicket = await fixtureTicket(other.id, 2);
  const post = (t: number) =>
    request(app).post(`/api/tickets/${t}/actions`).set("Cookie", staff.cookie).send(actionBody);
  ownAction = (await post(ownTicket)).body.id;
  othersAction = (await post(othersTicket)).body.id;
});

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
});

const counts = () => prisma.actionTaken.count({ where: { ticket: { ticketNumber: { startsWith: TOKEN } } } });

// AUTHZ-01 — AC-20, BR-17
it("AUTHZ-01: a Requester cannot create, edit, or change status of an action on their own Ticket", async () => {
  const before = await counts();
  const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: ownAction } });
  const forbidden = { error: "Only IT Staff can record actions." };

  const created = await request(app).post(`/api/tickets/${ownTicket}/actions`).set("Cookie", owner.cookie).send(actionBody);
  expect(created.status).toBe(403);
  expect(created.body).toEqual(forbidden);

  for (const change of [{ description: "Requester edit" }, { status: "CANCELLED" }]) {
    const res = await request(app)
      .patch(`/api/actions/${ownAction}`)
      .set("Cookie", owner.cookie)
      .send({ expectedVersion: 1, ...change });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(forbidden);
  }
  expect(await counts()).toBe(before);
  expect(await prisma.actionTaken.findUniqueOrThrow({ where: { id: ownAction } })).toEqual(stored);
});

// AUTHZ-02 — AC-20
it("AUTHZ-02: the same writes on another Requester's Ticket are 404, identical to a missing one", async () => {
  const before = await counts();
  const post = (t: number) => request(app).post(`/api/tickets/${t}/actions`).set("Cookie", owner.cookie).send(actionBody);
  const missingTicket = await post(999999999);
  const theirs = await post(othersTicket);
  expect(theirs.status).toBe(404);
  expect(theirs.text).toBe(missingTicket.text);

  const patch = (a: number) =>
    request(app).patch(`/api/actions/${a}`).set("Cookie", owner.cookie).send({ expectedVersion: 1, status: "CANCELLED" });
  const missingAction = await patch(999999999);
  const theirAction = await patch(othersAction);
  expect(theirAction.status).toBe(404);
  expect(theirAction.text).toBe(missingAction.text);
  expect(await counts()).toBe(before);
});

// AUTHZ-03 — AC-21, BR-18
it("AUTHZ-03: a Requester reads every action on their own Ticket without creator or email", async () => {
  const res = await request(app).get(`/api/tickets/${ownTicket}/actions`).set("Cookie", owner.cookie);
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(1);
  const [action] = res.body.items;
  expect(action.performedBy).toEqual({ id: staff.id, name: "az4.staff" });
  expect(action).not.toHaveProperty("createdBy");
  expect(action).not.toHaveProperty("clientRequestId");
  expect(res.text).not.toMatch(/@/);

  const staffView = await request(app).get(`/api/tickets/${ownTicket}/actions`).set("Cookie", staff.cookie);
  expect(staffView.body.items[0].createdBy).toEqual({ id: staff.id, name: "az4.staff" });
  expect(staffView.text).not.toMatch(/@/);
});

// AUTHZ-04 — AC-22
describe("AUTHZ-04: another Requester's actions and status history are 404, identical to a missing Ticket", () => {
  it.each(["actions", "status-history"])("%s", async (resource) => {
    const missing = await request(app).get(`/api/tickets/999999999/${resource}`).set("Cookie", owner.cookie);
    const malformed = await request(app).get(`/api/tickets/abc/${resource}`).set("Cookie", owner.cookie);
    const theirs = await request(app).get(`/api/tickets/${othersTicket}/${resource}`).set("Cookie", owner.cookie);
    expect(theirs.status).toBe(404);
    expect(theirs.text).toBe(missing.text);
    expect(malformed.text).toBe(missing.text);
  });
});

// AUTHZ-06 — AC-24
it("AUTHZ-06: an Administrator creates, edits, and completes an action and resolves the Ticket", async () => {
  const ticketId = await fixtureTicket(owner.id, 3);
  const created = await request(app)
    .post(`/api/tickets/${ticketId}/actions`)
    .set("Cookie", admin.cookie)
    .send({ ...actionBody, performedById: admin.id });
  expect(created.status).toBe(201);
  expect(created.body.createdBy.id).toBe(admin.id);

  const edited = await request(app)
    .patch(`/api/actions/${created.body.id}`)
    .set("Cookie", admin.cookie)
    .send({ expectedVersion: 1, description: "Diagnosed and fixed." });
  expect(edited.status).toBe(200);

  const done = await request(app)
    .patch(`/api/actions/${created.body.id}`)
    .set("Cookie", admin.cookie)
    .send({ expectedVersion: 2, status: "COMPLETED", result: "Working again." });
  expect(done.status).toBe(200);
  expect(done.body).toMatchObject({ status: "COMPLETED", version: 3 });

  const resolved = await request(app)
    .patch(`/api/tickets/${ticketId}/status`)
    .set("Cookie", admin.cookie)
    .send({ status: "RESOLVED", expectedVersion: 1 });
  expect(resolved.status).toBe(200);
  expect(resolved.body.currentStatus).toBe("RESOLVED");
});

// AUTHZ-07 — §6.1, all six new routes
describe("AUTHZ-07: gates on the new routes", () => {
  const routes: [string, (r: ReturnType<typeof request>) => request.Test][] = [
    ["GET /api/tickets/:id/actions", (r) => r.get(`/api/tickets/${ownTicket}/actions`)],
    ["POST /api/tickets/:id/actions", (r) => r.post(`/api/tickets/${ownTicket}/actions`).send(actionBody)],
    ["PATCH /api/actions/:id", (r) => r.patch(`/api/actions/${ownAction}`).send({ expectedVersion: 1 })],
    ["GET /api/tickets/:id/status-history", (r) => r.get(`/api/tickets/${ownTicket}/status-history`)],
    ["GET /api/dashboard/staff", (r) => r.get("/api/dashboard/staff")],
    ["GET /api/dashboard/requester", (r) => r.get("/api/dashboard/requester")],
  ];

  it.each(routes)("%s: no session → 401", async (_name, call) => {
    const res = await call(request(app));
    expect(res.status).toBe(401);
  });

  it.each(routes)("%s: password change outstanding → 403 passwordChangeRequired", async (_name, call) => {
    const res = await call(request(app)).set("Cookie", gated);
    expect(res.status).toBe(403);
    expect(res.body.passwordChangeRequired).toBe(true);
  });
});

// AUTHZ-08 — BR-23
it("AUTHZ-08: a Requester never changes status, even on their own Ticket with a valid version", async () => {
  const version = (await prisma.ticket.findUniqueOrThrow({ where: { id: ownTicket } })).version;
  const res = await request(app)
    .patch(`/api/tickets/${ownTicket}/status`)
    .set("Cookie", owner.cookie)
    .send({ status: "CANCELLED", expectedVersion: version });
  expect(res.status).toBe(403);
  const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ownTicket } });
  expect(stored).toMatchObject({ currentStatus: "IN_PROGRESS", version });
});

// AUTHZ-05 — AC-23
describe("AUTHZ-05: each dashboard refuses the other roles", () => {
  it("a Requester cannot read the staff dashboard", async () => {
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", owner.cookie);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "This dashboard is for IT Staff." });
  });

  it.each([
    ["IT Staff", () => staff.cookie],
    ["an Administrator", () => admin.cookie],
  ])("%s cannot read the Requester dashboard", async (_who, cookie) => {
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "This dashboard is for requesters." });
  });
});

// AUTHZ-09 — AC-54, D-04
it("AUTHZ-09: an Administrator reads the queue and a Ticket's detail, actions, and history", async () => {
  for (const path of [
    "/api/staff/tickets",
    `/api/tickets/${ownTicket}`,
    `/api/tickets/${ownTicket}/actions`,
    `/api/tickets/${ownTicket}/status-history`,
    "/api/dashboard/staff",
  ]) {
    const res = await request(app).get(path).set("Cookie", admin.cookie);
    expect({ path, status: res.status }).toEqual({ path, status: 200 });
  }
});
