# Lab 4 Sprint Engineering Specification

**Project:** TokTickIT — IT Service Desk
**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression
**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)
**Peer reviewer:** Nantakorn Pinsupaporn (67070501028, @copter549365)
**Builds on:** [Lab 3 contract](../lab-03/specification.md) — merged to `main` (PR #46)
**Status:** Approved for implementation

> **Numbering.** FR, BR, AC, and D identifiers restart at 01 for this sprint and
> live in the `lab-04` namespace, matching `server/tests/lab-04/` and
> `client/tests/lab-04/`. An earlier rule is always written with its lab, e.g.
> *Lab 3 BR-35*. Every Lab 3 rule stays in force unless §5.10 names it as changed.

---

## 1. Sprint Goal

Complete the TokTickIT service-desk workflow. IT Staff and Administrators record
the actual work on a Ticket as a chronological list of **Actions Taken**, each
with a performer, a result, and an optional follow-up, while the Ticket Owner
keeps coordinating the Ticket as a whole. A Ticket can be **Resolved** only when
that recorded work supports it, and the backend enforces this even when the
screen is bypassed. Every status change is kept in an append-only history, and
no user can silently overwrite another user's newer change. Requesters, IT
Staff, and Administrators each land on a concise **dashboard** whose every number
is computed by the backend and links to the detailed list behind it. Every
Lab 1–3 feature keeps working under one coherent, responsive, accessible Zen
Green application.

---

## 2. Stakeholder Request Interpretation

My reading of the request:

- **The Ticket becomes a parent of work, not just a conversation.** Comments and
  notes say what people *said*; Actions Taken say what was *done*, by whom,
  with what result, and whether more is needed. They are a separate record with
  their own lifecycle.
- **Coordination and execution are different jobs.** The Ticket Owner is
  accountable for the Ticket; any IT Staff member may perform an individual
  action. The performer is therefore a field on the action, distinct from both
  the Ticket Owner and the person who typed the entry.
- **"Resolved" must mean something.** Today any IT Staff member can mark a
  Ticket Resolved with nothing recorded. The resolution rule ties the status to
  finished work, and it lives in the backend because a client can always skip
  the screen.
- **The Requester's opinion is still advisory.** "It seems fixed" stays a signal
  next to the status, never the status itself (Lab 3 D-14 carries over).
- **Two people editing at once must not lose work silently.** With several staff
  on one Ticket, a stale screen must be refused with a clear message, not
  accepted as last-write-wins.
- **Dashboards are doorways, not reports.** Each one answers "what needs me
  now?" in a handful of numbers and short lists, and every number leads to the
  existing screen that shows the detail. No charts, exports, or BI.
- **This is the final sprint.** Regression across Labs 1–3 and the polish of the
  whole product are graded as much as the new features.

---

## 3. Scope

### 3.1 Included

| Area | Delivered |
|------|-----------|
| Actions Taken | Model, migration, create / edit / status (Planned → In Progress → Completed / Cancelled), performer assignment, follow-up, attachment notes; staff editing and Requester read-only view on Ticket Detail |
| Ticket workflow | Final transition matrix (Lab 3 matrix retained), backend resolution gate, gate-aware permitted transitions, append-only status history |
| Stale-update protection | Integer `version` on Ticket and Action Taken; every ticket-field and action write is version-checked |
| Duplicate protection | Idempotency key on Action Taken creation; single-flight submit buttons everywhere |
| Dashboards | Requester dashboard, IT Staff dashboard, Administrator dashboard (the IT Staff dashboard plus user-account counts) |
| Drill-down | List screens read their filters from the URL so a dashboard link opens the matching filtered view |
| Navigation | A Dashboard entry for every role, used as the post-login landing page; Administrator gains Ticket Queue |
| Database | Additive migration with backfill, documented rollback, idempotent seed with 0 / 1 / many Actions Taken and zero / non-zero metrics |
| Hardening | Labs 1–3 regression, consistent feedback states, data-preserving forms, no console errors or placeholder UI, current README |
| Testing | Unit, API, authorization, workflow and concurrency, migration/regression, UI component, UI style, responsive and accessibility, performance smoke, E2E |

### 3.2 Explicitly excluded

Carried from labsheet §4.2, plus the limits this contract sets:

- **Automation:** SLA clocks, escalation engines, on-call scheduling, breach
  notifications, and any scheduled job.
- **Notifications:** email, SMS, LINE, push, or any external service.
- **Operations accounting:** inventory, spare parts, purchasing, service cost,
  time sheets, billing, payroll, labour-cost calculation.
- **Approvals:** multi-level approval workflows and electronic signatures.
- **Analytics:** charts, BI tools, custom report builders, exports, date-range
  pickers on dashboards.
- **Infrastructure:** multi-tenancy and production-scale cloud operations.
- **Action Taken extras:** deleting an action, editing a Completed or Cancelled
  action, uploading files *into* an action (Attachment Notes are text that point
  at the Ticket's existing attachments), multiple performers per action, and a
  standalone "all actions" screen.
- **Status history extras:** editing or deleting history, and history for
  fields other than status.
- Any feature not approved in this contract.

---

## 4. Functional Requirements

### Actions Taken

| ID | Requirement |
|----|-------------|
| **FR-01** | IT Staff and Administrators shall create an Action Taken on a Ticket with Action Date/Time, Action Description, Result, Performed by, Follow-Up Required?, Follow-up Note, and Attachment Notes. |
| **FR-02** | The system shall record the creating user automatically and let the creator choose *Performed by* from active IT Staff and Administrators, defaulting to themselves. |
| **FR-03** | IT Staff and Administrators shall edit an Action Taken while it is Planned or In Progress. |
| **FR-04** | IT Staff and Administrators shall move an Action Taken through its status lifecycle (§5.2): start, complete, or cancel it. |
| **FR-05** | Ticket Detail shall list every Action Taken on the Ticket in stable chronological order — editable for IT Staff and Administrators, read-only for the Ticket's Requester. |

### Ticket workflow

| ID | Requirement |
|----|-------------|
| **FR-06** | IT Staff and Administrators shall change a Ticket's status only along the §5.3 transition matrix. |
| **FR-07** | The backend shall refuse a move to Resolved unless the resolution gate (§5.4) is satisfied, regardless of the client. |
| **FR-08** | Ticket Detail shall offer only the transitions currently permitted, explain why Resolved is unavailable when the gate blocks it, and refresh the Ticket summary after a successful change. |
| **FR-09** | The system shall append one status-history entry for every Ticket creation and every status change, and show the history on Ticket Detail with role-appropriate detail. |
| **FR-10** | The backend shall refuse a stale ticket or action write with a conflict response, and the client shall keep the user's entered data and offer to reload. |
| **FR-11** | A Requester's "problem appears resolved" signal shall remain advisory and never change the status (continues Lab 3 FR-12). |

### Dashboards

| ID | Requirement |
|----|-------------|
| **FR-12** | A Requester shall see a dashboard summarising only their own Tickets: metrics, Tickets needing their attention, recently updated, and recently resolved Tickets. |
| **FR-13** | IT Staff shall see an operational dashboard: unassigned, owned-by-me, my open Actions Taken, high-priority, by-status and by-IT-Priority counts, urgent and recently updated Tickets. |
| **FR-14** | An Administrator shall see the IT Staff dashboard plus concise user-account counts. |
| **FR-15** | Every dashboard number and list shall be computed by the backend and link to a detailed screen that shows the same set (§5.5). |
| **FR-16** | My Tickets, the Ticket Queue, and User Management shall initialise their filters from the URL query string, so a dashboard link reproduces the filtered view. |
| **FR-17** | Each role shall have a Dashboard navigation entry, and the dashboard shall be the landing page after login. |

### Hardening and regression

| ID | Requirement |
|----|-------------|
| **FR-18** | Every Lab 1–3 function shall remain available to its permitted roles and behave as its contract states, except where §5.6 names a deliberate change. |
| **FR-19** | Repeated clicks and network retries shall not create duplicate records (§5.7). |
| **FR-20** | Important forms — Create Ticket, Action Taken, comment, note, user create/edit — shall keep entered data after a recoverable failure. |
| **FR-21** | Every screen shall present loading, validation, success, empty / no-results, forbidden, not-found, conflict, and safe-failure feedback where meaningful, using the shared components. |
| **FR-22** | Console errors, broken links, placeholder text, and unfinished, duplicate, or obsolete controls shall be removed. |
| **FR-23** | Every screen shall remain usable at desktop, tablet, and mobile widths with no horizontal page scrolling, visible focus, keyboard operation, and non-colour status cues (Lab 2 / Lab 3 rules). |
| **FR-24** | The README shall document setup, migration, seed, seeded accounts, tests, rollback, and a demonstration script that is current for `main`. |

---

## 5. Business Rules

### 5.1 Actions Taken — structure and validation

| ID | Rule |
|----|------|
| **BR-01** | An Action Taken belongs to exactly one Ticket. It is never moved to another Ticket. |
| **BR-02** | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by a different IT Staff member. *Performed by* is independent of the Ticket Owner and of the creator. |
| **BR-03** | *Created by* is set by the backend from the session and is never accepted from the client. |
| **BR-04** | *Performed by* must be an **active** user whose role is `IT_STAFF` or `ADMINISTRATOR`. It defaults to the creator when omitted. Choosing a deactivated user or a Requester is rejected (mirrors Lab 3 BR-26/BR-28). |
| **BR-05** | An action whose performer is later deactivated keeps that performer and stays visible; an edit that does not change *Performed by* is still accepted. |
| **BR-06** | Action Description is required: trimmed, 1–2000 characters. |
| **BR-07** | Result is optional while Planned or In Progress (trimmed, 0–2000 characters) and **required** (1–2000) for the action to be Completed. |
| **BR-08** | Follow-Up Required? is a yes/no value, default **no**. When **yes**, Follow-up Note is required (trimmed, 1–1000). When **no**, any Follow-up Note sent is discarded and stored as empty. |
| **BR-09** | Attachment Notes are optional plain text (trimmed, 0–500) describing which of the Ticket's files or images to look at. They are not an upload and create no Attachment. |
| **BR-10** | Action Date/Time is required. It must not be earlier than the Ticket's Ticket Date. It may lie in the future only while the action is **Planned**; starting or completing an action requires an Action Date/Time no later than the server's current time plus a five-minute clock-skew allowance. |
| **BR-11** | All text is rendered as plain text, never HTML (continues Lab 3 BR-45). |
| **BR-12** | Actions Taken are listed in ascending Action Date/Time, with the action id as the tie-breaker, so the order is stable across reloads and identical for every viewer. |

### 5.2 Actions Taken — lifecycle and permissions

| ID | Rule |
|----|------|
| **BR-13** | Action statuses are `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. A new action may start as Planned, In Progress, or Completed (to record work already done), never as Cancelled. |
| **BR-14** | Permitted action transitions: Planned → In Progress, Planned → Completed, Planned → Cancelled, In Progress → Completed, In Progress → Cancelled. Completed and Cancelled are final. |
| **BR-15** | Only Planned and In Progress actions are editable. Completed and Cancelled actions are a record: a correction is made by adding a new action. |
| **BR-16** | Cancelling an action requires a confirmation step in the UI. |
| **BR-17** | Only IT Staff and Administrators create, edit, or change the status of an Action Taken, on any Ticket. A Requester never does, by any route. |
| **BR-18** | A Requester may read every Action Taken on a Ticket they own, all fields included, read-only. Creator identity and email addresses are never shown to a Requester; the performer appears by name. |
| **BR-19** | Actions may be created or changed only while the Ticket is in an **active** status (BR-46): not on a Resolved Ticket (reopen it first) and not on a Closed or Cancelled one. |
| **BR-20** | When a Ticket is Cancelled, its Planned and In Progress actions are cancelled in the same transaction, so no open work survives on a dead Ticket. |

### 5.3 Ticket status — final transition matrix

| ID | Rule |
|----|------|
| **BR-21** | The statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`. A Ticket starts at `NEW`. |
| **BR-22** | Only the transitions below are permitted; any other is a conflict and leaves the Ticket untouched. `CLOSED` and `CANCELLED` are terminal. |
| **BR-23** | Every status change is performed by IT Staff or an Administrator. A Requester never changes status by any route. |
| **BR-24** | Moving to `CANCELLED` requires a UI confirmation (continues Lab 3 BR-38). |

The Lab 3 matrix is retained unchanged; Lab 4 adds the resolution gate on the
`→ RESOLVED` cells (marked ✅ᴳ). Authorized roles for every ✅ cell: **IT Staff,
Administrator**.

| from ↓ / to → | OPEN | IN_PROGRESS | WAITING | RESOLVED | CLOSED | REOPENED | CANCELLED |
|---|---|---|---|---|---|---|---|
| **NEW** | ✅ | ✅ | — | — | — | — | ✅ |
| **OPEN** | — | ✅ | ✅ | — | — | — | ✅ |
| **IN_PROGRESS** | — | — | ✅ | ✅ᴳ | — | — | ✅ |
| **WAITING_FOR_REQUESTER** | — | ✅ | — | ✅ᴳ | — | — | ✅ |
| **RESOLVED** | — | — | — | — | ✅ | ✅ | — |
| **REOPENED** | — | ✅ | ✅ | ✅ᴳ | — | — | ✅ |
| **CLOSED** | — | — | — | — | — | — | — |
| **CANCELLED** | — | — | — | — | — | — | — |

### 5.4 Resolution gate and resolution signal

| ID | Rule |
|----|------|
| **BR-25** | A Ticket may move to `RESOLVED` only when **all** hold: (a) it has at least one `COMPLETED` action; (b) it has no `PLANNED` or `IN_PROGRESS` action; (c) its most recent Completed action — by Action Date/Time, then id — does not request follow-up. |
| **BR-26** | A follow-up is satisfied by recording the follow-up work as a newer Completed action that requests no further follow-up. Follow-up flags are never cleared by editing a Completed action (BR-15). |
| **BR-27** | The gate is evaluated by the backend inside the status-change transaction, under a lock on the Ticket row, so an action written concurrently cannot slip past it. A blocked move returns 409 naming every unmet condition. |
| **BR-28** | Ticket Detail lists `RESOLVED` as an available transition only when the gate is satisfied, and otherwise shows the unmet conditions in plain language. |
| **BR-29** | The gate applies only to entering `RESOLVED`. Tickets already Resolved or Closed when Lab 4 is deployed keep their status. A Reopened Ticket must satisfy the gate again, counting all of its actions. |
| **BR-30** | The Requester's resolution signal stays advisory: it records who signalled and when, never changes the status, and does not satisfy the gate (continues Lab 3 D-14). |
| **BR-31** | `Ticket.resolvedAt` is set to the transition time when a Ticket enters `RESOLVED` and cleared when it enters `REOPENED`. A Resolved → Closed move keeps it. |

### 5.5 Status history

| ID | Rule |
|----|------|
| **BR-32** | Ticket creation appends one history entry (*from* empty → `NEW`, by the Requester). Every successful status change appends one entry with *from*, *to*, the acting user, and the time, in the same transaction as the change. |
| **BR-33** | Status history is **append-only**: no API updates or deletes it, and the database rejects `UPDATE` and `DELETE` on the table. |
| **BR-34** | History is shown oldest first, ordered by change time then id, so ties are stable. |
| **BR-35** | IT Staff and Administrators see who made each change. The Ticket's Requester sees *from*, *to*, and when, with the actor shown as "IT Support" for staff changes. |
| **BR-36** | A failed or refused transition (409, 403, 404) appends nothing. |

### 5.6 Concurrency and stale updates

| ID | Rule |
|----|------|
| **BR-37** | Ticket and Action Taken each carry an integer `version`, starting at 1. |
| **BR-38** | `Ticket.version` increments on every change to status, owner, or IT Priority. `ActionTaken.version` increments on every edit or status change of that action. |
| **BR-39** | Every request that changes a Ticket's status, owner, or IT Priority, or edits an Action Taken, must send the `expectedVersion` the client last read. A missing or non-integer value is a 400. |
| **BR-40** | If `expectedVersion` differs from the stored version, the write is refused with 409, nothing changes, and the response carries the current version and current state so the client can show what changed. |
| **BR-41** | The version comparison and the write happen in one conditional update (`WHERE id = ? AND version = ?`), so two simultaneous writers cannot both succeed. |
| **BR-42** | Creating an Action Taken, posting a comment or note, uploading an attachment, and the resolution signal are additive and are not version-checked. Every Action Taken create, edit, or status change also sets `Ticket.updatedAt`, so the work appears in *Recently updated*; it does not change `Ticket.version`. |

### 5.7 Duplicate submissions

| ID | Rule |
|----|------|
| **BR-43** | Every submit button is disabled while its request is in flight and shows a busy label. |
| **BR-44** | Action Taken creation carries a client-generated `clientRequestId` (UUID), created once per open form. A repeat with the same key on the same Ticket returns the action already created (200) instead of creating another. If the key is omitted, the server generates one and the request is not idempotent. |
| **BR-45** | A retried version-checked write that already succeeded is refused by BR-40 rather than applied twice; the client reloads and shows the current state. |

### 5.8 Dashboard calculations

| ID | Rule |
|----|------|
| **BR-46** | **Active statuses** are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`. "Open" on every dashboard means *in an active status*. `RESOLVED` is counted separately as awaiting closure. |
| **BR-47** | Every metric is computed by the backend at request time from the database, using counts and bounded queries. Dashboard responses never contain full Ticket collections or descriptions. |
| **BR-48** | Every list on a dashboard holds at most **5** items, each with a deterministic order that ends in a tie-breaking id. |
| **BR-49** | Time windows are **rolling** durations from the server's current time — *last 7 days* is `now − 168 h` — so no calendar-day boundary or time-zone conversion affects a count. All timestamps are stored in UTC and displayed in the viewer's local time with the existing date formatters (the reference deployment is Asia/Bangkok, UTC+7). A record exactly on the window boundary is included. |
| **BR-50** | A metric with no matching records returns **0**, never null or an omitted key. A list with no matching records returns an empty array, and the UI shows a defined empty message for it. |
| **BR-51** | Each metric has one drill-down URL whose list shows exactly the counted set, where a list screen can express that filter. Where it cannot, the dashboard item links to the Ticket Detail of each listed row instead. |
| **BR-52** | Legacy data needs no special casing: legacy Tickets are counted by their current status; they have no actions, so they add 0 to action metrics; their `resolvedAt` is backfilled (§7.3). |
| **BR-53** | A Requester's dashboard counts only Tickets whose `requesterId` is the session user. The query is scoped by the backend; no client parameter can widen it. |

**Requester dashboard** — `GET /api/dashboard/requester`:

| Key | Label | Calculation (always `requesterId = me`) | Drill-down |
|-----|-------|------------------------------------------|------------|
| `openTickets` | Open tickets | status ∈ active | `/tickets?statusGroup=active` |
| `waitingForMe` | Waiting for you | status = `WAITING_FOR_REQUESTER` | `/tickets?status=WAITING_FOR_REQUESTER` |
| `awaitingClosure` | Resolved, awaiting closure | status = `RESOLVED` | `/tickets?status=RESOLVED` |
| `needsAttention[]` | Needs your attention | status = `WAITING_FOR_REQUESTER`; `updatedAt` desc, id desc; ≤ 5 | each row → `/tickets/:id`; *View all* → `/tickets?status=WAITING_FOR_REQUESTER` |
| `recentlyUpdated[]` | Recently updated | `updatedAt ≥ now − 7 days`; `updatedAt` desc, id desc; ≤ 5 | each row → `/tickets/:id`; *View all* → `/tickets?sort=updatedAt&order=desc` |
| `recentlyResolved[]` | Recently resolved | status ∈ {`RESOLVED`, `CLOSED`} and `resolvedAt ≥ now − 30 days`; `resolvedAt` desc, id desc; ≤ 5 | each row → `/tickets/:id` |

**IT Staff dashboard** — `GET /api/dashboard/staff`:

| Key | Label | Calculation | Drill-down |
|-----|-------|-------------|------------|
| `unassignedOpen` | Open and unassigned | `ownerId` null and status ∈ active | `/staff/tickets?ownerId=unassigned&statusGroup=active` |
| `mineOpen` | Open and assigned to me | `ownerId = me` and status ∈ active | `/staff/tickets?ownerId=me&statusGroup=active` |
| `myOpenActions` | My open actions | actions with `performedById = me`, status ∈ {`PLANNED`, `IN_PROGRESS`}, on a Ticket in an active status | the `myActions[]` list rows |
| `highPriorityOpen` | Open, high priority | `itPriority = HIGH` and status ∈ active | `/staff/tickets?itPriority=HIGH&statusGroup=active` |
| `byStatus` | By status | one count per each of the 8 statuses, all Tickets | `/staff/tickets?status=<STATUS>` |
| `openByItPriority` | Open by IT Priority | one count per `LOW` / `MEDIUM` / `HIGH`, status ∈ active | `/staff/tickets?itPriority=<P>&statusGroup=active` |
| `myActions[]` | My open actions | as `myOpenActions`; `actionAt` asc, id asc; ≤ 5 | each row → `/staff/tickets/:ticketId` |
| `urgent[]` | Urgent | status ∈ active and `itPriority = HIGH`; `ticketDate` asc (longest waiting first), id asc; ≤ 5 | each row → `/staff/tickets/:id`; *View all* → `/staff/tickets?itPriority=HIGH&statusGroup=active&sort=ticketDate&order=asc` |
| `recentlyUpdated[]` | Recently updated | `updatedAt ≥ now − 7 days`, all Tickets; `updatedAt` desc, id desc; ≤ 5 | each row → `/staff/tickets/:id`; *View all* → `/staff/tickets?sort=updatedAt&order=desc` |

**Administrator additions** — the same endpoint adds `userCounts` only when the
caller is an Administrator:

| Key | Label | Calculation | Drill-down |
|-----|-------|-------------|------------|
| `userCounts.activeByRole` | Active users by role | active users grouped by role — three counts, 0 where none | `/admin/users?role=<ROLE>` |
| `userCounts.inactive` | Inactive users | users with `isActive = false` | none (User Management has no status filter, Lab 3 §3.2) |

### 5.9 Migration, regression, and seed

| ID | Rule |
|----|------|
| **BR-54** | The Lab 4 migration is **additive**: it adds a column, two tables, an enum, a trigger, and indexes. It drops, renames, or rewrites no existing column or row. |
| **BR-55** | Every User, Ticket, Attachment, Public Comment, Internal Note, and Session from Lab 3 survives with identical ids and relationships. |
| **BR-56** | Every existing Ticket receives `version = 1`, exactly one backfilled history entry recording its current status (§7.3), and — if it is Resolved or Closed — a `resolvedAt` taken from its `updatedAt`. Legacy Tickets have zero Actions Taken, which is valid. |
| **BR-57** | A deliberate change to Lab 3 behaviour is listed in §5.10; every other Lab 3 acceptance criterion is re-run unchanged as regression. |
| **BR-58** | The seed stays idempotent: running it twice produces the same rows (continues Lab 3 BR-62). Actions Taken are upserted on `(ticketId, clientRequestId)` with fixed seed keys; history entries are added only when a seeded Ticket has none. |
| **BR-59** | The seed provides Tickets in all eight statuses, all three IT Priorities, assigned and unassigned; Tickets with **zero**, **one**, and **several** Actions Taken across all four action statuses, including a pending follow-up; a Requester with **no** Tickets and an IT Staff member with **no** owned Tickets or actions, so every dashboard metric can be shown at zero and non-zero; and a **second active Administrator**, so the Lab 3 self-deactivation and last-Administrator guards can be demonstrated separately. |

### 5.10 Deliberate changes to Lab 3 behaviour

| ID | Lab 3 behaviour | Lab 4 behaviour | Why |
|----|-----------------|-----------------|-----|
| **BR-60** | `→ RESOLVED` needed only a permitted matrix cell | It also needs the BR-25 gate | Labsheet §4.5 resolution rule |
| **BR-61** | Owner, IT Priority, and status PATCHes took no version | They require `expectedVersion` (BR-39) | Labsheet §6.1 stale updates |
| **BR-62** | IT Staff landed on the Queue, Administrators on User Management, Requesters on My Tickets | Every role lands on its Dashboard | Labsheet §7 Dashboard navigation |
| **BR-63** | Administrator navigation showed User Management only | Dashboard, Ticket Queue, User Management | D-04 |

The Lab 3 tests that exercise these four behaviours are updated to the new
contract — sending `expectedVersion`, completing an action before resolving,
and expecting the new landing pages — and the change is recorded in `tests.md`.
No other Lab 3 test is edited.

---

## 6. Authorization Matrix and UI Summary

### 6.1 Operations added or changed in Lab 4

`own` = only the caller's own Ticket. `any` = any Ticket. `—` = forbidden. Every
Lab 3 row (Lab 3 §6.1) continues unchanged.

| Operation | Requester | IT Staff | Administrator |
|-----------|-----------|----------|---------------|
| List Actions Taken on a Ticket | own (read-only) | any | any |
| Create an Action Taken | — | any | any |
| Edit an Action Taken / change its status | — | any | any |
| Be chosen as *Performed by* | — | if active | if active |
| Read status history | own (actor redacted) | any | any |
| Change Ticket status (gate on `→ RESOLVED`) | — | any | any |
| Read the Requester dashboard | ✅ | — | — |
| Read the IT Staff dashboard | — | ✅ | ✅ (+ user counts) |
| Open the Ticket Queue and Staff Ticket Detail screens | — | ✅ | ✅ |

Refusal semantics are unchanged from Lab 3 §6.2: 401 without a session, 403 with
`passwordChangeRequired` until the password is changed, **403** when the role is
not permitted, **404** when the Ticket or action is absent or not the
Requester's own — byte-identical to a nonexistent id. A Requester writing an
Action Taken on their own Ticket receives 403 (existence already known); on
someone else's Ticket, 404. Hiding a control is never the protection.

### 6.2 UI summary

Full detail lives in [`ui-spec.md`](./ui-spec.md). Lab 4 adds no new visual
system; it extends Lab 3's Zen Green tokens and components.

| Screen | Change |
|--------|--------|
| App shell | *Dashboard* first in every role's navigation with active-page indication; post-login landing is `/dashboard` |
| Requester Dashboard (new) | Three metric cards, then *Needs your attention*, *Recently updated*, *Recently resolved* lists |
| IT Staff Dashboard (new) | Four metric cards, by-status and by-IT-Priority count strips, then *My open actions*, *Urgent*, *Recently updated* lists |
| Administrator Dashboard (new) | The IT Staff dashboard plus a user-counts card |
| Staff Ticket Detail | New **Actions Taken** section: list, *Add action* create mode, view/edit mode, start / complete / cancel; status control lists only permitted transitions and explains a blocked Resolved; **Status history** section; conflict banner with *Reload* |
| Requester Ticket Detail | Read-only **Actions Taken** and **Status history** sections |
| My Tickets, Ticket Queue, User Management | Filters initialised from and written to the URL; `statusGroup=active` option |

Metric cards are links: label, value, and an accessible name such as "Open
tickets: 3 — view list". Every state — loading, empty, forbidden, safe failure,
conflict — reuses Lab 3's `States` components. Responsive and accessibility
rules are Lab 2 / Lab 3's: three viewports, no horizontal page scroll, visible
focus, keyboard-operable dialogs, non-colour status cues.

---

## 7. Data Changes

### 7.1 New and changed models

```prisma
enum ActionStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Ticket {
  // … every Lab 3 field unchanged …
  version    Int       @default(1)   // BR-37, optimistic concurrency
  resolvedAt DateTime?               // BR-31, dashboard "recently resolved"

  actions       ActionTaken[]
  statusChanges TicketStatusChange[]

  @@index([requesterId, resolvedAt(sort: Desc)])
  @@index([requesterId, updatedAt(sort: Desc)])
  @@index([updatedAt(sort: Desc)])
}

model ActionTaken {
  id               Int          @id @default(autoincrement())
  ticketId         Int
  actionAt         DateTime                      // Action Date/Time (BR-10)
  description      String       @db.VarChar(2000)
  result           String       @default("") @db.VarChar(2000)
  status           ActionStatus @default(PLANNED)
  performedById    Int                           // chosen, active staff/admin (BR-04)
  createdById      Int                           // from the session (BR-03)
  followUpRequired Boolean      @default(false)
  followUpNote     String       @default("") @db.VarChar(1000)
  attachmentNotes  String       @default("") @db.VarChar(500)
  clientRequestId  String       @db.VarChar(64)  // idempotency key (BR-44)
  version          Int          @default(1)
  completedAt      DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  ticket      Ticket @relation(fields: [ticketId], references: [id])
  performedBy User   @relation("ActionPerformedBy", fields: [performedById], references: [id])
  createdBy   User   @relation("ActionCreatedBy", fields: [createdById], references: [id])

  @@unique([ticketId, clientRequestId])
  @@index([ticketId, actionAt, id])          // the Ticket Detail list (BR-12)
  @@index([performedById, status])           // "my open actions" (§5.8)
}

model TicketStatusChange {
  id          Int           @id @default(autoincrement())
  ticketId    Int
  fromStatus  TicketStatus?                  // null for creation and backfill
  toStatus    TicketStatus
  changedById Int?                           // null only for backfilled rows
  changedAt   DateTime      @default(now())

  ticket    Ticket @relation(fields: [ticketId], references: [id])
  changedBy User?  @relation(fields: [changedById], references: [id])

  @@index([ticketId, changedAt, id])         // stable history order (BR-34)
}
```

`User` gains the three back-relations only; no `User` column changes.

Database-level guards added in the migration SQL, which Prisma cannot express:

```sql
-- BR-08: a follow-up needs its note.
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followUp_note"
  CHECK (NOT "followUpRequired" OR length(btrim("followUpNote")) > 0);
-- BR-07: a completed action needs its result.
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_completed_result"
  CHECK ("status" <> 'COMPLETED' OR length(btrim("result")) > 0);
-- BR-33: status history is append-only.
CREATE FUNCTION "reject_status_change_mutation"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'TicketStatusChange is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER "TicketStatusChange_append_only"
  BEFORE UPDATE OR DELETE ON "TicketStatusChange"
  FOR EACH ROW EXECUTE FUNCTION "reject_status_change_mutation"();
```

### 7.2 Justified design decisions

**1. Integer `version` columns, not `updatedAt`, for stale-update detection.**
`updatedAt` is also bumped by additive writes (comments, actions), so comparing
it would refuse a priority change merely because someone commented — a false
conflict. Its millisecond precision also lets two writes in the same instant
look identical. A dedicated integer changes only on the fields it protects
(BR-38), is compared in the same `UPDATE … WHERE version = ?` that writes the
row, and gives tests an exact value to assert. Cost: one `INTEGER` per row and an
`expectedVersion` field on four request bodies.

**2. Status history in its own append-only table, guarded by a trigger.**
Storing the latest change on `Ticket` (Lab 3's position) cannot show ordering
or answer "who reopened this?". A child table with one row per change gives the
stable order Part 7 asks for, through the `(ticketId, changedAt, id)` index.
"Append-only" is enforced in two layers: the API exposes no update or delete
route, and a `BEFORE UPDATE OR DELETE` trigger makes the database itself refuse,
so a future route or a manual query cannot quietly rewrite history. A test
proves the trigger fires.

**3. `ActionTaken` as a separate child table, not JSON on `Ticket`.**
Each action has its own lifecycle, version, performer foreign key, and
validation; dashboards must count them by performer and status. A JSON array
would lose foreign-key integrity — a performer could point at a deleted id — and
make "my open actions" a scan of every Ticket. The `(performedById, status)`
index answers that metric directly.

**4. Denormalised `Ticket.resolvedAt`.** "Recently resolved" could be derived
from the history table, but that is a correlated sub-query per Ticket on every
Requester dashboard load. One nullable timestamp, maintained in the same
transaction as the status change (BR-31) and indexed with `requesterId`, keeps
the query a single indexed range scan. The history table stays the audit record;
`resolvedAt` is a read optimisation that a test checks against it.

**5. Idempotency key on action creation.** A unique `(ticketId,
clientRequestId)` turns a retried POST into a lookup instead of a duplicate row,
which a disabled button alone cannot do when the network, not the user, retries.
It also gives the seed a natural key to upsert on (BR-58).

**6. Conditional-required rules as `CHECK` constraints too.** The API validates
BR-07 and BR-08 with field-level messages; the constraints make a bypassing
write — a script, a future route — fail rather than store a follow-up with no
note.

### 7.3 Migration, backfill, and recovery

One migration, `lab4_actions_workflow_dashboards`, created with
`prisma migrate dev --create-only` and edited by hand, applied in this order:

1. `CREATE TYPE "ActionStatus"`.
2. `ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1` — every
   existing row gets 1 in the same statement.
3. `ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3)`, then
   `UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN ('RESOLVED','CLOSED')`
   — the best available truth; Lab 3 recorded no resolution time.
4. `CREATE TABLE "ActionTaken"` with foreign keys, the unique key, and the two
   `CHECK` constraints.
5. `CREATE TABLE "TicketStatusChange"` with foreign keys.
6. Backfill: `INSERT INTO "TicketStatusChange" ("ticketId","fromStatus","toStatus","changedById","changedAt")
   SELECT "id", NULL, "currentStatus", NULL, "updatedAt" FROM "Ticket"` — one row
   per legacy Ticket recording the status it held at upgrade. `changedById` null
   is how the UI labels it "Recorded at upgrade".
7. Create the append-only function and trigger — **after** the backfill.
8. Create the new indexes.

**Legacy Tickets** have no actions and remain fully usable. They count in
dashboards by current status (BR-52). One already Resolved stays Resolved; to
resolve a legacy Ticket that is still active, staff record an action, as for any
Ticket.

**Recovery.** The migration is purely additive, which gives two independent
recovery routes:

- **Application rollback.** The Lab 3 build runs unchanged against the Lab 4
  schema: every new column has a default, the new tables are never read, and
  the trigger only affects a table Lab 3 does not touch. Redeploying `main` at
  the Lab 3 release commit is a complete rollback of behaviour.
- **Schema rollback.** `server/prisma/rollback/lab4_down.sql` drops the trigger,
  function, both tables, the two columns, and the enum, in reverse order. It is
  run in a recovery drill against a scratch database (`toktickit_rollback`)
  restored from a `pg_dump` of the seeded Lab 3 schema, and Lab 3's migration
  test then passes against it. The drill's output is recorded in `tests.md`.

Before running the migration on a database with data worth keeping, take
`pg_dump -Fc toktickit > before-lab4.dump`; `pg_restore` is the last-resort
recovery. The README documents all three.

### 7.4 Seed

Idempotent, extending Lab 3's (BR-58, BR-59):

| Seeded data | Purpose |
|-------------|---------|
| Lab 3 users, Tickets, comments, notes — unchanged | Regression baseline |
| A second active Administrator | Demonstrate self-deactivation and last-Administrator guards separately |
| An active Requester with no Tickets | Requester dashboard all-zero state |
| An active IT Staff member owning nothing and performing nothing | Staff dashboard zero state for *Assigned to me* and *My open actions* |
| Tickets in every status and IT Priority, assigned and unassigned | Non-zero `byStatus`, `openByItPriority`, *Unassigned*, *Urgent* |
| A Ticket with zero actions, one with exactly one Completed action, and one with several (Planned, In Progress, Completed, Cancelled), performed by different IT Staff than the Owner | List, BR-02, and gate demonstrations |
| An active Ticket whose latest Completed action requests follow-up | Gate refusal for an outstanding follow-up |
| An active Ticket with a single Completed action and no follow-up | Gate success |
| Status history for every seeded Ticket | History display and stable order |

Seeded Actions Taken use fixed `clientRequestId` values (`seed-<ticketNumber>-<n>`)
so a re-run updates instead of duplicating. All seeded accounts keep the single
documented development password (Lab 3 D-18).

---

## 8. API Contract

Full detail lives in [`api-spec.md`](./api-spec.md). Every Lab 2 and Lab 3
endpoint remains; the conventions, three-gate lifecycle, and error shape
(`{ "error": string, "fields"?: object }`) are unchanged.

### 8.1 New endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/tickets/:id/actions` | own / staff / admin | Actions Taken, ordered by BR-12; role-shaped |
| POST | `/api/tickets/:id/actions` | staff / admin | Create an action (idempotent on `clientRequestId`) |
| PATCH | `/api/actions/:id` | staff / admin | Edit fields and/or change action status; requires `expectedVersion` |
| GET | `/api/tickets/:id/status-history` | own / staff / admin | Append-only history, role-shaped |
| GET | `/api/dashboard/requester` | Requester | Requester dashboard (§5.8) |
| GET | `/api/dashboard/staff` | staff / admin | IT Staff dashboard; `userCounts` for Administrators |

### 8.2 Changed endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/tickets/:id` | Adds `version`, `resolvedAt`, and `resolutionGate: { satisfied, unmet[] }`; `permittedTransitions` omits `RESOLVED` when the gate is unmet |
| `PATCH /api/tickets/:id/status` | Requires `expectedVersion`; enforces the gate; appends history; sets/clears `resolvedAt`; cancels open actions on `→ CANCELLED`; response adds `version` |
| `PATCH /api/tickets/:id/owner`, `/it-priority` | Require `expectedVersion`; response adds `version` |
| `POST /api/tickets` | Also appends the creation history entry |
| `GET /api/tickets`, `GET /api/staff/tickets` | Accept `statusGroup=active` (ignored when `status` is also given; invalid values fall back to none, Lab 2 BR-36) |

### 8.3 Status codes

| Status | Lab 4 uses |
|--------|-----------|
| 200 | Reads; action edit; idempotent replay of an action create |
| 201 | Action created |
| 400 | Validation failure — field-level `fields`; missing `expectedVersion`; inactive or non-staff performer |
| 401 / 403 / 404 | As Lab 3 §6.2 |
| 409 | Stale version (`"conflict": "stale"`, with `current`); resolution gate unmet (`"conflict": "resolutionGate"`, with `unmet[]`); invalid ticket or action transition; write to a Resolved / terminal Ticket or a final action |
| 500 | Unexpected failure, reported without stack, SQL, or path |

---

## 9. Acceptance Criteria

### Actions Taken

| ID | Criterion |
|----|-----------|
| **AC-01** | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and the approved performer. |
| **AC-02** | Given no *Performed by* is sent, when an action is created, then the performer is the creator. |
| **AC-03** | Given IT Staff member A creates an action performed by IT Staff member B on a Ticket owned by C, then all three identities are stored as given and the Ticket Owner is unchanged (BR-02). |
| **AC-04** | Given a deactivated user, a Requester, or a nonexistent id as *Performed by*, when an action is created or edited, then 400 names `performedById` and nothing is saved. |
| **AC-05** | Given a `createdById` in the request body, then it is ignored and the session user is stored. |
| **AC-06** | Given a description that is empty or whitespace, or longer than 2000 characters, then 400 names `description`. |
| **AC-07** | Given Follow-Up Required? is yes and the note is empty, then 400 names `followUpNote`; given it is no, any note sent is stored as empty. |
| **AC-08** | Given status Completed and an empty Result, then 400 names `result`. |
| **AC-09** | Given an Action Date/Time earlier than the Ticket Date, or in the future for a non-Planned action, then 400 names `actionAt`; a future time on a Planned action is accepted. |
| **AC-10** | Given Attachment Notes over 500 characters, then 400 names `attachmentNotes`; given valid notes, no Attachment row is created. |
| **AC-11** | Given a Planned action, when it is moved to In Progress, then Completed, then each transition succeeds and the version increments each time. |
| **AC-12** | Given a Completed or Cancelled action, when any edit or status change is attempted, then 409 is returned and the action is unchanged. |
| **AC-13** | Given an attempt to create an action with status Cancelled, or to move Completed → In Progress, then the request is refused and nothing changes. |
| **AC-14** | Given an action is cancelled from the UI, then a confirmation dialog appears first and Cancel in the dialog leaves it untouched. |
| **AC-15** | Given a Ticket in Resolved, Closed, or Cancelled, when an action is created or edited, then 409 is returned. |
| **AC-16** | Given a Ticket with open actions, when it is Cancelled, then those actions become Cancelled in the same transaction and Completed ones are untouched. |
| **AC-17** | Given several actions with equal Action Date/Time, when the list is read twice, then the order is identical and follows id. |
| **AC-18** | Given the same `clientRequestId` posted twice on one Ticket, then exactly one action exists and the second response is 200 with that action. |
| **AC-19** | Given an action body containing `<script>`, when it is displayed, then it renders as literal text. |

### Authorization

| ID | Criterion |
|----|-----------|
| **AC-20** | Given a Requester, when they create or edit an action on their own Ticket by calling the API directly, then 403 is returned; on another Requester's Ticket, 404 byte-identical to a nonexistent id. |
| **AC-21** | Given a Requester and their own Ticket, when actions are listed, then every action is returned with the performer's name and without creator identity or any email. |
| **AC-22** | Given a Requester and another Requester's Ticket, when its actions or status history are requested, then 404 is returned. |
| **AC-23** | Given a Requester, when the staff dashboard is requested, then 403; given IT Staff or an Administrator, when the Requester dashboard is requested, then 403. |
| **AC-24** | Given an Administrator, when they create, edit, and complete an action, then each succeeds exactly as for IT Staff. |

### Ticket workflow

| ID | Criterion |
|----|-----------|
| **AC-25** | Given each cell of the §5.3 matrix, when that transition is attempted with the gate satisfied, then permitted cells succeed and every other cell returns 409 with the status unchanged. |
| **AC-26** | Given an active Ticket with no Completed action, when `→ RESOLVED` is sent directly to the API, then 409 with `conflict: "resolutionGate"` names the missing completed action, and the status is unchanged. |
| **AC-27** | Given a Ticket with a Completed action and also a Planned or In Progress one, when `→ RESOLVED` is attempted, then 409 names the open action. |
| **AC-28** | Given the most recent Completed action requests follow-up, when `→ RESOLVED` is attempted, then 409 names the outstanding follow-up; after a newer Completed action without follow-up is added, the same move succeeds. |
| **AC-29** | Given the gate is unmet, when Ticket Detail loads, then Resolved is absent from the status control and the unmet conditions are shown; once met, Resolved appears. |
| **AC-30** | Given a successful status change in the UI, then the summary status badge, permitted transitions, and history update without a page reload. |
| **AC-31** | Given a Requester's resolution signal on a Ticket with no actions, then the status is unchanged and the gate is still unmet. |
| **AC-32** | Given a Ticket enters Resolved, then `resolvedAt` is set; when it is Reopened, `resolvedAt` is cleared; when Resolved → Closed, it is kept. |

### Status history

| ID | Criterion |
|----|-----------|
| **AC-33** | Given a Ticket is created and moved NEW → OPEN → IN_PROGRESS, then its history has three entries in that order with the correct actors. |
| **AC-34** | Given a refused transition (409, 403, or 404), then no history entry is added. |
| **AC-35** | Given any client, when a history row is updated or deleted directly in the database, then the database raises an error and the row is unchanged. |
| **AC-36** | Given a Requester views their Ticket's history, then staff actors appear as "IT Support" and no staff name or email is present in the response. |

### Concurrency

| ID | Criterion |
|----|-----------|
| **AC-37** | Given two users read a Ticket at version *n* and both change its status, owner, or IT Priority, then exactly one succeeds and the other receives 409 `conflict: "stale"` carrying the current version and state. |
| **AC-38** | Given two users edit the same action at version *n*, then exactly one succeeds and the other receives 409 and the action holds only the winner's values. |
| **AC-39** | Given a status, owner, or IT Priority PATCH without `expectedVersion`, then 400 names `expectedVersion`. |
| **AC-40** | Given a stale write in the UI, then a conflict message with *Reload* appears and the user's typed values remain in the form. |
| **AC-41** | Given an action is being created while another request moves the same Ticket to Resolved, then the outcomes are consistent with the gate — never a Resolved Ticket with an open action. |

### Dashboards

| ID | Criterion |
|----|-----------|
| **AC-42** | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| **AC-43** | Given seeded data, when each Requester metric is retrieved, then it equals the count from the §5.8 calculation run directly against the database. |
| **AC-44** | Given seeded data, when each IT Staff metric is retrieved, then it equals the count from the §5.8 calculation run directly against the database, and `mineOpen` / `myOpenActions` reflect the calling user. |
| **AC-45** | Given a Requester with no Tickets, or IT Staff owning nothing, then every relevant metric is 0, every list is `[]`, and the UI shows the defined empty messages. |
| **AC-46** | Given more than five matching Tickets, then each list returns exactly five in the documented order. |
| **AC-47** | Given a Ticket updated exactly 7 days ago and one 7 days and 1 minute ago, then only the first appears in *Recently updated*. |
| **AC-48** | Given a metric's drill-down link is followed, then the list screen opens with matching filters applied and its total equals the metric. |
| **AC-49** | Given an Administrator, then the staff dashboard includes `userCounts`; given IT Staff, the key is absent. |
| **AC-50** | Given the dashboard API fails, then the dashboard shows a safe failure message with *Try again* and no stack or SQL text. |
| **AC-51** | Given a dashboard response, then it contains no Ticket description and no list longer than five. |
| **AC-52** | Given 1,000 Tickets and 2,000 actions in the database, when each dashboard endpoint is called, then it responds in under 500 ms on the development machine (performance smoke). |

### Navigation, regression, and hardening

| ID | Criterion |
|----|-----------|
| **AC-53** | Given each role logs in, then they land on `/dashboard`, *Dashboard* is the active navigation item, and only that role's destinations are present. |
| **AC-54** | Given an Administrator, then navigation shows Dashboard, Ticket Queue, and User Management, and the Ticket Queue and Staff Ticket Detail work for them. |
| **AC-55** | Given the Lab 3 migration database with existing Tickets, Attachments, comments, and notes, when the Lab 4 migration runs, then every row and id survives, each Ticket has `version = 1` and exactly one history entry, and Resolved / Closed Tickets have `resolvedAt`. |
| **AC-56** | Given the Lab 4 schema, when the rollback script runs in the recovery drill, then the Lab 3 schema is restored and Lab 3's migration test passes. |
| **AC-57** | Given the seed is run twice, then row counts for every table are identical after each run. |
| **AC-58** | Given the full Lab 1–3 automated suites, after the §5.10 updates, then every test passes on `main`. |
| **AC-59** | Given a submit button is double-clicked on Create Ticket, Add action, comment, note, or user create, then exactly one request is sent. |
| **AC-60** | Given a recoverable failure (network error, 409, 500) on Create Ticket, Add/Edit action, comment, note, or user forms, then the entered values remain. |
| **AC-61** | Given every route visited in the E2E suite, then the browser console records no errors and no link leads to a missing route. |
| **AC-62** | Given every Lab 4 screen at desktop, tablet, and mobile widths, then there is no horizontal page scroll, no clipped or overlapping control, every control is keyboard reachable with visible focus, and dialogs trap and return focus. |
| **AC-63** | Given the UI source, then no Lab 4 component uses a literal hex colour; status, action status, and priority are conveyed by text as well as colour. |

---

## 10. Definition of Done

### 10.1 Product completion

- [ ] Everything in §3.1 is implemented; nothing from §3.2 has been added.
- [ ] AC-01…AC-63 are each satisfied and linked to passing test evidence in `tests.md`.
- [ ] Unit, API, authorization, workflow/concurrency, migration/regression, UI
      component, UI style, responsive/accessibility, performance-smoke, and E2E
      suites pass from the documented commands **on the final `main`**.
- [ ] No test is skipped, disabled, `.todo`, flaky, or commented out.
- [ ] Every row of §6.1 is enforced server-side and proven by a test that calls
      the API directly.
- [ ] The resolution gate is proven by direct API calls that bypass the UI.
- [ ] Every Lab 1–3 acceptance criterion still passes; the only edited Lab 3
      tests are those §5.10 names.
- [ ] `npx prisma migrate reset --force` rebuilds the database; the seed is
      idempotent; the rollback drill has been run and recorded.
- [ ] Every dashboard metric matches its §5.8 query in a test that runs the
      query independently.
- [ ] Every screen implements loading, validation, success, empty / no-results,
      forbidden, not-found, conflict, and safe-failure feedback where meaningful.
- [ ] No console errors, broken links, placeholder text, or unfinished controls
      remain; obsolete Lab 2/3 UI leftovers are removed.
- [ ] Desktop, tablet, and mobile screenshots exist for every Lab 4 screen under
      `artifacts/lab-04/screenshots/` (`staff-dashboard/`,
      `requester-dashboard/`, `actions-taken/`).
- [ ] The visual and accessibility checklist in `ui-spec.md` is completed.
- [ ] No password, secret, or `.env` is committed; responses and logs carry no
      password material.
- [ ] README setup, migration, rollback, seed, seeded accounts, test, and
      demonstration instructions are current and were followed on a clean checkout.

### 10.2 Course delivery

- [ ] Every unit of work has a GitHub Issue and its own feature branch.
- [ ] Every feature branch entered `lab4-staging` through a peer-reviewed PR.
- [ ] One release PR merged `lab4-staging` into `main`.
- [ ] Substantive review comments and replies exist in **both** directions,
      recorded in [`reviewer.md`](./reviewer.md).
- [ ] All Issues sit in **Done** on the Kanban board.
- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`,
      and `ai-use.md` are present and current.
- [ ] This specification was committed **before** the implementation PRs, with
      evidence of the commit date.
- [ ] The submission PDF uses the headings "Answer Part 1" through "Answer Part 9".

---

## 11. Assumptions and Decisions

| # | Decision | Reasoning |
|---|----------|-----------|
| **D-01** | Actions Taken use a **hybrid model**: the labsheet's field list, plus a selectable *Performed by* (an active IT Staff or Administrator, defaulting to the author) with the author recorded automatically as `createdBy`, plus an action status `PLANNED → IN_PROGRESS → COMPLETED / CANCELLED` | The handout is internally inconsistent: the field list (§3, §8.3) has no assignee or status, yet AC-01's example names an "approved assignee" and Part 6 grades assign, complete, cancel, and inactive-assignee rejection. The hybrid satisfies both, and BR-02 needs a performer distinct from the author. *Approved 2026-10-09.* |
| **D-02** | **Resolution gate:** at least one Completed action, no Planned / In Progress action, no outstanding follow-up (BR-25) | §4.5 requires the backend to enforce "the resolution rule" even when the screen is bypassed. Tying resolution to recorded work makes the rule observable and testable. *Approved 2026-10-09.* |
| **D-03** | **Stale updates:** integer `version` on `Ticket` and `ActionTaken`, `expectedVersion` on every protected write, 409 with current state | Generalises Lab 3's status-only compare-and-set to every ticket and action write; reasoning in §7.2 decision 1. *Approved 2026-10-09.* |
| **D-04** | **Administrator navigation:** Dashboard, Ticket Queue / Detail, User Management | §4.3 says the Administrator performs IT Staff behaviour; Lab 3 D-12 already granted it at the API level. *Approved 2026-10-09.* |
| **D-05** | **Append-only status history** table with a database trigger | Part 7 grades stable ordering and append-only behaviour; closes Lab 3's deferred "status-change history" assumption. Reasoning in §7.2 decision 2. *Approved 2026-10-09.* |
| **D-06** | A follow-up is satisfied by a **newer Completed action**, not by un-ticking a flag | Keeps Completed actions immutable (BR-15) while giving the gate a clear, testable meaning: the latest finished work says whether more is needed. |
| **D-07** | Completed and Cancelled actions are **read-only**; there is no action deletion | An action is a work record. Corrections as new entries preserve what was believed at the time, which the Requester can also see. |
| **D-08** | Requesters see **all** Actions Taken fields, read-only, with the performer by name and no creator | Labsheet §8.3: "Requesters will see all Actions Taken items." Creator identity is internal bookkeeping with no value to the Requester. |
| **D-09** | Requesters see status history with staff shown as "IT Support" | Gives the Requester the timeline they need while showing role-appropriate visibility (Part 7), consistent with Lab 3's Internal Notes boundary. |
| **D-10** | Two dashboard endpoints, not one role-shaped endpoint | The two dashboards share no metric, and the labsheet asks for separate test files. Lab 3 D-15's "one endpoint per resource" applied to the *same* resource; these are different resources. |
| **D-11** | Rolling windows (7 days, 30 days) instead of calendar days | A rolling window is identical in every time zone, so no Bangkok-midnight boundary bug is possible, and a test can place a record exactly on the edge (AC-47). |
| **D-12** | "Open" means the five active statuses; Resolved is separate | A Resolved Ticket needs no work from staff but may still be reopened; counting it as open would inflate the workload numbers. |
| **D-13** | Dashboard lists cap at 5 | Labsheet §6.2 asks for concise data, not collections; the drill-down link is the way to see more. |
| **D-14** | `expectedVersion` is **required**, not optional, on the three Lab 3 ticket PATCHes | An optional check would let any client opt out and silently overwrite. The cost is updating the two Lab 3 test helpers that send these PATCHes (§5.10). |
| **D-15** | Ticket cancellation **cancels open actions** rather than being blocked by them | Cancelling a duplicate or withdrawn Ticket should not require cancelling each planned step first; leaving them open would pollute *My open actions*. |
| **D-16** | Idempotency key only on Action Taken creation; other creates rely on single-flight buttons | Action creation is the new, most-repeated write of this sprint. Extending keys to tickets, comments, notes, and uploads is recorded as deferred rather than widened into this sprint. |
| **D-17** | Seed a second Administrator | Lab 3's evidence showed the self-deactivation and last-Administrator guards cannot be demonstrated separately with one Administrator. |
| **D-18** | Ticket status badges become **pills**; action-status badges stay square | ui-spec §2.5 distinguishes the two by shape, but no earlier sprint defined a pill, so every badge was square and the distinction did not exist. The status badges took the pill radius rather than the spec changing, keeping the action badge exactly as specified. A visual change only: no colour, no token, and no Lab 2 or Lab 3 test asserts the shape. *Decided 2026-10-29 during Issue #50.* |
| **D-19** | The Requester dashboard's "no Tickets at all" state (ui-spec §6.2) is decided by My Tickets' own total (`GET /api/tickets`, `totalItems === 0`), asked only when every figure is 0 and every list empty | The dashboard response has no total, and all-zero figures also describe a Requester whose Tickets are all closed or cancelled long ago, who must not be told they never raised one. The existing endpoint answers exactly, so the API contract is unchanged; the cost is a second request in that one case. If it fails, the lists show their own empty messages. *Decided 2026-11-01 during Issue #53.* |

### Open assumptions

- The five-minute clock-skew allowance in BR-10 assumes client and server clocks
  are roughly synchronised; it is not configurable.
- Performance smoke (AC-52) is measured on the development machine against the
  local PostgreSQL; it is a regression tripwire, not a production benchmark.
- Expired-session cleanup stays lazy, as in Lab 3; a periodic sweep would be a
  scheduled job, which §3.2 excludes.
- Idempotency keys for Ticket, comment, note, and attachment creation are
  deferred (D-16).
