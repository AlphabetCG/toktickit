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

## Direction B — @AlphabetCG reviews @copter549365
