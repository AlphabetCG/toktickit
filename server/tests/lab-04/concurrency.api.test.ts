import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";
import { removeTickets } from "../helpers/cleanup.js";

// WF-13…WF-16 (docs/lab-04/tests.md §2.4): stale Ticket writes, a required
// version, stale action edits, and the resolution gate under a race.
const prisma = new PrismaClient();
const TOKEN = `CC4${Date.now()}`;

let cookieA: string;
let cookieB: string;
let ticketId: number;
let staffId: number;
let requesterId: number;
let seq = 1;

beforeAll(async () => {
  staffId = (await ensureUser(prisma, { email: "cc4.a@toktickit.test", role: "IT_STAFF" })).id;
  await ensureUser(prisma, { email: "cc4.b@toktickit.test", role: "IT_STAFF" });
  cookieA = await loginCookie("cc4.a@toktickit.test");
  cookieB = await loginCookie("cc4.b@toktickit.test");
  const requester = await ensureUser(prisma, { email: "cc4.req@toktickit.test", role: "REQUESTER" });
  requesterId = requester.id;
  ticketId = (
    await prisma.ticket.create({
      data: {
        ticketNumber: `${TOKEN}-1`,
        requesterId: requester.id,
        categoryId: (await prisma.category.findFirstOrThrow()).id,
        relatedSystemId: (await prisma.relatedSystem.findFirstOrThrow()).id,
        summary: `${TOKEN} concurrency`,
        description: "Concurrency fixture with a long enough description.",
        requestedPriority: "LOW",
        itPriority: "LOW",
        currentStatus: "IN_PROGRESS",
        ticketDate: new Date(Date.now() - 86_400_000),
      },
    })
  ).id;
});

afterAll(async () => {
  await removeTickets(prisma, { ticketNumber: { startsWith: TOKEN } });
  await prisma.$disconnect();
});

async function freshTicket(withCompletedAction = false) {
  seq += 1;
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `${TOKEN}-${seq}`,
      requesterId,
      categoryId: (await prisma.category.findFirstOrThrow()).id,
      relatedSystemId: (await prisma.relatedSystem.findFirstOrThrow()).id,
      summary: `${TOKEN} race ${seq}`,
      description: "Concurrency fixture with a long enough description.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: "IN_PROGRESS",
      ticketDate: new Date(Date.now() - 86_400_000),
    },
  });
  if (withCompletedAction) {
    await prisma.actionTaken.create({
      data: {
        ticketId: t.id,
        actionAt: new Date(Date.now() - 3_600_000),
        description: "Done already.",
        result: "Fixed.",
        status: "COMPLETED",
        performedById: staffId,
        createdById: staffId,
        clientRequestId: `${TOKEN}-done-${seq}`,
      },
    });
  }
  return t.id;
}

const patchTicket = (id: number, path: string, body: object, cookie: string) =>
  request(app).patch(`/api/tickets/${id}/${path}`).set("Cookie", cookie).send(body);

// WF-13 — AC-37, BR-40, BR-41
describe("WF-13: two writers at one Ticket version — exactly one wins", () => {
  const cases: [string, string, () => object, () => object][] = [
    ["status", "status", () => ({ status: "WAITING_FOR_REQUESTER" }), () => ({ status: "CANCELLED" })],
    ["owner", "owner", () => ({ ownerId: staffId }), () => ({ ownerId: null })],
    ["IT Priority", "it-priority", () => ({ itPriority: "HIGH" }), () => ({ itPriority: "MEDIUM" })],
  ];

  it.each(cases)("%s", async (_name, path, bodyA, bodyB) => {
    for (let round = 0; round < 3; round++) {
      const id = await freshTicket();
      const [a, b] = await Promise.all([
        patchTicket(id, path, { ...bodyA(), expectedVersion: 1 }, cookieA),
        patchTicket(id, path, { ...bodyB(), expectedVersion: 1 }, cookieB),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const loser = a.status === 409 ? a : b;
      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(loser.body).toMatchObject({
        conflict: "stale",
        current: { version: 2, currentStatus: stored.currentStatus, itPriority: stored.itPriority },
      });
      expect(stored.version).toBe(2);
    }
  });
});

// WF-14 — AC-38, BR-41. Repeated so an interleaving that lets both writers
// through has several chances to show itself.
it.each([1, 2, 3, 4, 5])("WF-14 (round %i): two edits at the same version — one 200, one 409", async () => {
  const action = (
    await request(app)
      .post(`/api/tickets/${ticketId}/actions`)
      .set("Cookie", cookieA)
      .send({ actionAt: new Date(Date.now() - 3_600_000).toISOString(), description: "Original." })
  ).body;

  const [a, b] = await Promise.all([
    request(app).patch(`/api/actions/${action.id}`).set("Cookie", cookieA).send({ expectedVersion: 1, description: "Edit by A." }),
    request(app).patch(`/api/actions/${action.id}`).set("Cookie", cookieB).send({ expectedVersion: 1, description: "Edit by B." }),
  ]);

  expect([a.status, b.status].sort()).toEqual([200, 409]);
  const [winner, loser] = a.status === 200 ? [a, b] : [b, a];
  expect(loser.body.conflict).toBe("stale");

  const row = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
  expect(row.version).toBe(2);
  expect(row.description).toBe(winner.body.description);
});

// WF-15 — AC-39, BR-39
describe("WF-15: every Ticket write needs an integer expectedVersion", () => {
  it.each([
    ["status", { status: "OPEN" }],
    ["owner", { ownerId: null }],
    ["it-priority", { itPriority: "LOW" }],
  ])("%s", async (path, body) => {
    const id = await freshTicket();
    for (const expectedVersion of [undefined, "1", 1.5]) {
      const res = await patchTicket(id, path, { ...body, expectedVersion }, cookieA);
      expect(res.status).toBe(400);
      expect(res.body.fields.expectedVersion).toBe("Reload the ticket and try again.");
    }
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).version).toBe(1);
  });
});

// WF-16 — AC-41, BR-27. A new Planned action racing a resolution: whichever
// takes the Ticket lock first, a Resolved Ticket never holds an open action.
it("WF-16: the gate holds under a race, over 20 rounds", async () => {
  for (let round = 0; round < 20; round++) {
    const id = await freshTicket(true);
    await Promise.all([
      request(app)
        .post(`/api/tickets/${id}/actions`)
        .set("Cookie", cookieB)
        .send({ actionAt: new Date(Date.now() - 60_000).toISOString(), description: "Late planned work." }),
      patchTicket(id, "status", { status: "RESOLVED", expectedVersion: 1 }, cookieA),
    ]);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id }, include: { actions: true } });
    const open = stored.actions.filter((a) => a.status === "PLANNED" || a.status === "IN_PROGRESS");
    expect(stored.currentStatus === "RESOLVED" && open.length > 0).toBe(false);
  }
}, 60_000);
