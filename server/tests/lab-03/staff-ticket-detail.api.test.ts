import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// API-20…API-26 (docs/lab-03/tests.md §2.2), plus the staff-side role-shaped
// detail (api-spec §3.2) and staff access to a requester's attachments (§6.1).
const prisma = new PrismaClient();
const TOKEN = `SDET${Date.now()}`;

let requesterId: number;
let requesterCookie: string;
let staffId: number;
let staffCookie: string;
let otherStaffId: number;
let adminId: number;
let inactiveStaffId: number;
let categoryId: number;
let relatedSystemId: number;
let seq = 0;

async function ticket(status: TicketStatus = "NEW", ownerId: number | null = null) {
  seq += 1;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `${TOKEN}-${seq}`,
      requesterId,
      categoryId,
      relatedSystemId,
      summary: `${TOKEN} ticket ${seq}`,
      description: "Staff detail fixture row with a long enough description.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      ownerId,
    },
  });
  return t.id;
}

const patch = (id: number, path: string, body: object, cookie = staffCookie) =>
  request(app).patch(`/api/tickets/${id}/${path}`).set("Cookie", cookie).send(body);
const saved = (id: number) => prisma.ticket.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  requesterId = (await ensureUser(prisma, { email: "sdet.req@toktickit.test", role: "REQUESTER" })).id;
  staffId = (await ensureUser(prisma, { email: "sdet.staff@toktickit.test", role: "IT_STAFF" })).id;
  otherStaffId = (await ensureUser(prisma, { email: "sdet.staff2@toktickit.test", role: "IT_STAFF" })).id;
  adminId = (await ensureUser(prisma, { email: "sdet.admin@toktickit.test", role: "ADMINISTRATOR" })).id;
  inactiveStaffId = (
    await ensureUser(prisma, { email: "sdet.staff.off@toktickit.test", role: "IT_STAFF", isActive: false })
  ).id;
  requesterCookie = await loginCookie("sdet.req@toktickit.test");
  staffCookie = await loginCookie("sdet.staff@toktickit.test");
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

afterAll(async () => {
  const ids = (await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: TOKEN } }, select: { id: true } })).map(
    (t) => t.id
  );
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

// API-20 — AC-33, BR-27
it("API-20: claiming gives an unassigned ticket the claiming user as owner", async () => {
  const id = await ticket();
  const res = await patch(id, "owner", { ownerId: staffId });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ id, owner: { id: staffId, name: expect.any(String) } });
  expect((await saved(id)).ownerId).toBe(staffId);
});

// API-21 — AC-34, BR-27
it("API-21: reassigns to another active IT Staff user, to an Administrator, and releases", async () => {
  const id = await ticket("OPEN", staffId);

  expect((await patch(id, "owner", { ownerId: otherStaffId })).status).toBe(200);
  expect((await saved(id)).ownerId).toBe(otherStaffId);

  expect((await patch(id, "owner", { ownerId: adminId })).status).toBe(200); // spec §6.1 / handout §4.5
  expect((await saved(id)).ownerId).toBe(adminId);

  const released = await patch(id, "owner", { ownerId: null });
  expect(released.status).toBe(200);
  expect(released.body.owner).toBeNull();
  expect((await saved(id)).ownerId).toBeNull();
});

// API-22 — AC-35, BR-26, BR-28
describe("API-22: an invalid assignee is rejected and ownership is unchanged", () => {
  it.each([
    ["a deactivated user", () => inactiveStaffId, /deactivated/],
    ["a Requester", () => requesterId, /IT Staff or an Administrator/],
    ["a user who does not exist", () => 999999999, /does not exist/],
  ])("rejects %s", async (_who, target, message) => {
    const id = await ticket("OPEN", staffId);
    const res = await patch(id, "owner", { ownerId: target() });
    expect(res.status).toBe(400);
    expect(res.body.fields.ownerId).toMatch(message);
    expect((await saved(id)).ownerId).toBe(staffId);
  });

  it("rejects a malformed ownerId", async () => {
    const id = await ticket("OPEN", staffId);
    expect((await patch(id, "owner", { ownerId: "abc" })).status).toBe(400);
    expect((await patch(id, "owner", {})).status).toBe(400);
    expect((await saved(id)).ownerId).toBe(staffId);
  });

  it("lets a deactivated user keep a ticket already assigned (BR-29)", async () => {
    const id = await ticket("OPEN", inactiveStaffId);
    const detail = await request(app).get(`/api/tickets/${id}`).set("Cookie", staffCookie);
    expect(detail.body.owner.id).toBe(inactiveStaffId);
  });
});

// API-23 — AC-36, BR-30
it("API-23: IT Priority changes while Requested Priority stays untouched", async () => {
  const id = await ticket();
  const res = await patch(id, "it-priority", { itPriority: "HIGH" });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ id, itPriority: "HIGH", requestedPriority: "MEDIUM" });
  const row = await saved(id);
  expect(row.itPriority).toBe("HIGH");
  expect(row.requestedPriority).toBe("MEDIUM");

  const bad = await patch(id, "it-priority", { itPriority: "URGENT" });
  expect(bad.status).toBe(400);
  expect(bad.body.fields.itPriority).toBeTruthy();
  expect((await saved(id)).itPriority).toBe("HIGH");
});

// API-24 — AC-37
it("API-24: a permitted transition succeeds, persists, and returns the next permitted set", async () => {
  const id = await ticket("NEW");
  const res = await patch(id, "status", { status: "IN_PROGRESS" });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    id,
    currentStatus: "IN_PROGRESS",
    permittedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  });
  expect((await saved(id)).currentStatus).toBe("IN_PROGRESS");
});

// API-25 — AC-38
it("API-25: RESOLVED → IN_PROGRESS returns 409 and leaves the status unchanged", async () => {
  const id = await ticket("RESOLVED");
  const res = await patch(id, "status", { status: "IN_PROGRESS" });
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: "Cannot move a Resolved ticket to In Progress." });
  expect((await saved(id)).currentStatus).toBe("RESOLVED");
});

// API-26 — AC-39, BR-36
describe("API-26: nothing leaves a terminal ticket", () => {
  const targets: TicketStatus[] = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
    "CANCELLED",
  ];
  it.each(targets)("CLOSED → %s returns 409", async (to) => {
    const id = await ticket("CLOSED");
    const res = await patch(id, "status", { status: to });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "This ticket is closed and can no longer be updated." });
    expect((await saved(id)).currentStatus).toBe("CLOSED");
  });

  it("CANCELLED is terminal too", async () => {
    const id = await ticket("CANCELLED");
    expect((await patch(id, "status", { status: "REOPENED" })).status).toBe(409);
    expect((await saved(id)).currentStatus).toBe("CANCELLED");
  });
});

describe("status request validation", () => {
  it("rejects an unknown status with 400", async () => {
    const id = await ticket();
    const res = await patch(id, "status", { status: "DONE" });
    expect(res.status).toBe(400);
    expect(res.body.fields.status).toBeTruthy();
  });

  it("returns 404 for an operation on a ticket that does not exist", async () => {
    for (const [path, body] of [
      ["status", { status: "OPEN" }],
      ["it-priority", { itPriority: "LOW" }],
      ["owner", { ownerId: null }],
    ] as const) {
      const res = await patch(999999999, path, body);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Ticket not found" });
    }
  });
});

// api-spec §3.2 — the staff body adds internalNotes and permittedTransitions.
it("gives IT Staff the role-shaped detail with notes and permitted transitions", async () => {
  const id = await ticket("WAITING_FOR_REQUESTER", staffId);
  const res = await request(app).get(`/api/tickets/${id}`).set("Cookie", staffCookie);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    itPriority: "MEDIUM",
    owner: { id: staffId },
    internalNotes: [],
    permittedTransitions: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  });
  expect(Array.isArray(res.body.publicComments)).toBe(true);
});

// spec §6.1 — attachments are "any" for IT Staff, so the detail screen works for them.
it("lets IT Staff list and download a requester's attachment", async () => {
  const id = await ticket();
  const png = Buffer.alloc(64);
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((v, i) => (png[i] = v));
  const up = await request(app)
    .post(`/api/tickets/${id}/attachments`)
    .set("Cookie", requesterCookie)
    .attach("file", png, "screen.png");
  expect(up.status).toBe(201);

  const list = await request(app).get(`/api/tickets/${id}/attachments`).set("Cookie", staffCookie);
  expect(list.status).toBe(200);
  expect(list.body.map((a: { id: number }) => a.id)).toContain(up.body.id);

  const dl = await request(app).get(`/api/attachments/${up.body.id}/download`).set("Cookie", staffCookie);
  expect(dl.status).toBe(200);
});
