import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, type RequestedPriority, type TicketStatus } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// One documented development password shared by every seeded account. It is not a
// real secret and is recorded in the README (BR-65). bcrypt cost 10 keeps the seed
// quick while producing a standard $2 hash the auth code verifies (Issue #31).
export const DEV_PASSWORD = "ChangeMe123!";
const BCRYPT_COST = 10;

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

export interface SeedUser {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

// Lab 2's four active + one inactive Requester are retained by email so the
// migration's placeholder rows are overwritten with real credentials rather than
// duplicated; IT Staff and an Administrator are added (BR-63). Emails are the
// natural upsert key.
export const USERS: SeedUser[] = [
  // Requesters — the Lab 2 identities, now with credentials.
  { name: "Somchai Prasert", email: "somchai.prasert@toktickit.test", role: Role.REQUESTER, isActive: true },
  { name: "Nadia Rahman", email: "nadia.rahman@toktickit.test", role: Role.REQUESTER, isActive: true },
  { name: "Anong Srisai", email: "anong.srisai@toktickit.test", role: Role.REQUESTER, isActive: true },
  { name: "Peter Chen", email: "peter.chen@toktickit.test", role: Role.REQUESTER, isActive: true },
  { name: "Kanya Wong (inactive)", email: "kanya.inactive@toktickit.test", role: Role.REQUESTER, isActive: false },
  // IT Staff — three active, one inactive.
  { name: "Isara Thongchai", email: "isara.thongchai@toktickit.test", role: Role.IT_STAFF, isActive: true },
  { name: "Malee Boonmee", email: "malee.boonmee@toktickit.test", role: Role.IT_STAFF, isActive: true },
  { name: "Decha Phumipat", email: "decha.phumipat@toktickit.test", role: Role.IT_STAFF, isActive: true },
  { name: "Wichai Suk (inactive)", email: "wichai.inactive@toktickit.test", role: Role.IT_STAFF, isActive: false },
  // Administrator.
  { name: "Arthit Admin", email: "arthit.admin@toktickit.test", role: Role.ADMINISTRATOR, isActive: true },
];

export const REQUESTERS = USERS.filter((u) => u.role === Role.REQUESTER);

// Eight demo Tickets, one per status, spread across Requesters and priorities,
// assigned and unassigned, so every workflow state is visible (BR-64). Ticket
// Numbers use a reserved 9xxxxx block so they never collide with app-allocated
// numbers, and they double as the idempotent upsert key.
interface SeedTicket {
  ticketNumber: string;
  requesterEmail: string;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  ownerEmail: string | null;
  resolutionSignalled: boolean;
  publicComments: { authorEmail: string; body: string }[];
  internalNotes: { authorEmail: string; body: string }[];
}

const R = {
  somchai: "somchai.prasert@toktickit.test",
  nadia: "nadia.rahman@toktickit.test",
  anong: "anong.srisai@toktickit.test",
  peter: "peter.chen@toktickit.test",
};
const S = {
  isara: "isara.thongchai@toktickit.test",
  malee: "malee.boonmee@toktickit.test",
  decha: "decha.phumipat@toktickit.test",
};

const SEED_TICKETS: SeedTicket[] = [
  {
    ticketNumber: "TKT-2026-900001",
    requesterEmail: R.somchai,
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains within an hour",
    description: "The battery drops from 100% to 20% in about an hour even on idle. Started this week.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "NEW",
    ownerEmail: null,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: R.somchai, body: "Happy to bring the laptop in whenever suits." }],
    internalNotes: [],
  },
  {
    ticketNumber: "TKT-2026-900002",
    requesterEmail: R.nadia,
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Cannot access shared mailbox",
    description: "Access to the team shared mailbox disappeared after the last password reset.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "OPEN",
    ownerEmail: S.isara,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: S.isara, body: "Looking into the mailbox permissions now." }],
    internalNotes: [{ authorEmail: S.isara, body: "Delegation removed by the reset job; re-adding." }],
  },
  {
    ticketNumber: "TKT-2026-900003",
    requesterEmail: R.anong,
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Wi-Fi disconnects in the west building",
    description: "Wi-Fi drops every few minutes on the 3rd floor of the west building since Monday.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    currentStatus: "IN_PROGRESS",
    ownerEmail: S.malee,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: S.malee, body: "We've identified a failing access point and ordered a replacement." }],
    internalNotes: [{ authorEmail: S.malee, body: "AP-3W-04 failing; RMA raised, ETA 2 days." }],
  },
  {
    ticketNumber: "TKT-2026-900004",
    requesterEmail: R.peter,
    categoryName: "Software",
    relatedSystemName: "LEB2 App",
    summary: "LEB2 export produces an empty file",
    description: "Exporting a grade report from LEB2 downloads a 0 KB file regardless of the course.",
    requestedPriority: "MEDIUM",
    itPriority: "HIGH",
    currentStatus: "WAITING_FOR_REQUESTER",
    ownerEmail: S.isara,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: S.isara, body: "Could you confirm which browser and version you're using?" }],
    internalNotes: [{ authorEmail: S.isara, body: "Suspected browser popup-blocker; awaiting requester detail." }],
  },
  {
    ticketNumber: "TKT-2026-900005",
    requesterEmail: R.somchai,
    categoryName: "Software",
    relatedSystemName: "VPN",
    summary: "VPN client fails to start on Windows",
    description: "The VPN client shows 'service unavailable' and never connects after the OS update.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    currentStatus: "RESOLVED",
    ownerEmail: S.decha,
    resolutionSignalled: true,
    publicComments: [{ authorEmail: S.decha, body: "Reinstalling the VPN service resolved it — please confirm you can connect." }],
    internalNotes: [{ authorEmail: S.decha, body: "Windows update stopped the helper service; reinstalled and re-enabled auto-start." }],
  },
  {
    ticketNumber: "TKT-2026-900006",
    requesterEmail: R.nadia,
    categoryName: "Hardware",
    relatedSystemName: "Printer",
    summary: "Printer jams on every duplex job",
    description: "The 4th-floor printer jams whenever double-sided printing is selected.",
    requestedPriority: "LOW",
    itPriority: "LOW",
    currentStatus: "CLOSED",
    ownerEmail: S.malee,
    resolutionSignalled: true,
    publicComments: [{ authorEmail: S.malee, body: "Duplex roller replaced and tested. Closing the ticket — reopen if it recurs." }],
    internalNotes: [{ authorEmail: S.malee, body: "Worn duplex roller; replaced from spares." }],
  },
  {
    ticketNumber: "TKT-2026-900007",
    requesterEmail: R.anong,
    categoryName: "Account and Access",
    relatedSystemName: "Grade Submission App",
    summary: "Locked out after too many attempts",
    description: "Account locked following failed logins; the earlier unlock did not hold.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "REOPENED",
    ownerEmail: S.isara,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: R.anong, body: "It locked again this morning — reopening." }],
    internalNotes: [{ authorEmail: S.isara, body: "Lockout recurring; checking for a stale cached credential." }],
  },
  {
    ticketNumber: "TKT-2026-900008",
    requesterEmail: R.peter,
    categoryName: "Network",
    relatedSystemName: "VPN",
    summary: "Request for a second VPN profile",
    description: "Asked for an additional VPN profile for a contractor who has since left.",
    requestedPriority: "LOW",
    itPriority: "MEDIUM",
    currentStatus: "CANCELLED",
    ownerEmail: null,
    resolutionSignalled: false,
    publicComments: [{ authorEmail: R.peter, body: "No longer needed — please cancel." }],
    internalNotes: [],
  },
];

// Upserting on the unique `name` keeps category/related-system seeding idempotent.
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

// Keyed on `email`. Role and activation state are re-applied on update so the seed
// is the source of truth (BR-63). Every account gets the documented dev password;
// mustChangePassword is false so the credentials are immediately usable (BR-65).
export async function seedUsers(prisma: PrismaClient, passwordHash: string) {
  for (const { name, email, role, isActive } of USERS) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, isActive, passwordHash, mustChangePassword: false },
      create: { name, email, role, isActive, passwordHash, mustChangePassword: false },
    });
  }
}

// Idempotent Ticket seeding: upsert each demo Ticket on its reserved Ticket Number,
// then replace its comments and notes wholesale so a re-run produces the identical
// set with no duplicates (BR-62).
export async function seedTickets(prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const systems = await prisma.relatedSystem.findMany({ select: { id: true, name: true } });
  const userId = (email: string) => users.find((u) => u.email === email)!.id;
  const categoryId = (name: string) => categories.find((c) => c.name === name)!.id;
  const systemId = (name: string) => systems.find((s) => s.name === name)!.id;

  for (const t of SEED_TICKETS) {
    const requesterId = userId(t.requesterEmail);
    const ownerId = t.ownerEmail ? userId(t.ownerEmail) : null;
    const data = {
      requesterId,
      categoryId: categoryId(t.categoryName),
      relatedSystemId: systemId(t.relatedSystemName),
      summary: t.summary,
      description: t.description,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      currentStatus: t.currentStatus,
      ownerId,
      resolutionSignalledAt: t.resolutionSignalled ? new Date() : null,
      resolutionSignalledById: t.resolutionSignalled ? requesterId : null,
    };
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: data,
      create: { ticketNumber: t.ticketNumber, ...data },
    });

    // Replace comments/notes so re-running the seed never accumulates duplicates.
    await prisma.publicComment.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.internalNote.deleteMany({ where: { ticketId: ticket.id } });
    for (const c of t.publicComments) {
      await prisma.publicComment.create({
        data: { ticketId: ticket.id, authorId: userId(c.authorEmail), body: c.body },
      });
    }
    for (const n of t.internalNotes) {
      await prisma.internalNote.create({
        data: { ticketId: ticket.id, authorId: userId(n.authorEmail), body: n.body },
      });
    }
  }
}

export async function seed(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);
  await seedCategories(prisma);
  await seedRelatedSystems(prisma);
  await seedUsers(prisma, passwordHash);
  await seedTickets(prisma);
}

async function main() {
  const prisma = getPrisma();
  try {
    await seed(prisma);
    const byRole = (role: Role) => USERS.filter((u) => u.role === role);
    console.log(
      `Seeded ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEM_NAMES.length} related systems, ` +
        `${USERS.length} users (${byRole(Role.REQUESTER).length} requesters, ` +
        `${byRole(Role.IT_STAFF).length} IT staff, ${byRole(Role.ADMINISTRATOR).length} admin), ` +
        `and ${SEED_TICKETS.length} tickets across every status. Dev password: ${DEV_PASSWORD}`
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
