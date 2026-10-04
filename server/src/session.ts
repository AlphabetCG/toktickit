import { randomBytes, createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// 8-hour absolute lifetime, no sliding renewal (D-06, api-spec §1.2).
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE = "toktickit_session";

// 32 bytes of entropy — guessing is infeasible, so a slow hash buys nothing; the
// raw token goes to the cookie and is never stored (D-03).
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only the SHA-256 digest is persisted, so a leaked database yields no usable
// session (D-03).
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Creates a session row for the user and returns the raw token for the cookie.
export async function createSession(prisma: PrismaClient, userId: number): Promise<string> {
  const token = generateToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

// Resolves a raw token to its live session + user, or null. An expired row is
// treated as absent (and swept) so expiry needs no separate job (UNIT-09).
export async function findSessionUser(prisma: PrismaClient, token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { sessionId: session.id, user: session.user };
}

export async function deleteSessionByToken(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// Invalidates every other session for the user, keeping the caller's own so the
// screen they just used survives (BR-11).
export async function deleteOtherSessions(prisma: PrismaClient, userId: number, keepSessionId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
}
