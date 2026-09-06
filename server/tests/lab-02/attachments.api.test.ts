import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../src/app.js";

// Requires a migrated and seeded database. API-20…API-29. Each test gets a fresh
// ticket so attachment counts are independent; rows are cleaned up afterwards.
const prisma = new PrismaClient();

let requesterA: number;
let requesterB: number;
let categoryId: number;
let systemId: number;
const createdTicketIds: number[] = [];

// Minimal files identified by magic bytes; size is padded where a test needs it.
function png(size = 64): Buffer {
  const b = Buffer.alloc(Math.max(size, 8));
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((v, i) => (b[i] = v));
  return b;
}
function pdf(size = 64): Buffer {
  const b = Buffer.alloc(Math.max(size, 5));
  b.write("%PDF-", 0, "ascii");
  return b;
}
function exe(): Buffer {
  return Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
}

async function freshTicket(requesterId = requesterA): Promise<number> {
  const t = await prisma.ticket.create({
    data: {
      ticketNumber: `ATT${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "LOW",
      summary: "Attachment test ticket",
      description: "A description long enough to satisfy the twenty character minimum.",
    },
  });
  createdTicketIds.push(t.id);
  return t.id;
}

const uploadTo = (ticketId: number, buf: Buffer, filename: string, id = requesterA) =>
  request(app).post(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(id)).attach("file", buf, filename);

describe("Attachment lifecycle", () => {
  beforeAll(async () => {
    const actives = await prisma.requesterUser.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    requesterA = actives[0].id;
    requesterB = actives[1].id;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { isActive: true } })).id;
    systemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterEach(async () => {
    for (const id of createdTicketIds) {
      await prisma.attachment.deleteMany({ where: { ticketId: id } });
      await prisma.ticket.deleteMany({ where: { id } });
    }
    createdTicketIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // API-20 — AC-26
  it("uploads a valid PNG and lists it as active", async () => {
    const ticketId = await freshTicket();
    const res = await uploadTo(ticketId, png(2 * 1024 * 1024), "screenshot.png");
    expect(res.status).toBe(201);
    expect(res.body.originalFilename).toBe("screenshot.png");
    expect(res.body.removedAt).toBeNull();

    const saved = await prisma.attachment.findUnique({ where: { id: res.body.id } });
    expect(saved).not.toBeNull();
    expect(saved!.storedFilename).not.toBe("screenshot.png"); // server-generated (BR-50)
  });

  // API-21 — AC-27, BR-04
  it("rejects an unsupported type with 415 naming the allowed types", async () => {
    const ticketId = await freshTicket();
    const res = await uploadTo(ticketId, exe(), "malware.exe");
    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/Unsupported file type/i);
  });

  // API-22 — AC-28, BR-05
  it("rejects a file over 5 MB with 413", async () => {
    const ticketId = await freshTicket();
    const res = await uploadTo(ticketId, pdf(6 * 1024 * 1024), "huge.pdf");
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/5 MB/);
  });

  // API-23 — AC-29, BR-06
  it("rejects a sixth active attachment with 409", async () => {
    const ticketId = await freshTicket();
    for (let i = 0; i < 5; i++) {
      expect((await uploadTo(ticketId, png(), `file-${i}.png`)).status).toBe(201);
    }
    const sixth = await uploadTo(ticketId, png(), "file-6.png");
    expect(sixth.status).toBe(409);
  });

  // API-24 — AC-30
  it("downloads an active attachment with its original filename and bytes", async () => {
    const ticketId = await freshTicket();
    const content = pdf(2048);
    const up = await uploadTo(ticketId, content, "report.pdf");
    const dl = await request(app)
      .get(`/api/attachments/${up.body.id}/download`)
      .set("X-Requester-Id", String(requesterA))
      .responseType("blob");

    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain('filename="report.pdf"');
    expect(Buffer.compare(dl.body as Buffer, content)).toBe(0);
  });

  // API-25 — AC-31, BR-07, BR-54
  it("soft-removes an attachment, keeping the row with reason and remover", async () => {
    const ticketId = await freshTicket();
    const up = await uploadTo(ticketId, png(), "wrong.png");
    const res = await request(app)
      .delete(`/api/attachments/${up.body.id}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ reason: "Uploaded the wrong screenshot" });

    expect(res.status).toBe(200);
    expect(res.body.removalReason).toBe("Uploaded the wrong screenshot");
    expect(res.body.removedBy.id).toBe(requesterA);

    const saved = await prisma.attachment.findUnique({ where: { id: up.body.id } });
    expect(saved).not.toBeNull();
    expect(saved!.removedAt).not.toBeNull();
  });

  // API-26 — AC-32, BR-08
  it("refuses to download a removed attachment (404)", async () => {
    const ticketId = await freshTicket();
    const up = await uploadTo(ticketId, png(), "gone.png");
    await request(app).delete(`/api/attachments/${up.body.id}`).set("X-Requester-Id", String(requesterA)).send({ reason: "no longer needed" });

    const dl = await request(app).get(`/api/attachments/${up.body.id}/download`).set("X-Requester-Id", String(requesterA));
    expect(dl.status).toBe(404);
    expect(dl.body).toEqual({ error: "Attachment not found" });
  });

  // API-27 — AC-33, BR-53
  it("rejects removal without a reason (400), leaving the attachment active", async () => {
    const ticketId = await freshTicket();
    const up = await uploadTo(ticketId, png(), "keep.png");
    const res = await request(app).delete(`/api/attachments/${up.body.id}`).set("X-Requester-Id", String(requesterA)).send({});
    expect(res.status).toBe(400);
    expect(res.body.fields.reason).toBeDefined();

    const saved = await prisma.attachment.findUnique({ where: { id: up.body.id } });
    expect(saved!.removedAt).toBeNull();
  });

  // API-28 — AC-34, BR-56
  it("frees quota when an attachment is removed", async () => {
    const ticketId = await freshTicket();
    let firstId = 0;
    for (let i = 0; i < 5; i++) {
      const r = await uploadTo(ticketId, png(), `f-${i}.png`);
      if (i === 0) firstId = r.body.id;
    }
    expect((await uploadTo(ticketId, png(), "sixth.png")).status).toBe(409);

    await request(app).delete(`/api/attachments/${firstId}`).set("X-Requester-Id", String(requesterA)).send({ reason: "make room" });
    expect((await uploadTo(ticketId, png(), "after-removal.png")).status).toBe(201);
  });

  // API-29 — AC-35, BR-29
  it("returns 404 for another Requester's attachment id", async () => {
    const ticketId = await freshTicket(requesterA);
    const up = await uploadTo(ticketId, png(), "a-owned.png");

    const asB = await request(app).get(`/api/attachments/${up.body.id}/download`).set("X-Requester-Id", String(requesterB));
    expect(asB.status).toBe(404);

    const delB = await request(app).delete(`/api/attachments/${up.body.id}`).set("X-Requester-Id", String(requesterB)).send({ reason: "not mine to remove" });
    expect(delB.status).toBe(404);
  });

  it("rejects an upload to another Requester's ticket with 404 (BR-30)", async () => {
    const ticketId = await freshTicket(requesterA);
    const res = await uploadTo(ticketId, png(), "intruder.png", requesterB);
    expect(res.status).toBe(404);
  });
});
