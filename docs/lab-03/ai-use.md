# Lab 3 — AI Use and Reflection

**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)

> **Living document.** Started during the specification phase and extended as
> each Issue lands, so the prompt record matches what was actually typed rather
> than being reconstructed at the end of the sprint. The labsheet asks for 6–10
> selected key prompts; the selection is made when the sprint closes.

## LLM / agent used

**Claude Code** (Anthropic), run in the terminal against this repository.

| Model | Used for |
|-------|----------|
| Claude Sonnet 5 | Reading the labsheet, planning, general questions about lab process and Git mechanics |
| Claude Opus 5 | Drafting the engineering contract, decomposing Issues, implementation work |

The agent had read access to the repository, to the Lab 3 labsheet PDF, and to
the completed Lab 1 and Lab 2 contracts. It was used as an engineering
assistant; every document and decision below was reviewed and approved by me
before being committed.

Two agent playbooks from Lab 2 governed the work: `docs/skills/`
`skill-sprint-implementation.md` and `skill-sprint-verification.md`, plus the
process rules in `AGENTS.md` — including its §4.1 evidence-capture obligation,
which is why screenshot reminders appear at each milestone below.

---

## Specification phase

| # | Prompt (as typed) | What I did with the result |
|---|-------------------|----------------------------|
| 1 | *"[Lab 3 labsheet PDF attached] อันนี้เป็นใบแลป 3 — อ่าน แล้ววางแผนในการทำเป็นขั้นตอนให้หน่อย (ถ้ามีจุดไหนที่ผมต้องแคปส่งก่อนจะทำอะไรต่อให้บอกด้วย)"* | Got a phased plan plus a milestone-to-screenshot table. Two things came out of it that shaped the sprint: the migration — not the login feature — is the real risk, and the spec must be committed with a timestamp before any implementation PR. It also surfaced seven decisions the handout leaves to the student, which became the next prompt. |
| 2 | *"เอาตามที่แนะนำทั้งหมด เขียน specification.md ให้เลย"* | Approved the agent's recommended answers to the open decisions — session cookie over JWT, bcryptjs, `httpOnly`, `sameSite=lax` in place of a CSRF token, no lockout, a documented shared development password, and the eight-status transition matrix — and had it produce the contract. Result: FR-01…24, BR-01…65, AC-01…56, D-01…18, the authorization matrix, and the rename-not-recreate migration plan. |
| 3 | *"เขียน tests.md ต่อเลย"* | Produced the Test DD plan: 113 planned tests across the eight levels the labsheet names, with every AC mapped. I checked the traceability table covered all 56 criteria and that the fourteen test files the labsheet's required repository increment lists were all present. |
| 4 | *"เขียน api-spec.md ต่อเลย"* | Produced the REST contract for all 28 endpoints, each documenting unauthenticated, forbidden, invalid-input, missing-resource, conflict, and unexpected-error behaviour, as §6.2 of the handout requires. |
| 5 | *"เขียน ui-spec.md ต่อเลย"* | Produced the Zen Green extension — inheriting Lab 2's tokens rather than restating them, adding the eight-status badge set, role badges, role navigation, and the Public Comment / Internal Note boundary. Covers all nine items the Part 9 checklist names. |
| 6 | *"สร้าง issue ทั้ง 8 ใบ แล้วเปิด PR ให้เพื่อนรีวิว (เตรียมเขียน ai-use.md ด้วยนะ ฝาก track ให้ตลอดด้วย)"* | Created Issues #29–#36 with dependencies, acceptance criteria, and planned-test tables in each body; started this file during the specification phase rather than at the end; opened the contract PR against `lab3-staging` with @copter549365 as reviewer. |

### Decisions I approved rather than accepted silently

The agent presented these as open choices with recommendations. I read the
reasoning and approved each; they are recorded as D-01…D-18 in
`specification.md` §12 so I can defend them:

- **Session cookie, not JWT** — a JWT cannot be revoked before expiry without a
  denylist, which is a session table in disguise.
- **`bcryptjs` rather than `bcrypt`** — the native build needs a Windows
  toolchain, which would break `npm install` for my peer reviewer.
- **No CSRF token** — `sameSite=lax` plus a strict CORS allowlist closes the
  gap for the request shapes this API actually has.
- **No account lockout** — §4.2 of the handout excludes account unlocking, so a
  lockout would be a denial-of-service vector with no recovery path.
- **Deactivation revealed only after the password verifies** — otherwise login
  becomes an account-existence oracle.
- **Rename the table, do not recreate it** — the only approach that preserves
  `Ticket.requesterId`.

---

## Implementation phase — per Issue

_(Appended as each Issue lands.)_

| # | Issue | Prompt (as typed) | What I did with the result |
|---|-------|-------------------|----------------------------|
| 7 | #30 Data model, migration, seed | *"changing branch, start implementing next issue (issue 1)"* + the standing sub-instructions: record both review directions in `reviewer.md` first, then open a PR and add @copter549365 as reviewer. | Because "Issue 1" (the spec, #29) was already merged, the agent confirmed with me that the next issue to implement was #30 rather than guessing. It recorded both peer-review directions in a new `docs/lab-03/reviewer.md`: my reviewer's approval of the spec PR #37 (Direction A), and my own substantive `COMMENTED` review of the partner's data-model PR #43 (Direction B) — where it first verified their Lab 2 migration file was a *new* file, not a modified applied one, to avoid a false "checksum" finding, then raised the `ALTER TYPE ADD VALUE`-in-transaction check and a seed/migration email-continuity gap. Then it implemented #30 exactly per `specification.md` §8: the `Role` enum, seven added `TicketStatus` values, `Session` / `PublicComment` / `InternalNote`, and the `Ticket` additions. The migration was **hand-written as a `RENAME`, never a drop-and-recreate** (BR-59, D-10) — I had it prove this two ways: `prisma migrate diff` reported *no drift* between the migration and the schema, and REG-01/02 assert the SQL renames and never drops `RequesterUser`/`Ticket`/`Attachment`. The rename rippled into two `src` references and several Lab 2 test fixtures (now scoped to `role: REQUESTER`) and `itPriority` (now required, backfilled from `requestedPriority`). The idempotent seed adds credentialled users across all three roles and eight demo Tickets spanning every status, with comments and notes. Proved REG-01/02/04/05/07. Verified: `migrate reset` + seed clean, server **74/74**, tsc clean; test files run serially so the shared-DB seed stays deterministic. |

---

## My Reflection

_(To be completed at the end of the sprint, in my own words. Points that
actually happened, to draw on:)_

- Prompt 1 asked for a **plan and a screenshot schedule**, not code. That is
  what surfaced the Part 2 timestamp requirement early enough to act on — the
  same lesson as Lab 2, applied deliberately this time instead of by luck.
- Asking the agent to **name the decisions it could not make** kept 18 choices
  visible and mine, rather than buried in generated prose.
- The agent **flagged a trap I would have walked into**: Prisma renders a model
  rename as `DROP TABLE` + `CREATE TABLE`, which would have destroyed every user
  row and orphaned every ticket. It is now BR-59, D-10, and Issue #30's stated
  reason for existing.
- Carrying the **Lab 2 contract forward as an input** meant Lab 3's API changed
  no route path or response shape — the `X-Requester-Id` header chosen in Lab 2
  D-07 was designed for exactly this swap, and that paid off.
