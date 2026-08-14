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

Create the database once, as a PostgreSQL superuser:

```sql
CREATE ROLE toktickit WITH LOGIN PASSWORD 'toktickit' CREATEDB;
CREATE DATABASE toktickit OWNER toktickit;
```

`CREATEDB` is required — Prisma's `migrate dev` needs it for its shadow database.

```bash
cd server && npm install && cp .env.example .env
npm run prisma:migrate && npm run prisma:seed   # Category table + 4 categories
npm run dev                                     # :3000

cd client && npm install && cp .env.example .env && npm run dev   # :5173
```

The seed upserts on the unique category name, so it is safe to re-run.

## Tests

```bash
cd server && npm test
cd client && npm test
```

The server tests need a migrated and seeded database. Tests still marked `todo`
belong to Issue 4.

## Issues

| Issue | Branch | Status |
| ----- | ------ | ------ |
| 1. Project foundation | `feature/1-project-foundation` | merged |
| 2. API health check | `feature/2-health-check` | merged |
| 3. Category seed | `feature/3-category-seed` | in review |
| 4. Category list | `feature/4-category-list` | not started |

Never commit `.env`; only `.env.example` is tracked.
