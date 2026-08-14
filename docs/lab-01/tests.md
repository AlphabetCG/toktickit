# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | File | Tool | Test | Result |
|---|------|------|------|--------|
| API-01 | `server/.../health.test.ts` | Supertest | GET /api/health returns 200, status=ok | pass |
| API-02 | `server/.../categories.test.ts` | Supertest | GET /api/categories returns 4 seeded categories in id order | todo (Issue 4) |
| DB-01 | `server/.../category-seed.test.ts` | Vitest + Prisma | Seed inserts the four categories in order | pass |
| DB-02 | `server/.../category-seed.test.ts` | Vitest + Prisma | Seed run twice creates no duplicates | pass |
| UI-01 | `client/.../App.test.tsx` | Vitest | TokTickIT heading renders | pass |
| UI-02 | `client/.../App.test.tsx` | Vitest | Success state shows System Status Online | pass |
| UI-03 | `client/.../App.test.tsx` | Vitest | API failure shows Offline + a useful error message | pass |
| UI-04 | `client/.../App.test.tsx` | Vitest | Seeded categories render on success | todo (Issue 4) |

## Passing output — Issue 3 (`feature/3-category-seed`)

```
$ cd server && npm test

 RUN  v2.1.9 .../toktickit/server

 ✓ tests/lab-01/category-seed.test.ts (2 tests) 63ms
 ↓ tests/lab-01/categories.test.ts (1 test | 1 skipped)
 ✓ tests/lab-01/health.test.ts (1 test) 20ms

 Test Files  2 passed | 1 skipped (3)
      Tests  3 passed | 1 todo (4)
```

```
$ cd client && npm test

 ✓ tests/lab-01/App.test.tsx (4 tests | 1 skipped) 211ms

 Test Files  1 passed (1)
      Tests  3 passed | 1 todo (4)
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
