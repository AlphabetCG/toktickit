import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { TICKET_NUMBER_REGEX } from "../../src/ticketNumber.js";

// Requires a migrated and seeded database. API-04…API-09.
const prisma = new PrismaClient();

let requesterId: number;
let otherRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

const validBody = () => ({
  categoryId,
  relatedSystemId,
  requestedPriority: "MEDIUM",
  summary: "Laptop battery drains quickly",
  description: "The battery drops from 100% to 20% in about an hour even on a browser.",
});

const post = (body: object, id: number = requesterId) =>
  request(app).post("/api/tickets").set("X-Requester-Id", String(id)).send(body);

describe("POST /api/tickets", () => {
  beforeAll(async () => {
    const actives = await prisma.requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    requesterId = actives[0].id;
    otherRequesterId = actives[1].id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // API-04 — AC-07
  it("creates a valid Ticket and returns the official Ticket Number", async () => {
    const res = await post(validBody());

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(TICKET_NUMBER_REGEX);

    const saved = await prisma.ticket.findUnique({ where: { id: res.body.id } });
    expect(saved).not.toBeNull();
    expect(saved!.ticketNumber).toBe(res.body.ticketNumber);
  });

  // API-05 — AC-08, BR-02, BR-18
  it("stores the header Requester as owner and defaults status to NEW", async () => {
    const res = await post(validBody());
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });

    expect(saved.requesterId).toBe(requesterId);
    expect(saved.currentStatus).toBe("NEW");
    expect(res.body.requesterId).toBe(requesterId);
    expect(res.body.currentStatus).toBe("NEW");
  });

  // API-06 — AC-09, BR-01
  it("gives two Tickets in the same year different, well-formed numbers", async () => {
    const a = await post(validBody());
    const b = await post(validBody());

    expect(a.body.ticketNumber).toMatch(TICKET_NUMBER_REGEX);
    expect(b.body.ticketNumber).toMatch(TICKET_NUMBER_REGEX);
    expect(a.body.ticketNumber).not.toBe(b.body.ticketNumber);
  });

  // API-07 — AC-12, BR-39
  it("rejects a short Summary with a field-level message and creates nothing", async () => {
    const before = await prisma.ticket.count();
    const res = await post({ ...validBody(), summary: "help" }); // 4 chars

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.fields.summary).toMatch(/Summary/);
    expect(await prisma.ticket.count()).toBe(before);
  });

  // API-08 — BR-41
  it("rejects an unknown reference id with 400 and creates nothing", async () => {
    const before = await prisma.ticket.count();
    const res = await post({ ...validBody(), categoryId: 99999999 });

    expect(res.status).toBe(400);
    expect(res.body.fields.categoryId).toBeDefined();
    expect(await prisma.ticket.count()).toBe(before);
  });

  // API-09 — BR-16
  it("ignores client-supplied read-only fields; server values win", async () => {
    const res = await post({
      ...validBody(),
      ticketNumber: "TKT-1900-000001",
      ticketDate: "1900-01-01T00:00:00.000Z",
      currentStatus: "CLOSED",
      requesterId: otherRequesterId,
    });

    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).not.toBe("TKT-1900-000001");
    expect(res.body.ticketNumber).toMatch(TICKET_NUMBER_REGEX);
    expect(res.body.currentStatus).toBe("NEW");
    expect(res.body.requesterId).toBe(requesterId); // header wins, not the body
    expect(new Date(res.body.ticketDate).getFullYear()).toBeGreaterThan(1900);
  });
});
