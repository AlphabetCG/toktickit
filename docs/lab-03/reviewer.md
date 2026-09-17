# Lab 3 Peer Review Record

Peer review runs **both directions** every lab (AGENTS.md §8). Each direction
needs a substantive comment and a reply — a bare Approve does not satisfy the
rubric.

- **Author:** Naphat Utabuawong (67070501015, @AlphabetCG)
- **Peer reviewer:** Nantakorn Pinsupaporn (67070501028, @copter549365)
- **Partner repo:** `copter549365/toktickit`

---

## Direction A — @copter549365 reviews @AlphabetCG

### PR #37 — docs: Lab 3 sprint engineering contract (Issue #29 / Lab 3 Issue 1)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/37
- **Base:** `lab3-staging` ← **Head:** `feature/1-sprint3-specification`
- **Review verdict:** `APPROVED` by @copter549365, 2026-09-17 — "ครบถ้วนตาม
  description ที่ส่งมาครับ" (complete per the description sent). PR merged into
  `lab3-staging`.

No changes requested. The specification, test plan, REST contract, and UI spec
(`docs/lab-03/`) were accepted as the Lab 3 engineering contract, committed before
any implementation PR.

---

## Direction B — @AlphabetCG reviews @copter549365

Partner repo: `copter549365/toktickit`.

### PR #43 — Issue 2: Database Increment, Migration from Lab 2 & Seed Data

- **PR:** https://github.com/copter549365/toktickit/pull/43
- **Review verdict:** `COMMENTED` by @AlphabetCG, 2026-09-17.

Reviewed their Lab 3 data model: `prisma/schema.prisma`, the additive migration
`20260917000000_lab3_user_and_workflow`, the expanded seed, and
`server/tests/lab-03/migration.test.ts`. I first confirmed the Lab 2 migration
file shown in the diff was a **new file** (base branch lacked it), not a modified
already-applied migration — so no Prisma checksum concern, and no false finding.

The migration is genuinely additive and idempotent — `IF NOT EXISTS`,
`DO $$ … EXCEPTION`, `ON CONFLICT DO NOTHING`, `ADD VALUE IF NOT EXISTS` — and the
`RequesterUser → User` move re-points `Ticket.requesterId` via an email join
(Steps A–D) and adds the missing `ticketOwnerId` FK. `PublicComment` /
`InternalNote` are cleanly separated with full indexes; bcrypt salt 12 +
`mustChangePassword` defaults are sound. Two points to confirm, one minor:

1. **`ALTER TYPE "TicketStatus" ADD VALUE` inside Prisma's migration transaction.**
   Prisma runs a migration file in one transaction, and PostgreSQL restricts
   `ADD VALUE` in a transaction (the new value cannot be *used* in the same tx;
   pre-12 forbids it entirely). This file only *adds* the values, so it should
   pass on PG 12+ — asked them to confirm `prisma migrate reset` applies it
   cleanly on a fresh DB (also the Part 3 evidence).
2. **Seed emails should match the Lab 2 `RequesterUser` emails.** The migration
   brings old requesters in as placeholder `User` rows keyed on email; the seed
   creates demo users with new `@toktickit.com` emails. If the two sets diverge,
   the `upsert` never overwrites the placeholders, so migrated Lab 2 Tickets stay
   attached to no-login accounts and the demo requesters see none of the old
   tickets. If the intent is continuity, align the seed emails with Lab 2 (or note
   the deliberate split in the spec).

Minor: the placeholder `passwordHash` is not a structurally valid bcrypt string —
`bcrypt.compare` returns false for it (safe), but a well-formed sentinel avoids
any edge case.

- **Resolution:** awaiting @copter549365's confirmation on points 1–2, then approval.
