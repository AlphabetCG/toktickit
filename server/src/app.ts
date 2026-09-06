import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getPrisma } from "./prisma.js";
import { requireRequester } from "./requesterContext.js";
import { allocateTicketNumber } from "./ticketNumber.js";
import { validateSummary, validateDescription, validatePriority } from "./validation.js";
import { normalizeTicketQuery } from "./ticketQuery.js";
import {
  detectMimeType,
  isPermittedMime,
  isWithinSizeLimit,
  generateStoredFilename,
} from "./attachmentValidation.js";
import type { Prisma } from "@prisma/client";

// Attachments are stored on local disk; the database holds only metadata (D-03).
const UPLOAD_DIR = resolve(process.cwd(), "uploads");
void mkdir(UPLOAD_DIR, { recursive: true });

// In-memory so type and size are validated before anything is written to disk
// (BR-05); a hard cap guards against unbounded memory use.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).single("file");

// Strict positive-integer id; anything else is treated as not found.
function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

// Serialised attachment metadata — never exposes the stored filename or any path
// (BR-47, BR-50).
type AttachmentRow = {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
  removedBy: { id: number; name: string } | null;
};
function serializeAttachment(a: AttachmentRow) {
  return {
    id: a.id,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedAt: a.uploadedAt,
    removedAt: a.removedAt,
    removalReason: a.removalReason,
    removedBy: a.removedBy,
  };
}
const ATTACHMENT_SELECT = {
  id: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  uploadedAt: true,
  removedAt: true,
  removalReason: true,
  removedBy: { select: { id: true, name: true } },
} as const;

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

// Lab 2 / Issue #17: one owned Ticket with embedded attachment metadata. A ticket
// that does not exist, is not owned, or has a non-integer id all return the same
// 404 so the API never reveals another Requester's Ticket (BR-28, D-06).
app.get("/api/tickets/:id", requireRequester, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id, requesterId: req.requester!.id },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        description: true,
        requestedPriority: true,
        currentStatus: true,
        ticketDate: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: { select: ATTACHMENT_SELECT, orderBy: { uploadedAt: "asc" } },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.status(200).json({
      ...ticket,
      attachments: ticket.attachments.map(serializeAttachment),
    });
  } catch {
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// Attachment metadata for an owned Ticket, on its own so the panel can refresh.
app.get("/api/tickets/:id/attachments", requireRequester, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id, requesterId: req.requester!.id },
      select: { id: true },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const attachments = await getPrisma().attachment.findMany({
      where: { ticketId: id },
      select: ATTACHMENT_SELECT,
      orderBy: { uploadedAt: "asc" },
    });
    res.status(200).json(attachments.map(serializeAttachment));
  } catch {
    res.status(500).json({ error: "Unable to load attachments" });
  }
});

// Upload one attachment. Ownership → file present → size → detected type → active
// count are all checked before any disk write, so a rejected upload leaves nothing
// behind (BR-04, BR-05, BR-06, BR-30, BR-51).
app.post("/api/tickets/:id/attachments", requireRequester, (req: Request, res: Response) => {
  upload(req, res, async (uploadErr: unknown) => {
    if (uploadErr) {
      res.status(413).json({ error: "File exceeds the 5 MB limit." });
      return;
    }
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    try {
      const ticket = await getPrisma().ticket.findFirst({
        where: { id, requesterId: req.requester!.id },
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file supplied" });
        return;
      }
      if (!isWithinSizeLimit(file.size)) {
        res.status(413).json({ error: "File exceeds the 5 MB limit." });
        return;
      }
      const detected = detectMimeType(file.buffer);
      if (!isPermittedMime(detected)) {
        res.status(415).json({ error: "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF." });
        return;
      }

      // Removed attachments do not count toward the limit (BR-06, BR-56).
      const activeCount = await getPrisma().attachment.count({
        where: { ticketId: id, removedAt: null },
      });
      if (activeCount >= 5) {
        res.status(409).json({ error: "Maximum of 5 attachments reached." });
        return;
      }

      const storedFilename = generateStoredFilename(detected as string);
      try {
        await writeFile(join(UPLOAD_DIR, storedFilename), file.buffer);
      } catch {
        res.status(500).json({ error: "Unable to store attachment" });
        return;
      }

      const created = await getPrisma().attachment.create({
        data: {
          ticketId: id,
          originalFilename: file.originalname,
          storedFilename,
          mimeType: detected as string,
          sizeBytes: file.size,
          uploadedById: req.requester!.id,
        },
        select: { id: true, ticketId: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true },
      });
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: "Unable to store attachment" });
    }
  });
});

// Download an active attachment. A removed, not-owned, or missing attachment all
// return the same 404, so a guessed id reveals nothing (BR-08, BR-29, AC-32).
app.get("/api/attachments/:id/download", requireRequester, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  try {
    const attachment = await getPrisma().attachment.findFirst({
      where: { id, removedAt: null, ticket: { requesterId: req.requester!.id } },
      select: { storedFilename: true, originalFilename: true, mimeType: true },
    });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.setHeader("Content-Type", attachment.mimeType);
    // Quote and escape the original name; the stored UUID name is never exposed.
    const safeName = attachment.originalFilename.replace(/["\\]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);

    const stream = createReadStream(join(UPLOAD_DIR, attachment.storedFilename));
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "Unable to read attachment" });
    });
    stream.pipe(res);
  } catch {
    res.status(500).json({ error: "Unable to read attachment" });
  }
});

// Soft-remove an attachment with a mandatory reason. Ownership is checked before
// validation so probing another Requester's ids yields 404, not a 400 that would
// confirm existence (BR-07, BR-53, BR-54).
app.delete("/api/attachments/:id", requireRequester, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  try {
    const attachment = await getPrisma().attachment.findFirst({
      where: { id, ticket: { requesterId: req.requester!.id } },
      select: { id: true, removedAt: true },
    });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 200) {
      res.status(400).json({
        error: "Validation failed",
        fields: { reason: "A removal reason of 3–200 characters is required." },
      });
      return;
    }
    if (attachment.removedAt !== null) {
      res.status(409).json({ error: "Attachment has already been removed." });
      return;
    }

    const updated = await getPrisma().attachment.update({
      where: { id },
      data: { removedAt: new Date(), removedById: req.requester!.id, removalReason: reason },
      select: {
        id: true,
        removedAt: true,
        removalReason: true,
        removedBy: { select: { id: true, name: true } },
      },
    });
    res.status(200).json(updated);
  } catch {
    res.status(500).json({ error: "Unable to remove attachment" });
  }
});
