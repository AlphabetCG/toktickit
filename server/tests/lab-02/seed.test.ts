import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  seed,
  CATEGORY_NAMES,
  RELATED_SYSTEM_NAMES,
  REQUESTERS,
} from "../../prisma/seed.js";

// Talks to the real database, so run `npm run prisma:migrate` first.
// Covers the §4.2 data-integrity checks and BR-09…BR-13.
const prisma = new PrismaClient();

const activeRequesters = REQUESTERS.filter((r) => r.isActive);
const inactiveRequesters = REQUESTERS.filter((r) => !r.isActive);

describe("lab 2 seed", () => {
  beforeAll(async () => {
    // Seeding twice is the idempotency check — the second run must be a no-op (BR-09).
    await seed(prisma);
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds the four categories and no duplicates on re-run (BR-10, BR-09)", async () => {
    const rows = await prisma.category.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((c) => c.name)).toEqual(CATEGORY_NAMES);
  });

  it("seeds the seven related systems and no duplicates on re-run (BR-11, BR-09)", async () => {
    const rows = await prisma.relatedSystem.findMany({ orderBy: { id: "asc" } });
    expect(rows).toHaveLength(RELATED_SYSTEM_NAMES.length);
    expect(new Set(rows.map((s) => s.name))).toEqual(new Set(RELATED_SYSTEM_NAMES));
  });

  it("seeds four active and one inactive requester (BR-12)", async () => {
    expect(activeRequesters).toHaveLength(4);
    expect(inactiveRequesters).toHaveLength(1);

    expect(await prisma.requesterUser.count()).toBe(REQUESTERS.length);
    expect(await prisma.requesterUser.count({ where: { isActive: true } })).toBe(4);
    expect(await prisma.requesterUser.count({ where: { isActive: false } })).toBe(1);
  });

  it("keeps the inactive requester flagged inactive after a re-run (BR-13)", async () => {
    const kanya = await prisma.requesterUser.findUnique({
      where: { email: inactiveRequesters[0].email },
    });
    expect(kanya).not.toBeNull();
    expect(kanya?.isActive).toBe(false);
  });

  it("gives every requester a unique email so Lab 3 can attach credentials (BR-63)", async () => {
    const emails = (await prisma.requesterUser.findMany({ select: { email: true } })).map(
      (r) => r.email
    );
    expect(new Set(emails).size).toBe(emails.length);
  });
});
