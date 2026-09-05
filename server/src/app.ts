import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { requireRequester } from "./requesterContext.js";
import { allocateTicketNumber } from "./ticketNumber.js";
import { validateSummary, validateDescription, validatePriority } from "./validation.js";
import { normalizeTicketQuery } from "./ticketQuery.js";
import type { Prisma } from "@prisma/client";

// Exported without app.listen() — that lives in index.ts — so Supertest can
// import the app without opening a port.
export const app = express();

app.use(cors());          // lets the Vite dev server call this API
app.use(express.json());

// Lab 1 / Issue 2: health check the client uses to confirm the API is reachable.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// --- Public: the selector must load before any Requester exists in state -----

// Lab 2 / Issue #14: active Development Requesters for the selection screen.
// Public (api-spec §1.6); inactive Requesters never appear (BR-13, BR-20).
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Failed to load requesters" });
  }
});

// --- Scoped: every route below requires a valid X-Requester-Id ---------------

// Lab 1 / Issue 4, now scoped in Lab 2 (api-spec §1.6): the active IT request
// categories from PostgreSQL, in id order.
app.get("/api/categories", requireRequester, async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// Lab 2 / Issue #15: active Related Systems for the Create Ticket form. Fixed id
// order so the dropdown never reshuffles between loads (api-spec §2.3).
app.get("/api/related-systems", requireRequester, async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(systems);
  } catch {
    res.status(500).json({ error: "Failed to load related systems" });
  }
});

// Lab 2 / Issue #15: create one validated Ticket for the selected Requester. The
// Ticket Number is allocated inside the transaction so concurrent creates cannot
// collide (BR-01, BR-14). ticketNumber/ticketDate/currentStatus/requesterId in
// the body are ignored — the server owns them (BR-16, BR-18).
app.post("/api/tickets", requireRequester, async (req: Request, res: Response) => {
  const prisma = getPrisma();
  const body = req.body ?? {};
  const { categoryId, relatedSystemId, requestedPriority, summary, description } = body;

  const fields: Record<string, string> = {};

  const summaryError = validateSummary(summary);
  if (summaryError) fields.summary = summaryError;

  const descriptionError = validateDescription(description);
  if (descriptionError) fields.description = descriptionError;

  const priorityError = validatePriority(requestedPriority);
  if (priorityError) fields.requestedPriority = priorityError;

  try {
    // Reference ids must exist and be active (BR-41).
    const category = Number.isInteger(categoryId)
      ? await prisma.category.findFirst({ where: { id: categoryId, isActive: true } })
      : null;
    if (!category) fields.categoryId = "Select a valid category.";

    const relatedSystem = Number.isInteger(relatedSystemId)
      ? await prisma.relatedSystem.findFirst({ where: { id: relatedSystemId, isActive: true } })
      : null;
    if (!relatedSystem) fields.relatedSystemId = "Select a valid related system.";

    // Validate everything before any write — a 400 never leaves a partial Ticket.
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Validation failed", fields });
      return;
    }

    const year = new Date().getFullYear();
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await allocateTicketNumber(tx, year);
      return tx.ticket.create({
        data: {
          ticketNumber,
          requesterId: req.requester!.id,
          categoryId,
          relatedSystemId,
          requestedPriority,
          summary: String(summary).trim(),
          description: String(description).trim(),
        },
        select: {
          id: true,
          ticketNumber: true,
          currentStatus: true,
          ticketDate: true,
          requesterId: true,
        },
      });
    });

    res.status(201).json(ticket);
  } catch {
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

// Lab 2 / Issue #16: the selected Requester's Tickets, paginated. Ownership is
// always part of the where clause, so filters compose with it and can never widen
// the result set beyond the Requester's own Tickets (BR-27, BR-38). Invalid query
// parameters fall back to documented defaults, never 400 (BR-36).
app.get("/api/tickets", requireRequester, async (req: Request, res: Response) => {
  const q = normalizeTicketQuery(req.query as Record<string, unknown>);

  const where: Prisma.TicketWhereInput = {
    requesterId: req.requester!.id,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.relatedSystemId ? { relatedSystemId: q.relatedSystemId } : {}),
    ...(q.priority ? { requestedPriority: q.priority as Prisma.EnumRequestedPriorityFilter } : {}),
    ...(q.status ? { currentStatus: q.status as Prisma.EnumTicketStatusFilter } : {}),
    ...(q.search
      ? {
          OR: [
            { ticketNumber: { contains: q.search, mode: "insensitive" } },
            { summary: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // id DESC is the secondary key so ordering is deterministic on ties (BR-34).
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [q.sort]: q.order },
    { id: "desc" },
  ];

  try {
    const [totalItems, items] = await getPrisma().$transaction([
      getPrisma().ticket.count({ where }),
      getPrisma().ticket.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          requestedPriority: true,
          currentStatus: true,
          ticketDate: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.status(200).json({
      items,
      page: q.page,
      pageSize: q.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / q.pageSize),
    });
  } catch {
    res.status(500).json({ error: "Failed to load tickets" });
  }
});
