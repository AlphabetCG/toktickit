import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// TODO(Issue 4): write this test using health.test.ts as the pattern.
// It should assert GET /api/categories returns 200 and the four seeded
// category names in id order. Migrate and seed the DB first.
describe.todo("GET /api/categories", () => {
  it.todo("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
  });
});
