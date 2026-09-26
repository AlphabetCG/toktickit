import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// API-11…API-14 (docs/lab-03/tests.md §2.2). Requires a migrated + seeded database.
const prisma = new PrismaClient();

let cookieA: string; // owning requester
let cookieStaff: string;
let requesterAId: number;
let categoryId: number;
let relatedSystemId: number;

const ticketBody = () => ({
  categoryId,
  relatedSystemId,
  requestedPriority: "MEDIUM",
  summary: "Comment flow ticket",
  description: "A description long enough to satisfy the twenty character minimum rule.",
});

async function createTicketAsA(): Promise<number> {
  const res = await request(app).post("/api/tickets").set("Cookie", cookieA).send(ticketBody());
  return res.body.id;
}

beforeAll(async () => {
  requesterAId = (await ensureUser(prisma, { email: "cmt.a@toktickit.test", role: "REQUESTER" })).id;
  await ensureUser(prisma, { email: "cmt.staff@toktickit.test", role: "IT_STAFF" });
  cookieA = await loginCookie("cmt.a@toktickit.test");
  cookieStaff = await loginCookie("cmt.staff@toktickit.test");
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// API-11 — AC-20, BR-31
it("API-11: a created ticket is stored against the caller with itPriority = requestedPriority", async () => {
  const res = await request(app)
    .post("/api/tickets")
    .set("Cookie", cookieA)
    .send({ ...ticketBody(), requestedPriority: "HIGH" });
  expect(res.status).toBe(201);
  expect(res.body.requesterId).toBe(requesterAId);

  const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
  expect(saved.requesterId).toBe(requesterAId);
  expect(saved.itPriority).toBe("HIGH");
  expect(saved.requestedPriority).toBe("HIGH");
});

// API-12 — AC-22, BR-43
it("API-12: a requester's comment records server author/timestamp and is visible to IT Staff", async () => {
  const ticketId = await createTicketAsA();

  const posted = await request(app)
    .post(`/api/tickets/${ticketId}/comments`)
    .set("Cookie", cookieA)
    // A spoofed author/timestamp in the body must be ignored (BR-43).
    .send({ body: "I tried the update but it still fails.", authorId: 99999, createdAt: "1990-01-01T00:00:00.000Z" });
  expect(posted.status).toBe(201);
  expect(posted.body.author).toEqual({ id: requesterAId, name: expect.any(String), role: "REQUESTER" });
  expect(new Date(posted.body.createdAt).getFullYear()).toBeGreaterThan(2000);

  // Visible to IT Staff on the same ticket.
  const asStaff = await request(app).get(`/api/tickets/${ticketId}/comments`).set("Cookie", cookieStaff);
  expect(asStaff.status).toBe(200);
  expect(asStaff.body.map((c: { id: number }) => c.id)).toContain(posted.body.id);
});

// API-13 — AC-25, BR-23
it("API-13: a resolution signal records the timestamp and signer without changing status", async () => {
  const ticketId = await createTicketAsA();

  const res = await request(app).post(`/api/tickets/${ticketId}/resolution-signal`).set("Cookie", cookieA);
  expect(res.status).toBe(200);
  expect(res.body.resolutionSignalledAt).toBeTruthy();
  expect(res.body.resolutionSignalledBy.id).toBe(requesterAId);
  expect(res.body.currentStatus).toBe("NEW"); // unchanged

  const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  expect(saved.currentStatus).toBe("NEW");
  expect(saved.resolutionSignalledAt).not.toBeNull();
});

// API-14 — AC-26
it("API-14: a whitespace-only comment body is rejected and nothing is written", async () => {
  const ticketId = await createTicketAsA();
  const before = await prisma.publicComment.count({ where: { ticketId } });

  const res = await request(app).post(`/api/tickets/${ticketId}/comments`).set("Cookie", cookieA).send({ body: "   " });
  expect(res.status).toBe(400);
  expect(res.body.fields.body).toBeTruthy();

  expect(await prisma.publicComment.count({ where: { ticketId } })).toBe(before);
});
