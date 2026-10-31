import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient, type TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// API-01…API-19 (docs/lab-04/tests.md §2.2). Contract: api-spec §2. Every Ticket
// is created here with a TOKEN-prefixed number and removed in afterAll.
const prisma = new PrismaClient();
const TOKEN = `ACT${Date.now()}`;

let staffA: { id: number; cookie: string };
let staffB: { id: number };
let owner: { id: number };
let inactiveStaff: { id: number };
let requester: { id: number };
let categoryId: number;
let relatedSystemId: number;
let seq = 0;

const DAY = 24 * 3_600_000;
const past = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();

async function ticket(status: TicketStatus = "IN_PROGRESS", ownerId: number | null = null) {
  seq += 1;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `${TOKEN}-${seq}`,
      requesterId: requester.id,
      categoryId,
      relatedSystemId,
      summary: `${TOKEN} ticket ${seq}`,
      description: "Actions Taken fixture with a long enough description.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      ownerId,
      ticketDate: new Date(Date.now() - 10 * DAY),
    },
  });
  return t.id;
}

const body = (over: Record<string, unknown> = {}) => ({
  actionAt: past(1),
  description: "Checked the cabling.",
  ...over,
});
const create = (ticketId: number, data: object, cookie = staffA.cookie) =>
  request(app).post(`/api/tickets/${ticketId}/actions`).set("Cookie", cookie).send(data);
const edit = (actionId: number, data: object, cookie = staffA.cookie) =>
  request(app).patch(`/api/actions/${actionId}`).set("Cookie", cookie).send(data);
const list = (ticketId: number, cookie = staffA.cookie) =>
  request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", cookie);
const stored = (id: number) => prisma.actionTaken.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  const a = await ensureUser(prisma, { email: "act.staff.a@toktickit.test", name: "Act Staff A", role: "IT_STAFF" });
  staffA = { id: a.id, cookie: await loginCookie("act.staff.a@toktickit.test") };
  staffB = { id: (await ensureUser(prisma, { email: "act.staff.b@toktickit.test", name: "Act Staff B", role: "IT_STAFF" })).id };
  owner = { id: (await ensureUser(prisma, { email: "act.owner@toktickit.test", name: "Act Owner", role: "IT_STAFF" })).id };
  inactiveStaff = {
    id: (await ensureUser(prisma, { email: "act.staff.off@toktickit.test", role: "IT_STAFF", isActive: false })).id,
  };
  requester = { id: (await ensureUser(prisma, { email: "act.req@toktickit.test", role: "REQUESTER" })).id };
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

afterAll(async () => {
  const ids = (
    await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: TOKEN } }, select: { id: true } })
  ).map((t) => t.id);
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

// API-01 — AC-17, BR-12
it("API-01: lists by Action Date/Time, then id, identically on every read", async () => {
  const id = await ticket();
  const same = past(2);
  const ids: number[] = [];
  for (const d of ["third", "fourth", "fifth"]) ids.push((await create(id, body({ actionAt: same, description: d }))).body.id);
  const earliest = (await create(id, body({ actionAt: past(3), description: "first" }))).body.id;

  const first = await list(id);
  expect(first.status).toBe(200);
  expect(first.body.items.map((a: { id: number }) => a.id)).toEqual([earliest, ...ids]);
  expect((await list(id)).body).toEqual(first.body);
});

it("returns an empty list for a Ticket with no actions", async () => {
  const res = await list(await ticket());
  expect(res.body).toEqual({ items: [] });
});

// API-02 — AC-02
it("API-02: defaults the performer to the creator", async () => {
  const res = await create(await ticket(), body());
  expect(res.status).toBe(201);
  expect(res.body.performedBy).toEqual({ id: staffA.id, name: "Act Staff A" });
  expect((await stored(res.body.id)).performedById).toBe(staffA.id);
});

// API-03 — AC-01
it("API-03: creates a valid action under the Ticket with the session user as creator", async () => {
  const id = await ticket();
  const sent = body({
    description: "Replaced the battery.",
    status: "COMPLETED",
    result: "Holds charge for six hours.",
    performedById: staffB.id,
    followUpRequired: true,
    followUpNote: "Check again next week.",
    attachmentNotes: "See photo battery-label.jpg",
  });
  const res = await create(id, sent);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    ticketId: id,
    actionAt: sent.actionAt,
    description: "Replaced the battery.",
    result: "Holds charge for six hours.",
    status: "COMPLETED",
    performedBy: { id: staffB.id, name: "Act Staff B" },
    createdBy: { id: staffA.id, name: "Act Staff A" },
    followUpRequired: true,
    followUpNote: "Check again next week.",
    attachmentNotes: "See photo battery-label.jpg",
    version: 1,
  });
  expect(res.body.completedAt).toEqual(expect.any(String));
  expect(res.body).not.toHaveProperty("clientRequestId");
  const row = await stored(res.body.id);
  expect(row).toMatchObject({ ticketId: id, createdById: staffA.id, performedById: staffB.id });
});

// API-04 — AC-03, BR-02
it("API-04: Staff A records an action performed by Staff B on a Ticket owned by C", async () => {
  const id = await ticket("IN_PROGRESS", owner.id);
  const res = await create(id, body({ performedById: staffB.id }));
  expect(res.status).toBe(201);
  expect(await stored(res.body.id)).toMatchObject({ createdById: staffA.id, performedById: staffB.id });
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).ownerId).toBe(owner.id);
});

// API-05 — AC-04, BR-04
describe("API-05: an inactive, non-staff, or unknown performer is rejected", () => {
  const targets: [string, () => number][] = [
    ["a deactivated IT Staff member", () => inactiveStaff.id],
    ["a Requester", () => requester.id],
    ["a user who does not exist", () => 999999999],
  ];

  it.each(targets)("on create: %s", async (_who, target) => {
    const id = await ticket();
    const res = await create(id, body({ performedById: target() }));
    expect(res.status).toBe(400);
    expect(res.body.fields.performedById).toBe("Choose an active IT Staff member.");
    expect(await prisma.actionTaken.count({ where: { ticketId: id } })).toBe(0);
  });

  it.each(targets)("on edit: %s", async (_who, target) => {
    const action = (await create(await ticket(), body())).body;
    const res = await edit(action.id, { expectedVersion: 1, performedById: target() });
    expect(res.status).toBe(400);
    expect(res.body.fields.performedById).toBe("Choose an active IT Staff member.");
    expect(await stored(action.id)).toMatchObject({ performedById: staffA.id, version: 1 });
  });
});

// API-06 — AC-05, BR-03
it("API-06: ignores a createdById sent by the client", async () => {
  const res = await create(await ticket(), body({ createdById: staffB.id, version: 7, completedAt: past(1) }));
  expect(res.status).toBe(201);
  expect(await stored(res.body.id)).toMatchObject({ createdById: staffA.id, version: 1, completedAt: null });
});

// API-07 — AC-06
it.each([
  ["empty", ""],
  ["whitespace", "    "],
  ["2001 characters", "x".repeat(2001)],
])("API-07: a %s description is a 400 naming description", async (_case, description) => {
  const res = await create(await ticket(), body({ description }));
  expect(res.status).toBe(400);
  expect(res.body.fields.description).toBeTruthy();
});

// API-08 — AC-07, BR-08
it("API-08: follow-up yes needs a note; follow-up no stores the note empty", async () => {
  const id = await ticket();
  const missing = await create(id, body({ followUpRequired: true, followUpNote: "  " }));
  expect(missing.status).toBe(400);
  expect(missing.body.fields.followUpNote).toBeTruthy();

  const discarded = await create(id, body({ followUpRequired: false, followUpNote: "Not needed" }));
  expect(discarded.status).toBe(201);
  expect((await stored(discarded.body.id)).followUpNote).toBe("");
});

// API-09 — AC-08, BR-07
it("API-09: creating or completing without a Result is a 400 naming result", async () => {
  const id = await ticket();
  const created = await create(id, body({ status: "COMPLETED", result: "" }));
  expect(created.status).toBe(400);
  expect(created.body.fields.result).toBeTruthy();

  const action = (await create(id, body())).body;
  const completed = await edit(action.id, { expectedVersion: 1, status: "COMPLETED" });
  expect(completed.status).toBe(400);
  expect(completed.body.fields.result).toBeTruthy();
  expect((await stored(action.id)).status).toBe("PLANNED");
});

// API-10 — AC-09, BR-10
describe("API-10: Action Date/Time", () => {
  it("rejects a time before the Ticket Date", async () => {
    const res = await create(await ticket(), body({ actionAt: past(11) }));
    expect(res.status).toBe(400);
    expect(res.body.fields.actionAt).toBeTruthy();
  });

  it("accepts a future time on a Planned action only", async () => {
    const id = await ticket();
    expect((await create(id, body({ actionAt: future(2), status: "PLANNED" }))).status).toBe(201);
    expect((await create(id, body({ actionAt: future(2), status: "IN_PROGRESS" }))).status).toBe(400);
    expect((await create(id, body({ actionAt: future(2), status: "COMPLETED", result: "Done." }))).status).toBe(400);
  });

  it("refuses to start a Planned action that is dated in the future", async () => {
    const action = (await create(await ticket(), body({ actionAt: future(2) }))).body;
    const res = await edit(action.id, { expectedVersion: 1, status: "IN_PROGRESS" });
    expect(res.status).toBe(400);
    expect(res.body.fields.actionAt).toBeTruthy();
    expect((await stored(action.id)).status).toBe("PLANNED");
  });
});

// API-11 — AC-10, BR-09
it("API-11: Attachment Notes are text only, at most 500 characters", async () => {
  const id = await ticket();
  const tooLong = await create(id, body({ attachmentNotes: "x".repeat(501) }));
  expect(tooLong.status).toBe(400);
  expect(tooLong.body.fields.attachmentNotes).toBeTruthy();

  const ok = await create(id, body({ attachmentNotes: "See photo label.jpg" }));
  expect(ok.status).toBe(201);
  expect(await prisma.attachment.count({ where: { ticketId: id } })).toBe(0);
});

// API-12 — AC-11
it("API-12: Planned → In Progress → Completed, versions 1 → 2 → 3, completedAt on completion", async () => {
  const action = (await create(await ticket(), body())).body;
  expect(action.version).toBe(1);

  const started = await edit(action.id, { expectedVersion: 1, status: "IN_PROGRESS" });
  expect(started.status).toBe(200);
  expect(started.body).toMatchObject({ status: "IN_PROGRESS", version: 2, completedAt: null });

  const done = await edit(action.id, { expectedVersion: 2, status: "COMPLETED", result: "Fixed." });
  expect(done.status).toBe(200);
  expect(done.body).toMatchObject({ status: "COMPLETED", version: 3, result: "Fixed." });
  expect(done.body.completedAt).toEqual(expect.any(String));
});

// API-13 — AC-12, BR-15
describe("API-13: Completed and Cancelled actions are read-only", () => {
  it.each([
    ["Completed", { status: "COMPLETED", result: "Done." }],
    ["Cancelled", {}],
  ])("a %s action refuses any edit or status change with 409", async (label, extra) => {
    const action = (await create(await ticket(), body(extra))).body;
    if (label === "Cancelled") await edit(action.id, { expectedVersion: 1, status: "CANCELLED" });
    const before = await stored(action.id);

    for (const change of [{ description: "Rewritten." }, { status: "IN_PROGRESS" }]) {
      const res = await edit(action.id, { expectedVersion: before.version, ...change });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: "Completed and cancelled actions cannot be changed. Record a new action instead.",
        conflict: "actionFinal",
      });
    }
    expect(await stored(action.id)).toEqual(before);
  });
});

// API-14 — AC-13, BR-13
it("API-14: never starts as Cancelled; Completed → In Progress is a conflict", async () => {
  const id = await ticket();
  const cancelled = await create(id, body({ status: "CANCELLED" }));
  expect(cancelled.status).toBe(400);
  expect(cancelled.body.fields.status).toBeTruthy();

  const done = (await create(id, body({ status: "COMPLETED", result: "Done." }))).body;
  const back = await edit(done.id, { expectedVersion: 1, status: "IN_PROGRESS" });
  expect(back.status).toBe(409);
  expect((await stored(done.id)).status).toBe("COMPLETED");
});

it("refuses a transition the matrix does not permit, naming both states", async () => {
  const action = (await create(await ticket(), body())).body;
  const res = await edit(action.id, { expectedVersion: 1, status: "PLANNED" });
  expect(res.status).toBe(409);
  expect(res.body).toMatchObject({ conflict: "transition", error: "Cannot move a Planned action to Planned." });
});

// API-15 — AC-15, BR-19
describe("API-15: no action writes on a Resolved, Closed, or Cancelled Ticket", () => {
  it.each(["RESOLVED", "CLOSED", "CANCELLED"] as TicketStatus[])("%s", async (status) => {
    const id = await ticket("IN_PROGRESS");
    const action = (await create(id, body())).body;
    await prisma.ticket.update({ where: { id }, data: { currentStatus: status } });

    const created = await create(id, body());
    expect(created.status).toBe(409);
    expect(created.body).toEqual({ error: "Reopen the ticket before recording more work.", conflict: "ticketInactive" });

    const edited = await edit(action.id, { expectedVersion: 1, description: "Late edit." });
    expect(edited.status).toBe(409);
    expect(edited.body.conflict).toBe("ticketInactive");
    expect(await prisma.actionTaken.count({ where: { ticketId: id } })).toBe(1);
    expect((await stored(action.id)).description).toBe("Checked the cabling.");
  });
});

// API-16 — AC-18, BR-44
it("API-16: the same clientRequestId returns the action already created", async () => {
  const id = await ticket();
  const key = `${TOKEN}-key`;
  const first = await create(id, body({ clientRequestId: key }));
  expect(first.status).toBe(201);

  const replay = await create(id, body({ clientRequestId: key, description: "A different body." }));
  expect(replay.status).toBe(200);
  expect(replay.body).toEqual(first.body);
  expect(await prisma.actionTaken.count({ where: { ticketId: id } })).toBe(1);

  const elsewhere = await create(await ticket(), body({ clientRequestId: key }));
  expect(elsewhere.status).toBe(201);
  expect(elsewhere.body.id).not.toBe(first.body.id);
});

it("rejects a clientRequestId that is empty or longer than 64 characters", async () => {
  const id = await ticket();
  for (const clientRequestId of ["", "k".repeat(65), 42]) {
    const res = await create(id, body({ clientRequestId }));
    expect(res.status).toBe(400);
    expect(res.body.fields.clientRequestId).toBeTruthy();
  }
});

// API-17 — BR-42
it("API-17: creating and editing an action advance Ticket.updatedAt and leave its version", async () => {
  const id = await ticket();
  // Backdated an hour before each write, so the assertion does not depend on the
  // wall clock moving forward between two millisecond reads.
  const backdate = () =>
    prisma.ticket.update({ where: { id }, data: { updatedAt: new Date(Date.now() - 3_600_000) } });

  const before = await backdate();
  const action = (await create(id, body())).body;
  const afterCreate = await prisma.ticket.findUniqueOrThrow({ where: { id } });
  expect(afterCreate.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime() + 3_000_000);
  expect(afterCreate.version).toBe(before.version);

  const beforeEdit = await backdate();
  await edit(action.id, { expectedVersion: 1, description: "Edited." });
  const afterEdit = await prisma.ticket.findUniqueOrThrow({ where: { id } });
  expect(afterEdit.updatedAt.getTime()).toBeGreaterThan(beforeEdit.updatedAt.getTime() + 3_000_000);
  expect(afterEdit.version).toBe(before.version);
});

// API-18 — BR-05
it("API-18: an action keeps a performer deactivated after the fact", async () => {
  const temp = await ensureUser(prisma, { email: `act.temp.${TOKEN}@toktickit.test`, role: "IT_STAFF" });
  const action = (await create(await ticket(), body({ performedById: temp.id }))).body;
  await prisma.user.update({ where: { id: temp.id }, data: { isActive: false } });

  const kept = await edit(action.id, { expectedVersion: 1, description: "Still theirs." });
  expect(kept.status).toBe(200);
  expect(kept.body.performedBy.id).toBe(temp.id);

  const restated = await edit(action.id, { expectedVersion: 2, performedById: temp.id });
  expect(restated.status).toBe(200);
});

// API-19 — AC-19, BR-11
it("API-19: markup is stored and returned verbatim", async () => {
  const markup = "<script>alert(1)</script>";
  const res = await create(await ticket(), body({ description: markup, attachmentNotes: markup }));
  expect(res.status).toBe(201);
  expect(res.body.description).toBe(markup);
  expect((await stored(res.body.id)).description).toBe(markup);
  expect((await list(res.body.ticketId)).body.items[0].attachmentNotes).toBe(markup);
});

describe("version-checked edits", () => {
  it("requires an integer expectedVersion", async () => {
    const action = (await create(await ticket(), body())).body;
    for (const expectedVersion of [undefined, "1", 1.5]) {
      const res = await edit(action.id, { expectedVersion, description: "x" });
      expect(res.status).toBe(400);
      expect(res.body.fields.expectedVersion).toBe("Reload the ticket and try again.");
    }
  });

  it("refuses a stale version with the stored action and changes nothing", async () => {
    const action = (await create(await ticket(), body())).body;
    await edit(action.id, { expectedVersion: 1, description: "First." });
    const res = await edit(action.id, { expectedVersion: 1, description: "Second." });
    expect(res.status).toBe(409);
    expect(res.body.conflict).toBe("stale");
    expect(res.body.current).toMatchObject({ id: action.id, version: 2, description: "First." });
    expect((await stored(action.id)).description).toBe("First.");
  });

  it("returns 404 for an action that does not exist", async () => {
    const res = await edit(999999999, { expectedVersion: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Action not found" });
  });
});
