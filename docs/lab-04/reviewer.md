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

## Direction B — @AlphabetCG reviews @copter549365
