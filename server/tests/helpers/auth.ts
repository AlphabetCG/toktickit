import request from "supertest";
import type { PrismaClient, Role } from "@prisma/client";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";

// A known, policy-compliant password every test account shares (12–128 chars,
// not blocklisted). Tests create their own users so they never depend on the
// seed's mustChangePassword state.
export const TEST_PASSWORD = "TestPassw0rd!2026";

interface EnsureUserInput {
  email: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

// Upsert a user with the shared test password, ready to authenticate. Defaults to
// an active REQUESTER whose password gate is already satisfied.
export async function ensureUser(prisma: PrismaClient, input: EnsureUserInput) {
  const {
    email,
    name = email.split("@")[0],
    role = "REQUESTER",
    isActive = true,
    mustChangePassword = false,
  } = input;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, isActive, passwordHash, mustChangePassword },
    create: { email, name, role, isActive, passwordHash, mustChangePassword },
  });
}

// Log in and return the session cookie for supertest `.set("Cookie", cookie)`.
export async function loginCookie(email: string, password: string = TEST_PASSWORD): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  const setCookie = res.headers["set-cookie"];
  if (!setCookie || setCookie.length === 0) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return setCookie[0].split(";")[0]; // "toktickit_session=<token>"
}

// Create an active requester and return { id, cookie } in one step.
export async function requesterWithCookie(prisma: PrismaClient, email: string) {
  const user = await ensureUser(prisma, { email, role: "REQUESTER" });
  const cookie = await loginCookie(email);
  return { id: user.id, cookie };
}
