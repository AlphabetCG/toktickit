import { it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// WF-14 (docs/lab-04/tests.md §2.4). The Ticket-version cases WF-09…WF-13 arrive
// with the workflow in #51.
const prisma = new PrismaClient();
const TOKEN = `CC4${Date.now()}`;

let cookieA: string;
let cookieB: string;
let ticketId: number;

beforeAll(async () => {
  await ensureUser(prisma, { email: "cc4.a@toktickit.test", role: "IT_STAFF" });
  await ensureUser(prisma, { email: "cc4.b@toktickit.test", role: "IT_STAFF" });
  cookieA = await loginCookie("cc4.a@toktickit.test");
  cookieB = await loginCookie("cc4.b@toktickit.test");
  const requester = await ensureUser(prisma, { email: "cc4.req@toktickit.test", role: "REQUESTER" });
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
  await prisma.actionTaken.deleteMany({ where: { ticketId } });
  await prisma.ticket.delete({ where: { id: ticketId } });
  await prisma.$disconnect();
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
