import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getPrisma } from "./prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "./auth.js";
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  validateNewPassword,
  DUMMY_HASH,
} from "./password.js";
import {
  createSession,
  deleteSessionByToken,
  deleteOtherSessions,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./session.js";
import { allocateTicketNumber } from "./ticketNumber.js";
import { validateSummary, validateDescription, validatePriority, validateCommentBody } from "./validation.js";
import { normalizeTicketQuery } from "./ticketQuery.js";
import { normalizeQueueQuery } from "./queueQuery.js";
import { wouldKeepAnActiveAdmin } from "./adminRules.js";
import {
  isStatus,
  STATUSES,
  isTerminal,
  isTransitionPermitted,
  permittedTransitions,
  STATUS_LABEL,
  TERMINAL,
  type Status,
} from "./transitions.js";
import {
  detectMimeType,
  isPermittedMime,
  isWithinSizeLimit,
  generateStoredFilename,
} from "./attachmentValidation.js";
import {
  parseActionInput,
  actionRuleErrors,
  isActionFinal,
  isActionTransitionPermitted,
  ACTION_STATUS_LABEL,
  CLIENT_REQUEST_ID_MAX,
  type ActionValues,
  type ActionStatusValue,
} from "./actionRules.js";
import { evaluateResolutionGate, gatedTransitions } from "./resolutionGate.js";
import { ACTIVE_STATUSES, windowStart, cutText } from "./dashboardRules.js";
import type { Prisma } from "@prisma/client";

// The Vite dev origin. A wildcard is incompatible with credentialed requests and
// would defeat the cookie's SameSite protection (api-spec §1.1, D-05).
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

// Serialised login/me identity — never carries a password field of any kind.
function serializeIdentity(u: { id: number; name: string; email: string; role: string; mustChangePassword: boolean }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword };
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
    secure: process.env.NODE_ENV === "production",
  });
}

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

// The §6.1 matrix's ticket scope: a Requester reaches only their own ticket, IT
// Staff and Administrators reach any. Spread into a Prisma where so every ticket
// and attachment route applies the same rule; a ticket outside the scope is the
// same 404 as a missing one (BR-15).
//
// Administrator ticket access is a deliberate, approved decision, not a side
// effect of this if/else: specification.md §6.1 grants Administrators "any" for
// ticket detail, attachments, and Public Comments, and its "Why Administrator
// holds Ticket operations" note records the reason (handout §4.5 lets an
// Administrator own a ticket and set IT Priority). Rows marked "—" for
// Administrators are enforced separately — e.g. resolution-signal refuses every
// non-Requester with 403, and Internal Notes refuse every Requester.
function ticketScope(user: { id: number; role: string }): Prisma.TicketWhereInput {
  return user.role === "REQUESTER" ? { requesterId: user.id } : {};
}

async function findAccessibleTicket(id: number, user: { id: number; role: string }) {
  return getPrisma().ticket.findFirst({
    where: { id, ...ticketScope(user) },
    select: { id: true, currentStatus: true, requesterId: true },
  });
}

const TERMINAL_STATUSES: readonly string[] = TERMINAL;

// Public Comment / Internal Note serialised shape (author role included so the UI
// can label the speaker without a second lookup — api-spec §4.1).
function serializeComment(c: {
  id: number;
  body: string;
  createdAt: Date;
  author: { id: number; name: string; role: string };
}) {
  return { id: c.id, body: c.body, author: c.author, createdAt: c.createdAt };
}
const COMMENT_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} as const;

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

// Credentialed CORS with an explicit origin so the session cookie travels from
// the Vite dev server (api-spec §1.1).
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Lab 1 / Issue 2: health check the client uses to confirm the API is reachable.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// --- Authentication (api-spec §2) --------------------------------------------

// POST /api/auth/login — public. Verifies the password before the activation
// check so the deactivation message reaches only someone who holds the credential
// (BR-06, D-07). Unknown email and wrong password return a byte-identical 401, and
// an unknown email still runs a bcrypt comparison so the paths cannot be timed
// apart (api-spec §2.1).
const INCORRECT = { error: "Email or password is incorrect." };

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const fields: Record<string, string> = {};
  if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "Email is required.";
  if (typeof body.password !== "string" || body.password === "") fields.password = "Password is required.";
  if (Object.keys(fields).length > 0) {
    res.status(400).json({ error: "Validation failed", fields });
    return;
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(body.email) } });
    const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);

    // Unknown email or wrong password — identical response, no session (AC-03/04/06).
    if (!user || !ok) {
      res.status(401).json(INCORRECT);
      return;
    }
    // Correct password but deactivated — the only case that reveals deactivation (AC-05).
    if (!user.isActive) {
      res.status(401).json({ error: "This account is deactivated. Contact an administrator." });
      return;
    }

    const token = await createSession(prisma, user.id);
    setSessionCookie(res, token);
    res.status(200).json(serializeIdentity(user));
  } catch {
    res.status(500).json({ error: "Unable to sign in" });
  }
});

// POST /api/auth/logout — authenticated. Deletes the session row so the cookie is
// inert even if replayed; a second call returns 401 (AC-07, api-spec §2.2).
app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string") await deleteSessionByToken(getPrisma(), token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Unable to sign out" });
  }
});

// GET /api/auth/me — authenticated, exempt from the password gate so the client
// can discover it must route to the change screen (api-spec §2.3).
app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
  res.status(200).json(serializeIdentity(req.user!));
});

// POST /api/auth/password — authenticated, exempt from the password gate. Serves
// both the mandatory first-login change and a voluntary one. On success clears the
// flag and deletes every *other* session for the user (BR-10, BR-11, api-spec §2.4).
app.post("/api/auth/password", requireAuth, async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    // A generic message that confirms nothing about the account (api-spec §2.4).
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: "Validation failed", fields: { currentPassword: "Current password is incorrect." } });
      return;
    }
    const policyError = validateNewPassword(newPassword, currentPassword);
    if (policyError) {
      res.status(400).json({ error: "Validation failed", fields: { newPassword: policyError } });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    await deleteOtherSessions(prisma, user.id, req.sessionId!);
    res.status(200).json({ ok: true, mustChangePassword: false });
  } catch {
    res.status(500).json({ error: "Unable to change password" });
  }
});

// --- Scoped: every route below requires an authenticated session -------------

// Lab 1 / Issue 4, now scoped in Lab 2 (api-spec §1.6): the active IT request
// categories from PostgreSQL, in id order.
app.get("/api/categories", requireAuth, requirePasswordChanged, async (_req: Request, res: Response) => {
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
app.get("/api/related-systems", requireAuth, requirePasswordChanged, async (_req: Request, res: Response) => {
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
app.post("/api/tickets", requireAuth, requirePasswordChanged, requireRole("REQUESTER"), async (req: Request, res: Response) => {
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
      const created = await tx.ticket.create({
        data: {
          ticketNumber,
          requesterId: req.user!.id,
          categoryId,
          relatedSystemId,
          requestedPriority,
          // IT Priority starts as a copy of the Requested Priority (BR-30, BR-31);
          // IT Staff can change it independently in a later Lab 3 issue.
          itPriority: requestedPriority,
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
      // Lab 4 BR-32: creation is the first history entry, by the Requester.
      await tx.ticketStatusChange.create({
        data: { ticketId: created.id, fromStatus: null, toStatus: "NEW", changedById: req.user!.id },
      });
      return created;
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
app.get("/api/tickets", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const q = normalizeTicketQuery(req.query as Record<string, unknown>);

  const where: Prisma.TicketWhereInput = {
    requesterId: req.user!.id,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.relatedSystemId ? { relatedSystemId: q.relatedSystemId } : {}),
    ...(q.priority ? { requestedPriority: q.priority as Prisma.EnumRequestedPriorityFilter } : {}),
    ...(q.status ? { currentStatus: q.status as Prisma.EnumTicketStatusFilter } : {}),
    ...(q.statusGroup === "active" ? { currentStatus: { in: [...ACTIVE_STATUSES] } } : {}),
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
app.get("/api/tickets/:id", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id, ...ticketScope(req.user!) },
      select: {
        id: true,
        ticketNumber: true,
        summary: true,
        description: true,
        requestedPriority: true,
        itPriority: true,
        currentStatus: true,
        ticketDate: true,
        resolutionSignalledAt: true,
        createdAt: true,
        updatedAt: true,
        version: true,
        resolvedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        attachments: { select: ATTACHMENT_SELECT, orderBy: { uploadedAt: "asc" } },
        publicComments: { select: COMMENT_SELECT, orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const body = {
      ...ticket,
      attachments: ticket.attachments.map(serializeAttachment),
      publicComments: ticket.publicComments.map(serializeComment),
    };

    // Role-shaped (api-spec §3.2). A Requester's body OMITS the internalNotes key
    // entirely — not an empty array, which would still confirm notes exist (AC-40).
    if (req.user!.role === "REQUESTER") {
      res.status(200).json(body);
      return;
    }
    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: id },
      select: COMMENT_SELECT,
      orderBy: { createdAt: "asc" },
    });
    // Computed on every staff read, even when RESOLVED is not reachable, so the
    // UI can explain the rule in advance (api-spec §3.1, BR-28).
    const resolutionGate = evaluateResolutionGate(
      await getPrisma().actionTaken.findMany({
        where: { ticketId: id },
        select: { id: true, status: true, actionAt: true, followUpRequired: true },
      })
    );
    res.status(200).json({
      ...body,
      internalNotes: notes.map(serializeComment),
      resolutionGate,
      permittedTransitions: gatedTransitions(ticket.currentStatus as Status, resolutionGate.satisfied),
    });
  } catch {
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// Attachment metadata for an owned Ticket, on its own so the panel can refresh.
app.get("/api/tickets/:id/attachments", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await getPrisma().ticket.findFirst({
      where: { id, ...ticketScope(req.user!) },
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
app.post("/api/tickets/:id/attachments", requireAuth, requirePasswordChanged, (req: Request, res: Response) => {
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
        where: { id, ...ticketScope(req.user!) },
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
          uploadedById: req.user!.id,
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
app.get("/api/attachments/:id/download", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  try {
    const attachment = await getPrisma().attachment.findFirst({
      where: { id, removedAt: null, ticket: ticketScope(req.user!) },
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
app.delete("/api/attachments/:id", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  try {
    const attachment = await getPrisma().attachment.findFirst({
      where: { id, ticket: ticketScope(req.user!) },
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
      data: { removedAt: new Date(), removedById: req.user!.id, removalReason: reason },
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

// --- Public Comments and the Requester's resolution signal (api-spec §4) ------

// GET /api/tickets/:id/comments — owner / staff / admin. Ordered oldest-first so
// the thread reads like a conversation (api-spec §4.1).
app.get("/api/tickets/:id/comments", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await findAccessibleTicket(id, req.user!);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId: id },
      select: COMMENT_SELECT,
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(comments.map(serializeComment));
  } catch {
    res.status(500).json({ error: "Unable to load comments" });
  }
});

// POST /api/tickets/:id/comments — owner / staff / admin. Author and timestamp are
// server-owned; a closed or cancelled ticket can no longer be commented on
// (api-spec §4.2). Ownership is checked before validation so probing another
// requester's ticket yields 404, not a 400 that confirms existence.
app.post("/api/tickets/:id/comments", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await findAccessibleTicket(id, req.user!);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const bodyError = validateCommentBody(req.body?.body);
    if (bodyError) {
      res.status(400).json({ error: "Validation failed", fields: { body: bodyError } });
      return;
    }
    if (TERMINAL_STATUSES.includes(ticket.currentStatus)) {
      res.status(409).json({ error: "This ticket is closed and can no longer be updated." });
      return;
    }

    const created = await getPrisma().publicComment.create({
      data: { ticketId: id, authorId: req.user!.id, body: String(req.body.body).trim() },
      select: COMMENT_SELECT,
    });
    res.status(201).json(serializeComment(created));
  } catch {
    res.status(500).json({ error: "Unable to add comment" });
  }
});

// POST /api/tickets/:id/resolution-signal — the owning Requester only. Records a
// current opinion that the problem looks fixed; it never changes currentStatus,
// which is returned unchanged as proof (api-spec §4.3, BR-23). Signalling twice
// overwrites the timestamp rather than erroring.
app.post("/api/tickets/:id/resolution-signal", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  // Only the requester may signal — a distinct 403 message, so not requireRole.
  if (req.user!.role !== "REQUESTER") {
    res.status(403).json({ error: "Only the requester can signal resolution." });
    return;
  }
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const ticket = await findAccessibleTicket(id, req.user!);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (TERMINAL_STATUSES.includes(ticket.currentStatus)) {
      res.status(409).json({ error: "This ticket is closed and can no longer be updated." });
      return;
    }

    const updated = await getPrisma().ticket.update({
      where: { id },
      data: { resolutionSignalledAt: new Date(), resolutionSignalledById: req.user!.id },
      select: {
        currentStatus: true,
        resolutionSignalledAt: true,
        resolutionSignalledBy: { select: { id: true, name: true } },
      },
    });
    res.status(200).json(updated);
  } catch {
    res.status(500).json({ error: "Unable to signal resolution" });
  }
});

// --- IT Staff queue (api-spec §7) ---------------------------------------------

// GET /api/staff/tickets — IT Staff and Administrators. Every ticket regardless of
// submitter, with the §9.3 query contract. `itPriority` sorts by severity because
// PostgreSQL orders an enum by declaration (LOW < MEDIUM < HIGH), not alphabetically.
// `counts` are whole-queue header figures, independent of the current filters.
app.get(
  "/api/staff/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const q = normalizeQueueQuery(req.query as Record<string, unknown>);
    const me = req.user!.id;

    const ownerWhere: Prisma.TicketWhereInput =
      q.owner?.kind === "unassigned" ? { ownerId: null }
      : q.owner?.kind === "me" ? { ownerId: me }
      : q.owner?.kind === "user" ? { ownerId: q.owner.id }
      : {};

    const where: Prisma.TicketWhereInput = {
      ...ownerWhere,
      ...(q.status ? { currentStatus: q.status as Prisma.EnumTicketStatusFilter } : {}),
      ...(q.statusGroup === "active" ? { currentStatus: { in: [...ACTIVE_STATUSES] } } : {}),
      ...(q.itPriority ? { itPriority: q.itPriority as Prisma.EnumRequestedPriorityFilter } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search
        ? {
            OR: [
              { ticketNumber: { contains: q.search, mode: "insensitive" } },
              { summary: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [{ [q.sort]: q.order }, { id: "desc" }];

    try {
      const prisma = getPrisma();
      const [totalItems, rows, unassigned, mine] = await prisma.$transaction([
        prisma.ticket.count({ where }),
        prisma.ticket.findMany({
          where,
          orderBy,
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            ticketDate: true,
            updatedAt: true,
            resolutionSignalledAt: true,
            category: { select: { id: true, name: true } },
            requester: { select: { id: true, name: true } },
            owner: { select: { id: true, name: true } },
          },
        }),
        prisma.ticket.count({ where: { ownerId: null } }),
        prisma.ticket.count({ where: { ownerId: me } }),
      ]);

      // Description is omitted (unbounded, never rendered in a row); the signal is
      // a boolean because the queue only needs the chip (api-spec §7.1).
      const items = rows.map(({ resolutionSignalledAt, ...t }) => ({
        ...t,
        resolutionSignalled: resolutionSignalledAt !== null,
      }));

      res.status(200).json({
        items,
        page: q.page,
        pageSize: q.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / q.pageSize),
        counts: { unassigned, mine },
      });
    } catch {
      res.status(500).json({ error: "Failed to load the ticket queue" });
    }
  }
);

// GET /api/staff/assignees — active IT Staff and Administrators, by name. Just
// enough to hand over a ticket: no email, activation flag, or timestamps (§7.2).
app.get(
  "/api/staff/assignees",
  requireAuth,
  requirePasswordChanged,
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (_req: Request, res: Response) => {
    try {
      const users = await getPrisma().user.findMany({
        where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      });
      res.status(200).json(users);
    } catch {
      res.status(500).json({ error: "Failed to load assignees" });
    }
  }
);

// --- Ticket operations: IT Staff and Administrator (api-spec §6) ---------------

const STAFF = ["IT_STAFF", "ADMINISTRATOR"] as const;

// --- Ticket operations: version-checked (Lab 4, api-spec §3.2, §3.3) ---------

const STALE_TICKET = "This ticket was changed by someone else. Reload to see the latest version.";
const VERSION_MESSAGE = "Reload the ticket and try again.";

// BR-39: every Ticket write sends the version the client last read.
const isVersion = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

// What a client needs to redraw after a stale write, and nothing it could not
// already read (api-spec §1.1).
async function ticketCurrent(tx: Prisma.TransactionClient, id: number) {
  return tx.ticket.findUniqueOrThrow({
    where: { id },
    select: { version: true, currentStatus: true, itPriority: true, owner: { select: { id: true, name: true } } },
  });
}

async function gateFor(tx: Prisma.TransactionClient, ticketId: number) {
  const actions = await tx.actionTaken.findMany({
    where: { ticketId },
    select: { id: true, status: true, actionAt: true, followUpRequired: true },
  });
  return evaluateResolutionGate(actions);
}

// PATCH /api/tickets/:id/owner — claim (own id), reassign (another id), and release
// (null) through one endpoint, since they are one state change on one field. Only
// an active IT Staff or Administrator may own a ticket (BR-26, BR-28); a
// deactivated owner keeps tickets already assigned (BR-29), so the rule applies
// only to the new owner being written. Lab 4: version-checked (BR-61).
app.patch(
  "/api/tickets/:id/owner",
  requireAuth,
  requirePasswordChanged,
  requireRole(...STAFF),
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const fields: Record<string, string> = {};
      const expectedVersion = req.body?.expectedVersion;
      if (!isVersion(expectedVersion)) fields.expectedVersion = VERSION_MESSAGE;
      const raw = req.body?.ownerId;
      let ownerId: number | null = null;
      if (raw === null) {
        ownerId = null;
      } else if (Number.isInteger(raw) && raw > 0) {
        const candidate = await prisma.user.findUnique({
          where: { id: raw },
          select: { role: true, isActive: true },
        });
        const fieldError = !candidate
          ? "That user does not exist."
          : candidate.role === "REQUESTER"
            ? "Ticket owner must be IT Staff or an Administrator."
            : !candidate.isActive
              ? "That user is deactivated."
              : null;
        if (fieldError) fields.ownerId = fieldError;
        ownerId = raw;
      } else {
        fields.ownerId = "Choose an owner, or null to release the ticket.";
      }
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Validation failed", fields });
        return;
      }

      const outcome = await prisma.$transaction(async (tx) => {
        const written = await tx.ticket.updateMany({
          where: { id, version: expectedVersion as number },
          data: { ownerId, version: { increment: 1 } },
        });
        if (written.count === 0) return { ok: false as const, current: await ticketCurrent(tx, id) };
        return {
          ok: true as const,
          ticket: await tx.ticket.findUniqueOrThrow({
            where: { id },
            select: { id: true, owner: { select: { id: true, name: true } }, version: true },
          }),
        };
      });
      if (!outcome.ok) {
        res.status(409).json({ error: STALE_TICKET, conflict: "stale", current: outcome.current });
        return;
      }
      res.status(200).json(outcome.ticket);
    } catch {
      res.status(500).json({ error: "Unable to update the owner" });
    }
  }
);

// PATCH /api/tickets/:id/it-priority — sets only IT Priority; Requested Priority is
// immutable after creation, and both are returned so the caller can see they are
// now independent (BR-30, AC-36). Lab 4: version-checked (BR-61).
app.patch(
  "/api/tickets/:id/it-priority",
  requireAuth,
  requirePasswordChanged,
  requireRole(...STAFF),
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      const fields: Record<string, string> = {};
      const expectedVersion = req.body?.expectedVersion;
      if (!isVersion(expectedVersion)) fields.expectedVersion = VERSION_MESSAGE;
      const priorityError = validatePriority(req.body?.itPriority);
      if (priorityError) fields.itPriority = priorityError;
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Validation failed", fields });
        return;
      }

      const outcome = await prisma.$transaction(async (tx) => {
        const written = await tx.ticket.updateMany({
          where: { id, version: expectedVersion as number },
          data: { itPriority: req.body.itPriority, version: { increment: 1 } },
        });
        if (written.count === 0) return { ok: false as const, current: await ticketCurrent(tx, id) };
        return {
          ok: true as const,
          ticket: await tx.ticket.findUniqueOrThrow({
            where: { id },
            select: { id: true, itPriority: true, requestedPriority: true, version: true },
          }),
        };
      });
      if (!outcome.ok) {
        res.status(409).json({ error: STALE_TICKET, conflict: "stale", current: outcome.current });
        return;
      }
      res.status(200).json(outcome.ticket);
    } catch {
      res.status(500).json({ error: "Unable to update the IT Priority" });
    }
  }
);

// PATCH /api/tickets/:id/status — one transaction under a lock on the Ticket row
// (api-spec §3.2): version, matrix, resolution gate (BR-25, BR-27), the write with
// version + 1, resolvedAt (BR-31), the cancel cascade (BR-20), and one history
// entry (BR-32). No refusal appends history (BR-36).
app.patch(
  "/api/tickets/:id/status",
  requireAuth,
  requirePasswordChanged,
  requireRole(...STAFF),
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const target: unknown = req.body?.status;
    const expectedVersion: unknown = req.body?.expectedVersion;
    try {
      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      const fields: Record<string, string> = {};
      if (!isStatus(target)) fields.status = "Choose a valid status.";
      if (!isVersion(expectedVersion)) fields.expectedVersion = VERSION_MESSAGE;
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Validation failed", fields });
        return;
      }
      const to = target as Status;
      const version = expectedVersion as number;

      const outcome = await prisma.$transaction(async (tx) => {
        await lockTicket(tx, id);
        const current = await ticketCurrent(tx, id);
        const from = current.currentStatus as Status;
        if (current.version !== version) return { kind: "stale" as const, current };
        if (isTerminal(from)) {
          return { kind: "transition" as const, current, error: "This ticket is closed and can no longer be updated." };
        }
        if (!isTransitionPermitted(from, to)) {
          return {
            kind: "transition" as const,
            current,
            error: `Cannot move a ${STATUS_LABEL[from]} ticket to ${STATUS_LABEL[to]}.`,
          };
        }
        if (to === "RESOLVED") {
          const gate = await gateFor(tx, id);
          if (!gate.satisfied) return { kind: "gate" as const, unmet: gate.unmet };
        }

        // One instant for the status, resolvedAt, and the history entry (WF-07).
        const now = new Date();
        const written = await tx.ticket.updateMany({
          where: { id, version },
          data: {
            currentStatus: to,
            version: { increment: 1 },
            ...(to === "RESOLVED" ? { resolvedAt: now } : to === "REOPENED" ? { resolvedAt: null } : {}),
          },
        });
        if (written.count === 0) return { kind: "stale" as const, current: await ticketCurrent(tx, id) };

        // BR-20: no open work survives on a cancelled Ticket.
        const cancelled =
          to === "CANCELLED"
            ? await tx.actionTaken.updateMany({
                where: { ticketId: id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
                data: { status: "CANCELLED", version: { increment: 1 } },
              })
            : { count: 0 };

        await tx.ticketStatusChange.create({
          data: { ticketId: id, fromStatus: from, toStatus: to, changedById: req.user!.id, changedAt: now },
        });

        const after = await tx.ticket.findUniqueOrThrow({ where: { id }, select: { version: true, resolvedAt: true } });
        const gate = await gateFor(tx, id);
        return {
          kind: "ok" as const,
          body: {
            id,
            currentStatus: to,
            version: after.version,
            resolvedAt: after.resolvedAt,
            permittedTransitions: gatedTransitions(to, gate.satisfied),
            cancelledActions: cancelled.count,
          },
        };
      });

      switch (outcome.kind) {
        case "stale":
          res.status(409).json({ error: STALE_TICKET, conflict: "stale", current: outcome.current });
          return;
        case "transition":
          res.status(409).json({ error: outcome.error, conflict: "transition", current: outcome.current });
          return;
        case "gate":
          res.status(409).json({ error: "This ticket cannot be resolved yet.", conflict: "resolutionGate", unmet: outcome.unmet });
          return;
        case "ok":
          res.status(200).json(outcome.body);
      }
    } catch {
      res.status(500).json({ error: "Unable to change the status" });
    }
  }
);

// GET /api/tickets/:id/status-history — oldest first, by change time then id
// (BR-34). Staff see who made each change; the owning Requester sees staff changes
// as "staff" with no identity (BR-35). There is no write route: history is
// append-only (BR-33), and any other method falls through to 404.
app.get("/api/tickets/:id/status-history", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    const user = req.user!;
    const ticket = await findAccessibleTicket(id, user);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const rows = await getPrisma().ticketStatusChange.findMany({
      where: { ticketId: id },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        changedAt: true,
        changedBy: { select: { id: true, name: true, role: true } },
      },
    });
    const items = rows.map(({ changedBy, ...entry }) => {
      if (!changedBy) return { ...entry, actor: { kind: "system" } };
      if (changedBy.role === "REQUESTER") {
        return { ...entry, actor: { kind: "requester", id: changedBy.id, name: changedBy.name } };
      }
      return {
        ...entry,
        actor: user.role === "REQUESTER" ? { kind: "staff" } : { kind: "staff", id: changedBy.id, name: changedBy.name },
      };
    });
    res.status(200).json({ items });
  } catch {
    res.status(500).json({ error: "Unable to load the status history" });
  }
});

// --- Internal Notes: IT Staff and Administrator only (api-spec §5) -------------

const NOTES_FORBIDDEN = { error: "You do not have permission to perform this action." };

// Resolves the ticket for a notes request in the order api-spec §5.2 fixes. The
// ownership check runs first, so a Requester asking about another user's ticket
// gets the same 404 as a missing one and existence stays hidden. A Requester
// asking about their own ticket then gets a 403 that carries no note text, author,
// or count; the ticket's existence is already known to them (AC-24, AUTHZ-09).
async function resolveNotesTicket(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const ticket = id === null ? null : await findAccessibleTicket(id, req.user!);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return null;
  }
  if (req.user!.role === "REQUESTER") {
    res.status(403).json(NOTES_FORBIDDEN);
    return null;
  }
  return ticket;
}

app.get("/api/tickets/:id/notes", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  try {
    const ticket = await resolveNotesTicket(req, res);
    if (!ticket) return;
    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: ticket.id },
      select: COMMENT_SELECT,
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json(notes.map(serializeComment));
  } catch {
    res.status(500).json({ error: "Unable to load notes" });
  }
});

app.post("/api/tickets/:id/notes", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  try {
    const ticket = await resolveNotesTicket(req, res);
    if (!ticket) return;

    const bodyError = validateCommentBody(req.body?.body);
    if (bodyError) {
      res.status(400).json({ error: "Validation failed", fields: { body: bodyError.replace("Comment", "Note") } });
      return;
    }
    if (TERMINAL_STATUSES.includes(ticket.currentStatus)) {
      res.status(409).json({ error: "This ticket is closed and can no longer be updated." });
      return;
    }

    const created = await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, body: String(req.body.body).trim() },
      select: COMMENT_SELECT,
    });
    res.status(201).json(serializeComment(created));
  } catch {
    res.status(500).json({ error: "Unable to add the note" });
  }
});

// --- Administrator User Management (api-spec §8) ------------------------------
// Every route here is Administrator-only; IT Staff and Requesters get 403 — the
// routes are not secret, the data behind them is (AUTHZ-04/05). There is no delete
// route: deactivation is the only removal (BR-57).

const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
type RoleValue = (typeof ROLES)[number];
const isRole = (v: unknown): v is RoleValue => typeof v === "string" && (ROLES as readonly string[]).includes(v);

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_EMAIL = { error: "That email address is already registered." };
const LAST_ADMIN = { error: "The system must keep at least one active administrator." };

// The §8.1 shape. Built field by field, so a passwordHash can never ride along.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

function validateName(raw: unknown): string | undefined {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 1 || name.length > 120) return "Name must be 1–120 characters.";
  return undefined;
}

function validateEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !EMAIL_FORMAT.test(raw.trim())) return "Enter a valid email address.";
  return undefined;
}

const ROLE_MESSAGE = "Choose exactly one role: Requester, IT Staff, or Administrator.";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";

// GET /api/admin/users — search name or email, optional role filter. No pagination
// and no sorting parameters (§3.2); ordered by name.
app.get(
  "/api/admin/users",
  requireAuth,
  requirePasswordChanged,
  requireRole("ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const role = isRole(req.query.role) ? req.query.role : undefined;
    try {
      const users = await getPrisma().user.findMany({
        where: {
          ...(role ? { role } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: USER_SELECT,
      });
      res.status(200).json(users);
    } catch {
      res.status(500).json({ error: "Failed to load users" });
    }
  }
);

// POST /api/admin/users — exactly one role, and always flagged for a password
// change: mustChangePassword is not accepted from the request (BR-49).
app.post(
  "/api/admin/users",
  requireAuth,
  requirePasswordChanged,
  requireRole("ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const fields: Record<string, string> = {};
    const nameError = validateName(body.name);
    if (nameError) fields.name = nameError;
    const emailError = validateEmail(body.email);
    if (emailError) fields.email = emailError;
    if (!isRole(body.role)) fields.role = ROLE_MESSAGE;
    if (body.isActive !== undefined && typeof body.isActive !== "boolean") fields.isActive = "Status must be active or inactive.";
    const passwordError = validateNewPassword(body.initialPassword);
    if (passwordError) fields.initialPassword = passwordError;
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Validation failed", fields });
      return;
    }

    const email = normalizeEmail(body.email);
    try {
      const prisma = getPrisma();
      // Emails are stored lower-cased (BR-12), so this catches any casing.
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
        res.status(409).json(DUPLICATE_EMAIL);
        return;
      }
      const created = await prisma.user.create({
        data: {
          name: String(body.name).trim(),
          email,
          role: body.role,
          isActive: body.isActive ?? true,
          passwordHash: await hashPassword(body.initialPassword),
          mustChangePassword: true,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
      });
      res.status(201).json(created);
    } catch (err) {
      // A concurrent create with the same email loses the unique constraint race.
      if (isUniqueViolation(err)) {
        res.status(409).json(DUPLICATE_EMAIL);
        return;
      }
      res.status(500).json({ error: "Unable to create the user" });
    }
  }
);

// PATCH /api/admin/users/:id — name, email, role, activation; nothing else (BR-50).
// The last-active-Administrator check locks the active Administrator rows inside
// the writing transaction, so two concurrent edits cannot each see one other
// Administrator and both succeed, leaving none (BR-56, api-spec §8.3).
app.patch(
  "/api/admin/users/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const body = req.body ?? {};
    try {
      const prisma = getPrisma();
      const target = id === null ? null : await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const fields: Record<string, string> = {};
      if (body.name !== undefined) {
        const e = validateName(body.name);
        if (e) fields.name = e;
      }
      if (body.email !== undefined) {
        const e = validateEmail(body.email);
        if (e) fields.email = e;
      }
      if (body.role !== undefined && !isRole(body.role)) fields.role = ROLE_MESSAGE;
      if (body.isActive !== undefined && typeof body.isActive !== "boolean") fields.isActive = "Status must be active or inactive.";
      if (Object.keys(fields).length > 0) {
        res.status(400).json({ error: "Validation failed", fields });
        return;
      }

      const self = target.id === req.user!.id;
      const nextRole: RoleValue = body.role ?? target.role;
      const nextActive: boolean = body.isActive ?? target.isActive;
      if (self && nextActive === false) {
        res.status(409).json({ error: "You cannot deactivate your own account." }); // BR-54
        return;
      }
      if (self && nextRole !== target.role) {
        res.status(409).json({ error: "You cannot change your own role." }); // BR-55
        return;
      }

      const data: { name?: string; email?: string; role?: RoleValue; isActive?: boolean } = {};
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.email !== undefined) data.email = normalizeEmail(body.email);
      if (body.role !== undefined) data.role = body.role;
      if (body.isActive !== undefined) data.isActive = body.isActive;

      if (data.email && data.email !== target.email) {
        const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
        if (taken && taken.id !== target.id) {
          res.status(409).json(DUPLICATE_EMAIL);
          return;
        }
      }

      const removesAnAdmin =
        target.role === "ADMINISTRATOR" && target.isActive && (nextRole !== "ADMINISTRATOR" || !nextActive);

      const outcome = await prisma.$transaction(async (tx) => {
        if (removesAnAdmin) {
          // Lock EVERY active Administrator row, in id order. Two concurrent edits
          // (A deactivating B while B deactivates A) then queue on the same locks
          // instead of each locking a different row and deadlocking; the second
          // re-reads after the first commits and finds no one left. Locking only
          // "the others" would lock different rows per transaction.
          const active = await tx.$queryRaw<{ id: number }[]>`
            SELECT id FROM "User"
            WHERE role = 'ADMINISTRATOR' AND "isActive" = true
            ORDER BY id
            FOR UPDATE`;
          if (!wouldKeepAnActiveAdmin(active.map((r) => r.id), target.id)) return null;
        }
        return tx.user.update({ where: { id: target.id }, data, select: USER_SELECT });
      });

      if (!outcome) {
        res.status(409).json(LAST_ADMIN);
        return;
      }
      res.status(200).json(outcome);
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json(DUPLICATE_EMAIL);
        return;
      }
      res.status(500).json({ error: "Unable to update the user" });
    }
  }
);

// POST /api/admin/users/:id/initial-password — atomically replaces the hash, sets
// mustChangePassword, and deletes every session the user has, so an open tab stops
// working (BR-53). The password is never echoed back.
app.post(
  "/api/admin/users/:id/initial-password",
  requireAuth,
  requirePasswordChanged,
  requireRole("ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    try {
      const prisma = getPrisma();
      const target = id === null ? null : await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const passwordError = validateNewPassword(req.body?.initialPassword);
      if (passwordError) {
        res.status(400).json({ error: "Validation failed", fields: { initialPassword: passwordError } });
        return;
      }
      const passwordHash = await hashPassword(req.body.initialPassword);
      await prisma.$transaction([
        prisma.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true } }),
        prisma.session.deleteMany({ where: { userId: target.id } }),
      ]);
      res.status(200).json({ id: target.id, mustChangePassword: true });
    } catch {
      res.status(500).json({ error: "Unable to set the initial password" });
    }
  }
);

// --- Actions Taken (Lab 4, api-spec §2) -----------------------------------------

const ACTION_SELECT = {
  id: true,
  ticketId: true,
  actionAt: true,
  description: true,
  result: true,
  status: true,
  performedById: true,
  performedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ActionTakenSelect;

type ActionRow = Prisma.ActionTakenGetPayload<{ select: typeof ACTION_SELECT }>;

// Role shaping (BR-18, api-spec §2.1): a Requester never sees who created an
// action, and no email is selected for anyone. clientRequestId is never returned.
function serializeAction(a: ActionRow, viewer: { role: string }) {
  const { performedById: _performedById, createdBy, ...rest } = a;
  return viewer.role === "REQUESTER" ? rest : { ...rest, createdBy };
}

const ACTION_NOT_FOUND = { error: "Action not found" };
const ACTION_FORBIDDEN = { error: "Only IT Staff can record actions." };
const TICKET_INACTIVE = { error: "Reopen the ticket before recording more work.", conflict: "ticketInactive" };
const ACTION_FINAL = {
  error: "Completed and cancelled actions cannot be changed. Record a new action instead.",
  conflict: "actionFinal",
};
const ACTION_STALE = "This action was changed by someone else. Reload to see the latest version.";
const PERFORMER_MESSAGE = "Choose an active IT Staff member.";
// BR-19: actions are written only while the Ticket is active.
const ACTION_INACTIVE_STATUSES: readonly string[] = ["RESOLVED", "CLOSED", "CANCELLED"];

// BR-04: the performer must be an active IT Staff member or Administrator.
async function performerError(tx: Prisma.TransactionClient, id: number): Promise<string | undefined> {
  const user = await tx.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  return user && user.isActive && user.role !== "REQUESTER" ? undefined : PERFORMER_MESSAGE;
}

// Locks the Ticket row for the rest of the transaction, so an action write cannot
// interleave with a status change's resolution-gate check (BR-27, api-spec §2.3).
async function lockTicket(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${id} FOR UPDATE`;
  return tx.ticket.findUniqueOrThrow({ where: { id }, select: { currentStatus: true, ticketDate: true } });
}

// GET /api/tickets/:id/actions — every action on a Ticket the caller can reach,
// in Action Date/Time order with id as the tie-breaker (BR-12). A Requester reads
// their own Ticket's actions (BR-18); anyone else's is the Ticket 404 (BR-15).
app.get("/api/tickets/:id/actions", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  try {
    if (!(await findAccessibleTicket(id, req.user!))) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const items = await getPrisma().actionTaken.findMany({
      where: { ticketId: id },
      orderBy: [{ actionAt: "asc" }, { id: "asc" }],
      select: ACTION_SELECT,
    });
    res.status(200).json({ items: items.map((a) => serializeAction(a, req.user!)) });
  } catch {
    res.status(500).json({ error: "Unable to load actions" });
  }
});

// POST /api/tickets/:id/actions — IT Staff and Administrators only (BR-17). The
// creator comes from the session (BR-03); a repeated clientRequestId returns the
// action already created instead of a second one (BR-44).
app.post("/api/tickets/:id/actions", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const user = req.user!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const findByKey = (key: string) =>
    getPrisma().actionTaken.findUnique({
      where: { ticketId_clientRequestId: { ticketId: id, clientRequestId: key } },
      select: ACTION_SELECT,
    });
  try {
    const prisma = getPrisma();
    if (!(await findAccessibleTicket(id, user))) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (user.role === "REQUESTER") {
      res.status(403).json(ACTION_FORBIDDEN);
      return;
    }

    const parsed = parseActionInput(body, { partial: false });
    const fields: Record<string, string> = { ...parsed.fields };
    let clientRequestId: string | undefined;
    if (body.clientRequestId !== undefined) {
      const key = body.clientRequestId;
      if (typeof key === "string" && key.length >= 1 && key.length <= CLIENT_REQUEST_ID_MAX) clientRequestId = key;
      else fields.clientRequestId = `Request id must be 1–${CLIENT_REQUEST_ID_MAX} characters.`;
    }

    // A replay returns the action already created, unchanged (BR-44).
    if (clientRequestId) {
      const existing = await findByKey(clientRequestId);
      if (existing) {
        res.status(200).json(serializeAction(existing, user));
        return;
      }
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const ticket = await lockTicket(tx, id);
      if (ACTION_INACTIVE_STATUSES.includes(ticket.currentStatus)) return { kind: "inactive" as const };

      const performedById = parsed.performedById ?? user.id;
      if (!fields.performedById) {
        const performer = await performerError(tx, performedById);
        if (performer) fields.performedById = performer;
      }
      const values = {
        result: "",
        status: "PLANNED",
        followUpRequired: false,
        followUpNote: "",
        attachmentNotes: "",
        ...parsed.values,
      } as ActionValues;
      // The merged-value rules need a complete, well-formed action; a format
      // error on a field takes precedence over a rule error on the same field.
      if (Object.keys(parsed.fields).length === 0) {
        const rules = actionRuleErrors(values, { ticketDate: ticket.ticketDate, now: new Date() });
        for (const [key, message] of Object.entries(rules)) fields[key] ??= message;
      }
      if (Object.keys(fields).length > 0) return { kind: "invalid" as const };

      const created = await tx.actionTaken.create({
        data: {
          ...values,
          ticketId: id,
          performedById,
          createdById: user.id,
          clientRequestId: clientRequestId ?? randomUUID(),
          completedAt: values.status === "COMPLETED" ? new Date() : null,
        },
        select: ACTION_SELECT,
      });
      // BR-42: the work shows as recent activity without changing Ticket.version.
      await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
      return { kind: "created" as const, created };
    });

    if (outcome.kind === "inactive") {
      res.status(409).json(TICKET_INACTIVE);
      return;
    }
    if (outcome.kind === "invalid") {
      res.status(400).json({ error: "Validation failed", fields });
      return;
    }
    res.status(201).json(serializeAction(outcome.created, user));
  } catch (err) {
    // Two simultaneous requests with one key: the loser of the unique race
    // returns the winner's action, exactly as a later replay would.
    if (isUniqueViolation(err) && typeof body.clientRequestId === "string") {
      const existing = await findByKey(body.clientRequestId).catch(() => null);
      if (existing) {
        res.status(200).json(serializeAction(existing, user));
        return;
      }
    }
    res.status(500).json({ error: "Unable to save the action" });
  }
});

// PATCH /api/actions/:id — edits fields, changes status, or both, against the
// version the client last read (BR-39…BR-41). Errors follow api-spec §2.4's order:
// format → stale → inactive Ticket → final action → transition → merged rules.
app.patch("/api/actions/:id", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json(ACTION_NOT_FOUND);
    return;
  }
  const user = req.user!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const prisma = getPrisma();
    const found = await prisma.actionTaken.findFirst({
      where: { id, ticket: ticketScope(user) },
      select: { ticketId: true },
    });
    if (!found) {
      res.status(404).json(ACTION_NOT_FOUND);
      return;
    }
    if (user.role === "REQUESTER") {
      res.status(403).json(ACTION_FORBIDDEN);
      return;
    }

    const parsed = parseActionInput(body, { partial: true });
    const fields: Record<string, string> = { ...parsed.fields };
    const expectedVersion = body.expectedVersion;
    if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) {
      fields.expectedVersion = "Reload the ticket and try again.";
    }
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Validation failed", fields });
      return;
    }
    const version = expectedVersion as number;

    const outcome = await prisma.$transaction(async (tx) => {
      const ticket = await lockTicket(tx, found.ticketId);
      const reread = () => tx.actionTaken.findUniqueOrThrow({ where: { id }, select: ACTION_SELECT });
      const current = await reread();
      if (current.version !== version) return { kind: "stale" as const, current };
      if (ACTION_INACTIVE_STATUSES.includes(ticket.currentStatus)) return { kind: "inactive" as const };
      const from = current.status as ActionStatusValue;
      if (isActionFinal(from)) return { kind: "final" as const };
      const to = parsed.values.status;
      if (to !== undefined && !isActionTransitionPermitted(from, to)) {
        return { kind: "transition" as const, current, from, to };
      }

      const merged: ActionValues = {
        actionAt: current.actionAt,
        description: current.description,
        result: current.result,
        status: from,
        followUpRequired: current.followUpRequired,
        followUpNote: current.followUpNote,
        attachmentNotes: current.attachmentNotes,
        ...parsed.values,
      };
      const ruleFields = actionRuleErrors(merged, { ticketDate: ticket.ticketDate, now: new Date() });
      // BR-05: restating a performer deactivated since is accepted; choosing one is not.
      if (parsed.performedById !== undefined && parsed.performedById !== current.performedById) {
        const performer = await performerError(tx, parsed.performedById);
        if (performer) ruleFields.performedById = performer;
      }
      if (Object.keys(ruleFields).length > 0) return { kind: "invalid" as const, fields: ruleFields };

      // BR-41: the comparison and the write are one conditional update.
      const written = await tx.actionTaken.updateMany({
        where: { id, version },
        data: {
          ...parsed.values,
          ...(parsed.performedById !== undefined ? { performedById: parsed.performedById } : {}),
          ...(to === "COMPLETED" ? { completedAt: new Date() } : {}),
          version: { increment: 1 },
        },
      });
      if (written.count === 0) return { kind: "stale" as const, current: await reread() };
      await tx.ticket.update({ where: { id: found.ticketId }, data: { updatedAt: new Date() } });
      return { kind: "updated" as const, action: await reread() };
    });

    switch (outcome.kind) {
      case "stale":
        res.status(409).json({ error: ACTION_STALE, conflict: "stale", current: serializeAction(outcome.current, user) });
        return;
      case "inactive":
        res.status(409).json(TICKET_INACTIVE);
        return;
      case "final":
        res.status(409).json(ACTION_FINAL);
        return;
      case "transition":
        res.status(409).json({
          error: `Cannot move a ${ACTION_STATUS_LABEL[outcome.from]} action to ${ACTION_STATUS_LABEL[outcome.to]}.`,
          conflict: "transition",
          current: serializeAction(outcome.current, user),
        });
        return;
      case "invalid":
        res.status(400).json({ error: "Validation failed", fields: outcome.fields });
        return;
      case "updated":
        res.status(200).json(serializeAction(outcome.action, user));
    }
  } catch {
    res.status(500).json({ error: "Unable to update the action" });
  }
});

// --- IT Staff and Administrator dashboard (Lab 4, api-spec §6.1) -------------------

const ACTIVE_IN = { in: [...ACTIVE_STATUSES] };
const OPEN_ACTION_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;
const PRIORITY_KEYS = ["LOW", "MEDIUM", "HIGH"] as const;
const ROLE_KEYS = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;

const STAFF_TICKET_SUMMARY = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  owner: { select: { id: true, name: true } },
  ticketDate: true,
  updatedAt: true,
} satisfies Prisma.TicketSelect;

const metric = (value: number, href: string | null) => ({ value, href });
const staffTicketHref = (id: number) => `/staff/tickets/${id}`;

// GET /api/dashboard/staff — every number is computed at request time with counts
// and bounded queries, in one read transaction so the figures on one response
// agree with each other (BR-47). "Me" is always the session user. Lists hold at
// most five items in a deterministic order ending in id (BR-48); no Ticket
// description is ever included.
app.get("/api/dashboard/staff", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "REQUESTER") {
    res.status(403).json({ error: "This dashboard is for IT Staff." });
    return;
  }
  try {
    const now = new Date();
    const me = user.id;
    const myOpenActionsWhere: Prisma.ActionTakenWhereInput = {
      performedById: me,
      status: { in: [...OPEN_ACTION_STATUSES] },
      ticket: { currentStatus: ACTIVE_IN },
    };

    const data = await getPrisma().$transaction(
      async (tx) => {
        const [unassignedOpen, mineOpen, myOpenActions, highPriorityOpen] = await Promise.all([
          tx.ticket.count({ where: { ownerId: null, currentStatus: ACTIVE_IN } }),
          tx.ticket.count({ where: { ownerId: me, currentStatus: ACTIVE_IN } }),
          tx.actionTaken.count({ where: myOpenActionsWhere }),
          tx.ticket.count({ where: { itPriority: "HIGH", currentStatus: ACTIVE_IN } }),
        ]);
        const [byStatusRows, byPriorityRows] = await Promise.all([
          tx.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
          tx.ticket.groupBy({ by: ["itPriority"], where: { currentStatus: ACTIVE_IN }, _count: { _all: true } }),
        ]);
        const [myActions, urgent, recentlyUpdated] = await Promise.all([
          tx.actionTaken.findMany({
            where: myOpenActionsWhere,
            orderBy: [{ actionAt: "asc" }, { id: "asc" }],
            take: 5,
            select: {
              id: true,
              status: true,
              actionAt: true,
              description: true,
              ticket: { select: { id: true, ticketNumber: true, summary: true } },
            },
          }),
          tx.ticket.findMany({
            where: { itPriority: "HIGH", currentStatus: ACTIVE_IN },
            orderBy: [{ ticketDate: "asc" }, { id: "asc" }],
            take: 5,
            select: STAFF_TICKET_SUMMARY,
          }),
          tx.ticket.findMany({
            where: { updatedAt: { gte: windowStart(now, 7) } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 5,
            select: STAFF_TICKET_SUMMARY,
          }),
        ]);
        const userCounts =
          user.role === "ADMINISTRATOR"
            ? await Promise.all([
                tx.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } }),
                tx.user.count({ where: { isActive: false } }),
              ])
            : null;
        return {
          unassignedOpen,
          mineOpen,
          myOpenActions,
          highPriorityOpen,
          byStatusRows,
          byPriorityRows,
          myActions,
          urgent,
          recentlyUpdated,
          userCounts,
        };
      },
      { isolationLevel: "RepeatableRead" }
    );

    // A status or priority with no Tickets is 0, never an omitted key (BR-50).
    const byStatus = Object.fromEntries(
      STATUSES.map((s) => [
        s,
        metric(data.byStatusRows.find((r) => r.currentStatus === s)?._count._all ?? 0, `/staff/tickets?status=${s}`),
      ])
    );
    const openByItPriority = Object.fromEntries(
      PRIORITY_KEYS.map((p) => [
        p,
        metric(
          data.byPriorityRows.find((r) => r.itPriority === p)?._count._all ?? 0,
          `/staff/tickets?itPriority=${p}&statusGroup=active`
        ),
      ])
    );
    const ticketSummary = (t: (typeof data.urgent)[number]) => ({ ...t, href: staffTicketHref(t.id) });

    res.status(200).json({
      generatedAt: now.toISOString(),
      metrics: {
        unassignedOpen: metric(data.unassignedOpen, "/staff/tickets?ownerId=unassigned&statusGroup=active"),
        mineOpen: metric(data.mineOpen, "/staff/tickets?ownerId=me&statusGroup=active"),
        // No list screen can express "my open actions"; the list rows carry links (BR-51).
        myOpenActions: metric(data.myOpenActions, null),
        highPriorityOpen: metric(data.highPriorityOpen, "/staff/tickets?itPriority=HIGH&statusGroup=active"),
      },
      byStatus,
      openByItPriority,
      myActions: {
        items: data.myActions.map((a) => ({
          id: a.id,
          status: a.status,
          actionAt: a.actionAt,
          description: cutText(a.description),
          ticket: a.ticket,
          href: staffTicketHref(a.ticket.id),
        })),
      },
      urgent: {
        items: data.urgent.map(ticketSummary),
        viewAllHref: "/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc",
      },
      recentlyUpdated: {
        items: data.recentlyUpdated.map(ticketSummary),
        viewAllHref: "/staff/tickets?sort=updatedAt&order=desc",
      },
      // Absent, not null, for IT Staff (AC-49).
      ...(data.userCounts
        ? {
            userCounts: {
              activeByRole: Object.fromEntries(
                ROLE_KEYS.map((r) => [
                  r,
                  metric(data.userCounts![0].find((row) => row.role === r)?._count._all ?? 0, `/admin/users?role=${r}`),
                ])
              ),
              inactive: metric(data.userCounts[1], null),
            },
          }
        : {}),
    });
  } catch {
    res.status(500).json({ error: "Unable to load the dashboard" });
  }
});

// --- Requester dashboard (Lab 4, api-spec §5.1) -----------------------------------

const REQUESTER_TICKET_SUMMARY = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  updatedAt: true,
  resolvedAt: true,
} satisfies Prisma.TicketSelect;

// GET /api/dashboard/requester — the session user's own Tickets only. The route
// reads no query parameter, so nothing a client sends can widen the scope (BR-53).
// Same shape rules as the staff dashboard: one read transaction, lists of at most
// five ending in id, no description (BR-47, BR-48).
app.get("/api/dashboard/requester", requireAuth, requirePasswordChanged, async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "REQUESTER") {
    res.status(403).json({ error: "This dashboard is for requesters." });
    return;
  }
  try {
    const now = new Date();
    const mine = { requesterId: user.id };
    const waiting = { ...mine, currentStatus: "WAITING_FOR_REQUESTER" as const };

    const [openTickets, waitingForMe, awaitingClosure, needsAttention, recentlyUpdated, recentlyResolved] =
      await getPrisma().$transaction(
        (tx) =>
          Promise.all([
            tx.ticket.count({ where: { ...mine, currentStatus: ACTIVE_IN } }),
            tx.ticket.count({ where: waiting }),
            tx.ticket.count({ where: { ...mine, currentStatus: "RESOLVED" } }),
            tx.ticket.findMany({
              where: waiting,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: 5,
              select: REQUESTER_TICKET_SUMMARY,
            }),
            tx.ticket.findMany({
              where: { ...mine, updatedAt: { gte: windowStart(now, 7) } },
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: 5,
              select: REQUESTER_TICKET_SUMMARY,
            }),
            tx.ticket.findMany({
              where: { ...mine, currentStatus: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: { gte: windowStart(now, 30) } },
              orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
              take: 5,
              select: REQUESTER_TICKET_SUMMARY,
            }),
          ]),
        { isolationLevel: "RepeatableRead" }
      );

    const summaries = (items: typeof needsAttention) => items.map((t) => ({ ...t, href: `/tickets/${t.id}` }));
    res.status(200).json({
      generatedAt: now.toISOString(),
      metrics: {
        openTickets: metric(openTickets, "/tickets?statusGroup=active"),
        waitingForMe: metric(waitingForMe, "/tickets?status=WAITING_FOR_REQUESTER"),
        awaitingClosure: metric(awaitingClosure, "/tickets?status=RESOLVED"),
      },
      needsAttention: { items: summaries(needsAttention), viewAllHref: "/tickets?status=WAITING_FOR_REQUESTER" },
      recentlyUpdated: { items: summaries(recentlyUpdated), viewAllHref: "/tickets?sort=updatedAt&order=desc" },
      recentlyResolved: { items: summaries(recentlyResolved) },
    });
  } catch {
    res.status(500).json({ error: "Unable to load the dashboard" });
  }
});
