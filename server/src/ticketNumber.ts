import type { Prisma } from "@prisma/client";

// Official Ticket Number: TKT-YYYY-NNNNNN, six-digit zero-padded sequence that
// restarts each year (BR-14, D-01).
export const TICKET_NUMBER_REGEX = /^TKT-\d{4}-\d{6}$/;

export function formatTicketNumber(year: number, sequence: number): string {
  return `TKT-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Allocates the next Ticket Number for a year and returns it. **Must run inside
 * the same transaction that inserts the Ticket** (call it with a Prisma
 * transaction client) so the number and the Ticket commit together — the
 * concern @copter549365 raised on PR #22, and what specification §7.3 requires.
 *
 * `increment` compiles to `SET "lastValue" = "lastValue" + 1`, which is atomic at
 * the row level, so two concurrent creates can never read the same value and
 * produce a duplicate number (BR-01).
 */
export async function allocateTicketNumber(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  const row = await tx.ticketNumberSequence.upsert({
    where: { year },
    update: { lastValue: { increment: 1 } },
    create: { year, lastValue: 1 },
  });
  return formatTicketNumber(year, row.lastValue);
}
