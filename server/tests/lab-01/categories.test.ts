import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { CATEGORY_NAMES } from "../../prisma/seed.js";

// Requires a migrated and seeded database (npm run prisma:migrate && prisma:seed).
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(CATEGORY_NAMES);
    expect(res.body.every((c: { id: number }) => typeof c.id === "number")).toBe(true);
  });
});
