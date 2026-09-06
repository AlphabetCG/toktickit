# TokTickIT

Project TokTickIT for Software Engineering, KMUTT. Built across four individual
sprints (Labs 1–4). Lab 1 (foundation, health check, categories) is complete and
merged to `main`; Lab 2 (Requester Ticketing MVP + Zen Green UI) is in progress.

A full-stack IT service desk: React + TypeScript + Vite + Bootstrap on the front,
Express + TypeScript on the back, Prisma + PostgreSQL underneath, tested with
Vitest + Supertest + Playwright.

Process, lifecycle, and conventions live in [`AGENTS.md`](./AGENTS.md); each
sprint's engineering contract lives under `docs/lab-0N/`.

## Structure

```
client/src           App.tsx, api.ts, main.tsx, components/, theme.css
client/tests         lab-01/, lab-02/ — Vitest UI + style tests
server/src           app.ts, index.ts, prisma.ts
server/prisma        schema.prisma, seed.ts, migrations/
server/tests         lab-01/, lab-02/ — Vitest + Supertest API tests
e2e/lab-02           Playwright end-to-end specs
docs/lab-01          ai_use.md, reviewer.md, tests.md
docs/lab-02          specification.md, api-spec.md, ui-spec.md, tests.md, reviewer.md, ai-use.md
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

The seed upserts on natural keys (category/related-system `name`, requester
`email`), so it is safe to re-run. It creates 4 categories, 7 related systems,
and 5 development requesters (4 active, 1 inactive).

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
PostgreSQL — no mocks. It runs Chromium only, serially, and drives the five
end-to-end journeys (`e2e/lab-02/requester-ticket-flow.spec.ts`) plus the
responsive/no-overflow checks (`e2e/lab-02/responsive.spec.ts`). The responsive
spec writes the desktop/tablet/mobile evidence to
`artifacts/lab-02/screenshots/` (ui-spec §13).

To rebuild the database from scratch: `cd server && npx prisma migrate reset --force`
(re-applies every migration and re-seeds).

## Status

Lab 1 is merged to `main`. Lab 2 work happens on feature branches off
`lab2-staging`. The authoritative per-lab status table is in
[`AGENTS.md`](./AGENTS.md) §10, and each Issue is tracked on the
**TokTickIT Individual Sprints** GitHub Project board.

Never commit `.env`; only `.env.example` is tracked.
