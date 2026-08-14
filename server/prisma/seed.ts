import { pathToFileURL } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// The four supported request categories, in the order the app lists them.
export const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

// Upserting on the unique `name` keeps the seed idempotent: a second run finds
// each row, updates nothing, and creates no duplicates.
export async function seedCategories(prisma: PrismaClient) {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function main() {
  const prisma = getPrisma();
  try {
    await seedCategories(prisma);
    console.log(`Seeded ${CATEGORY_NAMES.length} categories.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when executed as a script (npm run prisma:seed) — tests import
// seedCategories() directly and manage their own connection.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
