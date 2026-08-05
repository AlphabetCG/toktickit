# TokTickIT

A tiny full-stack IT service desk vertical slice built for CPE 334 (Intro to
Software Engineering in the Age of AI Agents), Lab 1.

**Stack:** React + TypeScript + Vite + Bootstrap (client) → Node.js + Express +
TypeScript (server) → Prisma ORM → PostgreSQL.

## Repository structure

```
toktickit/
├── client/        # React + TypeScript + Vite + Bootstrap frontend
├── server/        # Express + TypeScript backend
│   ├── prisma/    # Prisma schema
│   ├── src/       # Express app + server bootstrap
│   └── tests/     # Vitest + Supertest tests
│       └── lab-01/
├── docs/
│   └── lab-01/    # ai_use.md, reviewer.md, tests.md
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

### 2. Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL points at the backend
npm run dev                 # starts the app on http://localhost:5173
```

## Running tests

```bash
# Backend (Supertest + Vitest)
cd server && npm test

# Frontend (Vitest)
cd client && npm test
```

## Notes

- Never commit `.env`; only `.env.example` is tracked.
- Lab 1 is delivered across four issues (project foundation, health check,
  category seed, category list). This README covers the foundation (Issue 1).
