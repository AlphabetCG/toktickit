# Lab 4 Peer Review Record

**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)
**Reviewer:** Nantakorn Pinsupaporn (67070501028, @copter549365)
**Partner repository:** [copter549365/toktickit](https://github.com/copter549365/toktickit)

Review runs in both directions. Each entry records the PR link, the reviewer's
substantive comment, the author's reply, and the approval.

---

## Direction A — @copter549365 reviews @AlphabetCG

### PR #55 — docs: Lab 4 sprint engineering contract (Issue #47 / Lab 4 Issue 1)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/55
- **Base:** `lab4-staging` ← **Head:** `feature/1-sprint4-specification`
- **Review verdict:** `APPROVED` by @copter549365, 2026-10-13 — "โอเคครับ" (OK).
  PR merged into `lab4-staging` the same day.

No inline comments and no changes requested. The approval carries no
substantive point, so on its own this entry is a bare Approve, which does not
meet the rubric's "substantive comment and reply". Later Lab 4 PRs therefore
name specific review-focus points in their description, to invite a review that
can be answered.

### PR #56 — feat: Lab 4 data model, additive migration, rollback, and seed (Issue #48 / Lab 4 Issue 2)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/56
- **Base:** `lab4-staging` ← **Head:** `feature/2-lab4-data-model`
- **Review verdict:** `APPROVED` by @copter549365 — "ทำได้ดีครับ" (well done).
- **Timing:** the PR merged on 2026-10-24 at 21:02:35 UTC and the approval was
  submitted at 21:02:46 UTC, **11 seconds after the merge**. The approval is
  real, but it was not a review gate before the merge.

No inline comments. The PR asked three review-focus questions: REG-02 scoped to
pre-migration Tickets, `LAB4_USERS` kept apart from `USERS`, and seeded history
written only when a Ticket has none. None of them received an answer, so this
entry is again an approval without a substantive comment.

### PR #57 — feat: Actions Taken API and authorization (Issue #49 / Lab 4 Issue 3)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/57
- **Base:** `lab4-staging` ← **Head:** `feature/3-actions-taken-api`
- **Review verdict:** `APPROVED` by @copter549365 at 21:12:43 UTC on 2026-10-28,
  "ok สมบูรณ์ดีครับ" (ok, it's complete). Merged 16 seconds later, at 21:12:59 UTC.
  Unlike PR #56, the approval came *before* the merge.

No inline comments. The PR asked three review-focus questions: the PATCH error
order (format, then stale, then merged rules), `ticketInactive` ahead of field
errors on create, and a `clientRequestId` replay returning the original action
even after the Ticket has become inactive. None was answered.

### PR #58 — feat: Actions Taken UI on Ticket Detail (Issue #50 / Lab 4 Issue 4)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/58
- **Base:** `lab4-staging` ← **Head:** `feature/4-actions-taken-ui`
- **Review verdict:** `APPROVED` by @copter549365 at 14:03:12 UTC on 2026-10-29,
  "เรียบร้อยดีครับ" (all good). Merged 8 seconds later, at 14:03:20 UTC.

No inline comments. The PR asked three review-focus questions: treating a
missing actions response as an empty list so the Lab 3 tests run unchanged, the
mobile ⋯ menu as always-visible buttons inside `role="menu"`, and decision D-18
(pill-shaped Ticket status badges). None was answered, so D-18 stands as my
own decision with no peer comment.

### PR #59 — feat: ticket workflow - resolution gate, stale updates, status history (Issue #51 / Lab 4 Issue 5)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/59
- **Base:** `lab4-staging` ← **Head:** `feature/5-ticket-workflow`
- **Review verdict:** `COMMENTED` by @copter549365, 2026-10-29 19:17 UTC — a
  **substantive review**, the first of Lab 4. There was no formal `APPROVED`; after
  my reply, copter answered "โอเคครับ" (OK) at 19:23:37 UTC and the PR merged at
  19:23:41 UTC.

**Reviewer's comment (summary).** Asked for confirmation before merge: they read
the `finally` block of `applyStatus` in `StaffTicketDetail.tsx` as still calling
`setNextStatus("")` unconditionally. That would override the `catch` branch's
decision to keep the chosen target after a stale conflict, and contradict UI-18's
assertion `expect(statusSelect()).toHaveValue("WAITING_FOR_REQUESTER")`. They asked
(1) whether UI-18 passes when run on its own, and (2) if so, where the real code
differs from the diff. Proposed fix if it was a bug: remove the line from
`finally` and let `catch` decide alone.

**Author's reply** ([comment](https://github.com/AlphabetCG/toktickit/pull/59#issuecomment-6506226957)):
the reasoning was correct, but the line is not in the PR's code. In the diff,
`setNextStatus("")` inside `finally` is a **removed** line, Lab 3's original. On
the branch (`b22eb31`), `finally` holds only `setBusy(false)`, which is exactly the
fix the reviewer proposed. Evidence: UI-18 run on its own passes. Putting the line
back into `finally` makes UI-18 fail (expected `WAITING_FOR_REQUESTER`, received
empty), so the test guards against exactly this regression; the file was restored
byte-identical afterwards.

**Outcome:** no change needed. The reviewer read a removed diff line as current
code; the check confirmed both the behaviour and the test that protects it.

### PR #60 — feat: IT Staff and Administrator dashboard, drill-down, Dashboard navigation (Issue #52 / Lab 4 Issue 6)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/60
- **Base:** `lab4-staging` ← **Head:** `feature/6-staff-dashboard`
- **Review verdict:** `CHANGES_REQUESTED` by @copter549365, 2026-10-29 20:08 UTC,
  a **substantive review**. After the fix and my reply, copter answered
  "แก้มาได้ตรงจุดครับ" (fixed right on the spot) at 17:40:32 UTC on 2026-10-31,
  and the PR merged at 17:40:36 UTC. The review was never changed to `APPROVED`,
  so GitHub still shows the PR as changes requested.

**Reviewer's comment (summary).** Five points that matched the contract: a
`href: null` metric renders as a static `<div>` rather than a fake link (§6.2);
the URL is the filter state for the Queue and User Management, so a drill-down
link opens filtered with no unfiltered first request, and Back restores the
previous filter (UI-37…39); the "Filtered from Dashboard" note explains a short
list; no new colour token (only `--zg-fs-metric`); and the Administrator's new
Ticket Queue link is tied to BR-63 and D-04. **The requested change:** three
`eslint-disable-next-line react-hooks/exhaustive-deps` lines in
`StaffTicketQueue.tsx`. The reviewer found no staleness bug, but warned that
disabling the rule three times in one file makes dependencies hard to check, and
suggested a custom hook.

**Author's reply** ([comment](https://github.com/AlphabetCG/toktickit/pull/60#issuecomment-6546869563)):
the point was right, and tracing it found a **real** staleness bug. The search
debounce's deps were only `[searchText]`, so its timer called an `update` that
still held the query from when typing started. A filter chosen within 300 ms of
typing was overwritten when the search reached the URL. `UserManagement.tsx` had
the same incomplete dependency list, with no disable comment to flag it. Two new
UI-39 cases (type, then pick a filter at once) failed for exactly that reason:
the URL was `?search=vpn` with `itPriority=LOW` gone. Fix in `c95acf2`: `query` is
memoised from the URL string, `update` and `setParam` are `useCallback`s rebuilt
when the URL changes, and every effect lists its real dependencies. All three
disables were removed; the custom hook was not needed once the dependencies were
honest. Client 200/200, `tsc` clean.

**Outcome:** fixed. The review caught a real defect that the tests had not
covered, and the two new UI-39 cases now guard it.

### PR #61 — feat: Requester dashboard, My Tickets drill-down, Dashboard landing for every role (Issue #53 / Lab 4 Issue 7)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/61
- **Base:** `lab4-staging` ← **Head:** `feature/7-requester-dashboard`
- **Review verdict:** `CHANGES_REQUESTED` by @copter549365, 2026-10-31 18:48 UTC,
  a **substantive review**. After my reply, copter answered "โอเคครับ" (OK) at
  18:58:14 UTC and the PR merged at 18:58:18 UTC. As with PR #60, the review was
  never changed to `APPROVED`.

**Reviewer's comment (summary).** A suspected CSS cascade bug. In the diff they
read, both `.zg-metrics--three` overrides (tablet: three columns; mobile: one
column) appeared inside the same `@media (max-width: 991px)` block. If that were
the real structure, the later one-column rule would win across 768–991 px as
well, because both have the same specificity, and the comment "the Requester's
three cards still fit across at 768 px" would be false. They suspected that the
pasted diff had lost a closing `}` and an opening `@media (max-width: 767px) {`,
as earlier diffs in the series had been truncated. They asked me to confirm in
the real file, and, if it was a bug, to fix it and re-shoot the tablet screenshot.

**Author's reply** ([comment](https://github.com/AlphabetCG/toktickit/pull/61#issuecomment-6547715701)):
confirmed from `client/src/theme.css` that the three-column tablet rule is in
`@media (max-width: 991px)` (lines 1760–1773) and the one-column mobile rule is
in a separate, sibling `@media (max-width: 767px)` block (line 1776), not nested
in the first. The copied diff had lost the closing brace and the second media
query. Measured in Chromium: three columns at 768–991 px, one column at ≤ 767 px.
A tablet screenshot of the Requester dashboard was attached.

**Outcome:** no change needed. As with PR #59, the reviewer's reasoning was
correct for the text they saw, and the real file and a measurement showed the
intended structure. RESP-02 in Issue #54 now checks the tablet layout
automatically.

## Direction B — @AlphabetCG reviews @copter549365

Twelve Lab 4 PRs in [copter549365/toktickit](https://github.com/copter549365/toktickit),
all reviewed by @AlphabetCG and all merged. Two received a substantive
`CHANGES_REQUESTED` review that was checked against a running build; both led to
a fix commit, and the approval followed it. The other ten were approved with a
one-line comment, listed at the end so the record does not overstate them.

### PR #66 — Issue 2: Database Increment — Actions Taken Model, Concurrency, Migration & Seed

- **PR:** https://github.com/copter549365/toktickit/pull/66
- **Base:** `lab4-staging` ← **Head:** `feat/issue-2-actions-taken-db`
- **Review verdict:** `CHANGES_REQUESTED` by @AlphabetCG, 2026-10-29 18:28 UTC;
  `APPROVED` at 18:41:23 UTC ("ครบถ้วนสมบูรณ์แล้วครับ", complete now) after the
  fix. Merged at 18:41:30 UTC.

**Reviewer's comment (summary).** Verified first: the migration applies, the seed
run twice leaves the row counts unchanged, server 192/192, client 87/87, Lab 3
E2E 41/41, and every §7.6 seed requirement checked with SQL. **Required change:**
the documented rollback did not work. After `rollback.sql`, the documented
`prisma migrate resolve --rolled-back` fails with **P3012** ("cannot be rolled
back because it is not in a failed state"), so the Lab 4 row stays in
`_prisma_migrations`: `migrate status` reports up to date while `ActionTaken` is
gone, and `migrate deploy` never recreates it. MIG-L4-02 still passed because it
ran the SQL directly instead of going through Prisma. Proposed fix, tried
locally: delete the migration's row from `_prisma_migrations` inside
`rollback.sql`, drop `migrate resolve` from the docs, and make MIG-L4-02 assert
on `_prisma_migrations`. **Non-blocking:** D-11's switch from `Restrict` to
`Cascade` trades away the database-level protection §7.2 gave as its reason
(a cleanup helper could delete actions and history first instead); and
TKT-2026-000005/000006 (Resolved/Closed) still had
`requesterResolvedIndicator = true`, contrary to BR-15.

**Author's response** (commit [`0379f91`](https://github.com/copter549365/toktickit/commit/0379f91),
"fix(db): make Lab 4 rollback work through Prisma; clear BR-15 flag (PR #66
review)"): `rollback.sql` now deletes the migration's `_prisma_migrations` row
and `migrate resolve` was removed from the docs; MIG-L4-01/02 baseline a scratch
database, go through `prisma migrate deploy`, and assert on
`_prisma_migrations`; the migration clears the BR-15 flag and the seed no longer
sets it; D-11 now records the Cascade/Restrict trade-off. No reply comment was
posted; the commit message answers each point.

**Outcome:** fixed, including both non-blocking points.

### PR #69 — Issue 5: Ticket workflow, resolution gate, status history & optimistic concurrency

- **PR:** https://github.com/copter549365/toktickit/pull/69
- **Base:** `lab4-staging` ← **Head:** `feat/issue-5-ticket-workflow`
- **Review verdict:** `CHANGES_REQUESTED` by @AlphabetCG, 2026-10-30 11:12 UTC;
  `APPROVED` at 15:38:14 UTC on 2026-10-31 ("ถูกต้องและครบถ้วนสมบูรณ์ครับ",
  correct and complete) after the fix. Merged at 15:38:34 UTC.

**Reviewer's comment (summary).** Pulled `e2c69ec` and ran it on a fresh
database: server 339/339 twice, client 115/115 three times, Lab 3 + Lab 4 E2E
51/51. The PR's own 338/339 came from residue in its dev database. Real API calls
confirmed the core: resolving an unowned Ticket with no completed action returns
409 `RESOLUTION_GATE_NOT_MET` listing `HAS_OWNER` and `HAS_COMPLETED_ACTION`; a
Requester calling the staff status endpoint gets 403; status history has no write
route (POST/DELETE 404); and a Requester can read their own Ticket's history.
Credited D-15, which locks the Ticket row on every action write so no open
action can survive on a resolved Ticket. **Two requested changes:**

1. *A Requester cancelling a Ticket was recorded as changing an Action Taken.*
   With a staff-created Planned action on a New Ticket, the Requester's cancel
   left the action `CANCELLED` / "Ticket cancelled" with `last_updated_by` the
   Requester (role `REQUESTER`), against handout §4.3 ("never creates or changes
   them") and the intent of AC-08. The cause was
   `cancelOpenActions(tx, ticketId, authUser.id)` in `/api/tickets/:id/cancel`.
   Suggested fix: refuse a Requester's cancel with 409 while an open action
   exists, since staff have already started work.
2. *The Requester's writes did not send `expectedVersion`*, against D-03 ("the
   Lab 4 client always sends it"). Reproduced: the Requester opens the Ticket at
   version 1, staff claim it (version 2, still New), and the Requester's cancel
   from the stale page succeeds with 200. Sending `expectedVersion: 1` makes the
   server answer 409 correctly, so only `cancelTicket()` and
   `markProblemAppearsResolved()` in `client/src/api/tickets.ts` needed to send
   `ticket.version`.

**Author's response** (commit [`1a8168a`](https://github.com/copter549365/toktickit/commit/1a8168a),
"fix(workflow): Requester never changes Actions Taken; Requester writes send
expectedVersion (PR #69 review)"): a Requester's cancel now returns 409
`TICKET_HAS_OPEN_ACTIONS` while a Planned or In Progress action exists, and
nothing changes; staff cancels still auto-cancel. The Requester detail drops
*Cancelled* from its options in that case. Both Requester writes send the
version on screen, and a 409 explains and reloads. Recorded as spec D-16, with
the api-spec error table and API-L4-18 updated and new client and server tests.
No reply comment was posted; the commit message answers both points.

**Outcome:** fixed, as suggested.

### The other ten PRs — approved with a one-line comment

These approvals carry no substantive point, so on their own they do not meet the
rubric's "substantive comment and reply"; they are recorded for completeness.

| PR | Title | Approved (UTC) | Comment |
|----|-------|----------------|---------|
| [#65](https://github.com/copter549365/toktickit/pull/65) | Issue 1: Sprint 4 Engineering Contract & Specifications | 2026-10-29 15:55 | "ครบถ้วนสำหรับ Issue นี้ดีครับ ไม่มีปัญหาครับ" (complete for this Issue, no problems) |
| [#67](https://github.com/copter549365/toktickit/pull/67) | Issue 3: Actions Taken API & Authorization | 2026-10-29 19:27 | "ไม่มีปัญหา สามารถ merge ได้เลยครับ" (no problems, ready to merge) |
| [#68](https://github.com/copter549365/toktickit/pull/68) | Issue 4: Actions Taken UI | 2026-10-29 20:03 | "ครบถ้วนครับ" (complete) |
| [#70](https://github.com/copter549365/toktickit/pull/70) | Issue 6: Requester Dashboard | 2026-10-31 16:50 | "Test ผ่านไม่มีปัญหา สามารถ Merge ได้เลยครับ" (tests pass, ready to merge) |
| [#71](https://github.com/copter549365/toktickit/pull/71) | Issue 7: IT Staff & Administrator Dashboard | 2026-10-31 18:16 | "ตรงตาม spec และพร้อมสำหรับการ merge" (matches the spec, ready to merge) |
| [#72](https://github.com/copter549365/toktickit/pull/72) | Issue 8: Final Hardening, Regression & Accessibility | 2026-10-31 18:56 | "โค้ดดีและพร้อม merge ไม่เจอบั๊กที่ต้องแก้ก่อน merge" (good code, no bug to fix before merge) |
| [#73](https://github.com/copter549365/toktickit/pull/73) | Issue 9: E2E Suite, Screenshots & Release Integration | 2026-10-31 19:20 | "สามารถ merge ได้เลยครับ" (ready to merge) |
| [#74](https://github.com/copter549365/toktickit/pull/74) | docs: key prompts, reflection, reviewers | 2026-10-31 19:40 | "ไม่มีปัญหาครับ" (no problems) |
| [#75](https://github.com/copter549365/toktickit/pull/75) | docs: record PR #74 and the release PR | 2026-10-31 19:48 | "พร้อมสำหรับการ merge ครับ" (ready to merge) |
| [#76](https://github.com/copter549365/toktickit/pull/76) | **Release Lab 4** (`lab4-staging` → `main`) | 2026-10-31 19:51 | "พร้อมสำหรับการ merge เข้า main ครับ" (ready to merge into main) |

---

## Summary

| Direction | PRs | Substantive review + reply | Fixed as a result |
|-----------|-----|----------------------------|-------------------|
| A — @copter549365 reviews @AlphabetCG | #55…#62 | #59, #60, #61 | #60 (a real stale-closure bug); #59 and #61 needed no change, shown from the real code and a measurement |
| B — @AlphabetCG reviews @copter549365 | #65…#76 | #66, #69 | #66 (Prisma rollback, BR-15 flag); #69 (Requester changing actions, missing `expectedVersion`) |

PR #62 (Issue #54) is open at the time of writing; its review is added when it
arrives.
