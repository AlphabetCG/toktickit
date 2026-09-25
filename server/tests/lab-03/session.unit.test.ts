import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  generateToken,
  hashToken,
  createSession,
  findSessionUser,
} from "../../src/session.js";
import { ensureUser } from "../helpers/auth.js";

// UNIT-09 — BR-08, D-03 (docs/lab-03/tests.md §2.1). Touches the database so the
// "only the digest is persisted" and "expired row treated as absent" guarantees
// are observed against real rows.
const prisma = new PrismaClient();
let userId: number;

beforeAll(async () => {
  userId = (await ensureUser(prisma, { email: "unit09.session@toktickit.test" })).id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.$disconnect();
});

describe("UNIT-09: session token", () => {
  it("has 32 bytes of entropy and differs across calls", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url").length).toBe(32);
  });

  it("persists only the SHA-256 digest, never the raw token", async () => {
    const token = await createSession(prisma, userId);
    const row = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    // The raw token is nowhere in the row.
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("treats an expired row as absent", async () => {
    const token = await createSession(prisma, userId);
    await prisma.session.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await findSessionUser(prisma, token)).toBeNull();
    // The expired row is swept on read.
    expect(await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } })).toBeNull();
  });
});
