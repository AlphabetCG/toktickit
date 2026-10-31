import { it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus, type ActionStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";

// PERF-01, PERF-02 (docs/lab-04/tests.md §2.10): a regression tripwire on the
// development machine, not a production benchmark (specification, open assumptions).
// Every volume Ticket belongs to one Requester, so PERF-01 measures the worst case.
const prisma = new PrismaClient();
const TOKEN = `PF4${Date.now()}`;
const TICKETS = 1_000;
const ACTIONS = 2_000;
const THRESHOLD_MS = 500;

const STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const ACTION_STATUSES: ActionStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

let adminCookie: string;
let requesterCookie: string;

beforeAll(async () => {
  const admin = await ensureUser(prisma, { email: "pf4.admin@toktickit.test", role: "ADMINISTRATOR" });
  adminCookie = await loginCookie("pf4.admin@toktickit.test");
  const staff = await ensureUser(prisma, { email: "pf4.staff@toktickit.test", role: "IT_STAFF" });
  const requester = await ensureUser(prisma, { email: "pf4.req@toktickit.test", role: "REQUESTER" });
  requesterCookie = await loginCookie("pf4.req@toktickit.test");
  const categoryId = (await prisma.category.findFirstOrThrow()).id;
  const relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow()).id;
  const now = Date.now();

  await prisma.ticket.createMany({
    data: Array.from({ length: TICKETS }, (_, i) => ({
      ticketNumber: `${TOKEN}-${i}`,
      requesterId: requester.id,
      categoryId,
      relatedSystemId,
      summary: `${TOKEN} volume ${i}`,
      description: "Volume fixture for the dashboard performance smoke test.",
      requestedPriority: PRIORITIES[i % 3],
      itPriority: PRIORITIES[(i + 1) % 3],
      currentStatus: STATUSES[i % STATUSES.length],
      ownerId: i % 4 === 0 ? null : i % 2 === 0 ? admin.id : staff.id,
      ticketDate: new Date(now - (i % 60) * 86_400_000),
    })),
  });
  const ids = (await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: TOKEN } }, select: { id: true } })).map((t) => t.id);
  await prisma.actionTaken.createMany({
    data: Array.from({ length: ACTIONS }, (_, i) => {
      const status = ACTION_STATUSES[i % 4];
      return {
        ticketId: ids[i % ids.length],
        actionAt: new Date(now - (i % 48) * 3_600_000),
        description: `Volume action ${i}`,
        result: status === "COMPLETED" ? "Done." : "",
        status,
        performedById: i % 2 === 0 ? admin.id : staff.id,
        createdById: staff.id,
        clientRequestId: `${TOKEN}-a${i}`,
      };
    }),
  });
}, 120_000);

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
}, 120_000);

/** Median of 5 timed calls after one warm-up; every call must succeed. */
async function medianMs(label: string, path: string, cookie: string) {
  expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(TICKETS);
  expect(await prisma.actionTaken.count()).toBeGreaterThanOrEqual(ACTIONS);

  await request(app).get(path).set("Cookie", cookie); // warm-up
  const timings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    const res = await request(app).get(path).set("Cookie", cookie);
    timings.push(performance.now() - started);
    expect(res.status).toBe(200);
  }
  const median = [...timings].sort((a, b) => a - b)[2];
  console.log(`${label}: median ${median.toFixed(1)} ms over 5 calls (${timings.map((t) => t.toFixed(0)).join(", ")})`);
  return median;
}

// PERF-01 — AC-52, BR-47
it("PERF-01: the Requester dashboard answers in under 500 ms (median of 5) at volume", async () => {
  expect(await medianMs("PERF-01 requester dashboard", "/api/dashboard/requester", requesterCookie)).toBeLessThan(THRESHOLD_MS);
}, 60_000);

// PERF-02 — AC-52, BR-47
it("PERF-02: the staff dashboard answers in under 500 ms (median of 5) at volume", async () => {
  expect(await medianMs("PERF-02 staff dashboard", "/api/dashboard/staff", adminCookie)).toBeLessThan(THRESHOLD_MS);
}, 60_000);
