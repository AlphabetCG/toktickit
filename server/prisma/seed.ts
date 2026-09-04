import { pathToFileURL } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// The four supported request categories, in the order the app lists them (BR-10).
export const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

// The systems a ticket can be raised against (BR-11), in list order.
export const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

// Four active Development Requesters and one inactive (BR-12). The inactive one
// must never surface in the selector (BR-13), so the requester-context tests use
// it as their negative case. Emails are the natural upsert key (BR-63).
export const REQUESTERS = [
  { name: "Somchai Prasert", email: "somchai.prasert@toktickit.test", isActive: true },
  { name: "Nadia Rahman", email: "nadia.rahman@toktickit.test", isActive: true },
  { name: "Anong Srisai", email: "anong.srisai@toktickit.test", isActive: true },
  { name: "Peter Chen", email: "peter.chen@toktickit.test", isActive: true },
  { name: "Kanya (inactive)", email: "kanya.inactive@toktickit.test", isActive: false },
];

// Upserting on the unique `name` keeps the seed idempotent: a second run finds
// each row, updates nothing, and creates no duplicates (BR-09).
export async function seedCategories(prisma: PrismaClient) {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
}

export async function seedRelatedSystems(prisma: PrismaClient) {
  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({ where: { name }, update: {}, create: { name } });
  }
}

// Keyed on `email`. `isActive` is re-applied on update so the inactive Requester
// stays inactive even if a row was toggled between runs — the seed is the source
// of truth for BR-12/BR-13.
export async function seedRequesters(prisma: PrismaClient) {
  for (const { name, email, isActive } of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email },
      update: { name, isActive },
      create: { name, email, isActive },
    });
  }
}

export async function seed(prisma: PrismaClient) {
  await seedCategories(prisma);
  await seedRelatedSystems(prisma);
  await seedRequesters(prisma);
}

async function main() {
  const prisma = getPrisma();
  try {
    await seed(prisma);
    const active = REQUESTERS.filter((r) => r.isActive).length;
    console.log(
      `Seeded ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEM_NAMES.length} related systems, ` +
        `${REQUESTERS.length} requesters (${active} active, ${REQUESTERS.length - active} inactive).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when executed as a script (npm run prisma:seed) — tests import the
// seed functions directly and manage their own connection.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
