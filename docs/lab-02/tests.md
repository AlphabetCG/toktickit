# Lab 2 Test Plan and Results

**Sprint:** Lab 2 — Requester Ticketing MVP with UI Foundation
**Contract:** [`specification.md`](./specification.md) — AC-01 … AC-39
**Status:** Planned before implementation. Result columns are filled in as each
Issue lands and are final only on `main`.

---

## 1. Test Strategy

This plan is written from the acceptance criteria **before** implementation, and
is used as the definition of evidence rather than as a summary of whatever tests
happened to get written.

**Approach — TDD per Issue.** For each Issue, the tests listed below are written
first and confirmed to fail for the expected reason (a missing route, not a
broken import). Only then is the smallest correct behaviour implemented, and the
test turned green.

**Six levels, each with a distinct job:**

| Level | Tool | Answers |
|-------|------|---------|
| Unit | Vitest | Does an isolated rule behave correctly at its boundaries? |
| API / integration | Vitest + Supertest | Does the endpoint honour the contract in §8, including every failure status? |
| UI component | Vitest + Testing Library | Does the screen render every state and call the API correctly? |
| UI style | Vitest + Testing Library | Are the required classes, labels, asterisks, and states actually present? |
| Responsive | Playwright | Does the layout hold at desktop, tablet, and mobile without overflow? |
| E2E | Playwright | Does a real Requester complete the whole journey against a real database? |

**Principles applied throughout:**

- **Ownership is proven without the UI.** Every ownership test calls the API
  directly with the wrong requester header. A hidden button is not a test.
- **Unhappy paths carry equal weight.** Each endpoint has tests for validation
  failure, ownership failure, missing resource, and boundary values — not only
  the happy path.
- **Boundaries are tested at the edge**, not in the middle: 4 and 5 characters
  for Summary, 5 MB and 5 MB + 1 byte for uploads, the fifth and sixth
  attachment.
- **Every test must fail when its behaviour is removed.** A test that passes
  against a stub is not evidence.
- **No test may be skipped, disabled, `.todo`, or commented out** in the final
  `main` branch.

**Test data.** API and E2E tests run against a migrated and seeded PostgreSQL
using the seed from `specification.md` §7.5 — four active Requesters and one
inactive Requester make ownership and inactive-user behaviour testable without
fixtures invented per test.

---

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UNIT-01 | Unit | AC-09, BR-14 | Ticket Number generator format | Matches `TKT-YYYY-NNNNNN` with the current year and zero padding | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| UNIT-02 | Unit | AC-09, BR-14 | Sequence increments and restarts each year | Consecutive calls increment; a new year restarts at `000001` | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| UNIT-03 | Unit | AC-12, BR-39, BR-40 | Summary and Description validators | Trimmed first; 4 and 151 chars rejected, 5 and 150 accepted; 19 and 5001 rejected, 20 and 5000 accepted | `server/tests/lab-02/validation.unit.test.ts` | Planned |
| UNIT-04 | Unit | AC-27, AC-28, BR-04, BR-05, BR-51 | Attachment type and size validators | PDF/PNG/JPEG/WEBP accepted by detected MIME type; `.exe` rejected; 5 MB accepted, 5 MB + 1 byte rejected | `server/tests/lab-02/validation.unit.test.ts` | Planned |
| UNIT-05 | Unit | BR-50 | Stored filename generation | Output is a server-generated UUID plus a validated extension; `../../etc/passwd` in the original name cannot escape the upload directory | `server/tests/lab-02/validation.unit.test.ts` | Planned |
| UNIT-06 | Unit | AC-20, BR-36 | List query parameter normalisation | `page=0`, `pageSize=999`, `sort=bogus`, `order=sideways` each fall back to the documented default | `server/tests/lab-02/validation.unit.test.ts` | Planned |

### 2.2 API / integration

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| API-01 | API | AC-02, BR-13, BR-20 | Active Requester list | 200; only active Requesters; the seeded inactive Requester is absent | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-02 | API | AC-01, BR-19 | Requester context header | Missing, malformed, unknown, and inactive `X-Requester-Id` each return 401 | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-03 | API | AC-10, BR-41 | Reference data endpoints | 200; active Categories and the seeded Related Systems returned from the database | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-04 | API | AC-07 | Create a valid Ticket | 201; one Ticket saved; official Ticket Number returned | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-05 | API | AC-08, BR-02, BR-18 | Created Ticket ownership and defaults | Stored row has `requesterId` of the header Requester and `currentStatus = NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | API | AC-09, BR-01 | Ticket Number uniqueness | Two Tickets created in the same year receive different, correctly formatted numbers | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-07 | API | AC-12, BR-39 | Summary below minimum | 400 with a field-level message naming Summary | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-08 | API | BR-41 | Unknown or inactive reference id | 400; no Ticket is created | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-09 | API | BR-16 | Client-supplied read-only fields | `ticketNumber`, `ticketDate`, and `currentStatus` in the body are ignored; server values win | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-10 | API | AC-15, BR-27 | Owned-only listing | Requester B's list contains none of Requester A's Tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-11 | API | AC-16, BR-31 | Search | Case-insensitive match on Summary and Ticket Number; non-matching Tickets excluded | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-12 | API | AC-17, BR-32 | Category filter | Only Tickets in the requested Category are returned | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-13 | API | AC-18, BR-37 | Pagination | Page 2 returns the next slice; `page`, `pageSize`, `totalItems`, `totalPages` are correct | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-14 | API | AC-19, BR-33, BR-34 | Default sort and tiebreak | Ticket Date descending; Tickets sharing a date are ordered deterministically by id | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-15 | API | AC-20, BR-36 | Invalid query parameters | `page=0&pageSize=999&sort=bogus` succeeds using documented defaults | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-16 | API | BR-38 | Filters compose with ownership | A Category filter matching another Requester's Tickets still returns none of them | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-17 | API | AC-23 | Owned Ticket detail | 200; full Ticket with its attachment metadata | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-18 | API | AC-24, BR-28 | Cross-Requester Ticket access | 404; response body carries no Ticket data | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-19 | API | AC-25, BR-60 | Non-existent Ticket | Response is byte-identical to API-18 | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-20 | API | AC-26 | Valid upload | 201; attachment stored and listed as active | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-21 | API | AC-27, BR-04 | Unsupported type | 415 with a reason naming the unsupported type | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-22 | API | AC-28, BR-05 | Oversized upload | 413 with a reason naming the size limit | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-23 | API | AC-29, BR-06 | Attachment limit | A sixth active attachment returns 409 | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-24 | API | AC-30 | Download active attachment | 200; original filename and byte-identical content | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-25 | API | AC-31, BR-07, BR-54 | Soft removal | 200; row still exists with `removedAt`, remover, and reason recorded | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-26 | API | AC-32, BR-08 | Download a removed attachment | Refused; no file content returned | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-27 | API | AC-33, BR-53 | Removal without a reason | 400; the attachment stays active | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-28 | API | AC-34, BR-56 | Removed files free quota | After removing one of five, a new upload succeeds | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-29 | API | AC-35, BR-29 | Cross-Requester attachment access | 404 on direct attachment id from the wrong Requester | `server/tests/lab-02/attachments.api.test.ts` | Planned |

### 2.3 UI component

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| UI-01 | UI | AC-02 | Selector contents | Only active Requesters appear as options | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-02 | UI | AC-03, BR-21 | Selection persistence | A stored selection is restored on mount and the shell shows the name | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-03 | UI | AC-05, BR-23 | Requester load failure | Safe message plus a retry action; the app cannot be entered | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-04 | UI | AC-06, BR-24 | No active Requesters | Explanatory empty state, not an empty dropdown | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-05 | UI | AC-01, BR-19 | Guarded screens | With no selection, a ticket screen renders the selection screen instead | `client/tests/lab-02/AppShell.test.tsx` | Planned |
| UI-06 | UI | AC-04, BR-22 | Change Requester | New name shown; previous Requester's tickets are cleared from the DOM | `client/tests/lab-02/AppShell.test.tsx` | Planned |
| UI-07 | UI | AC-10 | Reference data source | Category and Related System options come from the mocked API response, not literals | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-08 | UI | AC-11, BR-44 | Client-side validation | Message appears beneath Summary; the API client is never called | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-09 | UI | AC-13, BR-43 | Duplicate submission guard | Submit is disabled and shows busy; two rapid clicks produce one API call | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-10 | UI | AC-14, BR-45, BR-46 | Submission failure | Safe error message shown and every entered value is still in the form | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-11 | UI | AC-07 | Success state | The returned Ticket Number and the next action are displayed | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-12 | UI | AC-15 | List rendering | Rows reflect the API response, not hard-coded markup | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-13 | UI | AC-16 | Search interaction | Typing a term issues a request carrying that search parameter | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-14 | UI | AC-21, BR-57 | Empty state | "No tickets yet" wording with a create action | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-15 | UI | AC-22, BR-57, BR-58 | No-results state | Distinct wording from UI-14, plus a working Clear filters control | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-16 | UI | AC-18 | Pagination controls | Page controls reflect metadata and request the correct page | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-17 | UI | AC-23, BR-59 | Read-only detail | No Ticket field is an enabled input or editable control | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-18 | UI | AC-31, BR-55 | Removed attachment presentation | Still listed, badged Removed with its reason, and no download control | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-19 | UI | AC-33, BR-53 | Removal confirmation | Confirm stays disabled until a reason is entered | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-20 | UI | AC-27, AC-28, BR-52 | Rejected file feedback | The specific reason is shown — unsupported type, too large, or limit reached | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |

### 2.4 UI style

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| STYLE-01 | UI style | AC-37 | Required-field marking | Every required field renders the red asterisk **and** still produces a message on failure | `client/tests/lab-02/zen-green-style.test.tsx` | **Pass** |
| STYLE-02 | UI style | AC-38 | Accessible labelling | Every icon-only control exposes an accessible name and a tooltip | `client/tests/lab-02/zen-green-style.test.tsx` | Planned |
| STYLE-03 | UI style | AC-39 | Badge semantics | Status and Priority badges contain text; meaning never rests on colour alone | `client/tests/lab-02/zen-green-style.test.tsx` | **Pass** |
| STYLE-04 | UI style | §6.1, §6.4 | Field-state classes | Editable and read-only fields carry distinct classes bound to theme tokens; no hardcoded hex in components | `client/tests/lab-02/zen-green-style.test.tsx` | **Pass** |
| STYLE-05 | UI style | BR-43 | Busy and disabled state | The submitting button carries both the disabled attribute and the busy indicator class | `client/tests/lab-02/zen-green-style.test.tsx` | **Pass** |

> **Foundation coverage (Issue #12).** `zen-green-style.test.tsx` also carries six
> unnumbered assertions for the application shell itself — identity, both
> navigation destinations, the active-page marker as `aria-current` **and** a
> class, the mobile disclosure's `aria-expanded`, and the Requester identity area
> appearing only once a Requester is selected. They prove Issue #12's own
> acceptance criteria; the Requester-driven behaviour they hand off to is UI-05
> and UI-06 in Issue #14.
>
> STYLE-01 and STYLE-03 land early because the field and badge components ship
> with the foundation. Both are re-verified in context — STYLE-01 on the Create
> Ticket form (Issue #15), STYLE-03 in the ticket list (Issue #16). STYLE-02
> waits for the icon-only attachment controls in Issue #17.

### 2.5 Responsive

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| RESP-01 | Responsive | AC-36 | Desktop 1280×800 | Multi-column layout; `scrollWidth <= clientWidth`; screenshots captured | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-02 | Responsive | AC-36 | Tablet 820×1180 | Two-column where practical; Summary and Description keep width; no overflow | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-03 | Responsive | AC-36 | Mobile 390×844 | Fields stack; no horizontal page scrolling; buttons remain touch-sized | `e2e/lab-02/responsive.spec.ts` | Planned |
| RESP-04 | Responsive | AC-36 | Mobile list representation | My Tickets renders as cards; filters, pagination, and attachment controls stay usable | `e2e/lab-02/responsive.spec.ts` | Planned |

Screenshots are written to `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`.

### 2.6 End-to-end

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---------|------|------------------|---------------|-----------------|---------------------|-------|
| E2E-01 | E2E | AC-01, AC-07, AC-15 | Full intake journey | Select Requester → create Ticket → confirmation shows the official number → the Ticket is found in My Tickets | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-04, AC-15 | Requester switching | Requester A's tickets are listed, then vanish entirely after switching to Requester B | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-26, AC-30, AC-31, AC-32 | Attachment lifecycle | Upload → download succeeds → soft-remove with a reason → metadata remains → download is refused | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-24 | Direct-URL ownership | Navigating straight to another Requester's Ticket URL is refused and leaks no data | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-05 | E2E | AC-38 | Keyboard-only journey | Selection and Create Ticket are completable with the keyboard alone; focus is visible at every step | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

**Totals:** 6 unit · 29 API · 20 UI component · 5 UI style · 4 responsive · 5 E2E = **69 planned tests**.

---

## 3. Acceptance-Criterion Traceability

Every acceptance criterion maps to at least one planned test, and every planned
test names a real file path.

| AC | Criterion (abbreviated) | Covering tests |
|----|-------------------------|----------------|
| AC-01 | No selection → selection screen | API-02, UI-05, E2E-01 |
| AC-02 | Only active Requesters listed | API-01, UI-01 |
| AC-03 | Selection survives reload | UI-02 |
| AC-04 | Change Requester clears previous data | UI-06, E2E-02 |
| AC-05 | Requester API failure → safe error | UI-03 |
| AC-06 | No active Requesters → empty state | UI-04 |
| AC-07 | Valid submit → Ticket saved, number shown | API-04, UI-11, E2E-01 |
| AC-08 | Saved Ticket has requesterId and status NEW | API-05 |
| AC-09 | Ticket Numbers unique and correctly formatted | UNIT-01, UNIT-02, API-06 |
| AC-10 | Reference data comes from the database | API-03, UI-07 |
| AC-11 | Empty Summary → field message, no API call | UI-08 |
| AC-12 | Summary below minimum → 400 with field message | UNIT-03, API-07 |
| AC-13 | Repeat click → one Ticket only | UI-09 |
| AC-14 | Backend down → safe error, values preserved | UI-10 |
| AC-15 | Requester B never sees Requester A's Tickets | API-10, UI-12, E2E-02 |
| AC-16 | Search filters the list | API-11, UI-13 |
| AC-17 | Category filter applies | API-12 |
| AC-18 | Pagination returns the next page and metadata | API-13, UI-16 |
| AC-19 | Default sort is Ticket Date descending | API-14 |
| AC-20 | Invalid query parameters fall back to defaults | UNIT-06, API-15 |
| AC-21 | No Tickets → "no tickets yet" state | UI-14 |
| AC-22 | No matches → no-results state with Clear filters | UI-15 |
| AC-23 | Ticket Detail fields are read-only | API-17, UI-17 |
| AC-24 | Another Requester's Ticket → 404, no data | API-18, E2E-04 |
| AC-25 | Missing Ticket response identical to AC-24 | API-19 |
| AC-26 | Valid file uploads and appears active | API-20, E2E-03 |
| AC-27 | Unsupported type → 415 with reason | UNIT-04, API-21, UI-20 |
| AC-28 | Oversized file → 413 with reason | UNIT-04, API-22, UI-20 |
| AC-29 | Sixth attachment → 409 | API-23 |
| AC-30 | Active attachment downloads correctly | API-24, E2E-03 |
| AC-31 | Removal keeps metadata, badged, no download | API-25, UI-18, E2E-03 |
| AC-32 | Removed attachment download refused | API-26, E2E-03 |
| AC-33 | Removal without reason → 400 | API-27, UI-19 |
| AC-34 | Removed files free the quota | API-28 |
| AC-35 | Another Requester's attachment → 404 | API-29 |
| AC-36 | No overflow or clipping at any viewport | RESP-01, RESP-02, RESP-03, RESP-04 |
| AC-37 | Required asterisk plus validation message | STYLE-01 |
| AC-38 | Keyboard reachable, focus visible | STYLE-02, E2E-05 |
| AC-39 | Badges convey meaning beyond colour | STYLE-03 |

**Coverage: 39 of 39 acceptance criteria.**

### Additional business-rule coverage

Rules whose evidence sits outside the AC table:

| BR | Rule | Covering test |
|----|------|---------------|
| BR-16 | Client-supplied read-only fields ignored | API-09 |
| BR-38 | Filters compose with ownership | API-16 |
| BR-41 | Reference ids must exist and be active | API-08 |
| BR-50 | Stored filename resists path traversal | UNIT-05 |
| BR-09 | Seed is idempotent | Verified in §4.2 |

---

## 4. Responsive and Visual Checklist

Automated assertions cannot see clipping or overlap. This checklist is completed
by hand against `ui-spec.md` and the captured screenshots, **not from memory**.

### 4.1 Per screen, per viewport

Repeat for Create Ticket, My Tickets, and Ticket Detail at desktop, tablet, and
mobile:

- [ ] No horizontal page scrolling
- [ ] No clipped or truncated labels
- [ ] No overlapping validation messages
- [ ] No hidden or unreachable buttons
- [ ] Attachment filenames readable, not run together
- [ ] Filters, pagination, and attachment controls usable
- [ ] Editable and read-only fields visually distinct
- [ ] Validation messages sit beneath their own field
- [ ] Button hierarchy consistent (primary, secondary, destructive, disabled, busy)
- [ ] Zen Green tokens applied; no stray palette

### 4.2 Data and integrity spot checks

- [ ] `npx prisma migrate reset --force` rebuilds from scratch without error
- [ ] The seed runs twice and produces no duplicate rows (BR-09)
- [ ] `git ls-files | grep -E '\.env$'` returns nothing
- [ ] `git ls-files | grep -E 'node_modules|server/uploads'` returns nothing
- [ ] No test is skipped, `.todo`, `.skip`, or commented out

---

## 5. Test Commands

```bash
# Backend — unit and API (needs a migrated + seeded database)
cd server && npm run prisma:migrate && npm run prisma:seed && npm test

# Frontend — UI component and UI style
cd client && npm test

# Typecheck both sides
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# End-to-end and responsive (from the repository root, with both servers running)
npx playwright test
```

---

## 6. Final Results

Filled in from a clean run on `main` after the release PR merges.

| Level | Planned | Passing | Failing | Skipped |
|-------|---------|---------|---------|---------|
| Unit | 6 | — | — | — |
| API / integration | 29 | — | — | — |
| UI component | 20 | — | — | — |
| UI style | 5 | — | — | — |
| Responsive | 4 | — | — | — |
| E2E | 5 | — | — | — |
| **Total** | **69** | — | — | — |

> Paste the passing terminal output from `main` below, plus the Playwright report
> summary. Any non-zero figure in Failing or Skipped must be explained in §7.

---

## 7. Known Limitations and Deferred Tests

| Item | Status | Reason |
|------|--------|--------|
| Virus scanning of uploads | Deferred to Lab 3 | Out of Lab 2 scope; noted in `specification.md` §11 |
| In-browser attachment preview | Not implemented | Download only, per §11 open assumptions |
| Authentication, sessions, roles | Excluded | Lab 3 scope; the requester header is not a security boundary (BR-03) |
| Concurrent Ticket Number allocation under load | Not load-tested | Allocation is transactional per §7.3; verifying contention needs load tooling outside this sprint |
| Cross-browser E2E | Chromium only | Playwright is configured for one browser to keep the lab run time reasonable |
| Timezone rendering | Not tested | Timestamps are stored in UTC and rendered in the browser locale; no assertion is made about locale formatting |
