import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  seed,
  USERS,
  REQUESTERS,
  CATEGORY_NAMES,
  RELATED_SYSTEM_NAMES,
} from "../../prisma/seed.js";

// Talks to the real database, so run `npm run prisma:migrate` first. Covers the
// Lab 3 data-migration regressions REG-01, REG-02, REG-04, REG-05, and REG-07
// (docs/lab-03/tests.md §2). Two kinds of evidence:
//   • the migration SQL text — proves the *mechanism* that preserves Lab 2 data
//     (a rename, not a drop-and-recreate), which a fresh reset cannot show because
//     there is no pre-migration data to observe; and
//   • the migrated + seeded database — proves the resulting shape holds the
//     invariants the migration is responsible for.
const prisma = new PrismaClient();

// The hand-written Lab 3 migration (specification §8.3).
const migrationSql = (() => {
  const dir = join(process.cwd(), "prisma", "migrations");
  const folder = readdirSync(dir).find((f) => f.endsWith("_lab3_users_roles_workflow"));
  if (!folder) throw new Error("Lab 3 migration folder not found");
  return readFileSync(join(dir, folder, "migration.sql"), "utf8");
})();

describe("Lab 3 data migration", () => {
  beforeAll(async () => {
    // Seed once so the runtime invariants have data to assert against.
    await seed(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // REG-01 — AC-18, BR-58: the migration renames, so ids (and every
  // Ticket.requesterId) survive rather than being dropped and recreated.
  describe("REG-01: Tickets survive the migration", () => {
    it("renames RequesterUser to User instead of dropping it", () => {
      expect(migrationSql).toMatch(/ALTER TABLE "RequesterUser" RENAME TO "User"/);
      expect(migrationSql).not.toMatch(/DROP TABLE\s+"RequesterUser"/i);
      expect(migrationSql).not.toMatch(/DROP TABLE\s+"Ticket"/i);
    });

    it("leaves every seeded Ticket resolving to its submitting User", async () => {
      const tickets = await prisma.ticket.findMany({
        select: { id: true, ticketNumber: true, requester: { select: { id: true, role: true } } },
      });
      expect(tickets.length).toBeGreaterThan(0);
      for (const t of tickets) {
        expect(t.requester).not.toBeNull();
        expect(t.requester.id).toEqual(expect.any(Number));
      }
      // Ticket Numbers remain unique.
      const numbers = tickets.map((t) => t.ticketNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });
  });

  // REG-02 — AC-19, BR-58: the Attachment table is untouched by the migration and
  // still points at User, with soft-removal state intact.
  describe("REG-02: Attachments survive the migration", () => {
    it("does not drop or recreate the Attachment table", () => {
      expect(migrationSql).not.toMatch(/DROP TABLE\s+"Attachment"/i);
      expect(migrationSql).not.toMatch(/CREATE TABLE\s+"Attachment"/i);
    });

    it("keeps ticketId, uploadedById, and soft-removal columns working against User", async () => {
      const ticket = await prisma.ticket.findFirstOrThrow({ select: { id: true, requesterId: true } });
      const created = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          originalFilename: "reg02.png",
          storedFilename: `reg02-${Date.now()}.png`,
          mimeType: "image/png",
          sizeBytes: 1024,
          uploadedById: ticket.requesterId,
        },
        include: { uploadedBy: { select: { id: true } } },
      });
      try {
        expect(created.uploadedBy.id).toBe(ticket.requesterId);
        expect(created.removedAt).toBeNull();
        expect(created.removedById).toBeNull();
        expect(created.removalReason).toBeNull();
      } finally {
        await prisma.attachment.delete({ where: { id: created.id } });
      }
    });
  });

  // REG-04 — BR-60: migrated Requesters hold REQUESTER, keep their activation
  // state, and the migration flags them for a password change.
  describe("REG-04: migrated credentials", () => {
    it("adds role defaulting to REQUESTER and mustChangePassword defaulting to true", () => {
      expect(migrationSql).toMatch(/ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER'/);
      expect(migrationSql).toMatch(/ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true/);
      // Activation state is never rewritten by the migration.
      expect(migrationSql).not.toMatch(/UPDATE "User" SET "isActive"/i);
    });

    it("keeps the Lab 2 requesters as REQUESTER, with activation state and a change flag", async () => {
      for (const r of REQUESTERS) {
        const user = await prisma.user.findUnique({ where: { email: r.email } });
        expect(user, r.email).not.toBeNull();
        expect(user!.role).toBe("REQUESTER");
        expect(user!.isActive).toBe(r.isActive);
        // BR-60: migrated Requesters are flagged for a password change, which also
        // gives the mandatory first-login-change flow a demonstrable account.
        expect(user!.mustChangePassword).toBe(true);
      }
    });
  });

  // REG-05 — BR-31: every pre-existing Ticket is given an IT Priority copied from
  // its Requested Priority during the migration.
  describe("REG-05: IT Priority backfill", () => {
    it("backfills itPriority from requestedPriority in the migration", () => {
      expect(migrationSql).toMatch(/UPDATE "Ticket" SET "itPriority" = "requestedPriority"/);
      expect(migrationSql).toMatch(/ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL/);
    });

    it("leaves no Ticket without an IT Priority", async () => {
      const tickets = await prisma.ticket.findMany({ select: { itPriority: true } });
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.every((t) => t.itPriority !== null)).toBe(true);
    });
  });

  // REG-07 — BR-62: the seed is idempotent — a second run creates no duplicates.
  describe("REG-07: seed idempotency", () => {
    it("creates no duplicate user, category, related system, comment, or note on re-run", async () => {
      const counts = () =>
        Promise.all([
          prisma.user.count(),
          prisma.category.count(),
          prisma.relatedSystem.count(),
          prisma.ticket.count(),
          prisma.publicComment.count(),
          prisma.internalNote.count(),
        ]);

      const before = await counts();
      await seed(prisma); // second run
      const after = await counts();

      expect(after).toEqual(before);
      // And the seeded totals match the source of truth.
      const [users, categories, systems] = after;
      expect(users).toBe(USERS.length);
      expect(categories).toBe(CATEGORY_NAMES.length);
      expect(systems).toBe(RELATED_SYSTEM_NAMES.length);
    });
  });
});
