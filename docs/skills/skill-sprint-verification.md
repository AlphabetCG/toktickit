# Skill: Sprint Verification (QA & Review)

## Purpose & Scope

Run this playbook **before opening a pull request** and again before a release PR
from `labN-staging` into `main`. It is the gate that turns "I implemented it"
into "here is the evidence".

Use it when:

- an Issue's implementation is believed complete;
- reviewing your peer partner's pull request;
- auditing the sprint before submission.

The single guiding rule: **evaluate completion using traceable evidence, never an
agent's claim that the work is done.**

---

## Inputs

- `docs/lab-0N/specification.md` — acceptance criteria and Definition of Done
- `docs/lab-0N/tests.md` — the planned tests and their AC mapping
- `docs/lab-0N/ui-spec.md` — the visual and responsive contract
- `docs/lab-0N/api-spec.md` — the endpoint contract
- The diff under review

---

## 1. Contract Conformance

- [ ] Every acceptance criterion the Issue claims is listed, and each one names
      the test that proves it.
- [ ] No acceptance criterion is claimed without a test.
- [ ] No scope was added that the contract's Excluded section forbids.
- [ ] Where implementation and contract disagree, the contract was corrected
      deliberately — not silently bent to match the code.
- [ ] Field names, types, endpoint paths, and status codes match the contract
      **exactly**. A route that returns 200 where the contract says 201 is a defect.

## 2. Test Evidence

- [ ] `cd server && npm test` — all green.
- [ ] `cd client && npm test` — all green.
- [ ] `npx playwright test` — all green (from Lab 2 onward).
- [ ] `npx tsc --noEmit` clean in both `client/` and `server/`.
- [ ] **No test is skipped, disabled, `.todo`, `.skip`, or commented out.**
      Search the diff for `it.todo`, `describe.todo`, `.skip`, and `xit`.
- [ ] Each test asserts the behaviour its name claims. A test named "rejects
      oversized uploads" that only checks `status !== 200` is not evidence.
- [ ] Unhappy paths are covered, not just happy ones: invalid input, boundary
      values, ownership failure, missing resources, and server errors.
- [ ] Tests fail when the behaviour is removed. If unsure, break the code
      deliberately and confirm red.
- [ ] Test file paths in `tests.md` match the files that actually exist.

## 3. Data Layer

- [ ] `npx prisma migrate reset --force` rebuilds from scratch without error.
- [ ] The seed runs twice with no duplicate rows (idempotency).
- [ ] The generated `migration.sql` was read and drops nothing unintended.
- [ ] No applied migration was edited in place.
- [ ] Every foreign key is a declared relation.
- [ ] Soft removal uses a nullable timestamp, and removed rows are excluded from
      active queries and counts.
- [ ] Indexes present match those the specification justifies.

## 4. Security & Ownership

- [ ] Ownership is enforced **in the backend on every scoped route**, not by
      hiding controls in the UI.
- [ ] A test bypasses the UI entirely — calling the API directly as the wrong
      user — and proves access is refused.
- [ ] The refusal response does not reveal whether the resource exists, when the
      contract requires that.
- [ ] No error body contains a stack trace, SQL fragment, or filesystem path.
- [ ] Uploaded filenames are never used as path segments; stored names are
      server-generated.
- [ ] File type is validated by detected MIME type, not extension alone.
- [ ] `git ls-files | grep -E '\.env$'` returns nothing.
- [ ] `git ls-files | grep node_modules` returns nothing.
- [ ] No credential, token, or password appears in a tracked file.

## 5. UI Style Compliance

Compare against `ui-spec.md` and the approved illustrations — **not personal
memory**.

- [ ] Theme tokens are used as CSS variables; no hardcoded hex values in
      components.
- [ ] No raw Bootstrap colour utility stands in for a defined token.
- [ ] Editable and read-only fields are visually distinct.
- [ ] Required fields show the red asterisk, and the asterisk does not replace
      the validation message.
- [ ] Validation messages sit beneath their own field, not in a single top banner.
- [ ] Inputs share one height; multiline fields resize without breaking layout.
- [ ] Buttons carry visible text; icons support text but never replace it.
- [ ] Every icon-only control has an accessible label and a tooltip.
- [ ] Disabled controls are visually distinct and cannot be activated.
- [ ] Focus indicators remain visible for keyboard navigation.
- [ ] The submit control shows a busy state and is disabled while in flight.
- [ ] Badges convey meaning through text as well as colour.
- [ ] Button hierarchy (primary, secondary, destructive, disabled, busy) is
      consistent across screens.

## 6. Screen States

Every screen that fetches or submits data must render **all** of these. Check
each one by hand:

- [ ] Idle / initial
- [ ] Loading
- [ ] Success
- [ ] Validation failure — with values preserved
- [ ] Empty (no data yet)
- [ ] No results (filters matched nothing) — distinct from empty
- [ ] API failure — safe message, values preserved, retry available

## 7. Responsive Verification

Capture screenshots at all three viewports into
`artifacts/lab-0N/screenshots/<screen>/`:

- [ ] Desktop ≥ 992 px — multi-column, centred, sensible maximum width
- [ ] Tablet 768–991 px — two columns where practical
- [ ] Mobile < 768 px — stacked fields, touch-friendly buttons

At every size confirm:

- [ ] **No horizontal page scrolling.**
- [ ] No clipped labels.
- [ ] No overlapping messages.
- [ ] No hidden or unreachable buttons.
- [ ] Attachment and file names remain readable.
- [ ] Filters, pagination, and action controls stay usable.
- [ ] Desktop table and mobile card representations both work.

## 8. Git & Workflow Hygiene

- [ ] Work is on a feature branch, not on `main` or a staging branch.
- [ ] The PR base is the staging branch, not `main`.
- [ ] `Closes #N` cites the correct GitHub Issue number (`gh issue list` first —
      numbers drift because PRs share the counter).
- [ ] The diff contains no `node_modules`, no stray root lockfile, no `.env`,
      no upload directory, no build output.
- [ ] The diff contains no debugging leftovers: `console.log`, commented-out
      blocks, `TODO` markers for work this Issue claims to have finished.
- [ ] Commit messages describe behaviour, not files touched.
- [ ] The Kanban card is in the right column.

## 9. Documentation Currency

- [ ] `tests.md` reflects the tests that exist, with real paths and pass status.
- [ ] `ai-use.md` includes the prompts that produced this work.
- [ ] `reviewer.md` records PR links, comments given and received, and responses.
- [ ] `README.md` setup and test commands were followed on a clean checkout and
      actually work.
- [ ] `specification.md` still matches what was built.

---

## Peer Review Checklist

When reviewing the partner's PR, produce **substantive** comments tied to the
contract. A bare Approve does not satisfy the rubric and earns no marks.

Work through, in order:

1. **Does the PR state which acceptance criteria it closes?** If not, ask.
2. **Pull the branch and run it.** `gh pr checkout <n>`, install, migrate, seed,
   run both suites. Do not review from the diff alone.
3. **Check the contract, not your taste.** Cite `BR-xx` / `AC-xx` in comments so
   the discussion stays objective.
4. **Try to break ownership.** Call the API directly as the wrong user.
5. **Check the unhappy paths by hand** — the empty state, the failure state, the
   boundary value.
6. **Look at the diff for hygiene** — leaked files, skipped tests, hardcoded
   colours, debug output.

Approve only when the evidence holds. Request changes when an acceptance
criterion is unproven — that is the normal, useful outcome, and it produces the
Fixing → PR Review → Done trail the rubric wants to see.

---

## Release Gate (`labN-staging` → `main`)

Before the release PR:

- [ ] Every Issue for the sprint is merged into staging and sits in **Done**.
- [ ] The full suite passes **on the staging branch**, not just per feature.
- [ ] Screenshot evidence is complete for every screen at every viewport.
- [ ] Every Definition of Done item in `specification.md` §10 is ticked.
- [ ] Peer review evidence exists in **both directions** with comments and
      replies, recorded in `reviewer.md`.
- [ ] Both contract and evidence documents are committed and current.

---

## Reporting Format

When reporting verification results, state plainly:

- which acceptance criteria are **proven**, and by which test;
- which are **claimed but unproven**;
- which checks **failed**, with the actual output;
- which checks were **not run**, and why.

Never summarise a failing or partial run as success. An honest "18 of 22 criteria
proven, 3 untested, 1 failing" is worth more than an unverified "done".
