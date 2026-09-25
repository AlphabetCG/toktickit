import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// AUTHZ-01, AUTHZ-02 (docs/lab-03/tests.md §2.4). The role-specific refusals
// (AUTHZ-03…12) arrive with the queue/admin/notes routes in later Issues.
const prisma = new PrismaClient();

let categoryId: number;
let relatedSystemId: number;
let cookieA: string;
let otherUserId: number;

beforeAll(async () => {
  await ensureUser(prisma, { email: "authz.a@toktickit.test", role: "REQUESTER" });
  otherUserId = (await ensureUser(prisma, { email: "authz.b@toktickit.test", role: "REQUESTER" })).id;
  cookieA = await loginCookie("authz.a@toktickit.test");
  categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// AUTHZ-01 — AC-10, BR-13
describe("AUTHZ-01: unauthenticated access is refused with 401", () => {
  const protectedRoutes: [string, string][] = [
    ["get", "/api/auth/me"],
    ["post", "/api/auth/logout"],
    ["post", "/api/auth/password"],
    ["get", "/api/categories"],
    ["get", "/api/related-systems"],
    ["get", "/api/tickets"],
    ["post", "/api/tickets"],
    ["get", "/api/tickets/1"],
    ["get", "/api/tickets/1/attachments"],
    ["get", "/api/attachments/1/download"],
    ["delete", "/api/attachments/1"],
  ];

  it.each(protectedRoutes)("%s %s → 401 with no session", async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

// AUTHZ-02 — AC-12, BR-03
describe("AUTHZ-02: client-supplied identity is ignored", () => {
  it("creates the Ticket for the session user even when the body names another id", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Cookie", cookieA)
      .set("X-Requester-Id", String(otherUserId)) // the Lab 2 header must be inert
      .send({
        categoryId,
        relatedSystemId,
        requestedPriority: "LOW",
        requesterId: otherUserId, // a spoofed owner in the body
        summary: "Ownership comes from the session, not the body",
        description: "This ticket must belong to the authenticated caller only.",
      });
    expect(res.status).toBe(201);

    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(saved.requesterId).not.toBe(otherUserId);
    expect(res.body.requesterId).not.toBe(otherUserId);
  });

  it("lists only the session user's Tickets regardless of an X-Requester-Id header", async () => {
    const res = await request(app)
      .get("/api/tickets?pageSize=50")
      .set("Cookie", cookieA)
      .set("X-Requester-Id", String(otherUserId));
    expect(res.status).toBe(200);
    // Every returned ticket belongs to the caller; none leaks from the header id.
    const me = await request(app).get("/api/auth/me").set("Cookie", cookieA);
    const numbers = res.body.items as { id: number }[];
    const owned = await prisma.ticket.findMany({
      where: { id: { in: numbers.map((t) => t.id) } },
      select: { requesterId: true },
    });
    expect(owned.every((t) => t.requesterId === me.body.id)).toBe(true);
  });
});
