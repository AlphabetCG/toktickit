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

- **Approval:** _pending re-review_

---

## Direction B — @AlphabetCG reviews @copter549365

_To be completed: review a PR on `copter549365/toktickit`, leave a substantive
comment tied to an acceptance criterion, and record the exchange and approval
here._
