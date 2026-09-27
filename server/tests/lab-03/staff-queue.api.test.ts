import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus, type RequestedPriority } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// API-15…API-19 (docs/lab-03/tests.md §2.2), plus the api-spec §7.1 shape and
// severity rules and the §7.2 assignee list. The queue spans the whole database,
// so every query is scoped by a per-run TOKEN in the summary to stay deterministic.
const prisma = new PrismaClient();
const TOKEN = `QUEUE${Date.now()}`;
const PAGE_TOKEN = `QPAGE${Date.now()}`;

let staffId: number;
let otherStaffId: number;
let staffCookie: string;
let adminCookie: string;
let reqA: number;
let reqB: number;

const queue = (query: string, cookie = staffCookie) =>
  request(app).get(`/api/staff/tickets?${query}`).set("Cookie", cookie);
const numbersOf = (res: request.Response): string[] =>
  res.body.items.map((t: { ticketNumber: string }) => t.ticketNumber);

beforeAll(async () => {
  reqA = (await ensureUser(prisma, { email: "queue.req.a@toktickit.test", role: "REQUESTER" })).id;
  reqB = (await ensureUser(prisma, { email: "queue.req.b@toktickit.test", role: "REQUESTER" })).id;
  staffId = (await ensureUser(prisma, { email: "queue.staff@toktickit.test", role: "IT_STAFF" })).id;
  otherStaffId = (await ensureUser(prisma, { email: "queue.staff2@toktickit.test", role: "IT_STAFF" })).id;
  await ensureUser(prisma, { email: "queue.admin@toktickit.test", role: "ADMINISTRATOR" });
  staffCookie = await loginCookie("queue.staff@toktickit.test");
  adminCookie = await loginCookie("queue.admin@toktickit.test");

  const categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  const relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  const mk = (
    n: string,
    requesterId: number,
    currentStatus: TicketStatus,
    itPriority: RequestedPriority,
    ownerId: number | null,
    token = TOKEN
  ) =>
    prisma.ticket.create({
      data: {
        ticketNumber: `${token}-${n}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${token} ${n}`,
        description: "Queue fixture row with a long enough description.",
        requestedPriority: "MEDIUM",
        itPriority,
        currentStatus,
        ownerId,
      },
    });

  await mk("t1", reqA, "NEW", "LOW", null);
  await mk("t2", reqA, "OPEN", "HIGH", staffId);
  await mk("t3", reqB, "IN_PROGRESS", "MEDIUM", staffId);
  await mk("t4", reqB, "NEW", "HIGH", null);
  await mk("t5", reqB, "CLOSED", "LOW", otherStaffId);
  for (let i = 0; i < 25; i++) await mk(String(i).padStart(2, "0"), reqA, "NEW", "MEDIUM", null, PAGE_TOKEN);
});

afterAll(async () => {
  await prisma.ticket.deleteMany({
    where: { OR: [{ ticketNumber: { startsWith: TOKEN } }, { ticketNumber: { startsWith: PAGE_TOKEN } }] },
  });
  await prisma.$disconnect();
});

// API-15 — AC-27
it("API-15: the queue lists tickets from every requester, not only the caller's", async () => {
  const res = await queue(`search=${TOKEN}&pageSize=50`);
  expect(res.status).toBe(200);
  expect(res.body.totalItems).toBe(5);
  const requesters = new Set(res.body.items.map((t: { requester: { id: number } }) => t.requester.id));
  expect(requesters).toEqual(new Set([reqA, reqB]));
});

// API-16 — AC-28
describe("API-16: status and IT Priority filters narrow the result", () => {
  it("filters by status", async () => {
    expect(numbersOf(await queue(`search=${TOKEN}&status=OPEN`))).toEqual([`${TOKEN}-t2`]);
  });

  it("filters by IT Priority", async () => {
    expect(numbersOf(await queue(`search=${TOKEN}&itPriority=HIGH`)).sort()).toEqual([`${TOKEN}-t2`, `${TOKEN}-t4`]);
  });
});

// API-17 — AC-29, BR-25
describe("API-17: owner filters", () => {
  it("ownerId=unassigned returns only tickets with no owner", async () => {
    const res = await queue(`search=${TOKEN}&ownerId=unassigned`);
    expect(numbersOf(res).sort()).toEqual([`${TOKEN}-t1`, `${TOKEN}-t4`]);
    expect(res.body.items.every((t: { owner: unknown }) => t.owner === null)).toBe(true);
  });

  it("ownerId=me resolves to the caller server-side", async () => {
    expect(numbersOf(await queue(`search=${TOKEN}&ownerId=me`)).sort()).toEqual([`${TOKEN}-t2`, `${TOKEN}-t3`]);
  });

  it("ownerId=<id> returns that assignee's tickets", async () => {
    expect(numbersOf(await queue(`search=${TOKEN}&ownerId=${otherStaffId}`))).toEqual([`${TOKEN}-t5`]);
  });
});

// API-18 — AC-30
it("API-18: page 2 returns the next slice with correct metadata", async () => {
  const p1 = await queue(`search=${PAGE_TOKEN}&pageSize=10&page=1&sort=ticketNumber&order=asc`);
  const p2 = await queue(`search=${PAGE_TOKEN}&pageSize=10&page=2&sort=ticketNumber&order=asc`);
  expect(p2.body).toMatchObject({ page: 2, pageSize: 10, totalItems: 25, totalPages: 3 });
  expect(numbersOf(p2)).toHaveLength(10);
  expect(numbersOf(p2)[0]).toBe(`${PAGE_TOKEN}-10`);
  expect(numbersOf(p1).filter((n) => numbersOf(p2).includes(n))).toEqual([]); // no overlap
});

// API-19 — AC-31
it("API-19: invalid parameters fall back to defaults and never return 400", async () => {
  const res = await queue(
    `search=${PAGE_TOKEN}&page=0&pageSize=999&sort=bogus&order=sideways&status=NOPE&ownerId=abc&itPriority=URGENT`
  );
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ page: 1, pageSize: 20, totalItems: 25 });
});

// api-spec §7.1 — IT Priority orders by severity. Alphabetical would give
// HIGH, LOW, MEDIUM, which is meaningless to a person triaging work.
it("sorts IT Priority by severity, not alphabetically", async () => {
  const pri = (res: request.Response) => res.body.items.map((t: { itPriority: string }) => t.itPriority);
  expect(pri(await queue(`search=${TOKEN}&sort=itPriority&order=desc`))).toEqual(["HIGH", "HIGH", "MEDIUM", "LOW", "LOW"]);
  expect(pri(await queue(`search=${TOKEN}&sort=itPriority&order=asc`))).toEqual(["LOW", "LOW", "MEDIUM", "HIGH", "HIGH"]);
});

// api-spec §7.1 — row shape and header counts.
it("returns the documented row shape and whole-queue counts", async () => {
  const res = await queue(`search=${TOKEN}&status=OPEN`);
  const row = res.body.items[0];
  expect(row).toMatchObject({
    owner: { id: staffId },
    requester: { id: reqA },
    itPriority: "HIGH",
    resolutionSignalled: false,
  });
  expect(row).not.toHaveProperty("description");
  expect(row).not.toHaveProperty("resolutionSignalledAt");

  // counts ignore the filters: they are the queue header totals.
  const mineAll = await queue("ownerId=me");
  const unassignedAll = await queue("ownerId=unassigned");
  expect(res.body.counts).toEqual({ unassigned: unassignedAll.body.totalItems, mine: mineAll.body.totalItems });
});

it("lets an Administrator read the queue (spec §6.1)", async () => {
  const res = await queue(`search=${TOKEN}`, adminCookie);
  expect(res.status).toBe(200);
  expect(res.body.totalItems).toBe(5);
});

// api-spec §7.2 — the assignee picker's data (consumed by API-21 in Issue #34).
describe("GET /api/staff/assignees", () => {
  it("lists only active IT Staff and Administrators, by name, without directory fields", async () => {
    const inactive = await ensureUser(prisma, {
      email: "queue.staff.inactive@toktickit.test",
      role: "IT_STAFF",
      isActive: false,
    });
    const res = await request(app).get("/api/staff/assignees").set("Cookie", staffCookie);
    expect(res.status).toBe(200);

    const ids: number[] = res.body.map((u: { id: number }) => u.id);
    expect(ids).toContain(staffId);
    expect(ids).not.toContain(reqA); // requesters never offered
    expect(ids).not.toContain(inactive.id); // deactivated staff never offered

    for (const u of res.body) expect(Object.keys(u).sort()).toEqual(["id", "name", "role"]);
    const names: string[] = res.body.map((u: { name: string }) => u.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
