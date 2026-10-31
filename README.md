# TokTickIT

Project TokTickIT for Software Engineering, KMUTT. Built across four individual
sprints (Labs 1–4): the foundation and health check (Lab 1), Requester ticketing
with the Zen Green UI (Lab 2), users, roles, and IT Staff ticketing (Lab 3), and
Actions Taken, the resolution workflow, and role dashboards (Lab 4).

A full-stack IT service desk: React + TypeScript + Vite + Bootstrap on the front,
Express + TypeScript on the back, Prisma + PostgreSQL underneath, tested with
Vitest + Supertest + Playwright.

Process, lifecycle, and conventions live in [`AGENTS.md`](./AGENTS.md); each
sprint's engineering contract lives under `docs/lab-0N/`.

## Structure

```
client/src           App.tsx, api.ts, format.ts, main.tsx, components/, screens/, theme.css
client/tests         lab-01/ … lab-04/ — Vitest UI + style tests
server/src           app.ts, index.ts, prisma.ts, and the pure rule modules
server/prisma        schema.prisma, seed.ts, migrations/, rollback/lab4_down.sql
server/tests         lab-01/ … lab-04/, helpers/ — Vitest + Supertest API tests
e2e/lab-03, lab-04   Playwright end-to-end + responsive specs (lab-02 is retired)
artifacts/lab-0N     screenshots written by the responsive specs
docs/lab-01          ai_use.md, reviewer.md, tests.md
docs/lab-02 … lab-04 specification.md, api-spec.md, ui-spec.md, tests.md, reviewer.md, ai-use.md
docs/skills          agent playbooks
```

## Setup

Requires Node.js 18+ and a local PostgreSQL.

Create the database once, as a PostgreSQL superuser:

```sql
CREATE ROLE toktickit WITH LOGIN PASSWORD 'toktickit' CREATEDB;
CREATE DATABASE toktickit OWNER toktickit;
```

`CREATEDB` is required — Prisma's `migrate dev` needs it for its shadow database.

```bash
cd server && npm install && cp .env.example .env
npm run prisma:migrate && npm run prisma:seed   # tables + reference and requester seed
npm run dev                                     # :3000

cd client && npm install && cp .env.example .env && npm run dev   # :5173
```

The seed upserts on natural keys (category/related-system `name`, user `email`),
so it is safe to re-run. It creates 4 categories, 7 related systems, 13 users
(6 Requesters, 5 IT Staff, 2 Administrators), 8 demo tickets spanning every
status, and 9 Actions Taken.

### Development credentials (Labs 3–4)

Every seeded account shares one **development-only** password — it is not a real
secret (BR-65). Sign in with any seeded email plus this password:

```
Password for all seeded accounts:  ChangeMe123!
```

| Role | Example accounts | First login |
|------|------------------|-------------|
| Requester | `somchai.prasert@toktickit.test`, `nadia.rahman@toktickit.test`, `anong.srisai@toktickit.test`, `peter.chen@toktickit.test` (+ 1 inactive) | **prompted to change password** (migrated from Lab 2, BR-60) |
| IT Staff | `isara.thongchai@toktickit.test`, `malee.boonmee@toktickit.test`, `decha.phumipat@toktickit.test` (+ 1 inactive) | ready to use |
| Administrator | `arthit.admin@toktickit.test` | ready to use |
| *Lab 4* Administrator (second) | `ratana.admin@toktickit.test` | ready to use |
| *Lab 4* Requester with no Tickets | `lalita.chaiyo@toktickit.test` | **prompted to change password** |
| *Lab 4* IT Staff with no work | `thanin.rakdee@toktickit.test` | ready to use |

The Lab 4 accounts exist for demonstrations: two active Administrators show the
self-deactivation and last-Administrator guards separately, and the idle
Requester and IT Staff show each dashboard at zero. The eight seeded Tickets
(`TKT-2026-900001`…`900008`) carry Actions Taken and status history: 900003 has
several actions in all four action statuses, 900004 passes the resolution gate,
and 900007 has an outstanding follow-up that blocks it.

Requesters carry `mustChangePassword = true`, so any requester account also
demonstrates the mandatory first-login password-change flow.

Emails are stored lower-cased. The Lab 3 migration **renames** Lab 2's
`RequesterUser` table to `User` rather than recreating it, so every existing
Ticket and Attachment is preserved; run `npx prisma migrate reset --force` to
rebuild and re-seed from scratch.

### Migrating to Lab 4, and rolling back

The Lab 4 migration (`lab4_actions_workflow_dashboards`) is **additive**. It adds
Actions Taken, status history, `Ticket.version`, and `Ticket.resolvedAt`; it
backfills one history row and `version = 1` for every existing Ticket; and it
drops or rewrites nothing. On a database with data worth keeping, back it up
first:

```bash
pg_dump -Fc -d toktickit -f before-lab4.dump   # backup
cd server && npm run prisma:migrate             # apply (dev); `npx prisma migrate deploy` elsewhere
npm run prisma:seed                             # safe to re-run: upserts on natural keys
```

Two ways back, from least to most drastic:

1. **Application rollback.** Redeploy `main` at the Lab 3 release. The Lab 3 build
   runs unchanged on the Lab 4 schema, because every new column has a default
   and Lab 3 never reads the new tables.
2. **Schema rollback.** This removes every Lab 4 table, column, trigger, and type,
   and **deletes all Actions Taken and status history**:

   ```bash
   psql -v ON_ERROR_STOP=1 -d toktickit -f server/prisma/rollback/lab4_down.sql
   ```

   The database is then exactly at the Lab 3 schema: `prisma migrate status` on
   the Lab 3 code reports it up to date. The drill that proves this is recorded in
   `docs/lab-04/tests.md` §4.3.

As a last resort, `pg_restore --clean -d toktickit before-lab4.dump` restores the
backup.

## Tests

```bash
cd server && npm test          # Vitest + Supertest (needs a migrated + seeded DB)
cd client && npm test          # Vitest + Testing Library

# End-to-end + responsive (from the repo root), needs a migrated + seeded DB:
npm install                    # installs @playwright/test at the root
npx playwright install chromium
npm run test:e2e               # === npx playwright test
npm run test:e2e:report        # open the last HTML report
```

The Playwright config **starts both servers itself** (`server` on :3000 and the
Vite client on :5173), so the suite runs against a real Express API and a real
PostgreSQL — no mocks. It runs Chromium only and serially:

- `e2e/lab-03/authentication.spec.ts` — E2E-01…04 (session, first-login change,
  HttpOnly cookie, keyboard-only)
- `e2e/lab-03/staff-ticket-flow.spec.ts` — E2E-05, E2E-06 (staff journey,
  two-sided conversation, note confidentiality)
- `e2e/lab-03/user-administration.spec.ts` — E2E-07, E2E-08 (create and first
  login, Administrator guards)
- `e2e/lab-03/responsive.spec.ts` — RESP-01…04, plus the ui-spec §12 screenshot
  set written to `artifacts/lab-03/screenshots/`
- `e2e/lab-04/actions-taken-flow.spec.ts` — E2E-01…03 (action lifecycle, performer
  who is not the Owner, cancel confirmation, inactive performer)
- `e2e/lab-04/ticket-resolution.spec.ts` — E2E-04…07 (resolution gate, follow-up,
  two people on one Ticket, the Requester's view)
- `e2e/lab-04/dashboards.spec.ts` — E2E-08…10 (drill-down parity, landing, the
  Administrator's Ticket access)
- `e2e/lab-04/regression.spec.ts` — E2E-11, E2E-12 (Lab 1–3 journeys; every
  destination per role with no console error or broken link)
- `e2e/lab-04/responsive.spec.ts` — RESP-01…05, plus the ui-spec §14 screenshot
  set written to `artifacts/lab-04/screenshots/`

Both responsive specs **overwrite** the committed screenshots on every run.
Restore them with `git checkout -- artifacts/` unless you mean to update the
evidence.

The suite signs in as the seeded `arthit.admin` only to create its own accounts
through the Administrator API, and deactivates them afterwards, so the seeded
accounts' passwords are never changed. The Lab 2 specs were retired with the
Development Requester selector; `docs/lab-03/tests.md` §7 maps their coverage.

To rebuild the database from scratch: `cd server && npx prisma migrate reset --force`
(re-applies every migration and re-seeds).

**REG-02 needs Lab 3 data from before the Lab 4 migration.** It checks that every
Ticket that existed when the migration ran was backfilled, so on a database built
by `migrate reset` (the Lab 4 migration applied to empty tables) it has nothing to
check and fails. Build the database in release order instead:

```bash
git worktree add ../toktickit-lab3 08ef17d      # the Lab 3 release on main
cp server/.env ../toktickit-lab3/server/.env
cd ../toktickit-lab3/server && npm ci && npx prisma migrate reset --force   # Lab 3 schema + seed
cd -  && cd server && npx prisma generate && npx prisma migrate deploy && npm run prisma:seed
git worktree remove --force ../toktickit-lab3
```

## Demonstration (Lab 4)

With both dev servers running and the database seeded, every seeded account's
password is `ChangeMe123!` (see the table above for which must change it first).

1. **Requester** — sign in as a seeded Requester. You land on the Dashboard: three
   cards, *Needs your attention* first. Click *Waiting for you*; My Tickets opens
   filtered, with "Filtered from Dashboard" and a total equal to the card. Open a
   Ticket to see its Actions Taken (read-only) and its status history, where staff
   changes read "IT Support".
2. **IT Staff** — sign in as a seeded IT Staff member. The Dashboard shows four
   cards, the status and IT Priority strips, *My open actions*, *Urgent*, and
   *Recently updated*. Open an In Progress Ticket: *Resolved* is missing from the
   status select and the reasons are listed under it. Add a Completed action with a
   result; *Resolved* appears and can be applied.
3. **Two people** — open the same Ticket as two staff members in two browsers.
   Change the status in one; the other's change is refused with the conflict
   banner, and *Reload* shows the winner.
4. **Administrator** — sign in as `arthit.admin`. The Dashboard adds the Users
   card; the navigation is Dashboard, Ticket Queue, User Management.

## Status

Labs 1–3 are merged to `main`. Lab 4 work happens on feature branches off
`lab4-staging` and is released to `main` in one PR. The authoritative per-lab status table is in
[`AGENTS.md`](./AGENTS.md) §10, and each Issue is tracked on the
**TokTickIT Individual Sprints** GitHub Project board.

Never commit `.env`; only `.env.example` is tracked.
