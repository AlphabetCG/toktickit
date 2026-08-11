# TokTickIT

Project TokTickIT for Software Engineering, KMUTT — Lab 1.

A small full-stack IT service desk slice: React + TypeScript + Vite + Bootstrap
on the front, Express + TypeScript on the back, Prisma + PostgreSQL underneath.

## Structure

```
client/src        App.tsx, api.ts, main.tsx
client/tests      lab-01/ — Vitest UI tests
server/src        app.ts, index.ts, prisma.ts
server/prisma     schema.prisma, seed.ts
server/tests      lab-01/ — Vitest + Supertest API tests
docs/lab-01       ai_use.md, reviewer.md, tests.md
```

## Setup

Requires Node.js 18+ and a local PostgreSQL.

```bash
cd server && npm install && cp .env.example .env && npm run dev   # :3000
cd client && npm install && cp .env.example .env && npm run dev   # :5173
```

From Issue 3 onwards the database also needs:

```bash
cd server && npm run prisma:migrate && npm run prisma:seed
```

## Tests

```bash
cd server && npm test
cd client && npm test
```

`server/tests/lab-01/health.test.ts` stays **red until Issue 2** implements the
route — that is the intended red → green starting point, not a broken build.

## Issues

| Issue | Branch | Status |
| ----- | ------ | ------ |
| 1. Project foundation | `feature/1-project-foundation` | in review |
| 2. API health check | `feature/2-health-check` | not started |
| 3. Category seed | `feature/3-category-seed` | not started |
| 4. Category list | `feature/4-category-list` | not started |

Never commit `.env`; only `.env.example` is tracked.
