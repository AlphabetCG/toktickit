import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// AUTHZ-01, AUTHZ-02 (docs/lab-03/tests.md §2.4). The role-specific refusals
// (AUTHZ-03…12) arrive with the queue/admin/notes routes in later Issues.
const prisma = new PrismaClient();

let categoryId: number;
let relatedSystemId: number;
let cookieA: string;
let cookieB: string;
let otherUserId: number;

beforeAll(async () => {
  await ensureUser(prisma, { email: "authz.a@toktickit.test", role: "REQUESTER" });
  otherUserId = (await ensureUser(prisma, { email: "authz.b@toktickit.test", role: "REQUESTER" })).id;
  cookieA = await loginCookie("authz.a@toktickit.test");
  cookieB = await loginCookie("authz.b@toktickit.test");
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

// A ticket owned by requester B, for the cross-owner refusal tests.
async function ticketOwnedByB(): Promise<number> {
  const res = await request(app).post("/api/tickets").set("Cookie", cookieB).send({
    categoryId,
    relatedSystemId,
    requestedPriority: "LOW",
    summary: "Owned strictly by requester B",
    description: "Only B may reach this ticket; A must get an identical 404.",
  });
  return res.body.id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

// AUTHZ-01 — AC-10, BR-13
describe("AUTHZ-01: unauthenticated access is refused with 401", () => {
  const protectedRoutes: [string, string][] = [
    ["get", "/api/auth/me"],
    ["post", "/api/auth/logout"],
    ["post", "/api/auth/password"],
    ["get", "/api/categories"],
    ["get", "/api/related-systems"],
    ["get", "/api/tickets"],
    ["post", "/api/tickets"],
    ["get", "/api/tickets/1"],
    ["get", "/api/tickets/1/attachments"],
    ["get", "/api/attachments/1/download"],
    ["delete", "/api/attachments/1"],
  ];

  it.each(protectedRoutes)("%s %s → 401 with no session", async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

// AUTHZ-02 — AC-12, BR-03
describe("AUTHZ-02: client-supplied identity is ignored", () => {
  it("creates the Ticket for the session user even when the body names another id", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieA)
      .set("X-Requester-Id", String(otherUserId)) // the Lab 2 header must be inert
      .send({
        categoryId,
        relatedSystemId,
        requestedPriority: "LOW",
        requesterId: otherUserId, // a spoofed owner in the body
        summary: "Ownership comes from the session, not the body",
        description: "This ticket must belong to the authenticated caller only.",
      });
    expect(res.status).toBe(201);

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.requesterId).not.toBe(otherUserId);
    expect(res.body.requesterId).not.toBe(otherUserId);
  });

  it("lists only the session user's Tickets regardless of an X-Requester-Id header", async () => {
    const res = await request(app)
      .get("/api/tickets?pageSize=50")
      .set("Cookie", cookieA)
      .set("X-Requester-Id", String(otherUserId));
    expect(res.status).toBe(200);
    // Every returned ticket belongs to the caller; none leaks from the header id.
    const me = await request(app).get("/api/auth/me").set("Cookie", cookieA);
    const numbers = res.body.items as { id: number }[];
    const owned = await prisma.ticket.findMany({
      where: { id: { in: numbers.map((t) => t.id) } },
      select: { requesterId: true },
    });
    expect(owned.every((t) => t.requesterId === me.body.id)).toBe(true);
  });
});

// AUTHZ-06 — AC-16, BR-15: another requester's ticket is byte-identical to a
// missing one, so existence never leaks.
describe("AUTHZ-06: a Requester cannot distinguish another's ticket from a missing one", () => {
  it("returns an identical 404 for a not-owned ticket and a non-existent id", async () => {
    const bTicket = await ticketOwnedByB();
    const notOwned = await request(app).get(`/api/tickets/${bTicket}`).set("Cookie", cookieA);
    const missing = await request(app).get(`/api/tickets/999999999`).set("Cookie", cookieA);

    expect(notOwned.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(notOwned.body).toEqual(missing.body); // byte-identical
  });
});

// AUTHZ-08 — AC-23: commenting on a ticket you do not own is a 404, and writes nothing.
describe("AUTHZ-08: a Requester cannot comment on a ticket they do not own", () => {
  it("returns 404 and writes no comment", async () => {
    const bTicket = await ticketOwnedByB();
    const before = await prisma.publicComment.count({ where: { ticketId: bTicket } });

    const res = await request(app)
      .post(`/api/tickets/${bTicket}/comments`)
      .set("Cookie", cookieA)
      .send({ body: "I should not be able to post this." });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });

    expect(await prisma.publicComment.count({ where: { ticketId: bTicket } })).toBe(before);
  });
});

// AUTHZ-03 — AC-13, BR-14: a Requester is refused the queue with 403 and no data.
describe("AUTHZ-03: a Requester cannot read the IT Staff queue", () => {
  it.each(["/api/staff/tickets", "/api/staff/assignees"])("GET %s returns 403 with no queue data", async (path) => {
    const res = await request(app).get(path).set("Cookie", cookieA);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("items");
    expect(res.body).not.toHaveProperty("counts");
    expect(Array.isArray(res.body)).toBe(false);
  });
});

// A ticket owned by requester A, for the own-ticket refusal tests.
async function ticketOwnedByA(): Promise<number> {
  const res = await request(app).post("/api/tickets").set("Cookie", cookieA).send({
    categoryId,
    relatedSystemId,
    requestedPriority: "MEDIUM",
    summary: "Owned by requester A",
    description: "Requester A may read this but may never operate on it.",
  });
  return res.body.id;
}

// AUTHZ-07 — AC-17: IT Staff read any ticket regardless of submitter.
describe("AUTHZ-07: IT Staff can read any ticket", () => {
  it("returns 200 for tickets from two different requesters", async () => {
    await ensureUser(prisma, { email: "authz.staff@toktickit.test", role: "IT_STAFF" });
    const staff = await loginCookie("authz.staff@toktickit.test");
    for (const id of [await ticketOwnedByA(), await ticketOwnedByB()]) {
      const res = await request(app).get(`/api/tickets/${id}`).set("Cookie", staff);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    }
  });
});

// AUTHZ-09 — AC-24, BR-24: Requesters are refused Internal Notes.
describe("AUTHZ-09: a Requester cannot read or write Internal Notes", () => {
  const leaks = (body: unknown) => {
    const text = JSON.stringify(body);
    return /author|count|body|createdAt|\[/.test(text);
  };

  it("returns 403 with no note content on their own ticket, for read and create", async () => {
    const id = await ticketOwnedByA();
    await ensureUser(prisma, { email: "authz.staff@toktickit.test", role: "IT_STAFF" });
    const staff = await loginCookie("authz.staff@toktickit.test");
    await request(app).post(`/api/tickets/${id}/notes`).set("Cookie", staff).send({ body: "Secret staff-only detail." });

    const read = await request(app).get(`/api/tickets/${id}/notes`).set("Cookie", cookieA);
    expect(read.status).toBe(403);
    expect(read.body).toEqual({ error: "You do not have permission to perform this action." });
    expect(leaks(read.body)).toBe(false);

    const before = await prisma.internalNote.count({ where: { ticketId: id } });
    const write = await request(app).post(`/api/tickets/${id}/notes`).set("Cookie", cookieA).send({ body: "Let me in" });
    expect(write.status).toBe(403);
    expect(write.body).toEqual({ error: "You do not have permission to perform this action." });
    expect(await prisma.internalNote.count({ where: { ticketId: id } })).toBe(before);
  });

  it("returns 404, not 403, on another requester's ticket so its existence stays hidden", async () => {
    const bTicket = await ticketOwnedByB();
    const read = await request(app).get(`/api/tickets/${bTicket}/notes`).set("Cookie", cookieA);
    const missing = await request(app).get(`/api/tickets/999999999/notes`).set("Cookie", cookieA);
    expect(read.status).toBe(404);
    expect(read.body).toEqual(missing.body);
  });
});

// AUTHZ-10 — AC-40, BR-41: the Requester payload omits the key, even when notes exist.
describe("AUTHZ-10: Internal Notes are absent from the Requester's detail", () => {
  it("has no internalNotes key on a ticket that has notes", async () => {
    const id = await ticketOwnedByA();
    await ensureUser(prisma, { email: "authz.staff@toktickit.test", role: "IT_STAFF" });
    const staff = await loginCookie("authz.staff@toktickit.test");
    const note = await request(app).post(`/api/tickets/${id}/notes`).set("Cookie", staff).send({ body: "Confidential triage note." });
    expect(note.status).toBe(201);

    const res = await request(app).get(`/api/tickets/${id}`).set("Cookie", cookieA);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).not.toContain("internalNotes");
    expect(Object.keys(res.body)).not.toContain("permittedTransitions");
    expect(JSON.stringify(res.body)).not.toContain("Confidential triage note");
  });
});

// AUTHZ-11 — BR-37: a Requester is refused every operation, including on their own ticket.
describe("AUTHZ-11: a Requester cannot change status, IT Priority, or owner", () => {
  it.each([
    ["status", { status: "CANCELLED" }],
    ["it-priority", { itPriority: "HIGH" }],
    ["owner", { ownerId: null }],
  ])("PATCH %s on their own ticket returns 403 and changes nothing", async (path, body) => {
    const id = await ticketOwnedByA();
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id } });

    const res = await request(app).patch(`/api/tickets/${id}/${path}`).set("Cookie", cookieA).send(body);
    expect(res.status).toBe(403);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    expect([after.currentStatus, after.itPriority, after.ownerId]).toEqual([
      before.currentStatus,
      before.itPriority,
      before.ownerId,
    ]);
  });
});

// Every Administrator route, for the role-refusal checks.
const ADMIN_ROUTES: [string, string, object][] = [
  ["get", "/api/admin/users", {}],
  ["post", "/api/admin/users", { name: "X", email: "x@toktickit.test", role: "REQUESTER", initialPassword: "LongEnoughPass!1" }],
  ["patch", "/api/admin/users/1", { name: "X" }],
  ["post", "/api/admin/users/1/initial-password", { initialPassword: "LongEnoughPass!1" }],
];

// AUTHZ-04 — AC-14: a Requester receives 403 on every /api/admin/* route.
describe("AUTHZ-04: a Requester is refused every Administrator route", () => {
  it.each(ADMIN_ROUTES)("%s %s returns 403 with no user data", async (method, path, body) => {
    const before = await prisma.user.count();
    const res = await (request(app) as any)[method](path).set("Cookie", cookieA).send(body);
    expect(res.status).toBe(403);
    expect(Array.isArray(res.body)).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/email/i);
    expect(await prisma.user.count()).toBe(before);
  });
});

// AUTHZ-05 — AC-15, BR-18: IT Staff never gain user administration.
describe("AUTHZ-05: IT Staff are refused every Administrator route", () => {
  it.each(ADMIN_ROUTES)("%s %s returns 403, not 404", async (method, path, body) => {
    await ensureUser(prisma, { email: "authz.staff@toktickit.test", role: "IT_STAFF" });
    const staff = await loginCookie("authz.staff@toktickit.test");
    const res = await (request(app) as any)[method](path).set("Cookie", staff).send(body);
    expect(res.status).toBe(403);
    expect(Array.isArray(res.body)).toBe(false);
  });
});

// AUTHZ-12 — BR-19, BR-55: an Administrator cannot change their own role.
describe("AUTHZ-12: an Administrator cannot change their own role", () => {
  it.each(["IT_STAFF", "REQUESTER"])("rejects changing their own role to %s", async (role) => {
    const self = await ensureUser(prisma, { email: "authz.admin@toktickit.test", role: "ADMINISTRATOR" });
    const cookie = await loginCookie("authz.admin@toktickit.test");

    const res = await request(app).patch(`/api/admin/users/${self.id}`).set("Cookie", cookie).send({ role });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "You cannot change your own role." });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: self.id } })).role).toBe("ADMINISTRATOR");
  });

  it("still lets an Administrator edit their own name", async () => {
    const self = await ensureUser(prisma, { email: "authz.admin@toktickit.test", role: "ADMINISTRATOR" });
    const cookie = await loginCookie("authz.admin@toktickit.test");
    const res = await request(app)
      .patch(`/api/admin/users/${self.id}`)
      .set("Cookie", cookie)
      .send({ name: "Authz Admin", role: "ADMINISTRATOR" }); // unchanged role is not a change
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Authz Admin");
  });
});
