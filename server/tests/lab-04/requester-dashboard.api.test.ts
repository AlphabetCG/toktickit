import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";

// API-20…API-25 (docs/lab-04/tests.md §2.3). Contract: api-spec §5.1,
// specification §5.8. The counts are checked against raw SQL written here,
// independently of the endpoint's Prisma queries.
const prisma = new PrismaClient();
const TOKEN = `RD4${Date.now()}`;
const DAY = 86_400_000;
const MINUTE = 60_000;
// Timestamps are stored as UTC in "timestamp without time zone", but the database
// session is local (Asia/Bangkok): both now() and a bound Date read 7 h off. Every
// instant is therefore computed here and written with `AT TIME ZONE 'UTC'`.
const ago = (ms: number) => new Date(Date.now() - ms);
const ACTIVE = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const DESCRIPTION = "A description that must never appear in a dashboard response.";

// Emails carry the token so each run starts from Requesters with no other Tickets;
// they are stored lower-cased (BR-12).
const email = (who: string) => `rd4.${who}.${TOKEN}@toktickit.test`.toLowerCase();

let a: { id: number; cookie: string };
let b: { id: number; cookie: string };
let empty: { id: number; cookie: string };
let edge: { id: number; cookie: string };
let categoryId: number;
let relatedSystemId: number;
let seq = 0;

async function requester(who: string) {
  const u = await ensureUser(prisma, { email: email(who), role: "REQUESTER" });
  return { id: u.id, cookie: await loginCookie(email(who)) };
}

async function ticket(requesterId: number, status: TicketStatus, resolvedDaysAgo?: number) {
  seq += 1;
  return (
    await prisma.ticket.create({
      data: {
        ticketNumber: `${TOKEN}-${seq}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: `${TOKEN} requester dashboard ${seq}`,
        description: DESCRIPTION,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: status,
        resolvedAt: resolvedDaysAgo === undefined ? null : ago(resolvedDaysAgo * DAY),
        ticketDate: ago(3 * DAY),
      },
    })
  ).id;
}

const dashboard = (cookie: string, query = "") =>
  request(app).get(`/api/dashboard/requester${query}`).set("Cookie", cookie);
const one = async (sql: TemplateStringsArray, ...values: unknown[]) =>
  Number(((await prisma.$queryRaw(sql, ...values)) as { n: bigint }[])[0].n);
const ids = (sql: TemplateStringsArray, ...values: unknown[]) =>
  (prisma.$queryRaw(sql, ...values) as Promise<{ id: number }[]>).then((rows) => rows.map((r) => r.id));
const withoutClock = (body: Record<string, unknown>) => ({ ...body, generatedAt: undefined });

beforeAll(async () => {
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  [a, b, empty, edge] = await Promise.all([requester("a"), requester("b"), requester("empty"), requester("edge")]);

  // A: six waiting (one more than a list holds), three other active, one awaiting
  // closure, one closed recently, one closed long ago, one cancelled.
  for (let i = 0; i < 6; i++) await ticket(a.id, "WAITING_FOR_REQUESTER");
  for (const s of ["NEW", "OPEN", "REOPENED"] as const) await ticket(a.id, s);
  await ticket(a.id, "RESOLVED", 2);
  await ticket(a.id, "CLOSED", 10);
  await ticket(a.id, "CLOSED", 45);
  await ticket(a.id, "CANCELLED");
  // B: Tickets A must never see.
  for (const s of ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED"] as const) await ticket(b.id, s, s === "RESOLVED" ? 1 : undefined);
});

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
});

// API-20 — AC-42, BR-53
describe("API-20: a Requester sees only their own Tickets", () => {
  it("counts and lists hold only the caller's Tickets", async () => {
    const res = await dashboard(a.cookie);
    expect(res.status).toBe(200);
    const listed = [
      ...res.body.needsAttention.items,
      ...res.body.recentlyUpdated.items,
      ...res.body.recentlyResolved.items,
    ].map((t: { id: number }) => t.id);
    expect(listed.length).toBeGreaterThan(0);
    const owners = await prisma.ticket.findMany({ where: { id: { in: listed } }, select: { requesterId: true } });
    expect(new Set(owners.map((o) => o.requesterId))).toEqual(new Set([a.id]));
    expect(res.body.metrics.openTickets.value).toBe(9);
  });

  it("ignores a requesterId query parameter", async () => {
    const plain = await dashboard(a.cookie);
    const widened = await dashboard(a.cookie, `?requesterId=${b.id}&scope=all`);
    expect(withoutClock(widened.body)).toEqual(withoutClock(plain.body));
  });
});

// API-21 — AC-43
it("API-21: every metric equals an independent query", async () => {
  const m = (await dashboard(a.cookie)).body.metrics;
  expect(m.openTickets.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = ${a.id} AND "currentStatus"::text = ANY(${ACTIVE})`
  );
  expect(m.waitingForMe.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = ${a.id} AND "currentStatus"::text = 'WAITING_FOR_REQUESTER'`
  );
  expect(m.awaitingClosure.value).toBe(
    await one`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = ${a.id} AND "currentStatus"::text = 'RESOLVED'`
  );
  expect(m).toEqual({
    openTickets: { value: 9, href: "/tickets?statusGroup=active" },
    waitingForMe: { value: 6, href: "/tickets?status=WAITING_FOR_REQUESTER" },
    awaitingClosure: { value: 1, href: "/tickets?status=RESOLVED" },
  });
});

// API-22 — AC-45, BR-50
it("API-22: a Requester with no Tickets gets zeros and empty lists, no key missing or null", async () => {
  const res = await dashboard(empty.cookie);
  expect(res.status).toBe(200);
  expect(withoutClock(res.body)).toEqual({
    generatedAt: undefined,
    metrics: {
      openTickets: { value: 0, href: "/tickets?statusGroup=active" },
      waitingForMe: { value: 0, href: "/tickets?status=WAITING_FOR_REQUESTER" },
      awaitingClosure: { value: 0, href: "/tickets?status=RESOLVED" },
    },
    needsAttention: { items: [], viewAllHref: "/tickets?status=WAITING_FOR_REQUESTER" },
    recentlyUpdated: { items: [], viewAllHref: "/tickets?sort=updatedAt&order=desc" },
    recentlyResolved: { items: [] },
  });
  expect(new Date(res.body.generatedAt).toISOString()).toBe(res.body.generatedAt);
});

// API-23 — AC-46, AC-51, BR-48
describe("API-23: the lists", () => {
  it("return five of six matching Tickets, in the documented order", async () => {
    const res = await dashboard(a.cookie);
    expect(res.body.needsAttention.items.map((t: { id: number }) => t.id)).toEqual(
      await ids`SELECT id FROM "Ticket" WHERE "requesterId" = ${a.id} AND "currentStatus"::text = 'WAITING_FOR_REQUESTER'
                ORDER BY "updatedAt" DESC, id DESC LIMIT 5`
    );
    expect(res.body.recentlyUpdated.items.map((t: { id: number }) => t.id)).toEqual(
      await ids`SELECT id FROM "Ticket" WHERE "requesterId" = ${a.id} AND "updatedAt" >= (${ago(7 * DAY)}::timestamptz AT TIME ZONE 'UTC')
                ORDER BY "updatedAt" DESC, id DESC LIMIT 5`
    );
    expect(res.body.needsAttention.items).toHaveLength(5);
    expect(res.body.recentlyUpdated.items).toHaveLength(5);
  });

  it("list Recently resolved by resolvedAt within 30 days, Resolved and Closed only", async () => {
    const items = (await dashboard(a.cookie)).body.recentlyResolved.items;
    expect(items.map((t: { currentStatus: string }) => t.currentStatus)).toEqual(["RESOLVED", "CLOSED"]);
    const at = items.map((t: { resolvedAt: string }) => t.resolvedAt);
    expect(at).toEqual([...at].sort().reverse());
  });

  it("carry the summary shape and never a description", async () => {
    const res = await dashboard(a.cookie);
    const item = res.body.needsAttention.items[0];
    expect(Object.keys(item).sort()).toEqual(["currentStatus", "href", "id", "resolvedAt", "summary", "ticketNumber", "updatedAt"]);
    expect(item.href).toBe(`/tickets/${item.id}`);
    expect(res.text).not.toContain(DESCRIPTION);
    expect(res.text).not.toContain('"description"');
  });
});

// API-24 — AC-47, BR-49
describe("API-24: rolling 7- and 30-day boundaries", () => {
  let updatedInside: number;
  let updatedOutside: number;
  let resolvedInside: number;
  let resolvedOutside: number;

  beforeAll(async () => {
    updatedInside = await ticket(edge.id, "OPEN");
    updatedOutside = await ticket(edge.id, "OPEN");
    resolvedInside = await ticket(edge.id, "RESOLVED");
    resolvedOutside = await ticket(edge.id, "CLOSED");
    // A minute either side of the boundary; UNIT-06 pins the exact instant.
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = (${ago(7 * DAY - MINUTE)}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${updatedInside}`;
    await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = (${ago(7 * DAY + MINUTE)}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${updatedOutside}`;
    await prisma.$executeRaw`UPDATE "Ticket" SET "resolvedAt" = (${ago(30 * DAY - MINUTE)}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${resolvedInside}`;
    await prisma.$executeRaw`UPDATE "Ticket" SET "resolvedAt" = (${ago(30 * DAY + MINUTE)}::timestamptz AT TIME ZONE 'UTC') WHERE id = ${resolvedOutside}`;
  });

  it("Recently updated includes 7 days ago and excludes 7 days and a minute", async () => {
    const listed = (await dashboard(edge.cookie)).body.recentlyUpdated.items.map((t: { id: number }) => t.id);
    expect(listed).toContain(updatedInside);
    expect(listed).not.toContain(updatedOutside);
  });

  it("Recently resolved includes 30 days ago and excludes 30 days and a minute", async () => {
    const listed = (await dashboard(edge.cookie)).body.recentlyResolved.items.map((t: { id: number }) => t.id);
    expect(listed).toEqual([resolvedInside]);
  });
});

// API-25 — AC-48, BR-51
it("API-25: each metric's drill-down lists exactly the counted set", async () => {
  const metrics = (await dashboard(a.cookie)).body.metrics as Record<string, { value: number; href: string }>;
  let checked = 0;
  for (const { value, href } of Object.values(metrics)) {
    const list = await request(app).get(href.replace("/tickets", "/api/tickets")).set("Cookie", a.cookie);
    expect({ href, total: list.body.totalItems }).toEqual({ href, total: value });
    checked += 1;
  }
  expect(checked).toBe(3);
});
