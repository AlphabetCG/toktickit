# Lab 2 Peer Review Record

Peer review runs **both directions** every lab (AGENTS.md §8). Each direction
needs a substantive comment and a reply — a bare Approve does not satisfy the
rubric.

- **Author:** Naphat Utabuawong (67070501015, @AlphabetCG)
- **Peer reviewer:** Nantakorn Pinsupaporn (67070501028, @copter549365)
- **Partner repo:** `copter549365/toktickit`

---

## Direction A — @copter549365 reviews @AlphabetCG

### PR #21 — feat: Zen Green UI foundation and application shell (Issue #12)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/21
- **Base:** `lab2-staging` ← **Head:** `feature/2-zen-green-foundation`
- **Review verdict:** `COMMENTED` (changes requested with reasons), 2026-09-02

#### Reviewer comment (4 points)

1. **Token → hex mapping.** Components pass the "no literal colour" rule by using
   classes only, but the review couldn't see the theme/CSS file declaring the
   real values — asked to verify the classes map to the spec hex (#006B3C,
   #0B7A46, #EAF6EF, #F5F7F6) correctly.
2. **Responsive breakpoints (992/768).** No CSS/media query visible to check
   ui-spec §8 (desktop ≥992, tablet 768–991, mobile <768).
3. **Textarea resize.** ui-spec §2 says Description is "taller and resizable only
   when it does not break the layout" — asked to verify the real resize behaviour
   in the CSS, not just `rows=6` on the element.
4. **PriorityBadge only supports RequestedPriority.** Figure 1 shows both
   Requested Priority and IT Priority badges (same LOW/MEDIUM/HIGH values) —
   asked whether the existing badge can be reused for IT Priority or a separate
   type is needed.

#### Author reply & resolution

| Point | Resolution |
|-------|-----------|
| 1 | **Fixed (test).** Added a block that reads `theme.css` and asserts the 11 spec-fixed tokens equal ui-spec §1.1 exactly, so a token typo fails the suite. `client/tests/lab-02/zen-green-style.test.tsx`. |
| 2 | **Verified + assertion.** Shell collapses at `@media (max-width: 767px)`; test now asserts the breakpoint exists. 992px multi-column is screen content (ui-spec §8), arriving in #15/#16; real-viewport no-scroll is screenshot evidence in #19. |
| 3 | **Fixed (code + test).** ui-spec §2 requires `resize: vertical` **and** a `max-height`; `theme.css` had only the first. Added `max-height: 60vh` to `.zg-field--multiline` and a test locking both properties. |
| 4 | **Non-fix (out of scope).** specification §3.2 excludes IT Staff workflow incl. IT Priority; ui-spec §5 defines no IT Priority badge. Adding one would widen scope past the contract (AGENTS.md §4 closed-world rule). Reuse already works: `PriorityBadge` takes `LOW\|MEDIUM\|HIGH`, so Lab 3 reuses it verbatim with no type split. |

Result after fixes: client **35/35** (13 new), `tsc --noEmit` clean, `npm run build` succeeds.

- **Approval:** `APPROVED` by @copter549365; PR #21 merged into `lab2-staging` (2026-09-05).

### PR #22 — feat: Lab 2 data model, migration, and seed (Issue #13)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/22
- **Base:** `lab2-staging` ← **Head:** `feature/3-data-model-seed`
- **Review verdict:** `COMMENTED` then `APPROVED`, 2026-09-05; PR merged into `lab2-staging`.

#### Reviewer comment

The `TicketNumberSequence` schema is correct (one row per year), **but** it warns
about the *implementation* to come in #15: if ticket-number allocation is written
as a non-atomic read-then-write (read current value → add 1 in app code → write
back) instead of `UPDATE … RETURNING` inside the same transaction that creates the
Ticket, two requests colliding in a short window produce a race condition and a
duplicate number (violating BR-01).

#### Author reply & resolution

Agreed. The concern is about #15 (Create Ticket), not the #13 schema, which the
reviewer confirmed is correct. The contract already mandates the safe approach —
`specification.md` §7.3 says the sequence row is "updated inside the creation
transaction … keeps allocation atomic under concurrency." Replied on the PR that
it will be fixed with the ticket-creation feature: allocation will run as an
atomic `UPDATE … RETURNING` (or an equivalent single-statement increment) inside
the same transaction that inserts the Ticket. **Carried forward as a commitment
for Issue #15** — recorded here so it is not lost when Create Ticket is built.
Reviewer approved on that basis ("fix it on the feature side").

- **Approval:** `APPROVED` by @copter549365; PR #22 merged into `lab2-staging` (2026-09-05).

### PR #23 — feat: Development Requester context (Issue #14)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/23
- **Base:** `lab2-staging` ← **Head:** `feature/4-requester-context`
- **Review verdict:** `APPROVED` by @copter549365, 2026-09-05 — "เรียบร้อยดีตาม
  Acceptance criteria" (all good against the acceptance criteria). PR merged into
  `lab2-staging`.

No changes requested. The PR called out two review-focus questions (the
identical-401 contract for all four rejection cases, and keying the scoped
subtree by requester id for BR-22); the reviewer accepted both as delivered.

### PR #24 — feat: Create Ticket end to end (Issue #15)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/24
- **Base:** `lab2-staging` ← **Head:** `feature/5-create-ticket`
- **Review verdict:** `COMMENTED` then `APPROVED`, 2026-09-05 — "แก้ไขได้โอเคครับ"
  (the fix is fine) after the D-12 reply. PR merged into `lab2-staging`.

#### Reviewer comment

Labsheet §4.4 lists Attachments as a field of the Create Ticket screen and Part 6
evidence item 4 ("select one valid and one invalid attachment") ties to it, but
the form has no attachment input. If attachments are being split to #17 (BR-48),
an assumption for the flow should be recorded in `specification.md`.

#### Author reply & resolution

Valid point — the omission was deliberate, not a gap, but it was undocumented.
Attachment upload is out of scope for #15 by the Issue decomposition, following
BR-48/D-08, which already make ticket creation and attachment upload **separate
operations** so a long Description is never lost to a failed file. Rather than
implement a create-with-files form (which would contradict that compensation
model and duplicate the upload UI), the flow is: Create Ticket saves the Ticket,
and the success panel's **View ticket** action lands on Ticket Detail, where the
whole attachment lifecycle is built in #17. FR-08 is realised as part of that
intake flow, and the Part 6 valid/invalid-attachment evidence is captured there.
Recorded as **D-12** in `specification.md` and noted in `ui-spec.md` §8.2 so the
deferral is explicit. No code change to #15.

### PR #25 — feat: My Tickets owned list (Issue #16)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/25
- **Base:** `lab2-staging` ← **Head:** `feature/6-my-tickets`
- **Review verdict:** `APPROVED` by @copter549365, 2026-09-06 — "ตรงตาม Acceptance
  criteria ที่เขียนมาครับ" (matches the acceptance criteria). PR merged into
  `lab2-staging`.

No changes requested. Review-focus questions (completeness of the query-fallback
table, and the un-windowed pager) accepted as delivered.

---

## Direction B — @AlphabetCG reviews @copter549365

Partner repo: `copter549365/toktickit`.

### PR #22 — feat: implement My Tickets screen (search/filter/sort/pagination)

- **PR:** https://github.com/copter549365/toktickit/pull/22
- **Review verdict:** `CHANGES_REQUESTED` by @AlphabetCG, 2026-09-05.

Tests were green (client 26/26, server 59/59) and most of the work was sound, but
I flagged **two data-affecting defects** to fix first:

1. **`server/tests/lab-02/my-tickets.api.test.ts:6`** — a fixture leaves randomly
   numbered tickets in the DB, so `getNextTicketNumber()` (which uses `MAX + 1`)
   is permanently skewed; a single test run on a fresh DB jumps the sequence to
   `TKT-2026-939750`, and at the ceiling it produces `TKT-2026-1000000`, which
   breaks BR-01 and the `TICKET_NUMBER_REGEX`.
2. **`client/src/screens/MyTickets.tsx:79`** — `loadTickets` has no ignore
   flag / `AbortController`, so a slow earlier response can overwrite the list
   (request page 2 then quickly page 3 → the table sticks on page 2's data).

Plus four to address this round if possible, otherwise the next PR: empty
`?categoryId=` returns an empty list (`ticketQuery.ts:55`); `%`/`_` in search act
as SQL wildcards (`app.ts:211`); pagination renders every page number and
overflows on mobile (`MyTickets.tsx:389`); keyboard focus is lost on every
refetch (`MyTickets.tsx:84`).

- **Resolution:** @copter549365 addressed the findings; PR #22 merged.

### PR #23 — feat: Requester Ticket Detail screen & attachment lifecycle

- **PR:** https://github.com/copter549365/toktickit/pull/23
- **Review verdict:** `COMMENTED` by @AlphabetCG, 2026-09-05.

The ownership handling is solid — `/api/tickets/:id`, `/api/attachments/:id`, and
download all return an identical `ATTACHMENT_NOT_FOUND`/`TICKET_NOT_FOUND` for
not-found, not-owned, and soft-removed alike, so removal cannot be probed
(AC-24/AC-25); the removed-download guard has a passing test (API-23), and
soft-remove requires a reason and returns 409 on a second removal. Two points
raised, both hardening rather than blockers:

1. **`isRemoved` and `removedAt` encode the same state in two columns.** The
   DELETE sets both, which is correct today, but two fields that must always
   agree can drift (a later code path or migration touching one), and the
   download guard keys off `isRemoved`. A single source of truth —
   `removedAt IS NULL` = active, with `isRemoved` derived at serialisation —
   cannot disagree with itself.
2. **Loose id parsing.** `parseInt(req.params.id, 10)` accepts `"7x"` as `7`, so
   `/api/attachments/7x/download` resolves to id 7 (still requester-scoped, so no
   ownership leak). A strict `^\d+$` / `Number.isInteger` check returning 404 on
   non-numeric input is tighter.

- **Resolution:** @copter549365 addressed the points; approved on re-review and
  PR #23 merged.

### PR #24 — test: Playwright E2E + responsive visual suite, and two UI fixes

- **PR:** https://github.com/copter549365/toktickit/pull/24
- **Review verdict:** `CHANGES_REQUESTED` by @AlphabetCG, 2026-09-06.

Ran the whole suite against real PostgreSQL + dev servers: Playwright **14/14**
(E2E-01…05, RESP-01…03, all viewports), client **33/33**, server **70/71**. The
E2E coverage, the 42 captured screenshots, and the two real defects fixed by the
visual review (no keyboard focus indicator on `.btn-zg-*`; filenames crushed to
one character at narrow widths) are all sound. One blocker for a release-prep PR
heading to `main`:

- **API-08b in `my-tickets.api.test.ts:136` is red.** The DoD (`specification.md`
  §10) requires all tests to pass on `main` with none skipped, and Part 3
  evidence attaches a run from `main`. The failure comes from a search fixture
  `"…100% CPU spike_"` where `%`/`_` act as SQL-LIKE wildcards — the same
  wildcard-escaping issue raised on PR #22. Fix (escape the term or adjust the
  fixture) before merge rather than flag it in `tests.md`.

Non-blocking: `playwright.config.ts` `reuseExistingServer: true` should be
`!process.env.CI`; and the E2E specs create real tickets without cleanup, which
accumulates in the dev DB across runs.

- **Resolution:** awaiting @copter549365's fix of API-08b, then approval.

> Note: a duplicate `CHANGES_REQUESTED` was posted from this account at 08:27
> (raising the same API-08b blocker) before the 05:56 review was noticed. The
> 05:56 review above is the authoritative one.
