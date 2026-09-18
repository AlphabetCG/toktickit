# Lab 3 Test Plan and Results

**Sprint:** Lab 3 — Users, Roles, IT Staff Ticketing, and Admin Screens
**Contract:** [`specification.md`](./specification.md) — AC-01 … AC-56
**Status:** Planned before implementation. Result columns are filled in as each
Issue lands and are final only on `main`.

---

## 1. Test Strategy

This plan is written from the acceptance criteria **before** implementation, and
defines what counts as evidence. It is not a summary of whatever tests the
coding agent happened to produce.

**Approach — TDD per Issue.** For each Issue the tests below are written first
and confirmed to fail for the expected reason, then the smallest correct
behaviour is implemented until they pass.

**Eight levels.** Lab 3 adds two levels beyond Lab 2's six, because this sprint
introduces the two risks Lab 2 did not have — a privilege boundary, and an
irreversible data migration.

| Level | Tool | Answers |
|-------|------|---------|
| Unit | Vitest | Does an isolated rule hold at its boundaries? |
| API / integration | Vitest + Supertest | Does the endpoint honour §9, including every failure status? |
| **Authorization** | Vitest + Supertest | Is the §6.1 matrix enforced by the server, with the UI bypassed entirely? |
| **Migration / regression** | Vitest + Supertest + Prisma | Did Lab 2's data and behaviour survive the rename? |
| UI component | Vitest + Testing Library | Does the screen render every state and call the API correctly? |
| UI style | Vitest + Testing Library | Are the required classes, labels, and role markers present? |
| Responsive | Playwright | Does the layout hold at three viewports without overflow? |
| E2E | Playwright | Does a real user complete the journey against a real database? |

**Principles carried forward from Lab 2**

- **Boundaries are tested at the edge**, not in the middle: 11 and 12 characters
  for a password, the last active Administrator, a terminal status.
- **Every test must fail when its behaviour is removed.** A test that passes
  against a stub is not evidence.
- **No test may be skipped, disabled, `.todo`, or commented out** on `main`.

**Principles new to Lab 3**

- **Authorization is proven without the UI.** Every row of the §6.1 matrix is
  exercised by a direct API call carrying another role's session. A hidden
  button proves nothing (BR-16).
- **Refusals are tested for what they reveal, not only that they refuse.** A
  role refusal must be 403; an ownership refusal must be 404 and byte-identical
  to a missing resource (BR-14, BR-15). Asserting "not 200" would pass while
  leaking existence.
- **Negative-space assertions.** Several criteria are about what must *not* be
  present — Internal Notes in a Requester response, the selector in the
  codebase, the session token in `document.cookie`. Each gets an explicit test.
- **Migration is tested against real Lab 2 rows**, seeded through the Lab 2
  shape and then migrated, not against rows created after the fact.

**Test data.** API, authorization, and E2E tests run against a migrated and
seeded PostgreSQL using the §8.4 seed: four active and one inactive Requester,
three active and one inactive IT Staff, one Administrator, and Tickets spread
across every status, priority, and ownership state. Each test authenticates
through `POST /api/auth/login` and carries the returned cookie, so the session
path itself is exercised on every request rather than stubbed.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UNIT-01 | Unit | BR-04, D-02 | Password hashing | `hash()` output is not the plaintext, differs across calls for the same input, and `verify()` accepts only the original | `server/tests/lab-03/password.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-12 | Email normalisation | `  Somchai@KMUTT.AC.TH ` normalises to `somchai@kmutt.ac.th` before storage and comparison | `server/tests/lab-03/password.unit.test.ts` | Planned |
| UNIT-03 | Unit | AC-08, BR-10 | Password policy boundaries | 11 chars rejected, 12 accepted, 128 accepted, 129 rejected; a blocklisted value rejected; a value equal to the current password rejected | `server/tests/lab-03/password.unit.test.ts` | Planned |
| UNIT-04 | Unit | AC-26, BR-44 | Comment and note body rules | Trimmed first; `"   "` rejected, 1 char accepted, 2000 accepted, 2001 rejected | `server/tests/lab-03/validation.unit.test.ts` | Planned |
| UNIT-05 | Unit | AC-31, §9.3 | Queue query normalisation | `page=0`, `pageSize=999`, `sort=bogus`, `status=NOPE`, `ownerId=abc` each fall back to the documented default | `server/tests/lab-03/validation.unit.test.ts` | Planned |
| UNIT-06 | Unit | AC-37, BR-35 | Permitted transitions | Every ✅ cell of the §5.7 matrix is accepted | `server/tests/lab-03/status-transitions.unit.test.ts` | Planned |
| UNIT-07 | Unit | AC-38, BR-35 | Forbidden transitions | Every — cell of the §5.7 matrix is rejected, including `RESOLVED → IN_PROGRESS` | `server/tests/lab-03/status-transitions.unit.test.ts` | Planned |
| UNIT-08 | Unit | AC-39, BR-36 | Terminal statuses | No transition leaves `CLOSED` or `CANCELLED` | `server/tests/lab-03/status-transitions.unit.test.ts` | Planned |
| UNIT-09 | Unit | BR-08, D-03 | Session token | 32 bytes of entropy, tokens differ across calls, only the SHA-256 digest is persisted, and an expired row is treated as absent | `server/tests/lab-03/session.unit.test.ts` | Planned |

### 2.2 API / integration

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-01 | Valid login | 200; session established; response carries identity and role and **no** password field | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | AC-02, BR-02 | Password change outstanding | Login succeeds, but a protected route returns 403 with `passwordChangeRequired: true` until the change is saved | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | AC-03, BR-05 | Wrong password | 401 with the uniform message; no session issued | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | AC-04, BR-05 | Unknown email | Response byte-identical to API-03 | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | AC-05, BR-06 | Deactivated, correct password | Refused with the deactivation message; no session issued | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | API | AC-06, BR-06 | Deactivated, wrong password | Response byte-identical to API-03; deactivation not revealed | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-07 | API | AC-07, BR-08 | Logout | 200; the session row is gone and the next protected request returns 401 | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-08 | API | AC-08 | Weak new password | 400 with a field-level message; the old password still authenticates | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-09 | API | AC-09, BR-11 | Password change invalidates siblings | A second session for the same user returns 401 afterwards; the new password authenticates | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-10 | API | AC-11, BR-09 | Cookie flags | `Set-Cookie` carries `HttpOnly`, `SameSite=Lax`, and `Path=/` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-11 | API | AC-20, BR-31 | Authenticated ticket creation | 201; stored against the authenticated user; `itPriority` equals `requestedPriority` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-12 | API | AC-22, BR-43 | Requester posts a Public Comment | 201; author and timestamp set by the server; visible to IT Staff on the same Ticket | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-13 | API | AC-25, BR-23 | Resolution signal | 200; `resolutionSignalledAt` and the signalling user recorded; `currentStatus` unchanged | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-14 | API | AC-26 | Empty comment body | 400 with a field-level message; nothing written | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-15 | API | AC-27 | Queue breadth | Returns Tickets submitted by every Requester, not only the caller's | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-16 | API | AC-28 | Queue filters | Status and IT Priority filters each narrow the result correctly | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-17 | API | AC-29, BR-25 | Unassigned filter | `ownerId=unassigned` returns only Tickets with a null owner; `ownerId=me` returns only the caller's | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-18 | API | AC-30 | Queue pagination | Page 2 returns the next slice with correct `page`, `pageSize`, `totalItems`, `totalPages` | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-19 | API | AC-31 | Invalid queue parameters | Request succeeds using documented defaults; never 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-20 | API | AC-33, BR-27 | Claim | An unassigned Ticket gains the claiming user as owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-21 | API | AC-34, BR-27 | Reassign and release | Ownership moves to another active IT Staff user, and can be released back to unassigned | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-22 | API | AC-35, BR-26, BR-28 | Invalid assignee | Assigning to a deactivated user or to a Requester is rejected; ownership unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-23 | API | AC-36, BR-30 | IT Priority | New IT Priority stored; `requestedPriority` unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-24 | API | AC-37 | Permitted transition | `NEW → IN_PROGRESS` succeeds and persists | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-25 | API | AC-38 | Forbidden transition | `RESOLVED → IN_PROGRESS` returns 409; status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-26 | API | AC-39, BR-36 | Terminal ticket | Every transition from `CLOSED` returns 409 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-27 | API | AC-40, BR-41 | Internal note created | 201 for IT Staff; the note is absent from the Requester's view of the same Ticket | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-28 | API | AC-41, BR-46 | Append on a terminal Ticket | Comment and note both rejected on `CLOSED` and `CANCELLED` | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-29 | API | AC-43 | User list | 200; each row carries name, email, role, and activation state, and **no** password hash | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-30 | API | AC-44 | User search | Matches on name and on email, case-insensitively | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-31 | API | AC-45 | Role filter | Only users holding the requested role are returned | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-32 | API | AC-46, BR-49 | Create user | 201; exactly one role; `mustChangePassword` true | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-33 | API | AC-47, BR-51 | Duplicate email | 409 on create and on edit, including a case-differing duplicate; nothing written | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-34 | API | AC-48, BR-52 | Invalid role | 400; nothing written | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-35 | API | AC-49, BR-54 | Self-deactivation | 409; the Administrator stays active | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-36 | API | AC-50, BR-56 | Last active Administrator | Deactivating **or** demoting the only active Administrator returns 409 | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-37 | API | AC-51, BR-53 | New initial password | The target user is re-flagged and the new password authenticates | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-38 | API | AC-52, BR-53 | Initial password invalidates sessions | The target user's existing session returns 401 afterwards | `server/tests/lab-03/users-admin.api.test.ts` | Planned |

### 2.3 Authorization

Every test in this section calls the API directly with a session belonging to the
wrong role or the wrong user. None of them render a component (BR-16).

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| AUTHZ-01 | Authorization | AC-10, BR-13 | Unauthenticated access | Every protected route returns 401 with no session, and no resource is read | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-02 | Authorization | AC-12, BR-03 | Client-supplied identity ignored | A Requester sending another user's id in the body, query, or an `X-Requester-Id` header still receives only their own data | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-03 | Authorization | AC-13, BR-14 | Requester → queue | 403; no queue data in the body | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-04 | Authorization | AC-14 | Requester → Administrator routes | Every `/api/admin/*` route returns 403 | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-05 | Authorization | AC-15, BR-18 | IT Staff → Administrator routes | Every `/api/admin/*` route returns 403 | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-06 | Authorization | AC-16, BR-15 | Requester → another's Ticket | 404, **byte-identical** to the response for a Ticket id that does not exist | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-07 | Authorization | AC-17 | IT Staff → any Ticket | 200 regardless of submitter | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-08 | Authorization | AC-23 | Comment on a Ticket not owned | 404; nothing written | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-09 | Authorization | AC-24, BR-24 | Requester → Internal Notes | 403 on read and on create; the body carries no note text, author, or count | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-10 | Authorization | AC-40, BR-41 | Notes absent from Requester payloads | `GET /api/tickets/:id` as the owning Requester contains no `internalNotes` key at all, on a Ticket that has notes | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-11 | Authorization | BR-37 | Requester → status and priority | Status, IT Priority, and ownership routes each return 403 for a Requester, including on their own Ticket | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| AUTHZ-12 | Authorization | BR-19, BR-55 | Self role change | An Administrator editing their own role is rejected | `server/tests/lab-03/authorization.api.test.ts` | Planned |

### 2.4 Migration and regression

These run against a database seeded in the **Lab 2 shape**, migrated, and then
inspected — not against rows created after the migration.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| REG-01 | Migration | AC-18, BR-58 | Tickets survive | Every pre-migration Ticket id and Ticket Number still exists and still resolves to the same submitting user | `server/tests/lab-03/migration.api.test.ts` | Pass |
| REG-02 | Migration | AC-19, BR-58 | Attachments survive | Attachment rows, their `ticketId`, `uploadedById`, and soft-removal state are unchanged | `server/tests/lab-03/migration.api.test.ts` | Pass |
| REG-03 | Migration | AC-21, FR-10 | Selector removed | No source file references `X-Requester-Id`, `RequesterProvider`, or the `/select` route | `server/tests/lab-03/migration.api.test.ts` | Planned (Issue #32) |
| REG-04 | Migration | BR-60 | Migrated credentials | Every migrated Requester holds the `REQUESTER` role, keeps its original activation state, and is flagged for a password change | `server/tests/lab-03/migration.api.test.ts` | Pass |
| REG-05 | Migration | BR-31 | IT Priority backfill | Every pre-existing Ticket has `itPriority` equal to its `requestedPriority` after migration | `server/tests/lab-03/migration.api.test.ts` | Pass |
| REG-06 | Regression | BR-61 | Lab 2 behaviour intact | The Lab 2 owned-list contract still holds under authentication: ownership scoping, search, filter, sort, pagination metadata | `server/tests/lab-03/migration.api.test.ts` | Planned (Issue #32) |
| REG-07 | Regression | BR-62 | Seed idempotency | Running the seed twice creates no duplicate user, category, related system, comment, or note | `server/tests/lab-03/migration.api.test.ts` | Pass |

> **How the migration regressions are evidenced (REG-01, REG-02, REG-04, REG-05).**
> A fresh test run applies the migration to an empty database, so there is no
> genuine pre-migration dataset to replay a before/after against. These tests
> therefore combine **two** kinds of evidence rather than a runtime migration
> replay: (a) a *static mechanism check* that reads the migration SQL and asserts
> it **renames** `RequesterUser` (and never issues `DROP TABLE` on
> `RequesterUser`/`Ticket`/`Attachment`), backfills `itPriority`, and adds
> `role`/`mustChangePassword` with the correct defaults; and (b) *runtime
> invariants* on the migrated + seeded database (every Ticket resolves to a User,
> the Attachment FK points at User with soft-removal columns intact, requesters
> keep their role/activation and carry the change flag, every Ticket has an IT
> Priority). The data-preservation guarantee itself is additionally proven by
> `prisma migrate diff` reporting **no drift** between the hand-written migration
> and the schema. A true runtime replay is a known trade-off called out here so it
> is not mistaken for an omission at grading.

### 2.5 UI component

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UI-01 | UI | AC-01 | Login success path | Valid submission calls the API once and routes into the application | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI | FR-23 | Login validation | Empty email or password shows a field-level message and makes no API call | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-03 | UI | BR-43 | Login busy state | Submit is disabled and `aria-busy` while in flight; a double click produces one call | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-04 | UI | AC-03 | Login failure | The uniform message is shown and the entered email is preserved | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-05 | UI | AC-05 | Deactivated account | The deactivation message is shown, distinct from the credential failure message | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-06 | UI | AC-02 | Mandatory change mode | With `mustChangePassword`, the change screen renders and no application navigation is reachable | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-07 | UI | BR-10 | Rules shown up front | The length rule is visible before submission, not only after failure | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-08 | UI | FR-23 | Confirmation mismatch | A mismatched confirmation shows a field-level message and makes no API call | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-09 | UI | AC-02 | Successful change | On success the application becomes reachable | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-10 | UI | AC-53, FR-08 | Requester navigation | My Tickets and Create Ticket present; queue and User Management absent from the DOM | `client/tests/lab-03/RoleNavigation.test.tsx` | Planned |
| UI-11 | UI | AC-53 | IT Staff navigation | Ticket Queue present; User Management absent | `client/tests/lab-03/RoleNavigation.test.tsx` | Planned |
| UI-12 | UI | AC-53 | Administrator navigation | User Management present | `client/tests/lab-03/RoleNavigation.test.tsx` | Planned |
| UI-13 | UI | §7.1 | Shell identity and logout | The authenticated name and role badge render, and Logout calls the API and clears the session | `client/tests/lab-03/RoleNavigation.test.tsx` | Planned |
| UI-14 | UI | AC-22 | Requester posts a comment | The composer submits, clears, and the new comment appears | `client/tests/lab-03/RequesterComments.test.tsx` | Planned |
| UI-15 | UI | AC-25 | Resolution signal | The action confirms, then shows the signalled state; the status badge is unchanged | `client/tests/lab-03/RequesterComments.test.tsx` | Planned |
| UI-16 | UI | AC-24, BR-24 | No notes for a Requester | The Requester detail renders no Internal Notes region and no note composer | `client/tests/lab-03/RequesterComments.test.tsx` | Planned |
| UI-17 | UI | AC-27 | Queue rendering | Rows reflect the API response, including owner and status columns | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-18 | UI | AC-28, AC-29 | Queue controls | Search, status, IT Priority, and owner filters each issue a request carrying the right parameter | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-19 | UI | AC-32, BR-57 | Empty vs no-results | Distinct wording, and Clear filters present only in the no-results state | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-20 | UI | FR-23 | Queue failure state | A failed load shows a safe message and a retry action | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-21 | UI | AC-33, AC-34 | Ownership controls | Claim appears when unassigned; reassign offers only permitted assignees | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-22 | UI | AC-36 | IT Priority control | Changing IT Priority issues the request; the Requested Priority badge is read-only | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-23 | UI | AC-38, BR-38 | Status control | Only permitted targets are offered for the current status, and `CANCELLED` requires confirmation | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-24 | UI | AC-42, BR-47 | Comments and notes separated | Two distinct regions; the note composer carries a persistent "Visible to IT Staff only" label beside the input | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-25 | UI | AC-41 | Terminal ticket composers | On a `CLOSED` Ticket both composers are disabled with an explanation | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-26 | UI | AC-43 | User list columns | Name, Email, Role, Status, and an Edit action render for each user | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-27 | UI | AC-44, AC-45 | User search and filter | Typing a term and selecting a role each issue the matching request | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-28 | UI | AC-46, AC-48 | Create user form | Required fields validate inline; exactly one role can be chosen | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-29 | UI | AC-47, AC-49, AC-50 | Guard feedback | Duplicate email, self-deactivation, and last-Administrator refusals each surface a specific message, not a generic failure | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-30 | UI | AC-51 | Set initial password | The action confirms and reports that the user must change it at next login | `client/tests/lab-03/UserManagement.test.tsx` | Planned |

### 2.6 UI style

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| STYLE-01 | UI style | AC-55 | No literal colour | No Lab 3 component source contains a `#rrggbb` or `rgba()` literal; every colour comes from a Lab 2 token | `client/tests/lab-03/zen-green-lab3.test.tsx` | Planned |
| STYLE-02 | UI style | §7.5 | Status badge coverage | All eight statuses render through the shared badge with visible text | `client/tests/lab-03/zen-green-lab3.test.tsx` | Planned |
| STYLE-03 | UI style | §7.5 | Role badge | Each role renders as a badge carrying its name as text | `client/tests/lab-03/zen-green-lab3.test.tsx` | Planned |
| STYLE-04 | UI style | §7.2 | Editable vs read-only | On IT Staff Ticket Detail, operational fields carry the editable class and Requester-owned fields carry the read-only class | `client/tests/lab-03/zen-green-lab3.test.tsx` | Planned |
| STYLE-05 | UI style | AC-42, BR-47 | Note audience marker | The Internal Note composer's audience label is present and programmatically associated with the input | `client/tests/lab-03/zen-green-lab3.test.tsx` | Planned |

### 2.7 Responsive

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| RESP-01 | Responsive | AC-54 | Desktop 1280×800 | No horizontal page scroll on Login, Change Password, Queue, Staff Detail, User Management; screenshots captured | `e2e/lab-03/responsive.spec.ts` | Planned |
| RESP-02 | Responsive | AC-54 | Tablet 820×1180 | No overflow, no clipping, screenshots captured | `e2e/lab-03/responsive.spec.ts` | Planned |
| RESP-03 | Responsive | AC-54 | Mobile 390×844 | Fields stack, controls stay touch-sized, no horizontal page scroll | `e2e/lab-03/responsive.spec.ts` | Planned |
| RESP-04 | Responsive | AC-54 | Mobile queue representation | The queue renders as cards, and its filters and pagination stay usable | `e2e/lab-03/responsive.spec.ts` | Planned |

Screenshots are written to
`artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.

### 2.8 End-to-end

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| E2E-01 | E2E | AC-01, AC-07, AC-10 | Login, work, log out | A Requester logs in, opens their tickets, logs out; a direct URL afterwards returns to Login and shows no ticket data | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-02 | First-login change | A user with an initial password reaches only the change screen; the application opens only after a valid change | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-03 | E2E | AC-11 | Cookie not readable | `document.cookie` in the page contains no session token while the session is active | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-04 | E2E | AC-56 | Keyboard-only | Login and Change Password complete by keyboard alone with focus visible at every step | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-05 | E2E | AC-33, AC-36, AC-37, AC-40 | Staff journey | Queue → open detail → claim → set IT Priority → transition status → post a Public Comment → add an Internal Note | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-06 | E2E | AC-22, AC-24, AC-25 | Two-sided conversation | A Requester comments and signals resolution; staff see both; the Requester never sees the staff Internal Note | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-07 | E2E | AC-46, AC-51 | Create and first login | An Administrator creates a user, then that user logs in and is forced through the password change | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-08 | E2E | AC-49, AC-50 | Administrator guards | Self-deactivation and last-Administrator removal are both refused with a visible message | `e2e/lab-03/user-administration.spec.ts` | Planned |

**Totals:** 9 unit · 38 API · 12 authorization · 7 migration/regression ·
30 UI component · 5 UI style · 4 responsive · 8 E2E = **113 planned tests**.

---

## 3. Acceptance-Criterion Traceability

Every acceptance criterion maps to at least one planned test, and every planned
test names a real file path.

| AC | Criterion (abbreviated) | Covering tests |
|----|-------------------------|----------------|
| AC-01 | Valid login establishes a session | API-01, UI-01, E2E-01 |
| AC-02 | Password change blocks the application | API-02, UI-06, UI-09, E2E-02 |
| AC-03 | Wrong password → uniform message | API-03, UI-04 |
| AC-04 | Unknown email → identical response | API-04 |
| AC-05 | Deactivated + correct password → named refusal | API-05, UI-05 |
| AC-06 | Deactivated + wrong password → identical to AC-03 | API-06 |
| AC-07 | Logout invalidates the session | API-07, E2E-01 |
| AC-08 | Short password rejected | UNIT-03, API-08 |
| AC-09 | Change invalidates other sessions | API-09 |
| AC-10 | No session → 401 everywhere | AUTHZ-01, E2E-01 |
| AC-11 | Cookie unreadable from JavaScript | API-10, E2E-03 |
| AC-12 | Client-supplied identity ignored | AUTHZ-02 |
| AC-13 | Requester → queue 403 | AUTHZ-03 |
| AC-14 | Requester → admin routes 403 | AUTHZ-04 |
| AC-15 | IT Staff → admin routes 403 | AUTHZ-05 |
| AC-16 | Another's Ticket → 404, identical to missing | AUTHZ-06 |
| AC-17 | IT Staff read any Ticket | AUTHZ-07 |
| AC-18 | Migrated Requester sees Lab 2 Tickets | REG-01 |
| AC-19 | Migrated attachments unchanged | REG-02 |
| AC-20 | Authenticated creation, IT Priority copied | API-11 |
| AC-21 | Selector and header gone | REG-03 |
| AC-22 | Requester Public Comment | API-12, UI-14, E2E-06 |
| AC-23 | Comment on a Ticket not owned → 404 | AUTHZ-08 |
| AC-24 | Requester → Internal Notes 403, no content | AUTHZ-09, UI-16, E2E-06 |
| AC-25 | Resolution signal leaves status alone | API-13, UI-15, E2E-06 |
| AC-26 | Whitespace body rejected | UNIT-04, API-14 |
| AC-27 | Queue covers every Requester | API-15, UI-17 |
| AC-28 | Queue filters narrow correctly | API-16, UI-18 |
| AC-29 | Unassigned filter | API-17, UI-18 |
| AC-30 | Queue pagination and metadata | API-18 |
| AC-31 | Invalid queue parameters → defaults | UNIT-05, API-19 |
| AC-32 | No-results distinct from empty | UI-19 |
| AC-33 | Claim an unassigned Ticket | API-20, UI-21, E2E-05 |
| AC-34 | Reassign to permitted staff | API-21, UI-21 |
| AC-35 | Invalid assignee rejected | API-22 |
| AC-36 | IT Priority changes, Requested untouched | API-23, UI-22, E2E-05 |
| AC-37 | Permitted transition succeeds | UNIT-06, API-24, E2E-05 |
| AC-38 | Forbidden transition → 409 | UNIT-07, API-25, UI-23 |
| AC-39 | Terminal status rejects transitions | UNIT-08, API-26 |
| AC-40 | Note invisible to the Requester | API-27, AUTHZ-10, E2E-05 |
| AC-41 | Terminal Ticket rejects appends | API-28, UI-25 |
| AC-42 | Comments and notes visually distinct | UI-24, STYLE-05 |
| AC-43 | User list columns | API-29, UI-26 |
| AC-44 | User search by name or email | API-30, UI-27 |
| AC-45 | Role filter | API-31, UI-27 |
| AC-46 | Create user with one role | API-32, UI-28, E2E-07 |
| AC-47 | Duplicate email → 409 | API-33, UI-29 |
| AC-48 | Invalid role → 400 | API-34, UI-28 |
| AC-49 | Self-deactivation refused | API-35, UI-29, E2E-08 |
| AC-50 | Last Administrator protected | API-36, UI-29, E2E-08 |
| AC-51 | New initial password forces a change | API-37, UI-30, E2E-07 |
| AC-52 | Initial password invalidates sessions | API-38 |
| AC-53 | Role-specific navigation only | UI-10, UI-11, UI-12 |
| AC-54 | No overflow or clipping at any viewport | RESP-01…RESP-04 |
| AC-55 | Zen Green tokens, no literal colour | STYLE-01 |
| AC-56 | Keyboard reachable, focus visible | E2E-04 |

**Coverage: 56 of 56 acceptance criteria.**

### Additional business-rule coverage

Rules whose evidence sits outside the AC table:

| BR | Rule | Covering test |
|----|------|---------------|
| BR-12 | Email normalised and compared case-insensitively | UNIT-02, API-33 |
| BR-19, BR-55 | No self role change | AUTHZ-12 |
| BR-31 | IT Priority backfilled for existing Tickets | REG-05 |
| BR-37 | Requester never changes status or priority | AUTHZ-11 |
| BR-44 | Body length boundaries | UNIT-04 |
| BR-60 | Migrated users get role, state, and a change flag | REG-04 |
| BR-61 | Lab 2 list contract still holds | REG-06 |
| BR-62 | Seed idempotency | REG-07 |
| BR-08, D-03 | Session token entropy, digest at rest, expiry | UNIT-09 |

---

## 4. Manual Verification Checklist

Automated assertions cannot see clipping, overlap, or a confusing layout. This is
completed by hand against [`ui-spec.md`](./ui-spec.md) and the captured
screenshots, **not from memory**.

### 4.1 Per screen, per viewport

Repeat for Login, Change Password, IT Staff Queue, IT Staff Ticket Detail, and
User Management at desktop, tablet, and mobile:

- [ ] No horizontal page scrolling
- [ ] No clipped or truncated labels
- [ ] No overlapping validation messages
- [ ] No hidden or unreachable controls
- [ ] Editable and read-only fields visually distinct
- [ ] Validation messages beneath their own field
- [ ] Button hierarchy consistent; one primary action per screen
- [ ] Zen Green tokens only; no stray palette
- [ ] Status, priority, and role badges consistent with Lab 2's component

### 4.2 Role and confidentiality spot checks

- [ ] Signed in as each role, the shell shows only that role's destinations
- [ ] Public Comments and Internal Notes are unmistakable at a glance
- [ ] The note composer's audience label is visible while typing, not only above
- [ ] A Requester's Ticket Detail shows no trace of a note region

### 4.3 Data and integrity spot checks

- [ ] `npx prisma migrate reset --force` rebuilds and reseeds without error
- [ ] The seed runs twice with no duplicate rows
- [ ] `git ls-files | grep -E '\.env$'` returns nothing
- [ ] No password hash appears in any API response
- [ ] No test is skipped, `.todo`, `.skip`, or commented out

---

## 5. Test Commands

```bash
# Backend — unit, API, authorization, migration/regression
cd server && npm run prisma:migrate && npm run prisma:seed && npm test

# Frontend — UI component and UI style
cd client && npm test

# Typecheck both sides
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# End-to-end and responsive (repository root; the config starts both servers)
npm run test:e2e
npm run test:e2e:report
```

---

## 6. Final Results

Filled in from a clean run on `main` after the release PR merges.

| Level | Planned | Passing | Failing | Skipped |
|-------|---------|---------|---------|---------|
| Unit | 9 | — | — | — |
| API / integration | 38 | — | — | — |
| Authorization | 12 | — | — | — |
| Migration / regression | 7 | — | — | — |
| UI component | 30 | — | — | — |
| UI style | 5 | — | — | — |
| Responsive | 4 | — | — | — |
| E2E | 8 | — | — | — |
| **Total** | **113** | — | — | — |

> Paste the passing terminal output from `main` below, plus the Playwright report
> summary. Any non-zero figure in Failing or Skipped must be explained in §7.

---

## 7. Known Limitations and Deferred Tests

| Item | Status | Reason |
|------|--------|--------|
| Login rate limiting | Not implemented, not tested | D-08 — account lockout is excluded by scope, and rate limiting is deferred to a later sprint |
| Expired-session sweep | Lazily handled on lookup; no scheduled job tested | §12 open assumptions; a periodic sweep is deferred to Lab 4 |
| Concurrent ownership claims | Not load-tested | Two staff claiming simultaneously resolves last-write-wins; verifying contention needs load tooling outside this sprint |
| Password hashing cost under load | Not benchmarked | D-02 fixes the factor at 10 via environment variable; tuning is an operational concern |
| Cross-browser E2E | Chromium only | Keeps the lab run time reasonable, continuing the Lab 2 decision |
| Actions Taken | Out of scope | Lab 4 |
| E2E development-database residue | Known | Carried forward from Lab 2 §7 — E2E runs write to the development database rather than an isolated one |
