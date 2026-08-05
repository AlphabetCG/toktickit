import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

// Smoke test proving the Express app boots and the toolchain (Vitest + Supertest)
// is wired up. Endpoint-specific tests (health, categories) arrive in later issues.
describe("TokTickIT API foundation", () => {
  const app = createApp();

  it("responds on the root route", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("TokTickIT API");
  });
});
