import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, type ActionStatus, type RequestedPriority, type TicketStatus } from "@prisma/client";
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

// Lab 4 additions (BR-59), kept apart from USERS so the Lab 2 and Lab 3 seed
// regressions, which pin those lists, run unchanged (BR-57):
//   • a second active Administrator, so the self-deactivation and
//     last-Administrator guards can be demonstrated separately;
//   • an active Requester with no Tickets — the Requester dashboard at zero;
//   • an active IT Staff member who owns and performs nothing — the staff
//     dashboard's "Assigned to me" and "My open actions" at zero.
export const LAB4_USERS: SeedUser[] = [
  { name: "Ratana Siriwan", email: "ratana.admin@toktickit.test", role: Role.ADMINISTRATOR, isActive: true },
  { name: "Lalita Chaiyo", email: "lalita.chaiyo@toktickit.test", role: Role.REQUESTER, isActive: true },
  { name: "Thanin Rakdee", email: "thanin.rakdee@toktickit.test", role: Role.IT_STAFF, isActive: true },
];

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
  actions?: SeedAction[];
}

// Lab 4 — one Action Taken on a seeded Ticket (§7.4). `hours` places it after the
// Ticket Date, so every time is fixed and in the past (BR-10).
interface SeedAction {
  hours: number;
  status: ActionStatus;
  performedByEmail: string;
  createdByEmail: string;
  description: string;
  result?: string;
  followUpNote?: string; // present = Follow-Up Required (BR-08)
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

export const SEED_TICKETS: SeedTicket[] = [
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
    // Several actions in all four statuses, performed by staff other than the
    // Owner (BR-02); still open, so the resolution gate would refuse (BR-25b).
    actions: [
      { hours: 2, status: "COMPLETED", performedByEmail: S.isara, createdByEmail: S.malee,
        description: "Surveyed signal strength across the 3rd floor of the west building.",
        result: "AP-3W-04 drops every client roughly every four minutes; the other APs are healthy." },
      { hours: 3, status: "CANCELLED", performedByEmail: S.decha, createdByEmail: S.malee,
        description: "Roll AP-3W-04 back to the previous firmware." },
      { hours: 4, status: "IN_PROGRESS", performedByEmail: S.malee, createdByEmail: S.malee,
        description: "Raise neighbouring AP power to cover the dead zone until the replacement arrives." },
      { hours: 5, status: "PLANNED", performedByEmail: S.decha, createdByEmail: S.malee,
        description: "Swap in the replacement access point when the RMA unit arrives." },
    ],
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
    // Exactly one Completed action, no follow-up: the resolution gate passes.
    actions: [
      { hours: 2, status: "COMPLETED", performedByEmail: S.isara, createdByEmail: S.isara,
        description: "Reproduced the empty export in Chrome and Edge.",
        result: "The export works once pop-ups are allowed for LEB2; asked the requester to confirm their browser." },
    ],
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
    actions: [
      { hours: 2, status: "COMPLETED", performedByEmail: S.decha, createdByEmail: S.decha,
        description: "Reinstalled the VPN helper service and set it to start automatically.",
        result: "The client connects on the first attempt after a reboot." },
    ],
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
    actions: [
      { hours: 2, status: "COMPLETED", performedByEmail: S.malee, createdByEmail: S.malee,
        description: "Replaced the duplex roller from spares and ran a 50-page duplex test.",
        result: "No jams across the test run." },
    ],
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
    // Worked, resolved, reopened, and worked again: the latest Completed action
    // requests follow-up, so the resolution gate refuses (BR-25c).
    actions: [
      { hours: 2, status: "COMPLETED", performedByEmail: S.isara, createdByEmail: S.isara,
        description: "Unlocked the account and reset the lockout counter.",
        result: "Account unlocked; sign-in confirmed with the requester." },
      { hours: 9, status: "COMPLETED", performedByEmail: S.isara, createdByEmail: S.isara,
        description: "Cleared cached credentials on the requester's laptop.",
        result: "A stale password in Windows Credential Manager was causing the repeated lockouts.",
        followUpNote: "Confirm with the requester after 48 hours that no new lockouts have occurred." },
    ],
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
// is the source of truth (BR-63). Every account gets the documented dev password
// (BR-65). Requesters carry the Lab 2 identities that the migration brought over,
// so they stay flagged for a password change (BR-60) — this is also the account
// set that demonstrates the mandatory first-login change (Part 5 evidence). IT
// Staff and the Administrator are freshly provisioned here and are immediately
// usable, so their demos need no change step.
export async function seedUsers(prisma: PrismaClient, passwordHash: string, users: SeedUser[] = USERS) {
  for (const { name, email, role, isActive } of users) {
    const mustChangePassword = role === Role.REQUESTER;
    await prisma.user.upsert({
      where: { email },
      update: { name, role, isActive, passwordHash, mustChangePassword },
      create: { name, email, role, isActive, passwordHash, mustChangePassword },
    });
  }
}

// Lab 4 — fixed Ticket Dates, one day apart from 1 September 2026, so history
// and action times are deterministic and always in the past (BR-10, BR-58).
const SEED_EPOCH = Date.UTC(2026, 8, 1, 2, 0, 0); // 09:00 Bangkok
const HOUR = 3_600_000;
const seedTicketDate = (index: number) => new Date(SEED_EPOCH + index * 24 * HOUR);

// The shortest path through the §5.3 transition matrix from NEW to each seeded
// status, so seeded history only ever shows permitted moves. Resolved, Closed,
// and Reopened pass through In Progress, where their Completed actions were done.
const STATUS_PATH: Record<TicketStatus, TicketStatus[]> = {
  NEW: [],
  OPEN: ["OPEN"],
  IN_PROGRESS: ["IN_PROGRESS"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "WAITING_FOR_REQUESTER"],
  RESOLVED: ["IN_PROGRESS", "RESOLVED"],
  CLOSED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  REOPENED: ["IN_PROGRESS", "RESOLVED", "REOPENED"],
  CANCELLED: ["CANCELLED"],
};

// Step 1 lands an hour after creation; later steps from hour 6, two hours apart,
// so actions at hours 2–5 fall inside the In Progress window, before resolution.
const stepHours = (step: number) => (step === 0 ? 1 : 6 + (step - 1) * 2);

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

  for (const [index, t] of SEED_TICKETS.entries()) {
    const requesterId = userId(t.requesterEmail);
    const ownerId = t.ownerEmail ? userId(t.ownerEmail) : null;
    const ticketDate = seedTicketDate(index);
    const path = STATUS_PATH[t.currentStatus];
    const at = (hours: number) => new Date(ticketDate.getTime() + hours * HOUR);
    // BR-31: set on entering Resolved, kept through Closed, cleared on Reopened.
    const resolvedStep = path.indexOf("RESOLVED");
    const resolvedAt =
      resolvedStep >= 0 && t.currentStatus !== "REOPENED" ? at(stepHours(resolvedStep)) : null;
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
      ticketDate,
      resolvedAt,
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

    // Status history is append-only (BR-33), so it cannot be replaced like the
    // comments: it is written only when the Ticket has none (BR-58). Creation by
    // the Requester, then each step by the Owner (or an IT Staff member when the
    // Ticket is unassigned) — a Requester never changes status (BR-23).
    if ((await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })) === 0) {
      const actorId = ownerId ?? userId(S.isara);
      await prisma.ticketStatusChange.create({
        data: { ticketId: ticket.id, fromStatus: null, toStatus: "NEW", changedById: requesterId, changedAt: ticketDate },
      });
      for (const [step, toStatus] of path.entries()) {
        await prisma.ticketStatusChange.create({
          data: {
            ticketId: ticket.id,
            fromStatus: step === 0 ? "NEW" : path[step - 1],
            toStatus,
            changedById: actorId,
            changedAt: at(stepHours(step)),
          },
        });
      }
    }

    // Actions Taken upsert on (ticketId, clientRequestId) with fixed keys, so a
    // re-run updates rather than duplicates (BR-58, §7.4).
    for (const [n, a] of (t.actions ?? []).entries()) {
      const clientRequestId = `seed-${t.ticketNumber}-${n + 1}`;
      const actionAt = at(a.hours);
      const action = {
        actionAt,
        description: a.description,
        result: a.result ?? "",
        status: a.status,
        performedById: userId(a.performedByEmail),
        createdById: userId(a.createdByEmail),
        followUpRequired: a.followUpNote !== undefined,
        followUpNote: a.followUpNote ?? "",
        completedAt: a.status === "COMPLETED" ? actionAt : null,
      };
      await prisma.actionTaken.upsert({
        where: { ticketId_clientRequestId: { ticketId: ticket.id, clientRequestId } },
        update: action,
        create: { ticketId: ticket.id, clientRequestId, ...action },
      });
    }
  }
}

export async function seed(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);
  await seedCategories(prisma);
  await seedRelatedSystems(prisma);
  await seedUsers(prisma, passwordHash);
  await seedUsers(prisma, passwordHash, LAB4_USERS);
  await seedTickets(prisma);
}

async function main() {
  const prisma = getPrisma();
  try {
    await seed(prisma);
    const all = [...USERS, ...LAB4_USERS];
    const byRole = (role: Role) => all.filter((u) => u.role === role);
    const actions = SEED_TICKETS.reduce((n, t) => n + (t.actions?.length ?? 0), 0);
    console.log(
      `Seeded ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEM_NAMES.length} related systems, ` +
        `${all.length} users (${byRole(Role.REQUESTER).length} requesters, ` +
        `${byRole(Role.IT_STAFF).length} IT staff, ${byRole(Role.ADMINISTRATOR).length} admins), ` +
        `${SEED_TICKETS.length} tickets across every status, and ${actions} actions taken. ` +
        `Dev password: ${DEV_PASSWORD}`
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
