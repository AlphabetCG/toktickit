# Lab 4 Test Plan and Results

**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression
**Contract:** [`specification.md`](./specification.md) — AC-01 … AC-63
**Status:** Planned before implementation. The *Final* column is filled in as
each Issue lands and re-confirmed on `main` after the release.

---

## 1. Test Strategy

This plan is written from the acceptance criteria **before** implementation and
defines what counts as evidence. It is not a summary of whatever tests the coding
agent happens to produce.

**Approach — TDD per Issue.** For each Issue the tests below are written first
and confirmed to fail for the expected reason, then the smallest correct
behaviour is implemented until they pass.

**Ten levels.** Lab 4 keeps Lab 3's eight and adds the two the labsheet names
for this sprint's new risks: **workflow and concurrency**, because the
resolution gate and stale-update rules span several records and several users,
and **performance smoke**, because dashboards aggregate the whole database.

| Level | ID | Tool | Answers |
|-------|----|------|---------|
| Unit | UNIT | Vitest | Does an isolated rule hold at its boundaries? |
| API / integration | API | Vitest + Supertest | Does the endpoint honour api-spec, including every failure status? |
| **Workflow / concurrency** | WF | Vitest + Supertest | Is the gate enforced with the UI bypassed, is history append-only, and does a stale or racing write lose cleanly? |
| Authorization | AUTHZ | Vitest + Supertest | Is the §6.1 matrix enforced by the server for every new route? |
| Migration / regression | REG | Vitest + Prisma | Did Lab 3 data survive, is the seed idempotent, is history append-only in the database? |
| UI component | UI | Vitest + Testing Library | Does each screen render every state and call the API correctly? |
| UI style | STYLE | Vitest + Testing Library | Are tokens, badges, editable/read-only markers, and validation placement correct? |
| Responsive / accessibility | RESP | Playwright | Do the screens hold at three viewports, with keyboard operation and no overflow? |
| **Performance smoke** | PERF | Vitest + Supertest | Do dashboards stay fast on a realistic data volume? |
| E2E | E2E | Playwright | Does a real user complete the journey against a real database? |

**Principles carried forward**

- **Boundaries are tested at the edge:** 2000 and 2001 characters, a window of
  exactly 7 days and 7 days plus one minute, five and six list items.
- **Authorization is proven without the UI.** Every new route is called directly
  with each role's session; ownership refusals must be 404 and byte-identical to
  a missing resource.
- **Every test must fail when its behaviour is removed.**
- **No test may be skipped, disabled, `.todo`, or commented out** on `main`.

**Principles new to Lab 4**

- **Dashboard numbers are checked against an independent query.** Each metric
  test runs the §5.8 calculation itself with Prisma and compares, so a test
  cannot pass by echoing the endpoint's own logic.
- **The gate is attacked, not just exercised.** Every unmet condition is sent
  straight to `PATCH /status`, and a concurrent action-create races a resolve.
- **Concurrency tests run real parallel requests** (`Promise.all`) against the
  database rather than simulating interleavings, and assert that exactly one
  writer wins.
- **Regression includes the deliberate changes.** The Lab 3 tests that §5.10
  changes are updated in place and listed in §2.11; every other Lab 3 test runs
  unchanged.

**Test data.** API, workflow, authorization, and E2E tests run against a
migrated and seeded PostgreSQL using the §7.4 seed. Each test file creates its
own fixtures through `ensureUser` and Prisma, so assertions never depend on the
row counts of a shared database, and authenticates through
`POST /api/auth/login`.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UNIT-01 | Unit | AC-11, AC-13, BR-14 | Action status transitions | All 16 cells of the action matrix: the five permitted transitions accepted, every other cell and every move out of Completed or Cancelled rejected | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| UNIT-02 | Unit | AC-06, AC-07, AC-08, AC-10, BR-06…BR-09 | Action field validation | Description `"   "`/0 rejected, 1 and 2000 accepted, 2001 rejected; Result required only for Completed; Follow-up Note required when follow-up is yes and discarded when no; Attachment Notes 500 accepted, 501 rejected | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| UNIT-03 | Unit | AC-09, BR-10 | Action Date/Time rules | Earlier than Ticket Date rejected; future accepted only while Planned; `now + 5 min` accepted and `now + 5 min + 1 s` rejected for a started or completed action | `server/tests/lab-04/action-rules.unit.test.ts` | Pass |
| UNIT-04 | Unit | AC-26, AC-27, AC-28, BR-25, BR-26 | Resolution gate function | No Completed → unmet `noCompletedAction`; an open action → unmet `openAction`; latest Completed requests follow-up → unmet `followUpOutstanding`; a newer Completed without follow-up satisfies it; equal `actionAt` resolved by id | `server/tests/lab-04/resolution-gate.unit.test.ts` | Pass |
| UNIT-05 | Unit | AC-25, AC-29, BR-28 | Gate-aware permitted transitions | With the gate met, results equal Lab 3's matrix for every status; with it unmet, `RESOLVED` is removed and nothing else changes | `server/tests/lab-04/resolution-gate.unit.test.ts` | Pass |
| UNIT-06 | Unit | AC-47, BR-49 | Rolling window | A timestamp exactly `now − 168 h` is inside *last 7 days*; `now − 168 h − 1 min` is outside; same for 30 days | `server/tests/lab-04/dashboard-rules.unit.test.ts` | Pass |
| UNIT-07 | Unit | BR-46, FR-16 | Active set and `statusGroup` | The active set is exactly the five statuses; `statusGroup=active` normalises, an invalid value falls back to none, and an explicit `status` wins over the group | `server/tests/lab-04/dashboard-rules.unit.test.ts` | Pass |

### 2.2 API / integration — Actions Taken

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-17, BR-12 | Stable list order | Three actions with the same `actionAt` and one earlier: listed earliest first, then by id; two reads are identical | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | AC-02 | Default performer | Created without `performedById`: performer = creator | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-01 | Create a valid Action Taken | 201; created under the correct Ticket with the authenticated creator and the approved performer; every field echoed; `version` 1 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-03, BR-02 | Performer differs from Owner | Staff A creates an action performed by Staff B on a Ticket owned by C; all three stored as given; Ticket owner unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-04, BR-04 | Inactive / non-staff performer | Deactivated staff, a Requester, and a nonexistent id each return 400 naming `performedById`, on create and on edit; no row written or changed | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-05, BR-03 | Client cannot set creator | `createdById` in the body is ignored; the session user is stored | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-07 | API | AC-06 | Description validation | Empty, whitespace, and 2001 characters return 400 naming `description` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-08 | API | AC-07, BR-08 | Follow-up rules | Yes with empty note → 400 naming `followUpNote`; no with a note → 201 and the note stored empty | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-09 | API | AC-08, BR-07 | Completed needs a result | Create or move to Completed with empty Result → 400 naming `result` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-10 | API | AC-09, BR-10 | Action Date/Time | Before Ticket Date → 400; future on Planned → 201; future on In Progress or Completed → 400; starting a future Planned action → 400 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-11 | API | AC-10, BR-09 | Attachment Notes | 501 characters → 400 naming `attachmentNotes`; valid notes → 201 and the Ticket's Attachment count is unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-12 | API | AC-11 | Action lifecycle | Planned → In Progress → Completed each 200; `version` 1 → 2 → 3; `completedAt` set on completion | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-13 | API | AC-12, BR-15 | Final actions are read-only | Any edit or status change on a Completed or a Cancelled action → 409; row unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-14 | API | AC-13, BR-13 | Invalid action starts and moves | Create as Cancelled → 400 naming `status`; Completed → In Progress → 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-15 | API | AC-15, BR-19 | Actions on inactive Tickets | Create or edit on a Resolved, Closed, or Cancelled Ticket → 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-16 | API | AC-18, BR-44 | Idempotent create | Same `clientRequestId` twice → 201 then 200 with the same id; one row. The same key on another Ticket creates a separate action | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-17 | API | BR-42 | Action writes touch the Ticket | Creating and editing an action advance `Ticket.updatedAt` and leave `Ticket.version` unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-18 | API | BR-05 | Deactivated performer kept | After the performer is deactivated, an edit that leaves `performedById` unchanged → 200 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-19 | API | AC-19, BR-11 | Markup stored as text | `<script>alert(1)</script>` is stored and returned verbatim, never transformed into markup | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |

### 2.3 API / integration — Dashboards

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| API-20 | API | AC-42, BR-53 | Requester sees only their own | With Tickets for Requesters A and B, A's dashboard counts and lists contain only A's Tickets; a `requesterId` query parameter is ignored | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-21 | API | AC-43 | Requester metrics match the database | `openTickets`, `waitingForMe`, `awaitingClosure` each equal an independent Prisma count of the §5.8 calculation | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-22 | API | AC-45, BR-50 | Requester with no Tickets | Every metric is `0` and every list `[]`; no key missing or null | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-23 | API | AC-46, AC-51, BR-48 | Requester lists | Six matching Tickets → five returned in the documented order; no item carries `description` | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-24 | API | AC-47, BR-49 | 7- and 30-day boundaries | A Ticket updated exactly 7 days ago is in *Recently updated* and one 7 days + 1 minute ago is not; the same at 30 days for *Recently resolved* | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-25 | API | AC-48, BR-51 | Requester drill-down parity | For each metric, `GET /api/tickets` with its drill-down query returns `totalItems` equal to the metric | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-26 | API | AC-44 | Staff metrics match the database | Every count, `byStatus`, and `openByItPriority` equals an independent Prisma query | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-27 | API | AC-44 | "Me" is the caller | Two IT Staff with different owned Tickets and actions each see their own `mineOpen`, `myOpenActions`, and `myActions[]` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-28 | API | AC-45 | Staff member with nothing | `mineOpen` and `myOpenActions` are `0` and `myActions` is `[]` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-29 | API | AC-49 | Administrator additions | Administrator response has `userCounts` matching an independent count; IT Staff response has no `userCounts` key | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-30 | API | AC-46, AC-51, BR-48 | Staff lists | `urgent[]` is oldest first, `recentlyUpdated[]` newest first, `myActions[]` by `actionAt` ascending; each at most five; no `description` | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-31 | API | AC-48, BR-51 | Staff drill-down parity | For every metric with a drill-down URL, `GET /api/staff/tickets` with that query returns `totalItems` equal to the metric | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-32 | API | BR-50 | Response shape | Both dashboards return every documented key, numbers as integers, lists as arrays, all eight `byStatus` keys and all three `openByItPriority` keys present | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |

### 2.4 Workflow and concurrency

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| WF-01 | Workflow | AC-25, BR-22 | Every matrix cell | With the gate satisfied, all 64 from/to pairs: ✅ cells 200, every other cell 409 and the status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-02 | Workflow | AC-26, FR-07 | Gate — no completed work | `→ RESOLVED` on a Ticket with no Completed action: 409, `conflict: "resolutionGate"`, `unmet` contains `noCompletedAction`; status unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-03 | Workflow | AC-27 | Gate — open action | A Completed plus a Planned action: 409 naming `openAction` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-04 | Workflow | AC-28, BR-26 | Gate — follow-up | Latest Completed requests follow-up: 409 naming `followUpOutstanding`; after a newer Completed action without follow-up, the same request is 200 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-05 | Workflow | AC-29, BR-28 | Detail exposes the gate | `GET /api/tickets/:id` returns `resolutionGate.satisfied` and `unmet`, and omits `RESOLVED` from `permittedTransitions` until satisfied | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-06 | Workflow | AC-31, BR-30 | Signal is advisory | A Requester's resolution signal on a Ticket with no actions leaves the status unchanged and the gate unmet | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-07 | Workflow | AC-32, BR-31 | `resolvedAt` | Set on `→ RESOLVED`, cleared on `→ REOPENED`, kept on `RESOLVED → CLOSED`, and equal to the matching history entry's time | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-08 | Workflow | AC-16, BR-20 | Cancel cascades | Cancelling a Ticket with Planned, In Progress, and Completed actions cancels the first two and leaves the Completed one untouched, in one transaction | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-09 | Workflow | AC-33, BR-32 | History entries | Create, then NEW → OPEN → IN_PROGRESS: three entries in order, first by the Requester with empty *from*, then by the acting staff member | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-10 | Workflow | AC-34, BR-36 | Refusals append nothing | A 409 (matrix or gate), a 403 (Requester), and a 404 leave the history count unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-11 | Workflow | AC-36, BR-35 | Role-shaped history | Staff see actor names; the Requester sees "IT Support" for staff changes and the response contains no staff name or email | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-12 | Workflow | BR-29 | Legacy and reopened Tickets | A Resolved Ticket with no actions keeps its status; once Reopened it must satisfy the gate again before `→ RESOLVED` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| WF-13 | Concurrency | AC-37, BR-40, BR-41 | Stale ticket writes | For status, owner, and IT Priority: two parallel PATCHes with the same `expectedVersion` → exactly one 200; the other 409 `conflict: "stale"` with `current.version` and current values | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| WF-14 | Concurrency | AC-38 | Stale action edits | Two parallel edits of one action at the same version → one 200, one 409; the row holds only the winner's values | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| WF-15 | Concurrency | AC-39, BR-39 | Version is required | Status, owner, and IT Priority PATCH without `expectedVersion`, or with `"1"`, → 400 naming `expectedVersion` | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| WF-16 | Concurrency | AC-41, BR-27 | Gate under a race | 20 rounds of a Planned-action create in parallel with `→ RESOLVED` on a gate-satisfied Ticket: never a Resolved Ticket holding an open action | `server/tests/lab-04/concurrency.api.test.ts` | Pass |

### 2.5 Authorization

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| AUTHZ-01 | Authorization | AC-20, BR-17 | Requester writes on own Ticket | Create, edit, and status change of an action on the Requester's own Ticket → 403; nothing written | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-02 | Authorization | AC-20 | Requester writes on another's Ticket | The same requests on another Requester's Ticket → 404 byte-identical to a nonexistent Ticket | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-03 | Authorization | AC-21, BR-18 | Requester read shape | Own Ticket's actions: every action returned with performer name; no `createdBy`, no email anywhere in the body | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-04 | Authorization | AC-22 | Requester reads another's | Another Requester's actions and status history → 404 byte-identical to a nonexistent Ticket | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-05 | Authorization | AC-23 | Dashboard roles | Requester → staff dashboard 403; IT Staff and Administrator → Requester dashboard 403 | `server/tests/lab-04/authorization.api.test.ts` | Partial: Requester → staff dashboard 403 passes (#52); staff and Administrator → Requester dashboard in #53 |
| AUTHZ-06 | Authorization | AC-24 | Administrator acts as IT Staff | An Administrator creates, edits, and completes an action and resolves the Ticket | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-07 | Authorization | §6.1 | Gates on every new route | All six new endpoints: no session → 401; password change outstanding → 403 `passwordChangeRequired` | `server/tests/lab-04/authorization.api.test.ts` | Partial: 5 routes pass (#49, #51, #52); the Requester dashboard in #53 |
| AUTHZ-08 | Authorization | BR-23 | Requester never changes status | A Requester's `PATCH /status` on their own Ticket, with a valid version → 403 | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTHZ-09 | Authorization | AC-54, D-04 | Administrator ticket access | An Administrator reads the queue and a Ticket's detail, actions, and history (200 each) | `server/tests/lab-04/authorization.api.test.ts` | Pass |

### 2.6 Migration and regression

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| REG-01 | Migration | AC-55, BR-54 | Migration is additive | The migration SQL contains no `DROP`, `RENAME`, or `ALTER COLUMN … TYPE` on an existing table; adds `version` with `DEFAULT 1`; backfills history and `resolvedAt`; creates the trigger **after** the backfill; `prisma migrate diff` reports no drift | `server/tests/lab-04/migration.api.test.ts` | Pass |
| REG-02 | Migration | AC-55, BR-55, BR-56 | Runtime invariants | Every Ticket has `version ≥ 1` and at least one history entry whose first entry is a creation or a backfill; every Resolved or Closed Ticket has `resolvedAt`; every Lab 3 relation (requester, owner, attachments, comments, notes) still resolves | `server/tests/lab-04/migration.api.test.ts` | Pass |
| REG-03 | Migration | AC-35, BR-33 | History is append-only in the database | `UPDATE` and `DELETE` on `TicketStatusChange` through `$executeRaw` raise; the row is unchanged | `server/tests/lab-04/migration.api.test.ts` | Pass |
| REG-04 | Regression | AC-57, BR-58 | Seed idempotency | Running the seed twice leaves the row count of every table identical | `server/tests/lab-04/migration.api.test.ts` | Pass |
| REG-05 | Regression | BR-59 | Seed coverage | Seeded data includes all 8 statuses, 3 IT Priorities, assigned and unassigned; Tickets with 0, 1, and ≥ 3 actions; all 4 action statuses; a pending follow-up; a Requester with no Tickets; an IT Staff member with no owned Tickets or actions; two active Administrators | `server/tests/lab-04/migration.api.test.ts` | Pass |

The two migration levels that cannot be a unit test — the **rollback drill**
(AC-56) and the **full Lab 1–3 regression run** (AC-58) — are evidenced by
recorded command output in §4.3 and §6, not by a single test row.

### 2.7 UI component

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UI-01 | UI | FR-05, AC-17 | Actions list | Rows render in API order with Action Date/Time, description, result, performer, action-status badge text, and a follow-up marker | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-02 | UI | FR-01, FR-02 | Create mode | *Add action* opens the form with performer defaulted to the current user and date/time to now; submit sends one request carrying a `clientRequestId` | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-03 | UI | AC-06, AC-07, AC-08 | Client-side validation | Empty description, follow-up yes without a note, and Completed without a result each show a message beneath the field and send nothing; the Follow-up Note field appears only when follow-up is yes | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-04 | UI | FR-03 | Edit mode | *Edit* on a Planned action prefills every field; save sends `expectedVersion` | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-05 | UI | AC-11, FR-04 | Start and complete | *Start* and *Complete* appear only where permitted; completing an action without a result asks for one first | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-06 | UI | AC-14, BR-16 | Cancel confirmation | *Cancel action* opens a confirmation dialog; dismissing it makes no request | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-07 | UI | AC-12, BR-15 | Final actions read-only | Completed and Cancelled rows show no *Edit*, *Start*, *Complete*, or *Cancel* | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-08 | UI | AC-04, AC-60 | Server field error | A 400 naming `performedById` appears beside Performed by, and every entered value is kept | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-09 | UI | AC-19 | Markup as text | A description of `<script>…</script>` renders as literal text and adds no element | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-10 | UI | AC-21, BR-18 | Requester read-only view | In Requester mode there is no *Add action* or row control, the performer name is shown, and no creator appears | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-11 | UI | BR-19 | Inactive Ticket | On a Resolved, Closed, or Cancelled Ticket, *Add action* is replaced by a short explanation | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-12 | UI | AC-59 | Double submit | A double click on *Save action* sends one request, and the button shows its busy label | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-13 | UI | AC-40 | Stale edit | A 409 `stale` shows the conflict banner with *Reload*; the entered values stay in the form until the user reloads | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-14 | UI | FR-21 | Section states | Loading, empty ("No actions recorded yet"), and safe-failure with *Try again* | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-15 | UI | AC-29 | Gate unmet | The status control has no *Resolved* option and lists the unmet conditions in plain language | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-16 | UI | AC-29 | Gate met | *Resolved* is offered | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-17 | UI | AC-30, FR-08 | Refresh after a change | After a successful change the summary badge, the available transitions, and the history update without a reload; the request carried `expectedVersion` | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-18 | UI | AC-40 | Stale status change | 409 `stale` shows the banner with *Reload*, and the selected target stays selected | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-19 | UI | FR-09, BR-34 | History display | Entries oldest first; a backfilled entry reads "Recorded at upgrade" | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-20 | UI | AC-36 | Requester history | The Requester view shows "IT Support" as the actor of staff changes | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-21 | UI | BR-24, BR-20 | Cancel Ticket confirmation | The confirmation states how many open actions will also be cancelled | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-22 | UI | BR-27 | Gate refused by the server | A 409 `resolutionGate` received despite the option being shown (a race) lists the unmet conditions and refreshes the Ticket | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-23 | UI | FR-13, FR-15 | Staff metric cards | Each card shows label and value and is a link to its drill-down URL with an accessible name such as "Open and unassigned: 4 — view list" | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-24 | UI | FR-13 | Staff lists | *My open actions*, *Urgent*, and *Recently updated* rows link to the Ticket; each list has its own empty message | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-25 | UI | AC-45 | Staff zero state | All-zero metrics show `0`, not blanks, and every list shows its empty message | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-26 | UI | AC-49 | Administrator card | The user-counts card renders only when `userCounts` is present | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-27 | UI | AC-50 | Staff safe failure | A failed load shows a plain message and *Try again*, which refetches | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-28 | UI | FR-21 | Staff loading and forbidden | A loading placeholder that announces itself; a 403 shows the forbidden state | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-29 | UI | FR-12, FR-15 | Requester metric cards | Three cards with label, value, and drill-down link | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-30 | UI | FR-12 | Requester lists | *Needs your attention*, *Recently updated*, *Recently resolved* rows link to `/tickets/:id`; *View all* links present | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-31 | UI | AC-45 | Requester with no Tickets | Zeros, list empty messages, and a *Create ticket* call to action | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-32 | UI | AC-50, FR-21 | Requester loading and failure | Loading placeholder; safe failure with *Try again* | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-33 | UI | AC-53, FR-17 | Role navigation | For each role, *Dashboard* is the first item; at `/dashboard` it is the active item; other roles' items are absent from the DOM | `client/tests/lab-04/Navigation.test.tsx` | Partial: IT Staff and Administrator pass (#52); Requester in #53 |
| UI-34 | UI | AC-54, D-04 | Administrator navigation | Exactly Dashboard, Ticket Queue, User Management | `client/tests/lab-04/Navigation.test.tsx` | Pass |
| UI-35 | UI | AC-53, BR-62 | Landing route | An unknown or root path after login redirects every role to `/dashboard` | `client/tests/lab-04/Navigation.test.tsx` | Partial: IT Staff and Administrator pass (#52); Requester in #53 |
| UI-36 | UI | FR-16, AC-48 | My Tickets reads the URL | `/tickets?statusGroup=active` and `?status=WAITING_FOR_REQUESTER` render with those filters selected and request them | `client/tests/lab-04/DrillDown.test.tsx` | Planned |
| UI-37 | UI | FR-16, AC-48 | Queue reads the URL | `/staff/tickets?ownerId=me&statusGroup=active` and `?itPriority=HIGH&sort=ticketDate&order=asc` apply on first load | `client/tests/lab-04/DrillDown.test.tsx` | Pass |
| UI-38 | UI | FR-16 | User Management reads the URL | `/admin/users?role=IT_STAFF` applies the role filter on first load | `client/tests/lab-04/DrillDown.test.tsx` | Pass |
| UI-39 | UI | FR-16 | Filters write the URL | Changing a filter updates the query string, so *Back* restores the previous filter | `client/tests/lab-04/DrillDown.test.tsx` | Pass |
| UI-40 | UI | AC-59, FR-19 | Double submit everywhere | Create Ticket, Public Comment, Internal Note, and user create each send one request on a double click | `client/tests/lab-04/Hardening.test.tsx` | Planned |
| UI-41 | UI | AC-60, FR-20 | Data kept after failure | After a 500 or network error, Create Ticket, comment, note, and user forms keep every entered value | `client/tests/lab-04/Hardening.test.tsx` | Planned |
| UI-42 | UI | FR-22 | No placeholder UI | No source file under `client/src` contains `TODO`, `Lorem`, `Coming soon`, `console.log`, or a `href="#"` link | `client/tests/lab-04/Hardening.test.tsx` | Planned |

### 2.8 UI style

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| STYLE-01 | UI style | AC-63 | No literal colour | No Lab 4 component or stylesheet addition contains a `#rrggbb`, `rgb()`, or `rgba()` literal; every colour is a Zen Green token | `client/tests/lab-04/zen-green-lab4.test.tsx` | Pass |
| STYLE-02 | UI style | AC-63 | Action status badge | All four action statuses render through the shared badge with visible text, distinct from Ticket status badges | `client/tests/lab-04/zen-green-lab4.test.tsx` | Pass |
| STYLE-03 | UI style | ui-spec §2 | Metric card structure | Card carries the metric-card class, label, value, and a link; values use the numeric style | `client/tests/lab-04/zen-green-lab4.test.tsx` | Pass |
| STYLE-04 | UI style | Part 9 checklist | Editable vs read-only | The staff action form uses the editable field class; the Requester's actions and every Completed action use the read-only class | `client/tests/lab-04/zen-green-lab4.test.tsx` | Pass |
| STYLE-05 | UI style | Part 9 checklist | Validation placement | Every action-form error is rendered directly beneath its field and referenced by `aria-describedby` | `client/tests/lab-04/zen-green-lab4.test.tsx` | Pass |

### 2.9 Responsive and accessibility

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| RESP-01 | Responsive | AC-62 | Desktop 1280×800 | Requester, IT Staff, and Administrator dashboards and both Ticket Details with actions: no horizontal page scroll; screenshots captured | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-02 | Responsive | AC-62 | Tablet 820×1180 | Same screens: no overflow or clipping; metric cards in two columns | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-03 | Responsive | AC-62 | Mobile 390×844 | Same screens: metric cards stack, actions render as cards, controls at least 44 px tall, no horizontal page scroll | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-04 | Accessibility | AC-62 | Keyboard and focus | The action form, cancel-action confirmation, and cancel-Ticket confirmation open, trap focus, close with Escape, and return focus to their trigger; focus is visible at every step | `e2e/lab-04/responsive.spec.ts` | Planned |
| RESP-05 | Responsive | AC-62 | Containment | At each viewport every metric card, action row, and form control lies inside its panel's bounding box, and no two controls overlap | `e2e/lab-04/responsive.spec.ts` | Planned |

Screenshots are written to
`artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/`
as `<state>-<viewport>.png`.

### 2.10 Performance smoke

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| PERF-01 | Performance | AC-52, BR-47 | Requester dashboard under volume | With at least 1,000 Tickets and 2,000 actions present, the median of 5 calls is under 500 ms | `server/tests/lab-04/performance.smoke.test.ts` | Planned |
| PERF-02 | Performance | AC-52, BR-47 | Staff dashboard under volume | Same volume and threshold for `GET /api/dashboard/staff` as an Administrator | `server/tests/lab-04/performance.smoke.test.ts` | Pass |

The volume fixture is created idempotently (topped up to the target, never
duplicated) with `CLOSED` Tickets under a dedicated `perf.*` Requester, so it
adds nothing to the active counts that screenshots show. Run
`npx prisma migrate reset --force` before capturing evidence screenshots.

### 2.11 End-to-end

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| E2E-01 | E2E | AC-01, AC-11 | Action lifecycle | IT Staff open a Ticket, add a Planned action, edit it, start it, and complete it with a result; the list updates at each step | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-03 | Performer is not the Owner | Staff A records an action performed by Staff B on a Ticket owned by C; the Requester then sees it read-only with B's name | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-14, AC-04 | Cancel and inactive performer | Cancelling an action needs confirmation; choosing a performer who is deactivated mid-session is refused beside the field | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-26, AC-29, AC-30 | Resolving a Ticket | *Resolved* is absent with no completed work; after completing an action it appears; resolving updates the badge and the history | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-05 | E2E | AC-28 | Follow-up blocks resolution | A completed action with follow-up keeps *Resolved* unavailable with the reason shown; recording the follow-up action unblocks it | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-06 | E2E | AC-37, AC-40 | Two people, one Ticket | Two browser contexts load the same Ticket; the second's status change is refused with the conflict banner; *Reload* shows the winner's status | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-07 | E2E | AC-31, AC-36 | Requester view of the work | The Requester signals resolution (status unchanged), sees actions and history with "IT Support", and never sees an Internal Note | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-08 | E2E | AC-44, AC-48 | Staff drill-down | Each staff metric card opens the Queue with matching filters and a total equal to the card's value | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-09 | E2E | AC-42, AC-48 | Requester drill-down | Each Requester card opens My Tickets with matching filters and an equal total | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-10 | E2E | AC-53, AC-54 | Landing and Administrator access | Each role lands on its dashboard; the Administrator opens the Queue and a Ticket Detail from navigation | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-11 | E2E | AC-58, FR-18 | Representative Lab 1–3 regression | Health check; login and forced password change; Create Ticket with an attachment; My Tickets search; Requester comment; staff claim, IT Priority, Internal Note; Administrator creates a user | `e2e/lab-04/regression.spec.ts` | Planned |
| E2E-12 | E2E | AC-61, FR-22 | No console errors or broken links | For each role, every navigation destination and every link on it loads a defined route and logs no console error | `e2e/lab-04/regression.spec.ts` | Planned |

**Totals:** 7 unit · 32 API · 16 workflow/concurrency · 9 authorization ·
5 migration/regression · 42 UI component · 5 UI style · 5 responsive/accessibility ·
2 performance smoke · 12 E2E = **135 planned tests**, plus the complete Lab 1–3
suites re-run as regression.

### 2.12 Lab 3 tests changed by §5.10

These are the only edits to the Lab 3 suites. Each is a deliberate contract
change, not a regression; the list is re-confirmed when Issue 5 lands.

| Lab 3 file | Change | Rule | Status |
|------------|--------|------|--------|
| `server/tests/lab-03/staff-ticket-detail.api.test.ts` | The `patch` helper reads the Ticket's `version` and sends `expectedVersion`; Tickets whose expected transitions include `RESOLVED` first receive a Completed action; expected bodies gain `version`, `resolvedAt`, `cancelledActions`, and the 409 `conflict` / `current` keys; cleanup uses the shared `removeTickets` helper, because a Ticket moved through the workflow has append-only history | BR-60, BR-61 | **Done (#51)** |
| `server/tests/lab-03/authorization.api.test.ts` | ~~The ticket `patch` helper sends `expectedVersion`~~ | BR-61 | **Not needed:** a Requester's request is refused by role before the version is read, so the file passes unchanged |
| `client/tests/lab-03/StaffTicketDetail.test.tsx` | *Added in #51.* The fixture carries `version`, the mocked responses carry the Lab 4 fields, and the owner / IT Priority / status calls are expected with the version. Missing from the original list; it falls under the §5.10 rule ("sending `expectedVersion`") | BR-61 | **Done (#51)** |
| `client/tests/lab-03/RoleNavigation.test.tsx` | UI-12 now expects the Administrator to see *Ticket Queue* as well (BR-63). The landing-route expectations it did not have stay as they were | BR-62, BR-63 | **Done (#52)** |
| `e2e/lab-03/staff-ticket-flow.spec.ts` | ~~Records a Completed action before resolving~~ (not needed: the journey never resolves). **#52:** E2E-05 now expects the IT Staff member to land on `/dashboard`, then opens the queue through the navigation | BR-60, BR-62 | **Done (#52)** |
| `e2e/lab-03/user-administration.spec.ts` | *Added in #52.* E2E-07 expects the Administrator, and the user they create, to land on `/dashboard`; E2E-07 and E2E-08 open User Management through the navigation | BR-62, BR-63 | **Done (#52)** |
| `e2e/lab-03/responsive.spec.ts` | *Added in #52.* `pageAs` takes the path of the screen each test photographs, since staff and Administrators no longer land on it. RESP-04 waits for the reloaded list after changing rows per page, because a filter change is now a URL navigation (ui-spec §9) | BR-62 | **Done (#52)** |
| `e2e/lab-03/helpers.ts` | ~~Expected post-login landing~~ | BR-62 | **Not needed:** `signIn` waits for the Logout button, not for a particular page; the specs that assumed a landing page were edited instead (above) |

---

## 3. Acceptance-Criterion Traceability

Every acceptance criterion maps to at least one planned test, and every planned
test names a real file path.

| AC | Criterion (abbreviated) | Covering tests |
|----|-------------------------|----------------|
| AC-01 | Valid action saved with creator and performer | API-03, E2E-01 |
| AC-02 | Default performer is the creator | API-02 |
| AC-03 | Performer distinct from Owner | API-04, E2E-02 |
| AC-04 | Inactive / non-staff performer rejected | API-05, UI-08, E2E-03 |
| AC-05 | `createdById` from client ignored | API-06 |
| AC-06 | Description validation | UNIT-02, API-07, UI-03 |
| AC-07 | Follow-up note rules | UNIT-02, API-08, UI-03 |
| AC-08 | Completed needs a result | UNIT-02, API-09, UI-03 |
| AC-09 | Action Date/Time rules | UNIT-03, API-10 |
| AC-10 | Attachment Notes length, no Attachment created | UNIT-02, API-11 |
| AC-11 | Planned → In Progress → Completed, version increments | UNIT-01, API-12, UI-05, E2E-01 |
| AC-12 | Final actions refuse changes | API-13, UI-07 |
| AC-13 | No Cancelled create; no Completed → In Progress | UNIT-01, API-14 |
| AC-14 | Cancel-action confirmation | UI-06, E2E-03 |
| AC-15 | No action writes on Resolved / terminal Tickets | API-15, UI-11 |
| AC-16 | Ticket cancel cascades to open actions | WF-08, UI-21 |
| AC-17 | Stable action order | API-01, UI-01 |
| AC-18 | Idempotent create | API-16 |
| AC-19 | Markup rendered as text | API-19, UI-09 |
| AC-20 | Requester writes refused (403 own / 404 other) | AUTHZ-01, AUTHZ-02 |
| AC-21 | Requester read shape | AUTHZ-03, UI-10 |
| AC-22 | Requester cannot read another's actions or history | AUTHZ-04 |
| AC-23 | Dashboard role refusals | AUTHZ-05 |
| AC-24 | Administrator performs IT Staff action work | AUTHZ-06 |
| AC-25 | Every matrix cell | UNIT-05, WF-01 |
| AC-26 | Gate: no completed action | UNIT-04, WF-02, E2E-04 |
| AC-27 | Gate: open action | UNIT-04, WF-03 |
| AC-28 | Gate: follow-up, then satisfied | UNIT-04, WF-04, E2E-05 |
| AC-29 | UI shows only permitted transitions and reasons | UNIT-05, WF-05, UI-15, UI-16, E2E-04 |
| AC-30 | Summary refreshes after a change | UI-17, E2E-04 |
| AC-31 | Resolution signal is advisory | WF-06, E2E-07 |
| AC-32 | `resolvedAt` set, cleared, kept | WF-07 |
| AC-33 | History entries and actors | WF-09 |
| AC-34 | Refusals append no history | WF-10 |
| AC-35 | Database rejects history update / delete | REG-03 |
| AC-36 | Requester history redacts staff | WF-11, UI-20, E2E-07 |
| AC-37 | Stale ticket writes: one winner | WF-13, E2E-06 |
| AC-38 | Stale action edits: one winner | WF-14 |
| AC-39 | `expectedVersion` required | WF-15 |
| AC-40 | Conflict banner keeps entered data | UI-13, UI-18, E2E-06 |
| AC-41 | Gate holds under a race | WF-16 |
| AC-42 | Requester dashboard scoped to self | API-20, E2E-09 |
| AC-43 | Requester metrics equal the database | API-21 |
| AC-44 | Staff metrics equal the database; "me" is the caller | API-26, API-27, E2E-08 |
| AC-45 | Zero states | API-22, API-28, UI-25, UI-31 |
| AC-46 | Lists cap at five, in order | API-23, API-30 |
| AC-47 | Rolling-window boundary | UNIT-06, API-24 |
| AC-48 | Drill-down shows the counted set | API-25, API-31, UI-36, UI-37, E2E-08, E2E-09 |
| AC-49 | Administrator user counts only for Administrators | API-29, UI-26 |
| AC-50 | Dashboard safe failure | UI-27, UI-32 |
| AC-51 | No descriptions, no long lists | API-23, API-30 |
| AC-52 | Dashboards under 500 ms at volume | PERF-01, PERF-02 |
| AC-53 | Landing on Dashboard, active item, role items only | UI-33, UI-35, E2E-10 |
| AC-54 | Administrator navigation and ticket access | AUTHZ-09, UI-34, E2E-10 |
| AC-55 | Migration preserves data and backfills | REG-01, REG-02 |
| AC-56 | Rollback drill restores Lab 3 | §4.3 drill record |
| AC-57 | Seed idempotent | REG-04 |
| AC-58 | Lab 1–3 suites pass on `main` | §6 full-suite record, E2E-11 |
| AC-59 | Double click sends one request | UI-12, UI-40 |
| AC-60 | Forms keep data after failure | UI-08, UI-41 |
| AC-61 | No console errors or broken links | UI-42, E2E-12 |
| AC-62 | Responsive, keyboard, no clipping or overlap | RESP-01…RESP-05 |
| AC-63 | Tokens only; non-colour status cues | STYLE-01, STYLE-02 |

### Additional business-rule coverage

| BR | Rule | Covering test |
|----|------|---------------|
| BR-05 | Deactivated performer kept on edit | API-18 |
| BR-12 | Action order by `actionAt`, then id | API-01, UNIT-04 |
| BR-23 | Requester never changes status | AUTHZ-08 |
| BR-29 | Gate is not retroactive; Reopened must satisfy it again | WF-12 |
| BR-42 | Action writes touch `updatedAt`, not `version` | API-17 |
| BR-46 | Active status set and `statusGroup` | UNIT-07 |
| BR-50 | Every key present, zeros not nulls | API-32 |
| BR-59 | Seed coverage | REG-05 |
| §6.1 | 401 / password gate on every new route | AUTHZ-07 |

---

## 4. Manual Verification Checklist

Automated assertions cannot see a confusing layout. This is completed by hand
against [`ui-spec.md`](./ui-spec.md) and the captured screenshots, **not from
memory**.

### 4.1 Per screen, per viewport

Repeat for the Requester, IT Staff, and Administrator dashboards and for both
Ticket Details with Actions Taken, at desktop, tablet, and mobile:

- [ ] No horizontal page scrolling
- [ ] No clipped or truncated labels or values
- [ ] No overlapping controls or validation messages
- [ ] Editable and read-only fields visually distinct
- [ ] Validation messages beneath their own field
- [ ] One primary action per region; button hierarchy consistent
- [ ] Zen Green tokens only
- [ ] Ticket status, action status, and priority badges carry text
- [ ] Keyboard focus visible on every interactive element

### 4.2 Role and data spot checks

- [ ] Each role lands on its own dashboard and sees only its destinations
- [ ] Every dashboard card's value equals the total on the screen it opens
- [ ] A Requester's Ticket Detail shows actions and history, and no Internal Note
- [ ] Private (Internal Note) and shared (comment, action) content are distinct at a glance

### 4.3 Data, migration, and recovery

- [ ] `npx prisma migrate reset --force` rebuilds and reseeds without error
- [x] The seed runs twice with identical row counts (REG-04, every table, Issue #48)
- [x] **Rollback drill (AC-56):** restore a Lab 3 `pg_dump` into
      `toktickit_rollback`, apply the Lab 4 migration, run
      `server/prisma/rollback/lab4_down.sql`, run the Lab 3 migration test
      against it — command output pasted below (2026-10-14, Issue #48)
- [ ] `git diff main -- server/tests/lab-03 client/tests/lab-03 e2e/lab-03`
      touches only the files in §2.12
- [x] `git ls-files | grep -E '\.env$'` returns nothing (2026-10-14)
- [ ] No test is skipped, `.todo`, `.skip`, or commented out in any suite

#### Rollback drill output (AC-56)

Run on 2026-10-14 for Issue #48. The dump was taken from the development
database while it was still at the Lab 3 schema, before the Lab 4 migration was
first applied. The last three commands run from a worktree of `main` at the Lab 3
release (`08ef17d`), so they use Lab 3's own schema, Prisma client, and test.
Credentials are omitted.

```text
$ dropdb --if-exists toktickit_rollback && createdb toktickit_rollback
NOTICE:  database "toktickit_rollback" does not exist, skipping
created toktickit_rollback

$ pg_restore --no-owner -d toktickit_rollback lab3-before-lab4.dump   # the Lab 3 pg_dump
restored
Lab 3 rows: tickets=8 users=11 comments=9 notes=7

$ prisma migrate deploy   # apply Lab 4 (from feature/2-lab4-data-model)
4 migrations found in prisma/migrations
Applying migration `20261013193901_lab4_actions_workflow_dashboards`
The following migration(s) have been applied:
All migrations have been successfully applied.
Lab 4 present: history rows=8 tickets at version 1=8

$ psql -v ON_ERROR_STOP=1 -f server/prisma/rollback/lab4_down.sql
BEGIN
DROP TRIGGER
DROP FUNCTION
DROP TABLE
DROP TABLE
DROP INDEX
DROP INDEX
ALTER TABLE
ALTER TABLE
DROP TYPE
DELETE 1
COMMIT
after rollback: lab4 tables=0 lab4 Ticket columns=0 ActionStatus type=0 tickets=8 users=11

$ # from a worktree of main (the Lab 3 release, 08ef17d)
$ prisma generate && prisma migrate status
✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client
3 migrations found in prisma/migrations
Database schema is up to date!

$ prisma migrate diff --from-url <toktickit_rollback> --to-schema-datamodel prisma/schema.prisma --exit-code   # Lab 3 schema
No difference detected.

exit code: 0

$ npx vitest run tests/lab-03/migration.api.test.ts   # Lab 3 migration test
 ✓ tests/lab-03/migration.api.test.ts (12 tests) 856ms
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Result: the migration applies on top of real Lab 3 data and backfills it, and the
rollback returns the database to a state that Lab 3's tooling reports as up to
date, with no schema difference and every Lab 3 row intact. Lab 3's migration test
passes against it (12/12).

---

## 5. Test Commands

```bash
# Backend — unit, API, workflow/concurrency, authorization, migration/regression, performance smoke
cd server && npm run prisma:migrate && npm run prisma:seed && npm test

# Frontend — UI component and UI style
cd client && npm test

# Typecheck both sides
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# End-to-end, responsive, and accessibility (repository root; the config starts both servers)
npm run test:e2e
```

---

## 6. Final Results

Filled in when the suites run on the integrated `lab4-staging`, then **re-run on
`main` after the release PR merges** and pasted here as the record of the
release (submission Part 3).

| Level | Planned | Passing | Failing | Skipped |
|-------|---------|---------|---------|---------|
| Unit | 7 | | | |
| API / integration | 32 | | | |
| Workflow / concurrency | 16 | | | |
| Authorization | 9 | | | |
| Migration / regression | 5 | | | |
| UI component | 42 | | | |
| UI style | 5 | | | |
| Responsive / accessibility | 5 | | | |
| Performance smoke | 2 | | | |
| E2E | 12 | | | |
| **Total** | **135** | | | |
| Labs 1–3 suites (regression) | all | | | |

---

## 7. Known Limitations and Deferred Tests

| Item | Status | Reason |
|------|--------|--------|
| Cross-browser E2E | Chromium only | Continues the Lab 2 and Lab 3 decision |
| Performance smoke | Development machine only | A regression tripwire, not a production benchmark (specification open assumptions) |
| Idempotency of Ticket, comment, note, and upload creation | UI single-flight only | D-16; covered by UI-40, not by a server key |
| E2E development-database residue | Known | Carried from Lab 2 and Lab 3 — E2E runs write to the development database; reset before capturing evidence |
| Test Tickets with status history | Left in place | Status history is append-only in the database (BR-33), so a Ticket that has history cannot be deleted. The shared `server/tests/helpers/cleanup.ts` removes a test Ticket's actions, comments, notes, and attachments, and deletes the Ticket only when it has no history. Tickets that a test moved through the workflow stay in the development database, adding to the residue noted above. Lab 2/3 cleanups are unaffected: they create their Tickets directly, without history |
| Rollback drill | Manual | Needs a second database restored from a dump, which the automated suite does not provision |
| REG-02 history and `resolvedAt` invariants | Scoped to pre-migration Tickets | REG-02 asserts the backfilled history and `resolvedAt` only for Tickets that existed when the migration was applied (read from `_prisma_migrations.finished_at`), which is what the migration is responsible for. Tickets created afterwards get their creation entry and `resolvedAt` from the workflow (BR-31, BR-32, Issue #51), which is covered by that Issue's own tests. An unscoped check failed depending on test order: Lab 2/3 suites create Closed Tickets through Lab 3 code, which does not maintain `resolvedAt` yet |
| Seeded history on an already-migrated database | By design (BR-58) | The seed writes a seeded Ticket's history only when it has none. On a database that was migrated rather than reset, the seeded Tickets keep their single "Recorded at upgrade" entry. `npx prisma migrate reset --force` gives them the full seeded path |
