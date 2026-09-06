import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";
import { REQUESTERS } from "../../prisma/seed.js";

// Requires a migrated and seeded database. Covers API-01 (AC-02, BR-13, BR-20)
// and API-02 (AC-01, BR-19).
const prisma = new PrismaClient();

const inactiveEmail = REQUESTERS.find((r) => !r.isActive)!.email;

describe("Requester context", () => {
  let activeId: number;
  let inactiveId: number;

  beforeAll(async () => {
    const active = await prisma.requesterUser.findFirst({ where: { isActive: true } });
    const inactive = await prisma.requesterUser.findUnique({ where: { email: inactiveEmail } });
    activeId = active!.id;
    inactiveId = inactive!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // API-01 — GET /api/requesters
  describe("GET /api/requesters", () => {
    it("returns 200 with only active Requesters (BR-13, BR-20)", async () => {
      const res = await request(app).get("/api/requesters");

      expect(res.status).toBe(200);
      const activeCount = REQUESTERS.filter((r) => r.isActive).length;
      expect(res.body).toHaveLength(activeCount);
      expect(res.body.every((r: { isActive?: boolean }) => r.isActive === undefined)).toBe(true);
    });

    it("never includes the seeded inactive Requester", async () => {
      const res = await request(app).get("/api/requesters");
      const emails = res.body.map((r: { email: string }) => r.email);
      expect(emails).not.toContain(inactiveEmail);
    });

    it("exposes id, name, and email for each option (ui-spec §8.1)", async () => {
      const res = await request(app).get("/api/requesters");
      for (const r of res.body) {
        expect(r).toEqual({
          id: expect.any(Number),
          name: expect.any(String),
          email: expect.any(String),
        });
      }
    });
  });

  // API-02 — X-Requester-Id middleware, tested against the scoped categories route.
  describe("X-Requester-Id on a scoped route returns 401 unless valid", () => {
    const unauthorized = { error: "No Development Requester selected" };

    it("rejects a missing header", async () => {
      const res = await request(app).get("/api/categories");
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthorized);
    });

    it("rejects a non-integer header", async () => {
      const res = await request(app).get("/api/categories").set("X-Requester-Id", "abc");
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthorized);
    });

    it("rejects an unknown Requester id", async () => {
      const res = await request(app).get("/api/categories").set("X-Requester-Id", "99999999");
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthorized);
    });

    it("rejects an inactive Requester with the identical response (no probe)", async () => {
      const res = await request(app).get("/api/categories").set("X-Requester-Id", String(inactiveId));
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unauthorized);
    });

    it("accepts a valid active Requester", async () => {
      const res = await request(app).get("/api/categories").set("X-Requester-Id", String(activeId));
      expect(res.status).toBe(200);
    });
  });

  // API-03 — AC-10, BR-41: scoped reference data for the Create Ticket form.
  describe("scoped reference data", () => {
    it("returns active Categories from the database in id order", async () => {
      const res = await request(app).get("/api/categories").set("X-Requester-Id", String(activeId));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      const ids = res.body.map((c: { id: number }) => c.id);
      expect([...ids]).toEqual([...ids].sort((a, b) => a - b));
    });

    it("returns the seeded active Related Systems", async () => {
      const res = await request(app)
        .get("/api/related-systems")
        .set("X-Requester-Id", String(activeId));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(7);
      for (const s of res.body) {
        expect(s).toEqual({ id: expect.any(Number), name: expect.any(String) });
      }
    });

    it("requires the requester context (401 without a valid header)", async () => {
      expect((await request(app).get("/api/related-systems")).status).toBe(401);
    });
  });
});
