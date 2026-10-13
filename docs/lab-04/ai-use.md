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

## My Reflection
