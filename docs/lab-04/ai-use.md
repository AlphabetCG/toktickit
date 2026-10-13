# Lab 4 — AI Use and Reflection

**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)

> **Living document.** Started at sprint planning and extended as each Issue
> lands. The labsheet asks for 6–10 selected key prompts; the selection is made
> when the sprint closes.

## LLM / agent used

**Claude Code** (Anthropic), run in the terminal against this repository.

| Model | Used for |
|-------|----------|
| Claude Opus 5.5 | Reading the labsheet, sprint planning, Issue decomposition |

---

## Specification phase

| # | Prompt (as typed) | What I did with the result |
|---|-------------------|----------------------------|
| 1 | *"[Lab 4 labsheet PDF attached] อ่านไฟล์แลป จากนั้นวิเคราะห์ว่าผมต้องทำอะไรบ้าง หลังจากนั้นเตรียมออกแบบ Sprint, issue และเตรียมวางโครงได้เลย"* | Got a gap analysis against the merged Lab 3 code, an eight-Issue decomposition with dependencies, and the Lab 4 branch and document skeleton. The analysis surfaced a conflict inside the handout: the Actions Taken field list (§3, §8.3) has no assignee or status, yet the Part 6 rubric grades *assign, complete, cancel, and inactive-assignee rejection*. That and three other gaps became decisions for me to make before the contract is written. |

| 2 | *"เอาตามที่แนะนำ เขียน specification.md ให้เลย"* | Approved the remaining recommendation (an append-only status-history table, D-05) and had the agent write the contract: FR-01…24, BR-01…63, AC-01…63, D-01…17, the dashboard calculation tables with a drill-down URL per metric, and an additive migration with a rollback drill. I checked two things it raised that I had not asked about: the resolution gate and required `expectedVersion` both break existing Lab 3 tests, so the contract lists those as deliberate changes (§5.10) instead of letting them surface later as "regressions". It also added a second seeded Administrator because of the Lab 3 Part 8 screenshot problem. |
| 3 | *"ทำตามขั้นตอนได้เลย"* | Ran the rest of the planned sequence: `tests.md` (135 planned tests over ten levels, every AC traced, plus the list of Lab 3 tests the deliberate changes touch), `api-spec.md` (six new and six changed endpoints with a `conflict` discriminator on every 409), and `ui-spec.md` (dashboards, Actions Taken, workflow feedback, a seven-item polish list, the Part 9 checklist). While writing the UI spec the agent noticed the Lab 3 queue header counts *all* statuses, so the same words "unassigned" would show two different numbers on two screens; it relabelled both rather than silently changing a Lab 3 API. Then it created Issues #47–#54 with dependencies and planned-test tables, placed them on the board, and opened the contract PR. |

### Decisions I approved rather than accepted silently

| Decision | Options the agent laid out | What I chose |
|----------|---------------------------|--------------|
| Actions Taken model | field list only / assignee only / hybrid with assignee + action status | Hybrid — the only option that leaves something to demonstrate for every Part 6 rubric item (D-01) |
| Resolution gate | none / ≥1 action / ≥1 completed action and nothing outstanding | The strictest — resolution must be backed by finished work (D-02) |
| Stale-update detection | `updatedAt` timestamp / integer `version` | Integer `version` (D-03) |
| Administrator screens | Dashboard + Users / Dashboard + Queue + Users | Dashboard + Queue + Users (D-04) |
| Status history | `updatedAt` only (Lab 3) / append-only history table | Append-only table with a database trigger (D-05) |

## Implementation phase — per Issue

| # | Issue | Prompt (as typed) | What I did with the result |
|---|-------|-------------------|----------------------------|
| 4 | #48 Data model, migration, seed | *"start implementing next issue on lab4 / before implementing, update reviewer.md what my friend was reviewing for me in my last issue / after implementing please update ai-use.md then other md if necessary / after that open pr in github, move kanban board for me then in my pr add copter549365 to be a reviewer for me"* | **Before implementing:** the agent recorded copter's approval of PR #55 in `reviewer.md`. It noted honestly that "โอเคครับ" with no comment is a bare Approve, which does not meet the rubric, rather than presenting it as a substantive review. It closed #47 and moved #48 to Started. **Order of work driven by the drill:** it took the Lab 3 `pg_dump` **before** touching the schema, because AC-56's drill needs a pre-migration database that cannot be recreated once the migration runs. **Test-first:** it wrote REG-01…05 and saw them fail for the expected reason (no migration folder). **Implementation:** schema exactly per §7.1; migration generated with `--create-only` and reordered by hand to §7.3, so the trigger comes after the backfill; `lab4_down.sql`, which also drops the two new indexes on the existing `updatedAt` column (dropping a column wouldn't remove them) and Prisma's migration record; and a seed with fixed September dates, history along the shortest **permitted** §5.3 path, and actions that make 900004 pass and 900007 fail the resolution gate. **Two contract tensions resolved without editing old tests:** Lab 2's `seed.test.ts` pins four active Requesters, so the three Lab 4 accounts went into a separate `LAB4_USERS` (BR-57 forbids editing Lab 2/3 tests). And until #51, Tickets created *after* the migration have no history, so REG-02 is scoped to pre-migration Tickets via `_prisma_migrations.finished_at` and documented in §7. **Mutation checks found a flaw in its own test:** with the trigger dropped, REG-03's `UPDATE` really ran and corrupted history row 1. The agent restored the row (trigger briefly disabled, the change confined to that row) and rewrote REG-03 so each attempt runs in a transaction that always rolls back; re-checked, it now fails safely. The non-deterministic-key mutation broke REG-04 as intended and left 27 junk actions, which it removed by an exact key pattern. **Rollback drill, done faithfully:** Lab 3's migration test was run from a worktree of `main` with Lab 3's own Prisma client, because today's seed writes Lab 4 tables. The result: up to date, `migrate diff` no difference, Lab 3 migration test 12/12; output pasted in `tests.md` §4.3. A final re-run caught one more order-dependent assertion: REG-02's `resolvedAt` check failed on three Closed Tickets that Lab 2/3 tests had created *after* the migration, through Lab 3 code that does not maintain `resolvedAt` until #51. It was scoped to pre-migration Tickets like the history check, and passed twice with that residue present. The agent had chained the commit after that test run without gating on it, so the fix went in as a follow-up commit before anything was pushed. Verified: server **302/302** (284 Lab 1–3 + 18 new), Lab 3 E2E **16/16** on the Lab 4 schema, tsc clean. |

## My Reflection
