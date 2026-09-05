import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { CATEGORY_NAMES } from "../../prisma/seed.js";

// Requires a migrated and seeded database (npm run prisma:migrate && prisma:seed).
// GET /api/categories became a scoped route in Lab 2 (api-spec §1.6), so it now
// needs a valid X-Requester-Id — resolved from a seeded active Requester.
describe("GET /api/categories", () => {
  const prisma = new PrismaClient();
  let requesterId: number;

  beforeAll(async () => {
    const active = await prisma.requesterUser.findFirst({ where: { isActive: true } });
    requesterId = active!.id;
    await prisma.$disconnect();
  });

  it("returns the four seeded categories in id order", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("X-Requester-Id", String(requesterId));

    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(CATEGORY_NAMES);
    expect(res.body.every((c: { id: number }) => typeof c.id === "number")).toBe(true);
  });
});
