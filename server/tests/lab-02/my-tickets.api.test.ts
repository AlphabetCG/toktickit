import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";

// Requires a migrated and seeded database. API-10…API-16. A per-run TOKEN in
// every summary isolates this test's tickets from any others in the database, so
// counts and ordering are deterministic.
const prisma = new PrismaClient();
const TOKEN = `MYT${Date.now()}`;
const DESC = "A sufficiently long description for the seeded My Tickets test rows.";

let requesterA: number;
let requesterB: number;
let cat1: number;
let cat2: number;
let systemId: number;
const base = new Date("2027-03-01T00:00:00.000Z").getTime();

const get = (id: number, query = "") =>
  request(app).get(`/api/tickets${query}`).set("X-Requester-Id", String(id));

async function makeTicket(opts: {
  n: string;
  requesterId: number;
  categoryId: number;
  summary: string;
  ticketDate: Date;
}) {
  return prisma.ticket.create({
    data: {
      ticketNumber: opts.n,
      requesterId: opts.requesterId,
      categoryId: opts.categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      summary: opts.summary,
      description: DESC,
      ticketDate: opts.ticketDate,
    },
  });
}

describe("GET /api/tickets", () => {
  beforeAll(async () => {
    const actives = await prisma.requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    requesterA = actives[0].id;
    requesterB = actives[1].id;
    const cats = await prisma.category.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    cat1 = cats[0].id;
    cat2 = cats[1].id;
    systemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;

    // 12 tickets for A: first 6 in cat1, next 6 in cat2, strictly increasing dates.
    for (let i = 0; i < 12; i++) {
      await makeTicket({
        n: `${TOKEN}-${i}`,
        requesterId: requesterA,
        categoryId: i < 6 ? cat1 : cat2,
        summary: `${TOKEN} item ${i}`,
        ticketDate: new Date(base + i * 60000),
      });
    }
    // Two tickets sharing one ticketDate (later than all others) to prove the
    // id-DESC tiebreak; both in cat2 so they don't affect the cat1 filter count.
    const tieDate = new Date(base + 100 * 60000);
    await makeTicket({ n: `${TOKEN}-tieLow`, requesterId: requesterA, categoryId: cat2, summary: `${TOKEN} tie`, ticketDate: tieDate });
    await makeTicket({ n: `${TOKEN}-tieHigh`, requesterId: requesterA, categoryId: cat2, summary: `${TOKEN} tie`, ticketDate: tieDate });
    // One ticket for B, in cat1, matching the TOKEN — for ownership isolation.
    await makeTicket({ n: `${TOKEN}-B`, requesterId: requesterB, categoryId: cat1, summary: `${TOKEN} b-item`, ticketDate: new Date(base) });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: TOKEN } } });
    await prisma.$disconnect();
  });

  // API-10 — AC-15, BR-27
  it("returns only the selected Requester's Tickets", async () => {
    const res = await get(requesterB, `?search=${TOKEN}&pageSize=50`);
    expect(res.status).toBe(200);
    const numbers = res.body.items.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(numbers).toEqual([`${TOKEN}-B`]); // none of A's 14
  });

  // API-11 — AC-16, BR-31
  it("searches Ticket Number and Summary case-insensitively", async () => {
    const bySummary = await get(requesterA, `?search=${TOKEN.toLowerCase()} item 3`);
    expect(bySummary.body.items.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual([`${TOKEN}-3`]);

    const byNumber = await get(requesterA, `?search=${TOKEN}-7`);
    expect(byNumber.body.items.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual([`${TOKEN}-7`]);
  });

  // API-12 — AC-17, BR-32
  it("filters by Category", async () => {
    const res = await get(requesterA, `?search=${TOKEN}&categoryId=${cat1}&pageSize=50`);
    expect(res.body.items).toHaveLength(6);
    expect(res.body.items.every((t: { category: { id: number } }) => t.category.id === cat1)).toBe(true);
  });

  // API-13 — AC-18, BR-37
  it("paginates with correct metadata", async () => {
    const res = await get(requesterA, `?search=${TOKEN}&pageSize=10&page=2`);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.totalItems).toBe(14); // 12 + 2 tie tickets
    expect(res.body.totalPages).toBe(2);
    expect(res.body.items).toHaveLength(4);
  });

  // API-14 — AC-19, BR-33, BR-34
  it("defaults to Ticket Date descending with an id-descending tiebreak", async () => {
    const res = await get(requesterA, `?search=${TOKEN}&pageSize=50`);
    const numbers = res.body.items.map((t: { ticketNumber: string }) => t.ticketNumber);
    // The two tie tickets share the latest date; the higher id must come first.
    expect(numbers[0]).toBe(`${TOKEN}-tieHigh`);
    expect(numbers[1]).toBe(`${TOKEN}-tieLow`);
    // Then the rest by date descending: item 11 before item 0.
    expect(numbers.indexOf(`${TOKEN}-11`)).toBeLessThan(numbers.indexOf(`${TOKEN}-0`));
  });

  // API-15 — AC-20, BR-36
  it("applies documented defaults for invalid query parameters instead of failing", async () => {
    const res = await get(requesterA, `?search=${TOKEN}&page=0&pageSize=999&sort=bogus&order=sideways`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
  });

  // API-16 — BR-38
  it("composes filters with ownership; a filter cannot widen beyond the owner", async () => {
    // cat1 holds 6 of A's tickets and 1 of B's; as B, only B's own may return.
    const res = await get(requesterB, `?search=${TOKEN}&categoryId=${cat1}&pageSize=50`);
    const numbers = res.body.items.map((t: { ticketNumber: string }) => t.ticketNumber);
    expect(numbers).toEqual([`${TOKEN}-B`]);
  });
});
