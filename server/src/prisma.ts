import { PrismaClient } from "@prisma/client";

// The client is created on first use, not at import time, so routes and tests
// that never touch the DB (e.g. /api/health) stay free of database side effects.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}
