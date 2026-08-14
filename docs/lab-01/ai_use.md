# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude Code (Claude Sonnet 5, later Claude Opus)

## Selected key prompts

Planning and workflow prompts first, then the implementation prompt for each
issue with the follow-up sub-prompts I used to finish and debug it.

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Attached the labsheet, cheat sheet and glossary and asked for a detailed explanation of the lab — explicitly saying not to write code yet. | Used the breakdown to plan the four issues, the branch layout and the Kanban columns before touching the repo. |
| 2 | Asked how a peer partner reviews and approves my code on GitHub. | Learned the Collaborator → Reviewers → Approve flow, and added my partner as a collaborator. |
| 3 | Pointed the agent at my repo and asked what was still missing before my partner could review Issue 1. | It found that `npm test` in `client/` failed because no test file existed, so I fixed that before opening the PR. |
| 4 | Gave the agent the official starter scaffold and asked it to restructure my Issue 1 setup to match. | Replaced my hand-rolled layout with the official one (ESM, `tests/lab-01/`, split configs). |
| 5 | Said parts of the code were too verbose to understand and asked it to review and trim what was unnecessary. | Removed no-op lines, a redundant default export and oversized comment banners. |
| 6 | **Issue 1:** "do issue 1 — set up the branch then conclude it", then "implementing issue 1 for me". | Scaffolded `client/` + `server/`, verified the frontend/backend start, Vitest/Supertest run, `.gitignore`/`.env.example` exist. |
| 7 | **Issue 2:** "implementing issue 2" + the acceptance criteria (`GET /api/health` → 200 `{status:ok, service:TokTickIT API}`, Supertest verifies, React shows status from a real API call, error message when offline). | Re-based the branch onto `lab1-staging`, implemented `/api/health`, wired `checkSystem()` + Online/Offline UI, added the two UI tests. |
| 8 | **Issue 4:** "implementing issue 4" + criteria (`GET /api/categories` via Prisma in id order, Supertest, React renders API data not hard-coded, loading/error states, Vitest). **Sub-prompt:** "testing and debugging it, also reduce unnecessary code." | Added the categories route + Supertest, rendered the list from the API, and dropped the unused `SystemStatus.online` flag so `checkSystem` returns `Category[]`. |
| 9 | **Debug sub-prompt:** "there is some error on test structure on `vite.config.ts`". | Traced it to a duplicate Vite (app Vite 6 vs Vitest's bundled Vite 5) and split the `test` block into a dedicated `vitest.config.ts`. |
| 10 | **DB sub-prompts:** "is it possible to recover [the DB password]?" → after resetting it, "Done, create me db" → "debug and testing all project and reducing unnecessary files". | Walked through a `trust`-auth password reset, created the `toktickit` role/db, ran migrate + seed, then re-ran every suite (server 4/4, client 4/4) and removed stray build artifacts. |

## Reflection

- Prompt 1 was stronger because it **forbade code** — I got a plan I understood
  instead of code I could not explain.
- Prompt 3 asked the agent to **verify state** rather than build something, which
  is how the empty client test suite was caught before the PR.
- The most useful correction pattern was pairing each feature prompt with a
  "test and debug it / reduce unnecessary code" sub-prompt — that is what turned
  up the duplicate-Vite config error and the dead `online` flag.
- Biggest environment issue was the forgotten PostgreSQL password; the agent
  could not brute-force it (and correctly refused to), so I reset it myself and
  the agent then provisioned and seeded the database.
