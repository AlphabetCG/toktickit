# TokTickIT

A tiny full-stack IT service desk vertical slice built for CPE 334 (Intro to
Software Engineering in the Age of AI Agents), Lab 1.

**Stack:** React + TypeScript + Vite + Bootstrap (client) → Node.js + Express +
TypeScript (server) → Prisma ORM → PostgreSQL.

## Repository structure

```
toktickit/
├── client/
│   ├── src/            # App.tsx, api.ts, main.tsx
│   └── tests/
│       ├── setup.ts
│       └── lab-01/     # Vitest UI tests
├── server/
│   ├── prisma/         # schema.prisma, seed.ts
│   ├── src/            # app.ts, index.ts, prisma.ts
│   └── tests/
│       └── lab-01/     # Vitest + Supertest API tests
├── docs/
│   └── lab-01/         # ai_use.md, reviewer.md, tests.md
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL running locally

## Setup

### 1. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env        # then edit DATABASE_URL with your Postgres credentials
npx prisma generate
npm run dev                 # starts the API on http://localhost:3000
```

Database tasks (needed from Issue 3 onwards):

```bash
npm run prisma:migrate      # create/apply migrations
npm run prisma:seed         # insert the four request categories
```

### 2. Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL points at the backend
npm run dev                 # starts the app on http://localhost:5173
```

## Running tests

```bash
# Backend (Vitest + Supertest)
cd server && npm test

# Frontend (Vitest + Testing Library)
cd client && npm test
```

## Lab 1 progress

Lab 1 is delivered across four issues, each on its own branch and merged into
`lab1-staging` through a peer-reviewed PR:

| Issue | Branch | Status |
| ----- | ------ | ------ |
| 1. Project foundation | `feature/1-project-foundation` | in review |
| 2. API health check | `feature/2-health-check` | not started |
| 3. Category seed | `feature/3-category-seed` | not started |
| 4. Category list | `feature/4-category-list` | not started |

The foundation ships the official scaffold with `TODO(Issue n)` markers in
`server/src/app.ts`, `server/prisma/schema.prisma`, `server/prisma/seed.ts` and
`client/src/api.ts`. `server/tests/lab-01/health.test.ts` is a worked example
that stays **red until Issue 2** implements the route — that is the intended
red → green TDD starting point, not a broken build.

## Notes

- Never commit `.env`; only `.env.example` is tracked.
