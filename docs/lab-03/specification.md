# Lab 3 Sprint Engineering Specification

**Project:** TokTickIT — IT Service Desk
**Sprint:** Lab 3 — Users, Roles, IT Staff Ticketing, and Admin Screens
**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)
**Peer reviewer:** Nantakorn Pinsupaporn (67070501028, @copter549365)
**Builds on:** [Lab 2 contract](../lab-02/specification.md) — merged to `main`
**Status:** Approved for implementation

> **Numbering.** FR, BR, AC, and D identifiers restart at 01 for this sprint and
> live in the `lab-03` namespace, matching `server/tests/lab-03/` and
> `client/tests/lab-03/`. A reference to a Lab 2 rule is always written with its
> file, e.g. *Lab 2 BR-28*.

---

## 1. Sprint Goal

Replace the temporary Development Requester selector with real authentication and
server-enforced role-based authorization, without losing a single Ticket or
Attachment created in Lab 2. Three roles become real: a Requester keeps every
Lab 2 function under their authenticated identity and gains Public Comments, IT
Staff get an operational Ticket Queue and a Ticket Detail screen with ownership,
IT Priority, status workflow and Internal Notes, and an Administrator gets one
minimalist User Management screen. Every protected operation is enforced in the
backend; a hidden button is feedback, not a security control.

---

## 2. Stakeholder Request Interpretation

My reading of the request:

- **Identity moves from a client-chosen id to a verified credential.** Lab 2's
  `X-Requester-Id` header was deliberately shaped like an auth header (Lab 2
  D-07) so this swap changes the middleware, not every route. That design
  promise is now called in.
- **Migration is the risk, not the feature.** Login is well-trodden; silently
  breaking the FK from an existing Ticket to its owner is the failure that would
  actually cost data. The migration must rename and extend, never recreate.
- **Authorization is two separate questions.** *Do you own this?* (ownership,
  answered with 404 so existence stays hidden) and *is your role allowed?*
  (role, answered with 403 because existence is already known). Conflating them
  either leaks data or produces confusing errors.
- **Internal Notes are the new confidentiality boundary.** Public Comments and
  Internal Notes live on the same Ticket and must never be confusable — in the
  API, in the UI, or by accident when staff are typing.
- **The Administrator screen is deliberately small.** The handout excludes more
  than it includes. Scope discipline here is graded as much as the feature.
- **Zen Green is inherited, not re-decided.** New screens extend Lab 2's tokens
  and components; this sprint adds no new visual system.

---

## 3. Scope

### 3.1 Included

| Area | Delivered |
|------|-----------|
| Authentication | Email + password login, logout, current-user, password hashing, session lifecycle |
| First-login password change | Mandatory change before any application screen is reachable |
| Data migration | `RequesterUser` → `User` with roles and credentials; every Lab 2 Ticket and Attachment preserved |
| Role-based authorization | Server-enforced matrix for Requester, IT Staff, Administrator on every protected route |
| Requester regression | Every Lab 2 ticket and attachment function, now under the authenticated identity |
| Public Comments | Append-only, visible to Requester, IT Staff, Administrator |
| Internal Notes | Append-only, visible to IT Staff and Administrator only |
| Resolution signal | Requester marks "problem appears resolved"; staff still decide |
| IT Staff Ticket Queue | Shared queue with search, filters, sorting, pagination |
| IT Staff Ticket Detail | Ownership claim/reassign, IT Priority, permitted status transitions |
| Administrator User Management | List, search, role filter, create, edit, activate/deactivate, set initial password |
| Testing | Unit, API, UI component, UI style, responsive, **authorization**, **migration/regression**, E2E |

### 3.2 Explicitly excluded

- **Identity services:** email invitations, password-reset email, MFA, social
  login, SSO, self-registration, Requester-created accounts, account unlocking,
  administrator approval workflows, account recovery.
- **Administrator extras:** user deletion, bulk operations, import/export, role
  history, account audit history, multiple roles per user, departments,
  organizations, profile photos, mandatory pagination, multi-column sorting,
  multiple simultaneous filters.
- **Ticket workflow extras:** Actions Taken (Lab 4), SLA calculation, escalation
  rules, notification services.
- **Analytics:** dashboards and KPIs beyond simple queue counts.
- **Infrastructure:** multi-tenancy, production deployment, cloud changes.
- **Comment/Note editing and deletion** — both are append-only this sprint.

---

## 4. Functional Requirements

### Authentication and session

| ID | Requirement |
|----|-------------|
| **FR-01** | The system shall authenticate a user from an email address and password and establish an authenticated session. |
| **FR-02** | The system shall return the authenticated user's identity and role to the client. |
| **FR-03** | The system shall terminate the session on logout so the credential can no longer be used. |
| **FR-04** | The system shall require a user flagged for password change to set a new password before any other application screen or protected API becomes usable. |
| **FR-05** | The system shall let an authenticated user change their own password. |

### Authorization

| ID | Requirement |
|----|-------------|
| **FR-06** | The backend shall derive the acting user from the session, never from a client-supplied identifier. |
| **FR-07** | The backend shall enforce the §6.1 authorization matrix on every protected route, independently of what the UI displays. |
| **FR-08** | The client shall present only navigation destinations permitted for the authenticated role. |

### Requester

| ID | Requirement |
|----|-------------|
| **FR-09** | Every Lab 2 Requester function — create ticket, owned list with search/filter/sort/pagination, ticket detail, attachment upload/download/soft-removal — shall continue to work under the authenticated identity. |
| **FR-10** | The Development Requester selector, its route, its client state, and the `X-Requester-Id` header shall be removed. |
| **FR-11** | A Requester shall post Public Comments on a Ticket they own. |
| **FR-12** | A Requester shall signal that the reported problem appears resolved, without changing the Ticket status. |

### IT Staff

| ID | Requirement |
|----|-------------|
| **FR-13** | IT Staff shall retrieve a shared Ticket Queue covering every Ticket, with search, filters, sorting, and pagination. |
| **FR-14** | IT Staff shall open any Ticket's detail regardless of who submitted it. |
| **FR-15** | IT Staff shall claim an unassigned Ticket, reassign it to another permitted user, or release it to unassigned. |
| **FR-16** | IT Staff shall change a Ticket's IT Priority. |
| **FR-17** | IT Staff shall move a Ticket through the §5.7 transition matrix. |
| **FR-18** | IT Staff shall post Public Comments and create Internal Notes. |

### Administrator

| ID | Requirement |
|----|-------------|
| **FR-19** | An Administrator shall list users with search by name or email and an optional role filter. |
| **FR-20** | An Administrator shall create a user with a name, email address, one permitted role, activation state, and an initial password. |
| **FR-21** | An Administrator shall edit a user's name, email address, role, and activation state. |
| **FR-22** | An Administrator shall set a new initial password that the user must change at next login. |

### Cross-cutting

| ID | Requirement |
|----|-------------|
| **FR-23** | Every screen that fetches or submits shall present loading, validation, success, empty, no-results, forbidden, not-found, conflict, and safe-failure feedback where meaningful. |
| **FR-24** | Every Lab 3 screen shall remain usable at desktop, tablet, and mobile with no horizontal page scrolling. |

---

## 5. Business Rules

### 5.1 Authentication

| ID | Rule |
|----|------|
| **BR-01** | Only an active user with valid credentials may authenticate. |
| **BR-02** | A user marked as requiring a password change cannot enter the normal application until a new valid password is saved. |
| **BR-03** | The authenticated user identity, not an identifier supplied by the client, determines ownership of Requester operations. |
| **BR-04** | Passwords are never stored or logged in plaintext and never returned by any endpoint. |
| **BR-05** | A failed login returns one uniform message — "Email or password is incorrect" — whether the email is unknown or the password is wrong, so the endpoint cannot be used to enumerate accounts. |
| **BR-06** | A **deactivated** account is told so only after its credentials verify correctly. Wrong credentials on a deactivated account still return the uniform BR-05 message. |
| **BR-07** | Lab 3 applies no account lockout, because account unlocking is excluded from scope (§3.2). Brute-force resistance rests on the bcrypt work factor and the uniform error. |
| **BR-08** | A session expires 8 hours after it is issued, and logout invalidates it immediately for every subsequent request. |
| **BR-09** | The session credential is stored in an `httpOnly` cookie so client JavaScript can never read it. |
| **BR-10** | A new password is 12–128 characters, must differ from the current password, and is rejected if it appears in the documented trivial-password blocklist. No composition rules are applied, following NIST SP 800-63B. |
| **BR-11** | Changing a password invalidates every other session belonging to that user. |
| **BR-12** | Email addresses are unique, compared case-insensitively, and stored lower-cased. |

### 5.2 Authorization

| ID | Rule |
|----|------|
| **BR-13** | Every protected route resolves the acting user from the session before any other work; an unauthenticated request is rejected with 401 and no resource is read. |
| **BR-14** | A request that is authenticated but whose **role** is not permitted is rejected with 403. The resource's existence is already known to the caller, so hiding it would serve no purpose. |
| **BR-15** | A request that is authenticated and role-permitted but targets a resource the caller does **not own** is rejected with 404, identically to a resource that does not exist (continues Lab 2 BR-28). |
| **BR-16** | Hiding or disabling a control in the UI is feedback only. Every rule in §6.1 is independently enforced by the backend and proven by a test that bypasses the UI. |

### 5.3 Roles

| ID | Rule |
|----|------|
| **BR-17** | A user holds exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. |
| **BR-18** | Ticket operations are performed by IT Staff and Administrator; user administration is performed by Administrator alone. The §6.1 matrix is authoritative. |
| **BR-19** | Role is assigned only by an Administrator; no user may change their own role. |

### 5.4 Requester behaviour

| ID | Rule |
|----|------|
| **BR-20** | A Requester sees only Tickets they submitted, in the list and in detail. |
| **BR-21** | A Requester may post Public Comments only on a Ticket they own. |
| **BR-22** | A Requester may signal "problem appears resolved" only on a Ticket they own, and only while the Ticket is in a non-terminal status. |
| **BR-23** | The resolution signal records a timestamp and the signalling user. It does **not** change the Ticket status — only IT Staff or an Administrator may set `RESOLVED` or `CLOSED`. |
| **BR-24** | A Requester may never read, create, or infer the existence of Internal Notes. |

### 5.5 Ticket ownership

| ID | Rule |
|----|------|
| **BR-25** | A Ticket has zero or one Ticket Owner. A Ticket may remain unassigned indefinitely. |
| **BR-26** | A Ticket Owner must be an **active** user whose role is `IT_STAFF` or `ADMINISTRATOR`. |
| **BR-27** | IT Staff may claim an unassigned Ticket, reassign an assigned Ticket to another permitted user, or release it back to unassigned. |
| **BR-28** | Assigning a Ticket to a deactivated user, or to a Requester, is rejected. |
| **BR-29** | Deactivating a user does not orphan their Tickets; existing ownership is preserved and remains visible, but they can receive no new assignment (BR-26). |

### 5.6 Priority

| ID | Rule |
|----|------|
| **BR-30** | Requested Priority stays exactly as the Requester submitted it and is never editable after creation. |
| **BR-31** | IT Priority is initialised to the Requested Priority when the Ticket is created. |
| **BR-32** | IT Priority may thereafter be changed only by IT Staff or an Administrator, and uses the same `LOW` / `MEDIUM` / `HIGH` set as Requested Priority. |

### 5.7 Status workflow

| ID | Rule |
|----|------|
| **BR-33** | The status set is `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. |
| **BR-34** | A new Ticket starts at `NEW` (continues Lab 2 BR-02). |
| **BR-35** | Only the transitions in the matrix below are permitted. Any other transition is rejected as a conflict, and the Ticket is left untouched. |
| **BR-36** | `CLOSED` and `CANCELLED` are terminal: no transition leaves them. |
| **BR-37** | Every status change is performed only by IT Staff or an Administrator. A Requester never changes status by any route. |
| **BR-38** | Moving to `CANCELLED` requires a confirmation step in the UI, because it is terminal and irreversible. |
| **BR-39** | A status change on a Ticket with no owner is permitted; claiming is encouraged by the UI but not enforced, so an unassigned Ticket can still be cancelled or triaged. |

**Transition matrix** — rows are the current status, columns the target.

| from ↓ / to → | OPEN | IN_PROGRESS | WAITING | RESOLVED | CLOSED | REOPENED | CANCELLED |
|---|---|---|---|---|---|---|---|
| **NEW** | ✅ | ✅ | — | — | — | — | ✅ |
| **OPEN** | — | ✅ | ✅ | — | — | — | ✅ |
| **IN_PROGRESS** | — | — | ✅ | ✅ | — | — | ✅ |
| **WAITING_FOR_REQUESTER** | — | ✅ | — | ✅ | — | — | ✅ |
| **RESOLVED** | — | — | — | — | ✅ | ✅ | — |
| **REOPENED** | — | ✅ | ✅ | ✅ | — | — | ✅ |
| **CLOSED** | — | — | — | — | — | — | — |
| **CANCELLED** | — | — | — | — | — | — | — |

`NEW → IN_PROGRESS` is allowed so a staff member who picks up a ticket and starts
work immediately is not forced through a bookkeeping step. `RESOLVED → REOPENED`
is the route back when a fix did not hold; a Requester asks for it through a
Public Comment or the resolution signal, and staff perform it (BR-37).

### 5.8 Public Comments and Internal Notes

| ID | Rule |
|----|------|
| **BR-40** | Public Comments are visible to the Ticket's Requester, IT Staff, and Administrator. |
| **BR-41** | Internal Notes are visible only to IT Staff and Administrator. |
| **BR-42** | Both are append-only. Editing and deletion are excluded from Lab 3. |
| **BR-43** | Each entry records its author and creation time from the backend; neither is accepted from the client. |
| **BR-44** | Body text is trimmed before validation and must be 1–2000 characters. Empty or whitespace-only content is rejected. |
| **BR-45** | Content is rendered as plain text, never as HTML, so a comment can never inject markup into another user's page. |
| **BR-46** | Comments and Notes may not be added to a Ticket in a terminal status (`CLOSED`, `CANCELLED`). |
| **BR-47** | The two are visually distinct wherever they appear, and the Internal Note composer states its audience, so private text cannot be posted publicly by accident. |

### 5.9 Administrator user management

| ID | Rule |
|----|------|
| **BR-48** | An Administrator creates a user with a name, email address, exactly one permitted role, an activation state, and an initial password. |
| **BR-49** | A user created by an Administrator always starts flagged for a password change. |
| **BR-50** | An Administrator updates only a user's name, email address, role, and activation state. |
| **BR-51** | A duplicate email address is rejected (BR-12). |
| **BR-52** | An invalid role value is rejected. |
| **BR-53** | Setting a new initial password re-flags the user for a password change and invalidates that user's existing sessions. |
| **BR-54** | An Administrator may not deactivate their own account. |
| **BR-55** | An Administrator may not change their own role, since doing so would be a self-escalation or a self-lockout path. |
| **BR-56** | The system must always retain at least one active Administrator. Any edit that would remove the last one — by deactivation or by role change — is rejected. |
| **BR-57** | Users are deactivated, never deleted. |

### 5.10 Migration and regression

| ID | Rule |
|----|------|
| **BR-58** | Every Lab 2 Ticket and Attachment survives the migration with its identifiers and relationships unchanged. |
| **BR-59** | The migration **renames and extends** the existing `RequesterUser` table rather than creating a replacement and copying rows, so primary keys and foreign keys are never rewritten. |
| **BR-60** | Every migrated Lab 2 Requester becomes a `REQUESTER` user, keeps its activation state, receives the documented development initial password, and is flagged for a password change. |
| **BR-61** | Lab 2's acceptance criteria continue to hold after migration and are re-run as regression tests. |

### 5.11 Seed

| ID | Rule |
|----|------|
| **BR-62** | The seed is idempotent, upserting on natural keys (continues Lab 2 BR-09). |
| **BR-63** | The seed provides at least four active and one inactive Requester, at least three active and one inactive IT Staff, and at least one active Administrator. |
| **BR-64** | The seed provides Tickets spread across Requesters, statuses, priorities, and assigned/unassigned ownership, plus example Public Comments and Internal Notes containing no sensitive content. |
| **BR-65** | Seeded credentials are development-only, identical for every seeded account, and documented in the README. No real personal password or production secret is committed. |

---

## 6. Authorization Matrix

### 6.1 Operations

`own` = only the caller's own Ticket. `any` = any Ticket. `—` = forbidden.

| Operation | Requester | IT Staff | Administrator |
|-----------|-----------|----------|---------------|
| Log in, log out, read own identity | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| Read reference data (categories, systems) | ✅ | ✅ | ✅ |
| Create a Ticket | ✅ | — | — |
| List own Tickets | ✅ | ✅ | ✅ |
| Read Ticket detail | own | any | any |
| Upload / download / soft-remove Attachment | own | any | any |
| Post Public Comment | own | any | any |
| Read Public Comments | own | any | any |
| Signal "problem appears resolved" | own | — | — |
| Read the shared Ticket Queue | — | ✅ | ✅ |
| Claim / reassign / release ownership | — | ✅ | ✅ |
| Set IT Priority | — | ✅ | ✅ |
| Change status | — | ✅ | ✅ |
| Create / read Internal Notes | — | ✅ | ✅ |
| List permitted assignees | — | ✅ | ✅ |
| List, create, edit users; set initial password | — | — | ✅ |

**Why Administrator holds Ticket operations.** §4.3 of the handout asks that the
two responsibilities stay conceptually separate, and §4.5 then states that a
Ticket Owner may be "an active IT Staff **or Administrator** user" and that IT
Priority may be changed "only by IT Staff **or Administrator**". This matrix
resolves that by granting the Administrator the IT Staff ticket operations at the
**API** level, exactly as §4.3 allows when the approved matrix says so, while
keeping the **screens** separate: the Administrator's navigation leads to User
Management, and the queue is reachable but not promoted. IT Staff never gain user
administration.

**A Requester cannot create a Ticket on behalf of anyone**, and IT Staff cannot
create Tickets at all this sprint — ticket intake stays a Requester function, as
in Lab 2.

### 6.2 Status codes for refusals

| Situation | Status | Reasoning |
|-----------|--------|-----------|
| No session, or an expired or invalidated session | 401 | Nothing is read before the check (BR-13) |
| Session valid, password change outstanding | 403 with `passwordChangeRequired: true` | Lets the client route to the change screen (BR-02) |
| Role not permitted | 403 | Existence already known (BR-14) |
| Role permitted but resource not owned, or absent | 404 | Existence hidden (BR-15) |
| Internal Note read attempted by a Requester | 403, no note content | Ticket existence is already known to its owner (AC-24) |

---

## 7. UI Specification Summary

Full detail lives in [`ui-spec.md`](./ui-spec.md). Lab 3 **inherits** Lab 2's Zen
Green tokens, control states, button hierarchy, badge component, screen states,
and responsive rules unchanged; it adds no second visual system.

### 7.1 Shell changes

- The Development Requester name and Change Requester action are **removed**.
- The shell shows the authenticated user's name and a **role badge**.
- A **Logout** action and a **Change password** action are available.
- Navigation is role-specific: a Requester sees My Tickets and Create Ticket; IT
  Staff see the Ticket Queue; an Administrator sees User Management. Destinations
  the role cannot use are not rendered at all (FR-08).

### 7.2 New screens

| Screen | Purpose |
|--------|---------|
| Login | Email, password, validation, busy state, safe failure, distinct deactivated-account message |
| Change Password | Mandatory on first login; also reachable voluntarily. New password, confirmation, rules shown before submission |
| IT Staff Ticket Queue | Every Ticket, with search, filters, sorting, pagination, ownership and status columns, and an open-detail action |
| IT Staff Ticket Detail | Lab 2's detail plus ownership, IT Priority, status transitions, Public Comments, Internal Notes |
| Administrator User Management | One screen: list, search, role filter, create, edit, activate/deactivate, set initial password |

### 7.3 Changed screens

- **Requester Ticket Detail** gains Public Comments and the "Problem appears
  resolved" action, and keeps its Lab 2 attachment panel unchanged.
- **Requester Selection** is deleted outright, along with its route and its
  `localStorage` state.

### 7.4 Comment and note presentation

Public Comments and Internal Notes appear in clearly separated regions with
distinct surfaces and headings. The Internal Note composer carries a persistent
"Visible to IT Staff only" label next to the input, not only in a heading above
it, so the audience is unmistakable at the moment of typing (BR-47).

### 7.5 Badges

One shared badge component covers Ticket status (8 values), Requested Priority,
IT Priority, and user role. Every badge carries text; colour never carries the
meaning alone (continues Lab 2 AC-39).

---

## 8. Data Changes

### 8.1 New and changed models

```prisma
enum Role {
  REQUESTER
  IT_STAFF
  ADMINISTRATOR
}

enum TicketStatus {          // extended from Lab 2's single NEW value
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}

/// Lab 2's RequesterUser, renamed and extended (BR-59). Ids are preserved, so
/// every existing Ticket.requesterId and Attachment.uploadedById still resolves.
model User {
  id                 Int      @id @default(autoincrement())
  name               String
  email              String   @unique                 // stored lower-cased (BR-12)
  role               Role     @default(REQUESTER)
  passwordHash       String
  mustChangePassword Boolean  @default(true)
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  submittedTickets Ticket[]       @relation("SubmittedBy")
  ownedTickets     Ticket[]       @relation("OwnedBy")
  sessions         Session[]
  comments         PublicComment[]
  notes            InternalNote[]
  resolutionSignals Ticket[]      @relation("ResolutionSignalledBy")
  uploaded         Attachment[]   @relation("UploadedBy")
  removed          Attachment[]   @relation("RemovedBy")

  @@index([role, isActive])      // the Administrator list's only filter (FR-19)
}

/// Server-side session. The cookie carries a random token; only its SHA-256
/// digest is stored, so a database read cannot reconstruct a usable credential.
model Session {
  id        Int      @id @default(autoincrement())
  tokenHash String   @unique
  userId    Int
  createdAt DateTime @default(now())
  expiresAt DateTime

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

model PublicComment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  body      String   @db.VarChar(2000)
  createdAt DateTime @default(now())

  ticket Ticket @relation(fields: [ticketId], references: [id])
  author User   @relation(fields: [authorId], references: [id])

  @@index([ticketId, createdAt])
}

model InternalNote {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  body      String   @db.VarChar(2000)
  createdAt DateTime @default(now())

  ticket Ticket @relation(fields: [ticketId], references: [id])
  author User   @relation(fields: [authorId], references: [id])

  @@index([ticketId, createdAt])
}
```

`Ticket` gains, keeping every Lab 2 column and index:

```prisma
  itPriority                RequestedPriority              // initialised from requestedPriority (BR-31)
  ownerId                   Int?                           // zero or one owner (BR-25)
  resolutionSignalledAt     DateTime?
  resolutionSignalledById   Int?

  owner                 User? @relation("OwnedBy", fields: [ownerId], references: [id])
  resolutionSignalledBy User? @relation("ResolutionSignalledBy", fields: [resolutionSignalledById], references: [id])
  publicComments        PublicComment[]
  internalNotes         InternalNote[]

  @@index([ownerId, updatedAt(sort: Desc)])
  @@index([currentStatus, itPriority])
```

`Ticket.requesterId` **keeps its name** and now points at `User`. Renaming it to
`submittedById` would churn the Lab 2 API, its tests, and the client for no
behavioural gain.

### 8.2 Justified design decisions

**Rename, do not recreate (BR-59).** Prisma's `migrate dev` renders a model
rename as `DROP TABLE` + `CREATE TABLE`, which would destroy every row and break
`Ticket.requesterId`. The migration is therefore generated with
`--create-only` and hand-edited to
`ALTER TABLE "RequesterUser" RENAME TO "User"` followed by `ADD COLUMN`
statements. PostgreSQL carries foreign-key constraints through a table rename, so
no Ticket or Attachment relationship is touched — which is exactly what BR-58
requires and what the migration test asserts.

**Store only the digest of the session token.** The cookie holds 32 random bytes;
the row holds `SHA-256(token)`. A leaked database backup therefore yields no
usable session. SHA-256 rather than bcrypt is correct here: the input is already
256 bits of entropy, so there is nothing to slow down a guesser about, and login
paths must stay fast.

**Sessions in the database, not in memory.** An in-process store loses every
session on restart and cannot express BR-08 or BR-11 truthfully. A row per
session makes "logout invalidates" and "password change invalidates other
sessions" a `DELETE` that a test can observe directly.

**`(ownerId, updatedAt DESC)` composite index.** The queue's default view is "my
assigned work, most recently touched first", which filters on `ownerId` and sorts
on `updatedAt`. A single-column index would still force a sort of the matched
rows; the composite satisfies both from one scan — the same reasoning as Lab 2's
`(requesterId, ticketDate DESC)`.

**`itPriority` is a real column, not a computed fallback.** Deriving "IT Priority
= Requested Priority until changed" would make an explicit staff decision
indistinguishable from a default, and would make the queue's priority filter
ambiguous. A copied column at creation keeps both values independently truthful
(BR-30, BR-31).

### 8.3 Migration plan

One migration, `lab3_users_roles_workflow`, applied in this order:

1. `CREATE TYPE "Role"`.
2. `ALTER TYPE "TicketStatus" ADD VALUE` ×7 — additive, no data migration, as
   Lab 2 §7.3 anticipated.
3. `ALTER TABLE "RequesterUser" RENAME TO "User"`.
4. `ALTER TABLE "User" ADD COLUMN "role" … DEFAULT 'REQUESTER'`,
   `"passwordHash" TEXT NOT NULL DEFAULT ''`,
   `"mustChangePassword" BOOLEAN NOT NULL DEFAULT true`.
5. `UPDATE "User" SET email = lower(email)` (BR-12).
6. `ALTER TABLE "Ticket" ADD COLUMN "itPriority" …`, then
   `UPDATE "Ticket" SET "itPriority" = "requestedPriority"` so every existing
   Ticket gets a truthful value, then `SET NOT NULL` (BR-31).
7. `ALTER TABLE "Ticket" ADD COLUMN "ownerId"`, `"resolutionSignalledAt"`,
   `"resolutionSignalledById"` — all nullable, all with FKs.
8. `CREATE TABLE "Session"`, `"PublicComment"`, `"InternalNote"`.
9. Create the new indexes.

The empty-string `passwordHash` default exists only so the column can be `NOT
NULL` during the transaction; the seed immediately replaces it for every row, and
BR-01 makes an account with an unusable hash unable to authenticate regardless.

### 8.4 Seed

Idempotent upserts on `email`. Lab 2's four active and one inactive Requester are
retained and gain credentials; three active IT Staff, one inactive IT Staff, and
one Administrator are added. Tickets are spread across Requesters, all eight
statuses, all three priorities, and both assigned and unassigned ownership, each
with example Public Comments and — on assigned Tickets — Internal Notes.

Every seeded account shares one documented development password, recorded in the
README, never a real credential (BR-65).

---

## 9. API Contract

Full detail lives in [`api-spec.md`](./api-spec.md).

### 9.1 Authentication mechanism

| Decision | Value |
|----------|-------|
| Password hashing | **bcrypt** (`bcryptjs`), work factor 10 |
| Session credential | 32 random bytes from `crypto.randomBytes`, base64url-encoded |
| At rest | `SHA-256(token)` in `Session.tokenHash`; the raw token is never stored |
| Transport | `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production |
| Lifetime | 8 hours absolute, no sliding renewal |
| Logout | Deletes the session row |
| CORS | Explicit origin allowlist with `credentials: true` — no wildcard |

### 9.2 Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/health` | public | Liveness (Lab 1) |
| POST | `/api/auth/login` | public | Authenticate, set the session cookie |
| POST | `/api/auth/logout` | authenticated | Invalidate the session |
| GET | `/api/auth/me` | authenticated | Current identity, role, and `mustChangePassword` |
| POST | `/api/auth/password` | authenticated | Change own password |
| GET | `/api/categories` | authenticated | Active categories |
| GET | `/api/related-systems` | authenticated | Active related systems |
| POST | `/api/tickets` | Requester | Create a Ticket |
| GET | `/api/tickets` | authenticated | Own Tickets, paginated (Lab 2 contract) |
| GET | `/api/tickets/:id` | own / staff / admin | Ticket detail, role-shaped |
| POST | `/api/tickets/:id/attachments` | own / staff / admin | Upload |
| GET | `/api/tickets/:id/attachments` | own / staff / admin | Metadata |
| GET | `/api/attachments/:id/download` | own / staff / admin | Download |
| DELETE | `/api/attachments/:id` | own / staff / admin | Soft removal |
| GET | `/api/tickets/:id/comments` | own / staff / admin | Public Comments |
| POST | `/api/tickets/:id/comments` | own / staff / admin | Add a Public Comment |
| POST | `/api/tickets/:id/resolution-signal` | Requester (own) | Signal apparent resolution |
| GET | `/api/tickets/:id/notes` | staff / admin | Internal Notes |
| POST | `/api/tickets/:id/notes` | staff / admin | Add an Internal Note |
| PATCH | `/api/tickets/:id/owner` | staff / admin | Claim, reassign, release |
| PATCH | `/api/tickets/:id/it-priority` | staff / admin | Set IT Priority |
| PATCH | `/api/tickets/:id/status` | staff / admin | Transition status |
| GET | `/api/staff/tickets` | staff / admin | The shared queue |
| GET | `/api/staff/assignees` | staff / admin | Active IT Staff and Administrators |
| GET | `/api/admin/users` | admin | List with search and role filter |
| POST | `/api/admin/users` | admin | Create a user |
| PATCH | `/api/admin/users/:id` | admin | Edit name, email, role, activation |
| POST | `/api/admin/users/:id/initial-password` | admin | Set a new initial password |

### 9.3 Queue query contract

```
GET /api/staff/tickets?search=&status=&itPriority=&categoryId=&ownerId=
                      &sort=itPriority&order=desc&page=1&pageSize=20
```

| Parameter | Values | Default |
|-----------|--------|---------|
| `search` | Ticket Number or Summary, case-insensitive | none |
| `status` | any `TicketStatus` | none |
| `itPriority` | `LOW` \| `MEDIUM` \| `HIGH` | none |
| `categoryId` | integer | none |
| `ownerId` | integer, or `unassigned`, or `me` | none |
| `sort` | `ticketDate` \| `updatedAt` \| `itPriority` \| `ticketNumber` | `updatedAt` |
| `order` | `asc` \| `desc` | `desc` |
| `page` | integer ≥ 1 | 1 |
| `pageSize` | 10 \| 20 \| 50 | 20 |

Invalid values fall back to the documented default rather than failing the
request, continuing Lab 2 BR-36. Every sort applies `id DESC` as a deterministic
secondary key. The response carries `page`, `pageSize`, `totalItems`,
`totalPages`, exactly as Lab 2's list does.

The queue defaults to `pageSize` 20 rather than the Requester list's 10 because a
triage view is scanned, not read.

### 9.4 Status codes

| Status | Used when |
|--------|-----------|
| 200 | Retrieval, update, logout, download |
| 201 | Ticket, comment, note, attachment, or user created |
| 400 | Validation failure; unknown reference id; malformed body |
| 401 | No session, expired session, invalidated session, failed login |
| 403 | Role not permitted; outstanding password change |
| 404 | Resource absent, or present but not owned by the caller |
| 409 | Duplicate email; invalid status transition; last-active-Administrator guard; self-deactivation; attachment limit (Lab 2) |
| 413 / 415 | Attachment size / type (Lab 2, unchanged) |
| 500 | Unexpected failure, reported safely |

Error bodies keep Lab 2's shape — `{ "error": string, "fields"?: object }` — and
never carry a stack trace, SQL, ORM text, or filesystem path.

---

## 10. Acceptance Criteria

### Authentication

| ID | Criterion |
|----|-----------|
| **AC-01** | Given an active user with valid credentials, when they log in, then a session is established and the response returns their identity and role. |
| **AC-02** | Given a user flagged for a password change, when login succeeds, then every normal application screen and protected API stays unavailable until a valid new password is saved. |
| **AC-03** | Given a wrong password, when login is attempted, then the response is the uniform BR-05 message and no session is created. |
| **AC-04** | Given an email that does not exist, when login is attempted, then the response is byte-identical to AC-03. |
| **AC-05** | Given a deactivated account with correct credentials, when login is attempted, then it is refused with a message naming deactivation, and no session is created. |
| **AC-06** | Given a deactivated account with a wrong password, when login is attempted, then the response is byte-identical to AC-03 and deactivation is not revealed. |
| **AC-07** | Given an authenticated session, when the user logs out, then the session is invalidated and the next protected request returns 401. |
| **AC-08** | Given a new password shorter than 12 characters, when it is submitted, then it is rejected with a field-level message and the old password still works. |
| **AC-09** | Given a valid password change, when it completes, then the user's other sessions are invalidated and the new password authenticates. |
| **AC-10** | Given no session, when any protected endpoint is requested, then 401 is returned and no resource is read. |
| **AC-11** | Given the session cookie, when client JavaScript reads `document.cookie`, then the session token is absent. |

### Authorization

| ID | Criterion |
|----|-----------|
| **AC-12** | Given an authenticated Requester, when the client supplies another user's identifier in the body or a header, then the backend still applies the authenticated identity and returns no other Requester's data. |
| **AC-13** | Given a Requester, when the shared Ticket Queue is requested, then 403 is returned and no queue data is exposed. |
| **AC-14** | Given a Requester, when any Administrator user endpoint is requested, then 403 is returned. |
| **AC-15** | Given IT Staff, when any Administrator user endpoint is requested, then 403 is returned. |
| **AC-16** | Given a Requester, when a Ticket belonging to another Requester is requested, then 404 is returned — identical to a Ticket that does not exist. |
| **AC-17** | Given IT Staff, when any Ticket is requested regardless of submitter, then it is returned. |

### Requester regression and comments

| ID | Criterion |
|----|-----------|
| **AC-18** | Given a Requester migrated from Lab 2, when they log in, then every Ticket they submitted in Lab 2 is listed with its original Ticket Number. |
| **AC-19** | Given a migrated Ticket, when it is opened, then its attachments, category, related system, and Requested Priority are unchanged from Lab 2. |
| **AC-20** | Given an authenticated Requester, when they create a Ticket, then it is stored against their authenticated identity and its IT Priority equals its Requested Priority. |
| **AC-21** | Given the application, when any route is visited, then no Development Requester selector, Change Requester action, or `X-Requester-Id` header exists. |
| **AC-22** | Given a Requester on a Ticket they own, when they post a Public Comment, then it is stored with their identity and a server timestamp and appears for IT Staff. |
| **AC-23** | Given a Requester, when they post a Public Comment on a Ticket they do not own, then 404 is returned. |
| **AC-24** | Given a Requester account, when an Internal Note endpoint is requested, then the operation is rejected with 403 and no note content is exposed. |
| **AC-25** | Given a Requester on a Ticket they own, when they signal the problem appears resolved, then the signal is recorded and the Ticket status is unchanged. |
| **AC-26** | Given whitespace-only body text, when a comment or note is submitted, then it is rejected with a field-level message. |

### IT Staff queue

| ID | Criterion |
|----|-----------|
| **AC-27** | Given IT Staff, when the queue loads, then Tickets submitted by every Requester are listed. |
| **AC-28** | Given queue filters, when a status or IT Priority filter is applied, then only matching Tickets are returned. |
| **AC-29** | Given `ownerId=unassigned`, when the queue is requested, then only Tickets with no owner are returned. |
| **AC-30** | Given more Tickets than one page, when page 2 is requested, then the next slice and correct pagination metadata are returned. |
| **AC-31** | Given invalid queue query parameters, when the queue is requested, then the documented defaults are applied and the request succeeds. |
| **AC-32** | Given filters that match nothing, when the queue renders, then the no-results state is shown, distinct from the empty state. |

### IT Staff ticket operations

| ID | Criterion |
|----|-----------|
| **AC-33** | Given an unassigned Ticket, when IT Staff claim it, then they become its Ticket Owner. |
| **AC-34** | Given an assigned Ticket, when IT Staff reassign it to another active IT Staff user, then ownership moves and the change is visible in the queue. |
| **AC-35** | Given a deactivated user or a Requester, when a Ticket is assigned to them, then the request is rejected and ownership is unchanged. |
| **AC-36** | Given a Ticket, when IT Staff change its IT Priority, then the new value is stored and its Requested Priority is unchanged. |
| **AC-37** | Given a Ticket in `NEW`, when IT Staff move it to `IN_PROGRESS`, then the transition succeeds. |
| **AC-38** | Given a Ticket in `RESOLVED`, when a transition to `IN_PROGRESS` is attempted, then 409 is returned and the status is unchanged. |
| **AC-39** | Given a Ticket in `CLOSED`, when any transition is attempted, then 409 is returned. |
| **AC-40** | Given IT Staff on any Ticket, when they create an Internal Note, then it is stored and is absent from every Requester-facing response for that Ticket. |
| **AC-41** | Given a Ticket in a terminal status, when a comment or note is submitted, then it is rejected. |
| **AC-42** | Given the Ticket Detail screen, when Public Comments and Internal Notes are displayed, then they are visually distinct and the note composer states its audience. |

### Administrator

| ID | Criterion |
|----|-----------|
| **AC-43** | Given an Administrator, when the user list loads, then Name, Email, Role, Status, and an Edit action are shown for each user. |
| **AC-44** | Given a search term, when the user list is filtered, then only users matching on name or email are returned. |
| **AC-45** | Given a role filter, when it is applied, then only users holding that role are returned. |
| **AC-46** | Given valid details, when an Administrator creates a user, then the account exists, holds exactly the chosen role, and is flagged for a password change. |
| **AC-47** | Given an email already in use, when a user is created or edited, then 409 is returned and no account is written. |
| **AC-48** | Given an invalid role value, when a user is created, then 400 is returned. |
| **AC-49** | Given an Administrator, when they attempt to deactivate their own account, then the request is rejected and the account stays active. |
| **AC-50** | Given exactly one active Administrator, when an attempt is made to deactivate or demote them, then 409 is returned. |
| **AC-51** | Given a new initial password set by an Administrator, when the user next logs in, then the mandatory password-change screen appears before any other screen. |
| **AC-52** | Given a new initial password set by an Administrator, when that user had an active session, then the session is invalidated. |

### Presentation

| ID | Criterion |
|----|-----------|
| **AC-53** | Given each role, when the shell renders, then only that role's navigation destinations are present in the DOM. |
| **AC-54** | Given each of desktop, tablet, and mobile, when every Lab 3 screen renders, then no horizontal page scrolling occurs and no label, message, or control is clipped or hidden. |
| **AC-55** | Given any Lab 3 screen, when it renders, then it uses the Lab 2 Zen Green tokens and introduces no literal colour. |
| **AC-56** | Given keyboard-only navigation, when the user moves through Login, Change Password, and the Internal Note composer, then focus stays visible and every control is reachable. |

Every criterion maps to at least one planned test in [`tests.md`](./tests.md).

---

## 11. Definition of Done

### 11.1 Product completion

- [ ] Everything in §3.1 is implemented; nothing from §3.2 has been added.
- [ ] AC-01…AC-56 are each satisfied and linked to passing test evidence.
- [ ] Unit, API, UI component, UI style, responsive, **authorization**,
      **migration/regression**, and E2E suites all pass from the documented
      commands on the final `main` branch.
- [ ] No test is skipped, disabled, `.todo`, or commented out.
- [ ] The §6.1 matrix is enforced server-side and every row is proven by a test
      that calls the API directly, bypassing the UI.
- [ ] Every Lab 2 acceptance criterion still passes after migration (BR-61).
- [ ] `npx prisma migrate reset --force` rebuilds the database and the seed is
      idempotent across repeated runs.
- [ ] A migration test proves Ticket and Attachment rows, ids, and relationships
      survive the rename (BR-58).
- [ ] No password appears in plaintext in the database, any response, or any log.
- [ ] The session cookie is `httpOnly` and unreadable from client JavaScript.
- [ ] The Development Requester selector, its route, its client state, and the
      `X-Requester-Id` header are gone from the codebase.
- [ ] Every screen implements loading, validation, success, empty, no-results,
      forbidden, not-found, conflict, and safe-failure feedback where meaningful.
- [ ] Desktop, tablet, and mobile screenshots exist for every Lab 3 screen under
      `artifacts/lab-03/screenshots/`.
- [ ] `.env` stays untracked; no credential or secret is committed.
- [ ] README setup, seeded-credential documentation, and test instructions are
      current and were followed on a clean checkout.

### 11.2 Course delivery

- [ ] Every unit of work has a GitHub Issue and its own feature branch.
- [ ] Every feature branch entered `lab3-staging` through a peer-reviewed PR.
- [ ] One release PR merged `lab3-staging` into `main`.
- [ ] Substantive review comments and replies exist in **both** directions,
      recorded in [`reviewer.md`](./reviewer.md).
- [ ] All Issues sit in **Done** on the Kanban board.
- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`,
      and `ai-use.md` are present and current.
- [ ] This specification was committed **before** the implementation PRs, with
      evidence of the commit date.
- [ ] The submission PDF uses the headings "Answer Part 1" through "Answer Part 9".

---

## 12. Assumptions and Decisions

| # | Decision | Reasoning |
|---|----------|-----------|
| **D-01** | Session cookie, not a JWT | A server-side session row makes BR-08 and BR-11 real: logout and password change delete rows, and a test can observe the invalidation. A stateless JWT cannot be revoked before expiry without adding a denylist — which is a session table wearing a disguise. |
| **D-02** | `bcryptjs`, work factor 10 | bcrypt is the conventional, well-reviewed choice. The pure-JS build avoids a native toolchain on the Windows development machine, which would otherwise block a clean `npm install` for the peer reviewer. Factor 10 keeps the test suite usable while staying at the common floor; the factor is read from an environment variable so it can be raised without a code change. |
| **D-03** | Token: 32 random bytes, stored as `SHA-256` | 256 bits of entropy makes guessing infeasible, so a slow hash buys nothing and would tax every request. Storing only the digest means a database leak yields no usable session. |
| **D-04** | `httpOnly` cookie, not `localStorage` | `localStorage` is readable by any script on the page, so one XSS becomes full account takeover. `httpOnly` removes that path entirely (BR-09), and AC-11 asserts it. |
| **D-05** | `sameSite=lax` plus a strict CORS origin allowlist, **no CSRF token** | With `sameSite=lax` the cookie is not attached to cross-site form posts, and every state-changing route here is a JSON request that a foreign origin cannot make without passing the allowlist preflight. A separate double-submit token would add moving parts without closing a remaining hole. This is the §6.1 "CSRF considerations where applicable" judgement, and it is revisited if a cross-site form entry point is ever added. |
| **D-06** | 8-hour absolute session, no sliding renewal | Long enough for a working day, short enough that an unattended session dies the same day. Sliding renewal would let a stolen cookie live indefinitely. |
| **D-07** | Deactivation revealed only after credentials verify (BR-06) | §8.1 asks for a clear response for inactive accounts without exposing unnecessary information. Revealing it before the password is checked would turn login into an account-status oracle; revealing it after tells only the legitimate owner. |
| **D-08** | No account lockout (BR-07) | §3.2 excludes account unlocking. A lockout without an unlock path is a denial-of-service vector against a known email address. bcrypt's cost and the uniform error are the documented mitigation; rate limiting is recorded as deferred. |
| **D-09** | Password policy: 12–128, no composition rules | NIST SP 800-63B recommends length over character-class rules, which push users toward predictable substitutions. A short blocklist catches the obvious cases. |
| **D-10** | Table rename, not recreate (§8.2) | The only approach that preserves primary keys and foreign keys, and therefore the only one that satisfies BR-58 without rewriting `Ticket.requesterId`. |
| **D-11** | `Ticket.requesterId` keeps its name | Renaming it would ripple through the Lab 2 API, tests, and client for no behavioural gain, and would enlarge the regression surface during the riskiest migration of the course. |
| **D-12** | Administrator holds IT Staff ticket operations at the API level | §4.5 explicitly names the Administrator as a permitted Ticket Owner and IT Priority setter. §4.3 permits this where the approved matrix says so, which §6.1 now does. Screen separation is preserved through role-specific navigation. |
| **D-13** | Requester cannot cancel their own Ticket | §4.3's Requester list does not include it, and cancellation is terminal. The Requester's route is a Public Comment that staff act on. |
| **D-14** | Resolution signal is a timestamp, not a status | BR-05 forbids a Requester setting `RESOLVED`. A separate signal field keeps the staff decision and the customer's opinion independently visible, which a status value could not express. |
| **D-15** | One endpoint per resource, role-shaped responses | `GET /api/tickets/:id` serves both audiences, with Internal Notes present only for permitted roles. A parallel `/api/staff/tickets/:id` would duplicate ownership logic in two places — the classic way for one copy to drift and leak. |
| **D-16** | Comments and notes are rejected on terminal Tickets (BR-46) | A closed or cancelled Ticket is a record, not a conversation. Allowing appends would let a thread continue after the work formally ended. |
| **D-17** | Queue default page size 20, Requester list stays 10 | A triage view is scanned for patterns; a personal list is read. Different jobs, different densities. |
| **D-18** | Seeded accounts share one documented development password | A single documented value keeps the README honest and the peer reviewer unblocked. BR-49 forces a change at first login, so the shared value never becomes a real credential. |

### Open assumptions

- Rate limiting on the login endpoint is deferred; D-08 records the reasoning.
- Session cleanup of expired rows is handled lazily on lookup rather than by a
  scheduled job; a periodic sweep is deferred to Lab 4.
- Status-change history is not recorded. `updatedAt` carries the last change;
  a full audit trail is out of scope (§3.2) and deferred.
- Comment and note bodies are plain text only; rich text and file-in-comment are
  deferred.
