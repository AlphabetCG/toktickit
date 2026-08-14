# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.
Every test below passes on a migrated + seeded database.

| # | File | Tool | Test | Result |
|---|------|------|------|--------|
| API-01 | `server/.../health.test.ts` | Supertest | GET /api/health returns 200, status=ok | pass |
| API-02 | `server/.../categories.test.ts` | Supertest | GET /api/categories returns 4 seeded categories in id order | pass |
| DB-01 | `server/.../category-seed.test.ts` | Vitest + Prisma | Seed inserts the four categories in order | pass |
| DB-02 | `server/.../category-seed.test.ts` | Vitest + Prisma | Seed run twice creates no duplicates | pass |
| UI-01 | `client/.../App.test.tsx` | Vitest | TokTickIT heading renders | pass |
| UI-02 | `client/.../App.test.tsx` | Vitest | Success state shows System Status Online | pass |
| UI-03 | `client/.../App.test.tsx` | Vitest | API failure shows Offline + a useful error message | pass |
| UI-04 | `client/.../App.test.tsx` | Vitest | Categories from the API render on success (not hard-coded) | pass |

## Passing output — server (`feature/4-category-list`)

```
$ cd server && npm test

 RUN  v2.1.9 .../toktickit/server

 ✓ tests/lab-01/category-seed.test.ts (2 tests) 100ms
 ✓ tests/lab-01/health.test.ts (1 test) 16ms
 ✓ tests/lab-01/categories.test.ts (1 test) 77ms

 Test Files  3 passed (3)
      Tests  4 passed (4)
```

## Passing output — client

```
$ cd client && npm test

 ✓ tests/lab-01/App.test.tsx (4 tests) 181ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Live endpoints — evidence

```
$ curl http://localhost:3000/api/health
{"status":"ok","service":"TokTickIT API"}

$ curl http://localhost:3000/api/categories
[{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},
 {"id":3,"name":"Software"},{"id":4,"name":"Network"}]
```

## Seed idempotency — evidence

The seed was run twice in a row; the table still holds exactly four rows.

```
$ npm run prisma:seed && npm run prisma:seed
Seeded 4 categories.
Seeded 4 categories.

toktickit=> SELECT id, name FROM "Category" ORDER BY id;
 id |        name
----+--------------------
  1 | Account and Access
  2 | Hardware
  3 | Software
  4 | Network
(4 rows)
```
