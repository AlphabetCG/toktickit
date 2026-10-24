import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";
import { seed, USERS, LAB4_USERS, SEED_TICKETS } from "../../prisma/seed.js";

// REG-01…REG-05 (docs/lab-04/tests.md §2.6). Talks to the real database, so run
// `npm run prisma:migrate` first. As in Lab 3, two kinds of evidence:
//   • the migration SQL text proves the *mechanism* is additive, which a fresh
//     reset cannot show because there is no pre-migration data to observe; and
//   • the migrated + seeded database proves the invariants the migration and the
//     seed are responsible for.
const prisma = new PrismaClient();

const MIGRATION = "lab4_actions_workflow_dashboards";
const migrationSql = (() => {
  const dir = join(process.cwd(), "prisma", "migrations");
  const folder = readdirSync(dir).find((f) => f.endsWith(`_${MIGRATION}`));
  if (!folder) throw new Error("Lab 4 migration folder not found");
  return readFileSync(join(dir, folder, "migration.sql"), "utf8");
})();

// Comments stripped, so a statement named only in a comment cannot satisfy or
// fail an assertion.
const sqlStatements = migrationSql.replace(/--.*$/gm, "");

const SEEDED_NUMBERS = SEED_TICKETS.map((t) => t.ticketNumber);

beforeAll(async () => {
  await seed(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// REG-01 — AC-55, BR-54
describe("REG-01: the migration is additive", () => {
  it("drops, renames, and retypes nothing", () => {
    expect(sqlStatements).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)\b/i);
    expect(sqlStatements).not.toMatch(/\bRENAME\b/i);
    expect(sqlStatements).not.toMatch(/ALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE/i);
    expect(sqlStatements).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("gives every existing Ticket version 1 in the same statement that adds the column", () => {
    expect(sqlStatements).toMatch(/ALTER TABLE "Ticket" ADD COLUMN\s+"version" INTEGER NOT NULL DEFAULT 1/);
  });

  it("backfills resolvedAt and one history row per Ticket, then creates the trigger", () => {
    const resolvedBackfill = sqlStatements.search(
      /UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN \('RESOLVED',\s*'CLOSED'\)/
    );
    const historyBackfill = sqlStatements.search(/INSERT INTO "TicketStatusChange"[\s\S]*?SELECT[\s\S]*?FROM "Ticket"/);
    const trigger = sqlStatements.search(/CREATE TRIGGER "TicketStatusChange_append_only"/);
    expect(resolvedBackfill).toBeGreaterThan(-1);
    expect(historyBackfill).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(historyBackfill); // §7.3 step 7 after step 6
  });

  it("adds both CHECK constraints", () => {
    expect(sqlStatements).toMatch(/CONSTRAINT "ActionTaken_followUp_note"\s+CHECK/);
    expect(sqlStatements).toMatch(/CONSTRAINT "ActionTaken_completed_result"\s+CHECK/);
  });

  it("leaves no drift between the migrated database and schema.prisma", () => {
    // --exit-code: 0 = no difference, 2 = difference. execFileSync throws on non-zero.
    const run = () =>
      execFileSync(
        "npx",
        ["prisma", "migrate", "diff", "--from-url", process.env.DATABASE_URL!, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"],
        { stdio: "pipe", shell: process.platform === "win32" }
      );
    expect(run).not.toThrow();
  }, 60_000);
});

// REG-02 — AC-55, BR-55, BR-56
describe("REG-02: every Lab 3 row survives with its invariants", () => {
  // The Tickets the migration is responsible for: those that existed when it was
  // applied. Tickets created later get their history from the workflow (BR-32).
  let legacyIds: number[];

  beforeAll(async () => {
    const [applied] = await prisma.$queryRaw<{ finished_at: Date }[]>`
      SELECT finished_at FROM "_prisma_migrations" WHERE migration_name LIKE ${"%_" + MIGRATION}`;
    expect(applied?.finished_at).toBeInstanceOf(Date);
    legacyIds = (
      await prisma.ticket.findMany({ where: { createdAt: { lte: applied.finished_at } }, select: { id: true } })
    ).map((t) => t.id);
  });

  it("gives every Ticket a version of at least 1", async () => {
    expect(await prisma.ticket.count({ where: { version: { lt: 1 } } })).toBe(0);
  });

  it("gives every pre-migration Ticket a history whose first entry is a creation or a backfill", async () => {
    expect(legacyIds.length).toBeGreaterThan(0);
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: legacyIds } },
      select: { requesterId: true, statusChanges: { orderBy: [{ changedAt: "asc" }, { id: "asc" }] } },
    });
    for (const t of tickets) {
      expect(t.statusChanges.length).toBeGreaterThan(0);
      const [first] = t.statusChanges;
      expect(first.fromStatus).toBeNull();
      // backfill: no actor; creation: the Requester (BR-32)
      expect([null, t.requesterId]).toContain(first.changedById);
    }
  });

  // Scoped like the history check: keeping resolvedAt current on later
  // transitions is the workflow's job (BR-31, Issue #51), not the migration's.
  it("gives every pre-migration Resolved or Closed Ticket a resolvedAt", async () => {
    expect(
      await prisma.ticket.count({
        where: { id: { in: legacyIds }, currentStatus: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: null },
      })
    ).toBe(0);
  });

  it("keeps every Lab 3 relation resolvable", async () => {
    const orphans = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT
        (SELECT count(*) FROM "Ticket" t LEFT JOIN "User" u ON u.id = t."requesterId" WHERE u.id IS NULL)
      + (SELECT count(*) FROM "Ticket" t LEFT JOIN "User" u ON u.id = t."ownerId" WHERE t."ownerId" IS NOT NULL AND u.id IS NULL)
      + (SELECT count(*) FROM "Attachment" a LEFT JOIN "Ticket" t ON t.id = a."ticketId" WHERE t.id IS NULL)
      + (SELECT count(*) FROM "PublicComment" c LEFT JOIN "Ticket" t ON t.id = c."ticketId" WHERE t.id IS NULL)
      + (SELECT count(*) FROM "InternalNote" n LEFT JOIN "Ticket" t ON t.id = n."ticketId" WHERE t.id IS NULL)
      + (SELECT count(*) FROM "Session" s LEFT JOIN "User" u ON u.id = s."userId" WHERE u.id IS NULL) AS n`;
    expect(Number(orphans[0].n)).toBe(0);
  });
});

// REG-03 — AC-35, BR-33
describe("REG-03: status history is append-only in the database", () => {
  // Each attempt runs in a transaction that always rolls back, so even with the
  // trigger missing the test fails without rewriting real history.
  const attempt = (sql: Prisma.Sql) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw(sql);
      throw new Error("the write was not rejected");
    });

  it("rejects UPDATE and DELETE and leaves the row unchanged", async () => {
    const row = await prisma.ticketStatusChange.findFirstOrThrow({ orderBy: { id: "asc" } });

    await expect(
      attempt(Prisma.sql`UPDATE "TicketStatusChange" SET "toStatus" = 'CANCELLED' WHERE id = ${row.id}`)
    ).rejects.toThrow(/append-only/);
    await expect(attempt(Prisma.sql`DELETE FROM "TicketStatusChange" WHERE id = ${row.id}`)).rejects.toThrow(
      /append-only/
    );

    expect(await prisma.ticketStatusChange.findUnique({ where: { id: row.id } })).toEqual(row);
  });
});

// REG-04 — AC-57, BR-58
describe("REG-04: the seed is idempotent", () => {
  async function counts() {
    const tables = Prisma.dmmf.datamodel.models.map((m) => m.name);
    const out: Record<string, number> = {};
    for (const table of tables) {
      const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
      out[table] = Number(n);
    }
    return out;
  }

  it("leaves the row count of every table identical after a second run", async () => {
    await seed(prisma);
    const first = await counts();
    await seed(prisma);
    expect(await counts()).toEqual(first);
  }, 60_000);
});

// REG-05 — BR-59
describe("REG-05: the seed covers every dashboard and workflow case", () => {
  const seededTickets = () =>
    prisma.ticket.findMany({
      where: { ticketNumber: { in: SEEDED_NUMBERS } },
      include: { actions: { orderBy: [{ actionAt: "asc" }, { id: "asc" }] } },
    });

  it("covers all 8 statuses, all 3 IT Priorities, assigned and unassigned", async () => {
    const tickets = await seededTickets();
    expect(new Set(tickets.map((t) => t.currentStatus)).size).toBe(8);
    expect(new Set(tickets.map((t) => t.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
    expect(tickets.some((t) => t.ownerId === null)).toBe(true);
    expect(tickets.some((t) => t.ownerId !== null)).toBe(true);
  });

  it("has Tickets with zero, exactly one, and three or more Actions Taken, in all four action statuses", async () => {
    const tickets = await seededTickets();
    const sizes = tickets.map((t) => t.actions.length);
    expect(sizes).toContain(0);
    expect(sizes).toContain(1);
    expect(sizes.some((n) => n >= 3)).toBe(true);
    const statuses = new Set(tickets.flatMap((t) => t.actions.map((a) => a.status)));
    expect(statuses).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
  });

  it("has an action performed by someone other than the Ticket Owner (BR-02)", async () => {
    const tickets = await seededTickets();
    expect(tickets.some((t) => t.ownerId !== null && t.actions.some((a) => a.performedById !== t.ownerId))).toBe(true);
  });

  it("has an active Ticket whose latest Completed action requests follow-up", async () => {
    const tickets = await seededTickets();
    const pending = tickets.filter((t) => {
      if (["RESOLVED", "CLOSED", "CANCELLED"].includes(t.currentStatus)) return false;
      const completed = t.actions.filter((a) => a.status === "COMPLETED");
      return completed.length > 0 && completed[completed.length - 1].followUpRequired;
    });
    expect(pending.length).toBeGreaterThan(0);
  });

  it("gives every seeded Ticket a status history", async () => {
    const withoutHistory = await prisma.ticket.count({
      where: { ticketNumber: { in: SEEDED_NUMBERS }, statusChanges: { none: {} } },
    });
    expect(withoutHistory).toBe(0);
  });

  it("has an active Requester with no Tickets and an active IT Staff member with no work", async () => {
    const accounts = await prisma.user.findMany({
      where: { email: { in: LAB4_USERS.map((u) => u.email) }, isActive: true },
      include: {
        _count: { select: { submittedTickets: true, ownedTickets: true, actionsPerformed: true, actionsCreated: true } },
      },
    });
    expect(accounts.some((u) => u.role === "REQUESTER" && u._count.submittedTickets === 0)).toBe(true);
    expect(
      accounts.some(
        (u) =>
          u.role === "IT_STAFF" &&
          u._count.ownedTickets === 0 &&
          u._count.actionsPerformed === 0 &&
          u._count.actionsCreated === 0
      )
    ).toBe(true);
  });

  it("seeds two active Administrators", async () => {
    const admins = [...USERS, ...LAB4_USERS].filter((u) => u.role === "ADMINISTRATOR" && u.isActive);
    expect(admins.length).toBeGreaterThanOrEqual(2);
    const stored = await prisma.user.count({
      where: { email: { in: admins.map((a) => a.email) }, role: "ADMINISTRATOR", isActive: true },
    });
    expect(stored).toBe(admins.length);
  });
});
