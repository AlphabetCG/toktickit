import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  formatTicketNumber,
  allocateTicketNumber,
  TICKET_NUMBER_REGEX,
} from "../../src/ticketNumber.js";

// UNIT-01 (format) is pure; UNIT-02 (increment + yearly restart) exercises the
// real atomic allocation against sacrificial years so it never touches the
// current year's live sequence.
const prisma = new PrismaClient();
const YEAR_A = 2999;
const YEAR_B = 3000;

describe("Ticket Number", () => {
  afterAll(async () => {
    await prisma.ticketNumberSequence.deleteMany({ where: { year: { in: [YEAR_A, YEAR_B] } } });
    await prisma.$disconnect();
  });

  // UNIT-01 — AC-09, BR-14
  it("formats as TKT-YYYY-NNNNNN with a zero-padded six-digit sequence", () => {
    expect(formatTicketNumber(2026, 1)).toBe("TKT-2026-000001");
    expect(formatTicketNumber(2026, 42)).toBe("TKT-2026-000042");
    expect(formatTicketNumber(2026, 123456)).toBe("TKT-2026-123456");
    expect(formatTicketNumber(2026, 1)).toMatch(TICKET_NUMBER_REGEX);
  });

  // UNIT-02 — AC-09, BR-14
  it("increments within a year and restarts each year", async () => {
    await prisma.ticketNumberSequence.deleteMany({ where: { year: { in: [YEAR_A, YEAR_B] } } });

    const first = await prisma.$transaction((tx) => allocateTicketNumber(tx, YEAR_A));
    const second = await prisma.$transaction((tx) => allocateTicketNumber(tx, YEAR_A));
    expect(first).toBe("TKT-2999-000001");
    expect(second).toBe("TKT-2999-000002");

    // A new year restarts the sequence at 1.
    const nextYear = await prisma.$transaction((tx) => allocateTicketNumber(tx, YEAR_B));
    expect(nextYear).toBe("TKT-3000-000001");
  });
});
