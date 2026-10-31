import type { PrismaClient, Prisma } from "@prisma/client";

/**
 * Removes test Tickets and everything that hangs off them. Status history is
 * append-only (BR-33): the database refuses to delete it, so a Ticket that has
 * history cannot be deleted either, and is left in place. Returns how many were
 * left.
 */
export async function removeTickets(prisma: PrismaClient, where: Prisma.TicketWhereInput): Promise<number> {
  const ids = (await prisma.ticket.findMany({ where, select: { id: true } })).map((t) => t.id);
  if (ids.length === 0) return 0;
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.attachment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: ids } } });
  const removed = await prisma.ticket.deleteMany({ where: { id: { in: ids }, statusChanges: { none: {} } } });
  return ids.length - removed.count;
}
