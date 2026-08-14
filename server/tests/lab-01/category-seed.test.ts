import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedCategories, CATEGORY_NAMES } from "../../prisma/seed.js";

// Talks to the real database, so run `npm run prisma:migrate` first.
const prisma = new PrismaClient();

describe("category seed", () => {
  beforeAll(async () => {
    // Seeding twice is the idempotency check — the second run must be a no-op.
    await seedCategories(prisma);
    await seedCategories(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("inserts the four supported categories in order", async () => {
    const categories = await prisma.category.findMany({ orderBy: { id: "asc" } });
    expect(categories.map((c) => c.name)).toEqual(CATEGORY_NAMES);
  });

  it("creates no duplicates when run more than once", async () => {
    expect(await prisma.category.count()).toBe(CATEGORY_NAMES.length);
  });
});
