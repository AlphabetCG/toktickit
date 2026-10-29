import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus, type ActionStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";
import { STATUSES, isTransitionPermitted } from "../../src/transitions.js";

// WF-01…WF-12 (docs/lab-04/tests.md §2.4). Contract: api-spec §3,
// specification §5.3–§5.5.
const prisma = new PrismaClient();
const TOKEN = `WF${Date.now()}`;
const DAY = 86_400_000;

let staff: { id: number; cookie: string };
let requester: { id: number; cookie: string };
let categoryId: number;
let relatedSystemId: number;
let seq = 0;

async function ticket(status: TicketStatus = "IN_PROGRESS", resolvedAt: Date | null = null) {
  seq += 1;
  return (
    await prisma.ticket.create({
      data: {
        ticketNumber: `${TOKEN}-${seq}`,
        requesterId: requester.id,
        categoryId,
        relatedSystemId,
        summary: `${TOKEN} workflow ${seq}`,
        description: "Workflow fixture with a long enough description.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: status,
        resolvedAt,
        ticketDate: new Date(Date.now() - 10 * DAY),
      },
    })
  ).id;
}

let actionSeq = 0;
async function action(ticketId: number, status: ActionStatus, followUpRequired = false, daysAgo = 2) {
  actionSeq += 1;
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date(Date.now() - daysAgo * DAY),
      description: "Fixture action.",
      result: status === "COMPLETED" ? "Done." : "",
      status,
      performedById: staff.id,
      createdById: staff.id,
      followUpRequired,
      followUpNote: followUpRequired ? "Check back." : "",
      clientRequestId: `${TOKEN}-a${actionSeq}`,
    },
  });
}

const versionOf = async (id: number) => (await prisma.ticket.findUniqueOrThrow({ where: { id } })).version;
const move = async (id: number, status: string, cookie = staff.cookie) =>
  request(app)
    .patch(`/api/tickets/${id}/status`)
    .set("Cookie", cookie)
    .send({ status, expectedVersion: await versionOf(id) });
const history = (id: number) =>
  prisma.ticketStatusChange.findMany({ where: { ticketId: id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }] });

beforeAll(async () => {
  const s = await ensureUser(prisma, { email: "wf.staff@toktickit.test", name: "WF Staff", role: "IT_STAFF" });
  staff = { id: s.id, cookie: await loginCookie("wf.staff@toktickit.test") };
  const r = await ensureUser(prisma, { email: "wf.req@toktickit.test", name: "WF Requester", role: "REQUESTER" });
  requester = { id: r.id, cookie: await loginCookie("wf.req@toktickit.test") };
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
});

// WF-01 — AC-25, BR-22
describe("WF-01: every cell of the matrix, with the gate satisfied", () => {
  const pairs = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as [TicketStatus, TicketStatus]));

  it("has 64 cells", () => expect(pairs).toHaveLength(64));

  it.each(pairs)("%s → %s", async (from, to) => {
    const id = await ticket(from);
    await action(id, "COMPLETED");
    const res = await move(id, to);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } });
    if (isTransitionPermitted(from, to)) {
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, currentStatus: to, version: 2 });
      expect(stored.currentStatus).toBe(to);
    } else {
      expect(res.status).toBe(409);
      expect(res.body.conflict).toBe("transition");
      expect(stored.currentStatus).toBe(from);
      expect(stored.version).toBe(1);
    }
  });
});

// WF-02 — AC-26, FR-07
it("WF-02: no Completed action blocks resolution, naming noCompletedAction", async () => {
  const id = await ticket();
  const res = await move(id, "RESOLVED");
  expect(res.status).toBe(409);
  expect(res.body).toMatchObject({ conflict: "resolutionGate", error: "This ticket cannot be resolved yet." });
  expect(res.body.unmet.map((u: { code: string }) => u.code)).toContain("noCompletedAction");
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe("IN_PROGRESS");
});

// WF-03 — AC-27
it("WF-03: an open action blocks resolution, naming openAction", async () => {
  const id = await ticket();
  await action(id, "COMPLETED");
  await action(id, "PLANNED");
  const res = await move(id, "RESOLVED");
  expect(res.status).toBe(409);
  expect(res.body.unmet).toEqual([{ code: "openAction", message: "Finish or cancel 1 open action." }]);
});

// WF-04 — AC-28, BR-26
it("WF-04: an outstanding follow-up blocks resolution until newer completed work", async () => {
  const id = await ticket();
  await action(id, "COMPLETED", true, 3);
  const blocked = await move(id, "RESOLVED");
  expect(blocked.status).toBe(409);
  expect(blocked.body.unmet.map((u: { code: string }) => u.code)).toEqual(["followUpOutstanding"]);

  await action(id, "COMPLETED", false, 1);
  expect((await move(id, "RESOLVED")).status).toBe(200);
});

// WF-05 — AC-29, BR-28
it("WF-05: Ticket Detail exposes the gate and offers RESOLVED only once it is met", async () => {
  const id = await ticket();
  const unmet = await request(app).get(`/api/tickets/${id}`).set("Cookie", staff.cookie);
  expect(unmet.body.resolutionGate.satisfied).toBe(false);
  expect(unmet.body.resolutionGate.unmet[0]).toEqual({ code: "noCompletedAction", message: "Complete at least one action." });
  expect(unmet.body.permittedTransitions).toEqual(["WAITING_FOR_REQUESTER", "CANCELLED"]);
  expect(unmet.body).toMatchObject({ version: 1, resolvedAt: null });

  await action(id, "COMPLETED");
  const met = await request(app).get(`/api/tickets/${id}`).set("Cookie", staff.cookie);
  expect(met.body.resolutionGate).toEqual({ satisfied: true, unmet: [] });
  expect(met.body.permittedTransitions).toEqual(["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]);

  const own = await request(app).get(`/api/tickets/${id}`).set("Cookie", requester.cookie);
  expect(own.body).not.toHaveProperty("resolutionGate");
  expect(own.body).toMatchObject({ version: 1, resolvedAt: null });
});

// WF-06 — AC-31, BR-30
it("WF-06: the Requester's resolution signal is advisory", async () => {
  const id = await ticket();
  const signal = await request(app).post(`/api/tickets/${id}/resolution-signal`).set("Cookie", requester.cookie);
  expect(signal.status).toBe(200);
  const detail = await request(app).get(`/api/tickets/${id}`).set("Cookie", staff.cookie);
  expect(detail.body.currentStatus).toBe("IN_PROGRESS");
  expect(detail.body.resolutionGate.satisfied).toBe(false);
});

// WF-07 — AC-32, BR-31
it("WF-07: resolvedAt is set on Resolved, kept on Closed, cleared on Reopened, and matches history", async () => {
  const id = await ticket();
  await action(id, "COMPLETED");
  const resolved = await move(id, "RESOLVED");
  const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } });
  expect(stored.resolvedAt).toBeInstanceOf(Date);
  expect(resolved.body.resolvedAt).toBe(stored.resolvedAt!.toISOString());
  const entry = (await history(id)).at(-1)!;
  expect(entry.toStatus).toBe("RESOLVED");
  expect(entry.changedAt.getTime()).toBe(stored.resolvedAt!.getTime());

  const reopened = await move(id, "REOPENED");
  expect(reopened.body.resolvedAt).toBeNull();
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).resolvedAt).toBeNull();

  const other = await ticket();
  await action(other, "COMPLETED");
  await move(other, "RESOLVED");
  const kept = (await prisma.ticket.findUniqueOrThrow({ where: { id: other } })).resolvedAt;
  await move(other, "CLOSED");
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id: other } })).resolvedAt).toEqual(kept);
});

// WF-08 — AC-16, BR-20
it("WF-08: cancelling a Ticket cancels its open actions and leaves Completed work", async () => {
  const id = await ticket();
  const planned = await action(id, "PLANNED");
  const started = await action(id, "IN_PROGRESS");
  const done = await action(id, "COMPLETED");
  const res = await move(id, "CANCELLED");
  expect(res.status).toBe(200);
  expect(res.body.cancelledActions).toBe(2);
  const after = await prisma.actionTaken.findMany({ where: { ticketId: id } });
  const byId = Object.fromEntries(after.map((a) => [a.id, a]));
  expect(byId[planned.id]).toMatchObject({ status: "CANCELLED", version: 2 });
  expect(byId[started.id]).toMatchObject({ status: "CANCELLED", version: 2 });
  expect(byId[done.id]).toEqual(done);
});

// WF-09 — AC-33, BR-32
it("WF-09: creation and each change append one entry, in order", async () => {
  const created = await request(app).post("/api/tickets").set("Cookie", requester.cookie).send({
    categoryId,
    relatedSystemId,
    requestedPriority: "LOW",
    summary: `${TOKEN} history`,
    description: "Created through the API to record its creation entry.",
  });
  expect(created.status).toBe(201);
  const id = created.body.id;
  // Renumbered into the TOKEN block so cleanup finds it.
  await prisma.ticket.update({ where: { id }, data: { ticketNumber: `${TOKEN}-api` } });

  await move(id, "OPEN");
  await move(id, "IN_PROGRESS");
  const entries = await history(id);
  expect(entries.map((e) => [e.fromStatus, e.toStatus, e.changedById])).toEqual([
    [null, "NEW", requester.id],
    ["NEW", "OPEN", staff.id],
    ["OPEN", "IN_PROGRESS", staff.id],
  ]);
});

// WF-10 — AC-34, BR-36
it("WF-10: a refused change appends no history", async () => {
  const id = await ticket("RESOLVED", new Date());
  const count = async () => (await history(id)).length;
  const before = await count();

  expect((await move(id, "IN_PROGRESS")).status).toBe(409); // matrix
  const gateTicket = await ticket();
  const gateBefore = (await history(gateTicket)).length;
  expect((await move(gateTicket, "RESOLVED")).status).toBe(409); // gate
  expect((await move(id, "CLOSED", requester.cookie)).status).toBe(403); // Requester
  const missing = await request(app)
    .patch("/api/tickets/999999999/status")
    .set("Cookie", staff.cookie)
    .send({ status: "OPEN", expectedVersion: 1 });
  expect(missing.status).toBe(404);

  expect(await count()).toBe(before);
  expect((await history(gateTicket)).length).toBe(gateBefore);
});

// WF-11 — AC-36, BR-35
it("WF-11: staff see who changed the status; the Requester sees IT Support", async () => {
  const id = await ticket("NEW");
  await prisma.ticketStatusChange.create({
    data: { ticketId: id, fromStatus: null, toStatus: "NEW", changedById: requester.id, changedAt: new Date(Date.now() - DAY) },
  });
  await move(id, "OPEN");

  const staffView = await request(app).get(`/api/tickets/${id}/status-history`).set("Cookie", staff.cookie);
  expect(staffView.status).toBe(200);
  expect(staffView.body.items.map((e: { actor: unknown }) => e.actor)).toEqual([
    { kind: "requester", id: requester.id, name: "WF Requester" },
    { kind: "staff", id: staff.id, name: "WF Staff" },
  ]);

  const own = await request(app).get(`/api/tickets/${id}/status-history`).set("Cookie", requester.cookie);
  expect(own.body.items.map((e: { actor: unknown }) => e.actor)).toEqual([
    { kind: "requester", id: requester.id, name: "WF Requester" },
    { kind: "staff" },
  ]);
  expect(own.text).not.toContain("WF Staff");
  expect(own.text).not.toMatch(/@/);
});

it("labels a backfilled entry as system and refuses every write method", async () => {
  const id = await ticket("OPEN");
  await prisma.ticketStatusChange.create({ data: { ticketId: id, fromStatus: null, toStatus: "OPEN", changedById: null } });
  const res = await request(app).get(`/api/tickets/${id}/status-history`).set("Cookie", staff.cookie);
  expect(res.body.items[0]).toMatchObject({ fromStatus: null, toStatus: "OPEN", actor: { kind: "system" } });
  for (const method of ["post", "put", "patch", "delete"] as const) {
    expect((await request(app)[method](`/api/tickets/${id}/status-history`).set("Cookie", staff.cookie)).status).toBe(404);
  }
});

// WF-12 — BR-29
it("WF-12: a legacy Resolved Ticket keeps its status; once Reopened it must meet the gate", async () => {
  const id = await ticket("RESOLVED", new Date(Date.now() - DAY));
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).currentStatus).toBe("RESOLVED");
  expect((await move(id, "REOPENED")).status).toBe(200);
  const blocked = await move(id, "RESOLVED");
  expect(blocked.status).toBe(409);
  expect(blocked.body.conflict).toBe("resolutionGate");
  await action(id, "COMPLETED");
  expect((await move(id, "RESOLVED")).status).toBe(200);
});

describe("owner and IT Priority are version-checked too", () => {
  it("returns the new version and refuses the old one", async () => {
    const id = await ticket();
    const owner = await request(app).patch(`/api/tickets/${id}/owner`).set("Cookie", staff.cookie).send({ ownerId: staff.id, expectedVersion: 1 });
    expect(owner.status).toBe(200);
    expect(owner.body.version).toBe(2);
    const stale = await request(app).patch(`/api/tickets/${id}/it-priority`).set("Cookie", staff.cookie).send({ itPriority: "HIGH", expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ conflict: "stale", current: { version: 2, owner: { id: staff.id }, itPriority: "MEDIUM" } });
    const fresh = await request(app).patch(`/api/tickets/${id}/it-priority`).set("Cookie", staff.cookie).send({ itPriority: "HIGH", expectedVersion: 2 });
    expect(fresh.body).toMatchObject({ itPriority: "HIGH", version: 3 });
  });
});
