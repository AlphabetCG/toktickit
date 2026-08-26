# Skill: Sprint Implementation (Builder Agent)

## Purpose & Scope

Use this playbook when implementing **one bounded Issue** from a sprint
engineering contract that already exists in `docs/lab-0N/`.

The goal is repeatability: once an agent has built one vertical slice of
TokTickIT, it should build the next one with the same file locations, naming,
validation placement, ownership enforcement, error semantics, and verification
gates.

This skill covers full feature increments. For checking finished work, hand off
to [`skill-sprint-verification.md`](./skill-sprint-verification.md).

---

## Required Inputs

Before writing any code, confirm the sprint contract exists and is complete:

- `docs/lab-0N/specification.md` — scope, FR, BR, data model, acceptance criteria
- `docs/lab-0N/api-spec.md` — endpoint contract
- `docs/lab-0N/ui-spec.md` — visual and responsive contract
- `docs/lab-0N/tests.md` — planned tests and AC traceability

The contract must supply, for the Issue at hand:

- which numbered FR, BR, and AC the Issue satisfies;
- the models, fields, relationships, and indexes it touches;
- the endpoints, request/response shapes, and status codes;
- the screens, states, and components;
- the planned tests and their intended file paths.

**If the contract is silent on something you need, STOP and ask.** Never invent
a business rule, a field name, a status code, or a validation limit. This is the
closed-world rule from `AGENTS.md` §4 and it is not negotiable.

---

## Required Reading Order

Load only what the pass needs:

1. `AGENTS.md`
2. `docs/lab-0N/specification.md` — the sections covering this Issue
3. `docs/lab-0N/api-spec.md` — if the Issue touches the API
4. `docs/lab-0N/ui-spec.md` — if the Issue touches a screen
5. `docs/lab-0N/tests.md` — the planned tests for this Issue
6. [`skill-sprint-verification.md`](./skill-sprint-verification.md) — before claiming done

---

## Baseline Code to Inspect

Always read the closest existing implementation before scaffolding. TokTickIT is
small enough that the existing slice *is* the pattern:

| Concern | Read first |
|---------|-----------|
| Route shape, CORS, middleware | `server/src/app.ts` |
| Database handle | `server/src/prisma.ts` |
| Models, migrations | `server/prisma/schema.prisma`, `server/prisma/migrations/` |
| Idempotent seeding | `server/prisma/seed.ts` |
| API test pattern | `server/tests/lab-01/health.test.ts`, `categories.test.ts` |
| Frontend API client | `client/src/api.ts` |
| Screen + state pattern | `client/src/App.tsx` |
| UI test pattern | `client/tests/lab-01/App.test.tsx` |

---

## Build Order

Follow this order. Do not jump to the UI before the data and API contract are
settled — a screen built against a guessed response shape gets rewritten.

### 1. Turn the Issue into a work map

Before editing code, write yourself a short map:

- Which FR / BR / AC this Issue satisfies.
- Every file to be created or edited, by path.
- Models and fields touched; whether a migration is required.
- Endpoints added or changed, with method, path, and status codes.
- Screens and components; which states each must render.
- Test files to add, and which AC each one covers.

**Stop condition:** you can name every file you will touch, and every acceptance
criterion this Issue closes.

### 2. Create the branch

```bash
git checkout labN-staging && git pull
git checkout -b feature/<n>-<slug>
```

Confirm the previous Issue has already merged into staging. Branching from a
staging branch that lacks the foundation produces an empty tree.

### 3. Write the failing tests first

Implement the tests this Issue's contract row in `tests.md` names — **before** the
behaviour. Run them and confirm they fail *for the expected reason* (a missing
route, not a typo in the import).

```bash
cd server && npm test    # or: cd client && npm test
```

Record the red state. TDD is graded; a test written after the code is not TDD.

### 4. Data layer

If the Issue changes the schema:

- Edit `server/prisma/schema.prisma` to match `specification.md` §7 exactly —
  field names, types, nullability, unique constraints, indexes, enums.
- Generate the migration: `npx prisma migrate dev --name <descriptive_name>`.
- **Read the generated `migration.sql`.** Confirm it creates what you intended
  and drops nothing unexpected.
- Extend `seed.ts` using `upsert` on the natural key so it stays idempotent.
- Run the seed twice and confirm no duplicates appear.

Rules:

- Every foreign key is declared as a relation, never a bare integer.
- Soft removal is a nullable timestamp, never a boolean or a status string.
- Add the indexes the contract justifies; do not add speculative ones.
- Never edit an applied migration. Add a new one.

**Verification before moving on:** `npx prisma migrate reset --force` rebuilds
the database from scratch and the seed still produces exactly the expected rows.

### 5. API layer

- Add routes to `server/src/app.ts` matching `api-spec.md` exactly: path,
  method, request shape, response shape, status codes.
- Validate on the server regardless of what the client validates. The client is
  a convenience; the server is the authority.
- **Enforce ownership on every request that touches a user-owned resource.**
  Resolve the requester from the documented header, then scope the query by it.
  Never trust an id in the body or path to imply permission.
- Return the documented status for each failure case. Do not collapse 400, 404,
  409, 413, and 415 into a generic 500.
- Error bodies never carry stack traces, SQL, or filesystem paths.
- Read from the database inside the route via `getPrisma()`; never at module
  import time.

**Verification before moving on:** the API tests from step 3 pass, and every
error branch has a test — not just the happy path.

### 6. Frontend API client

- Add functions to `client/src/api.ts`. Keep every `fetch` in this file so tests
  can mock one module.
- Send the requester context header on every scoped request.
- Throw on a non-ok response so screens render one coherent error state.
- Return typed data; export the interfaces the screens consume.

### 7. Screens and components

- Build against `ui-spec.md`, not from memory or from a screenshot.
- Use the theme tokens as CSS variables. **Never hardcode a hex value** in a
  component and never use a raw Bootstrap colour utility where a token exists.
- Implement **every** state the contract names: idle, loading, success,
  validation failure, empty, no-results, and API failure. A screen missing its
  empty state is not done.
- Validation messages render beneath their field. A single banner at the top is
  not acceptable.
- Preserve entered values when submission fails.
- Disable the submit control and show a busy state while a request is in flight.
- Required fields show the red asterisk *and* still produce a message on failure.
- Every icon-only control gets an accessible label and a tooltip.
- Keep focus indicators visible; do not remove outlines.

**Verification before moving on:** the UI tests pass, and you have rendered the
screen at desktop, tablet, and mobile widths without horizontal page scrolling.

### 8. Documentation handoff

Update, in the same PR:

- `docs/lab-0N/tests.md` — mark the implemented tests and their real file paths.
- `docs/lab-0N/specification.md` — only if implementation revealed a genuine gap;
  changing the contract to match the code is otherwise backwards.
- `docs/lab-0N/ai-use.md` — add the prompts that produced this Issue.
- `README.md` — if setup or commands changed.

### 9. Hand off to verification

Run [`skill-sprint-verification.md`](./skill-sprint-verification.md) in full
before opening the PR.

### 10. Open the PR

```bash
gh pr create --base labN-staging --title "<type>: <summary>" \
  --body "Closes #<github-issue-number>" --reviewer <partner-username>
```

- Check `gh issue list` first — GitHub Issue numbers drift from lab Issue
  numbers because PRs share the counter.
- The base is the staging branch. GitHub defaults to `main`; change it.
- State in the PR body which acceptance criteria this Issue closes and which
  tests prove them.
- Move the Kanban card to **PR Review**.

---

## Completion Definition

An Issue is not complete until:

- every acceptance criterion it claims is satisfied and covered by a passing test;
- no test is skipped, disabled, `.todo`, or commented out;
- the schema, endpoints, and screens match the contract rather than the reverse;
- ownership is enforced server-side and proven by a test that bypasses the UI;
- every documented state renders, including the unhappy ones;
- the responsive layout holds at all three viewports;
- the contract documents and README are current;
- `.env`, `node_modules/`, and upload directories are untracked.

**Never report "done" with failing, missing, or unrelated tests.** Report what
passed, what is missing, and why.
