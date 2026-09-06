import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";

// Requires a migrated and seeded database. API-17…API-19.
const prisma = new PrismaClient();
const NUM = `TDT${Date.now()}`;

let requesterA: number;
let requesterB: number;
let ticketId: number;

describe("GET /api/tickets/:id", () => {
  beforeAll(async () => {
    const actives = await prisma.requesterUser.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    requesterA = actives[0].id;
    requesterB = actives[1].id;
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: NUM,
        requesterId: requesterA,
        categoryId: category.id,
        relatedSystemId: system.id,
        requestedPriority: "MEDIUM",
        summary: "Ticket detail test row",
        description: "A description long enough to satisfy the twenty character minimum.",
      },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.$disconnect();
  });

  // API-17 — AC-23
  it("returns the full owned Ticket with an attachments array", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(requesterA));
    expect(res.status).toBe(200);
    expect(res.body.ticketNumber).toBe(NUM);
    expect(res.body.description).toBeTruthy();
    expect(res.body.requester.id).toBe(requesterA);
    expect(Array.isArray(res.body.attachments)).toBe(true);
  });

  // API-18 — AC-24, BR-28
  it("returns 404 with no Ticket data for another Requester's Ticket", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(requesterB));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });
  });

  // API-19 — AC-25, BR-60
  it("returns a byte-identical 404 for a non-existent Ticket", async () => {
    const res = await request(app).get(`/api/tickets/999999999`).set("X-Requester-Id", String(requesterA));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });
  });

  it("returns the same 404 for a non-integer id", async () => {
    const res = await request(app).get(`/api/tickets/abc`).set("X-Requester-Id", String(requesterA));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });
  });
});
