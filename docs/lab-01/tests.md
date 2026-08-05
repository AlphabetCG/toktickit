# Lab 1 — Test Catalog

All tests live under `server/tests/lab-01/` (API) and `client/src/` (UI).

| Test File (tests/lab-01/) | Tool | Test Description |
| ------------------------- | --------- | ---------------- |
| foundation.test.ts        | Supertest | Express app boots and responds on the root route |
| _API-01 (Issue 2)_        | Supertest | Health endpoint returns 200 and expected JSON |
| _API-02 (Issue 4)_        | Supertest | Categories endpoint returns the four seeded categories |
| _UI-01 (Issue 2)_         | Vitest    | TokTickIT heading renders |
| _UI-02 (Issue 4)_         | Vitest    | Loading state changes to category list |
| _UI-03 (Issue 4)_         | Vitest    | API failure displays a useful error message |

> Rows in italics are placeholders to be implemented in later issues.
