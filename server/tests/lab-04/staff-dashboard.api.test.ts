import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus, type ActionStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";

// API-26…API-32 (docs/lab-04/tests.md §2.3). Contract: api-spec §6.1,
// specification §5.8. The counts are checked against raw SQL written here,
// independently of the endpoint's Prisma queries.
const prisma = new PrismaClient();
const TOKEN = `SD4${Date.now()}`;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const ACTIVE = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

let staffA: { id: number; cookie: string };
let staffB: { id: number; cookie: string };
let idle: { id: number; cookie: string };
let admin: { id: number; cookie: string };
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;
let seq = 0;

async function account(email: string, role: "IT_STAFF" | "ADMINISTRATOR") {
  const u = await ensureUser(prisma, { email, name: email.split("@")[0], role });
  return { id: u.id, cookie: await loginCookie(email) };
}

async function ticket(over: { status?: TicketStatus; ownerId?: number | null; itPriority?: "LOW" | "MEDIUM" | "HIGH"; daysOld?: number } = {}) {
  seq += 1;
  return (
    await prisma.ticket.create({
      data: {
        ticketNumber: `${TOKEN}-${seq}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${TOKEN} dashboard ${seq}`,
        description: "A description that must never appear in a dashboard response.",
        requestedPriority: "MEDIUM",
        itPriority: over.itPriority ?? "MEDIUM",
        currentStatus: over.status ?? "OPEN",
        ownerId: over.ownerId ?? null,
        ticketDate: new Date(Date.now() - (over.daysOld ?? 3) * DAY),
      },
    })
  ).id;
}

let actionSeq = 0;
async function action(ticketId: number, performedById: number, status: ActionStatus, hoursAgo = 1) {
  actionSeq += 1;
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date(Date.now() - hoursAgo * 3_600_000),
      description: `Dashboard fixture action ${actionSeq} ${"x".repeat(150)}`,
      result: status === "COMPLETED" ? "Done." : "",
      status,
      performedById,
      createdById: performedById,
      clientRequestId: `${TOKEN}-a${actionSeq}`,
    },
  });
}

const dashboard = (cookie: string) => request(app).get("/api/dashboard/staff").set("Cookie", cookie);
const one = async (sql: TemplateStringsArray, ...values: unknown[]) =>
  Number(((await prisma.$queryRaw(sql, ...values)) as { n: bigint }[])[0].n);

beforeAll(async () => {
  staffA = await account("sd4.a@toktickit.test", "IT_STAFF");
  staffB = await account("sd4.b@toktickit.test", "IT_STAFF");
  idle = await account(`sd4.idle.${TOKEN}@toktickit.test`.toLowerCase(), "IT_STAFF"); // emails are stored lower-cased (BR-12)
  admin = await account("sd4.admin@toktickit.test", "ADMINISTRATOR");
  requesterId = (await ensureUser(prisma, { email: "sd4.req@toktickit.test", role: "REQUESTER" })).id;
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;

  // A's work: two open owned Tickets, one closed; two open actions, one finished,
  // and one open action on a Resolved Ticket (not counted: the Ticket is not active).
  const a1 = await ticket({ ownerId: staffA.id, itPriority: "HIGH", daysOld: 9 });
  const a2 = await ticket({ ownerId: staffA.id, status: "IN_PROGRESS" });
  await ticket({ ownerId: staffA.id, status: "CLOSED" });
  await action(a1, staffA.id, "PLANNED", 5);
  await action(a2, staffA.id, "IN_PROGRESS", 2);
  await action(a2, staffA.id, "COMPLETED", 1);
  const resolved = await ticket({ ownerId: staffA.id, status: "RESOLVED" });
  await action(resolved, staffA.id, "PLANNED", 1);
  // B's work: one owned Ticket and one open action on A's Ticket (BR-02).
  await ticket({ ownerId: staffB.id, status: "WAITING_FOR_REQUESTER" });
  await action(a1, staffB.id, "PLANNED", 3);
  // Unassigned, high priority, old.
  await ticket({ itPriority: "HIGH", daysOld: 20 });
});

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
});

// API-26 — AC-44
it("API-26: every count equals an independent query", async () => {
  const res = await dashboard(staffA.cookie);
  expect(res.status).toBe(200);
  const m = res.body.metrics;
  const active = ACTIVE;
  expect(m.unassignedOpen.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "ownerId" IS NULL AND "currentStatus"::text = ANY(${active})`
  );
  expect(m.mineOpen.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "ownerId" = ${staffA.id} AND "currentStatus"::text = ANY(${active})`
  );
  expect(m.myOpenActions.value).toBe(
    await one`SELECT count(*) AS n FROM "ActionTaken" a JOIN "Ticket" t ON t.id = a."ticketId"
              WHERE a."performedById" = ${staffA.id} AND a.status::text IN ('PLANNED','IN_PROGRESS')
              AND t."currentStatus"::text = ANY(${active})`
  );
  expect(m.highPriorityOpen.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "itPriority" = 'HIGH' AND "currentStatus"::text = ANY(${active})`
  );
  for (const s of STATUSES) {
    expect(res.body.byStatus[s].value).toBe(await one`SELECT count(*) AS n FROM "Ticket" WHERE "currentStatus"::text = ${s}`);
  }
  for (const p of ["LOW", "MEDIUM", "HIGH"]) {
    expect(res.body.openByItPriority[p].value).toBe(
      await one`SELECT count(*) AS n FROM "Ticket" WHERE "itPriority"::text = ${p} AND "currentStatus"::text = ANY(${active})`
    );
  }
});

// API-27 — AC-44
it("API-27: \"me\" is the caller", async () => {
  const [a, b] = await Promise.all([dashboard(staffA.cookie), dashboard(staffB.cookie)]);
  expect(a.body.metrics.mineOpen.value).toBeGreaterThanOrEqual(2);
  expect(b.body.metrics.mineOpen.value).toBeGreaterThanOrEqual(1);
  const mine = (body: { myActions: { items: { ticket: { ticketNumber: string } }[] } }) =>
    body.myActions.items.filter((i) => i.ticket.ticketNumber.startsWith(TOKEN));
  expect(mine(a.body)).toHaveLength(2); // PLANNED + IN_PROGRESS on active Tickets; not the Resolved one
  expect(mine(b.body)).toHaveLength(1);
  expect(a.body.metrics.myOpenActions.value).not.toBe(b.body.metrics.myOpenActions.value);
});

// API-28 — AC-45
it("API-28: a staff member with nothing sees zeros and an empty list", async () => {
  const res = await dashboard(idle.cookie);
  expect(res.body.metrics.mineOpen).toEqual({ value: 0, href: "/staff/tickets?ownerId=me&statusGroup=active" });
  expect(res.body.metrics.myOpenActions).toEqual({ value: 0, href: null });
  expect(res.body.myActions).toEqual({ items: [] });
});

// API-29 — AC-49
it("API-29: userCounts for Administrators only, matching an independent count", async () => {
  const staffView = await dashboard(staffA.cookie);
  expect(staffView.body).not.toHaveProperty("userCounts");

  const res = await dashboard(admin.cookie);
  const u = res.body.userCounts;
  for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"]) {
    expect(u.activeByRole[role]).toEqual({
      value: await one`SELECT count(*) AS n FROM "User" WHERE "isActive" AND role::text = ${role}`,
      href: `/admin/users?role=${role}`,
    });
  }
  expect(u.inactive).toEqual({ value: await one`SELECT count(*) AS n FROM "User" WHERE NOT "isActive"`, href: null });
});

// API-30 — AC-46, AC-51, BR-48
describe("API-30: the lists", () => {
  it("are ordered, at most five long, and never carry a Ticket description", async () => {
    const res = await dashboard(staffA.cookie);
    const { urgent, recentlyUpdated, myActions } = res.body;
    for (const list of [urgent.items, recentlyUpdated.items, myActions.items]) expect(list.length).toBeLessThanOrEqual(5);

    const ticketDates = urgent.items.map((t: { ticketDate: string }) => t.ticketDate);
    expect(ticketDates).toEqual([...ticketDates].sort()); // oldest first
    for (const t of urgent.items) expect(t).toMatchObject({ itPriority: "HIGH", href: `/staff/tickets/${t.id}` });

    const updated = recentlyUpdated.items.map((t: { updatedAt: string }) => t.updatedAt);
    expect(updated).toEqual([...updated].sort().reverse()); // newest first

    const actionAts = myActions.items.map((a: { actionAt: string }) => a.actionAt);
    expect(actionAts).toEqual([...actionAts].sort());

    expect(res.text).not.toContain("must never appear");
    expect(JSON.stringify(res.body)).not.toMatch(/"description":"[^"]{121,}"/);
  });

  it("cut an action description to 120 characters with an ellipsis", async () => {
    const res = await dashboard(staffA.cookie);
    const fixture = res.body.myActions.items.find((a: { ticket: { ticketNumber: string } }) => a.ticket.ticketNumber.startsWith(TOKEN));
    expect(fixture.description).toHaveLength(120);
    expect(fixture.description.endsWith("…")).toBe(true);
    expect(fixture.href).toBe(`/staff/tickets/${fixture.ticket.id}`);
  });

  it("includes a Ticket updated exactly inside the 7-day window and excludes one just outside", async () => {
    const inside = await ticket();
    const outside = await ticket();
    // The columns hold UTC in "timestamp without time zone" while the session is
    // Asia/Bangkok, so now() and a bound Date both land 7 h off: the instant is
    // computed here and written with AT TIME ZONE 'UTC' (fixed in #54; before,
    // "outside" was really 6 days 17 hours old). The shared database holds more
    // than five recent Tickets, so the five-item cap would also drop "outside";
    // the 7-day boundary itself is pinned by the windowStart unit tests.
    const at = (ms: number) => new Date(Date.now() + ms);
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = (${at(HOUR)}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${inside}`;
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = (${at(-(7 * DAY + MINUTE))}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${outside}`;
    const ids = (await dashboard(staffA.cookie)).body.recentlyUpdated.items.map((t: { id: number }) => t.id);
    expect(ids).toContain(inside);
    expect(ids).not.toContain(outside);
  });
});

// API-31 — AC-48, BR-51
it("API-31: every drill-down URL lists exactly the counted set", async () => {
  const res = await dashboard(staffA.cookie);
  const entries: { value: number; href: string | null }[] = [
    ...Object.values(res.body.metrics as Record<string, { value: number; href: string | null }>),
    ...Object.values(res.body.byStatus as Record<string, { value: number; href: string }>),
    ...Object.values(res.body.openByItPriority as Record<string, { value: number; href: string }>),
  ];
  let checked = 0;
  for (const { value, href } of entries) {
    if (!href) continue;
    const query = href.replace("/staff/tickets", "/api/staff/tickets");
    const list = await request(app).get(query).set("Cookie", staffA.cookie);
    expect({ href, total: list.body.totalItems }).toEqual({ href, total: value });
    checked += 1;
  }
  expect(checked).toBe(3 + 8 + 3);
});

// API-32 — BR-50
it("API-32: every documented key is present, with integer values and array lists", async () => {
  const res = await dashboard(staffA.cookie);
  expect(Object.keys(res.body).sort()).toEqual(
    ["generatedAt", "metrics", "byStatus", "openByItPriority", "myActions", "urgent", "recentlyUpdated"].sort()
  );
  expect(Object.keys(res.body.metrics).sort()).toEqual(["highPriorityOpen", "mineOpen", "myOpenActions", "unassignedOpen"]);
  expect(Object.keys(res.body.byStatus).sort()).toEqual([...STATUSES].sort());
  expect(Object.keys(res.body.openByItPriority).sort()).toEqual(["HIGH", "LOW", "MEDIUM"]);
  for (const metric of [
    ...Object.values(res.body.metrics),
    ...Object.values(res.body.byStatus),
    ...Object.values(res.body.openByItPriority),
  ] as { value: unknown }[]) {
    expect(Number.isInteger(metric.value)).toBe(true);
  }
  for (const list of [res.body.myActions.items, res.body.urgent.items, res.body.recentlyUpdated.items]) {
    expect(Array.isArray(list)).toBe(true);
  }
  expect(res.body.urgent.viewAllHref).toBe("/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc");
  expect(res.body.recentlyUpdated.viewAllHref).toBe("/staff/tickets?sort=updatedAt&order=desc");
  expect(new Date(res.body.generatedAt).toISOString()).toBe(res.body.generatedAt);
});
