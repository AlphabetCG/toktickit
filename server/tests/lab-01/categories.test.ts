import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { CATEGORY_NAMES } from "../../prisma/seed.js";
import { ensureUser, loginCookie } from "../helpers/auth.js";

// Requires a migrated and seeded database (npm run prisma:migrate && prisma:seed).
// GET /api/categories became an authenticated route in Lab 3 (api-spec §1.7), so
// it now needs a valid session cookie rather than X-Requester-Id.
describe("GET /api/categories", () => {
  const prisma = new PrismaClient();
  let cookie: string;

  beforeAll(async () => {
    await ensureUser(prisma, { email: "lab1.categories@toktickit.test", role: "REQUESTER" });
    cookie = await loginCookie("lab1.categories@toktickit.test");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the four seeded categories in id order", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(CATEGORY_NAMES);
    expect(res.body.every((c: { id: number }) => typeof c.id === "number")).toBe(true);
  });
});
