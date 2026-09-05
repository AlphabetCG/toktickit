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

- **Resolution:** awaiting @copter549365's fixes and reply.
