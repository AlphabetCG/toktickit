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

### PR #38 — feat: Lab 3 data model, migration, and seed (Issue #30)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/38
- **Base:** `lab3-staging` ← **Head:** `feature/2-data-model-migration`
- **Review verdict:** `CHANGES_REQUESTED` by @copter549365, 2026-09-17 (four points).

#### Reviewer comment (4 points)

1. Every seeded account had `mustChangePassword: false`, so nothing demonstrates
   the mandatory first-login password-change flow (Part 5 evidence).
2. `migration.api.test.ts` proves the rename via a static SQL regex check, not a
   runtime before/after replay — suggested noting this in `tests.md` for grading.
3. The seven `ALTER TYPE … ADD VALUE` lines share the migration transaction —
   confirm `prisma migrate reset` runs clean on a live DB before merge.
4. `passwordHash` uses a transient `''` default then `DROP DEFAULT`; any row
   migrated from Lab 2 but not covered by the seed would keep `''` (non-blocking).

#### Author reply & resolution (`c91935d`)

| Point | Resolution |
|-------|-----------|
| 1 | **Fixed.** Under-implemented BR-60 — seeded Requesters now carry `mustChangePassword = true` (they are the migrated Lab 2 identities and give a demonstrable first-login-change account); IT Staff/Admin stay usable. REG-04 now runtime-asserts the flag; README documents it. |
| 2 | **Fixed (docs).** `tests.md` now states REG-01/02/04/05 are a static SQL-mechanism check **plus** runtime seeded invariants (not a replay), with preservation additionally proven by `prisma migrate diff` reporting no drift. |
| 3 | **Confirmed (no fix).** Re-ran `prisma migrate reset --force` on PostgreSQL 18.3; migration applies and the seed (which uses the new statuses) succeeds — the migrate transaction commits before the separate seed process runs. |
| 4 | **Non-fix (safe by design).** On a fresh reset only seeded rows exist, all with real hashes; a stray non-seeded row keeps `''`, which no valid bcrypt hash can match, so it cannot authenticate (BR-01) — a fail-safe, not a silent risk. |

- **Resolution:** fixes pushed; @copter549365 **`APPROVED`** on 2026-09-18 and PR #38
  merged into `lab3-staging`. Verified before merge: server 74/74, tsc clean.

### PR #39 — feat: Authentication foundation (Issue #31 / Lab 3 Issue 3)

- **PR:** https://github.com/AlphabetCG/toktickit/pull/39
- **Base:** `lab3-staging` ← **Head:** `feature/3-authentication`
- **Review verdict:** `COMMENTED` by @copter549365, 2026-09-25 — explicitly not
  blocking ("ไม่มีปัญหาในการ merge"), three questions raised.

**Comment received** — three points:

1. `PASSWORD_MIN = 12` is declared in both `client/src/screens/ChangePassword.tsx`
   and `server/src/password.ts`. The values agree today, but they are not shared
   from one source, so the policy can drift if only one side is changed later.
2. No test appears to cover "wrong current password when changing password" —
   possibly hidden in the collapsed `app.ts` diff, worth confirming.
3. Cannot see whether `/api/tickets` carries `requireRole('REQUESTER')` — the
   `app.ts` diff was collapsed. Not a suspected bug, but confirm it is deliberate.

**My response** — verified each against the code before replying; two were real
gaps and were fixed in `55b70b6`, the third needed no change:

1. **Confirmed and fixed.** The duplication was real. I did not introduce a shared
   workspace package for a single constant mid-sprint; instead **UI-31** now reads
   both source files and asserts the two `PASSWORD_MIN` declarations match, turning
   "remember to update both" into a failing test. Its helper throws if either
   constant stops being a literal, so it cannot pass silently. I also reported an
   asymmetry found while checking: the client validates only `MIN` while the server
   validates `MIN` and `MAX`, so an over-long password fails one round trip later —
   documented rather than changed, as the case is not reachable in practice.
2. **Confirmed and fixed.** The behaviour existed — `POST /api/auth/password`
   already calls `verifyPassword` and returns 400 with `fields.currentPassword` —
   but nothing asserted it, and `tests.md` had no row for it either, so a behaviour
   documented in `api-spec.md` §2.4 had no evidence. **API-39** now covers it, and
   deliberately asserts more than the status code: that the old password still
   authenticates and the proposed one does not, so the test would fail if the code
   ever wrote the new hash before returning the error.
3. **No change needed; confirmed deliberate.** `POST /api/tickets` does carry
   `requireRole("REQUESTER")` (`app.ts:254`), matching `api-spec.md` §1.7. `GET
   /api/tickets` deliberately carries no role guard (`app.ts:324`) because it is
   owner-scoped by the session — adding one would 403 IT Staff when the correct
   answer is an empty list, using a role to gate what ownership already handles.
   `AUTHZ-06` and `AUTHZ-11` hold that distinction.

Verified after the fix: server 100/100, client 60/60, `tsc --noEmit` clean on both
sides. Both new tests were re-run by name to confirm they execute rather than
being skipped. `tests.md` updated from 113 to 115 planned tests.

- **Resolution:** replied on the PR
  ([comment](https://github.com/AlphabetCG/toktickit/pull/39#issuecomment-5835840201));
  awaiting re-review.

---

## Direction B — @AlphabetCG reviews @copter549365

Partner repo: `copter549365/toktickit`.

### PR #42 — docs: Lab 3 sprint engineering contract (their Issue 1)

- **PR:** https://github.com/copter549365/toktickit/pull/42
- **Review verdicts:** `CHANGES_REQUESTED` 2026-09-17, then `APPROVED` 2026-09-17.
  Merged the same day.

**My comment** — three must-fix, six should-fix:

1. **`tests.md` marked every row `Pass` with no code written.** The document's own
   header said results start as `Planned`, so it contradicted itself and claimed
   results that had not happened — exactly what the labsheet warns about when
   accepting "done" from an agent.
2. **Three of the eight required coverage types were missing** — responsive, UI
   style, and migration/regression — although §10 mandates all eight and Part 9
   grades responsive screenshots.
3. **Cross-document links were absolute local paths** (`file:///c:/Users/copte/…`),
   which do not open on GitHub and expose a personal path; Part 2 is graded from
   the rendered `specification.md`.

Should-fix: the status matrix lacked permitted roles and confirmations (§4.5
requires four things); CSRF was claimed in `specification.md` but never defined in
`api-spec.md`; the migration plan set `mustChangePassword = false` "to keep test
suites uninterrupted", contradicting their own BR and the thing Part 5 grades;
several FR had neither an AC nor a test; `ui-spec.md` had a "Visual Checklist"
heading with no checklist; `ai-use.md` had 5 prompts against a 6–10 requirement.

**Their response:** `d4ddf5b` closed all three must-fix and all six should-fix.
I verified by `grep` rather than taking the commit message at face value — zero
`| Pass |` rows remained, the missing coverage types appeared as `STYLE-01`,
`RESP-01…03`, `MIGR-01/02`, `REGR-01`, and no `file:///` link survived. Approved.

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

- **Resolution:** @copter549365 addressed the points; PR #43 merged.

### PR #45 — Issue 2: Database Increment, Migration & Seed (v2)

- **PR:** https://github.com/copter549365/toktickit/pull/45
- **Review verdicts:** `CHANGES_REQUESTED` 2026-09-17, `CHANGES_REQUESTED`
  2026-09-18, then `APPROVED` 2026-09-18. Merged 2026-09-18.

**Round 1 — a blocker only a clean install reveals.** `prisma/seed.ts` and
`migration.test.ts` both `import bcrypt`, but `bcrypt` and `@types/bcrypt` had
dropped out of `package.json` during the v2 restructure. It passed on their
machine because `node_modules` still held the package from the previous branch.
I reproduced it from a clean `npm ci`:

```
$ npm ci && npx prisma db seed     → Error: Cannot find module 'bcrypt'
$ npx vitest run migration.test.ts → Cannot find package 'bcrypt'
```

I installed bcrypt with `--no-save` to review the rest, and confirmed the other
six points from #43 were genuinely fixed rather than claimed.

**Round 2 — a process blocker, not a code one.** The code went green, but the PR's
**base branch still pointed at `restore/lab2-into-lab3-staging`**, a branch already
merged and abandoned. GitHub still reported it mergeable, so merging would have
parked Issue 2 in a dead branch instead of `lab3-staging` — and the commit history
Part 1 is graded on would have shown feature → dead branch rather than
feature → staging → main. I verified retargeting changed nothing in the diff
(15 files, +1000/−114 either way) before asking for it.

**Their response:** `4e5a8fd` restored `bcrypt` to both manifests with lockfiles,
and the base was retargeted. I re-ran from a clean `npm ci` across root, server,
and client: migrate + seed passed, a second seed added no rows (User 10 / Ticket 8
/ PublicComment 6 / InternalNote 4), zero tickets had a null `itPriority`, and
suites were green at server 95/95 and client 33/33. I also verified a migrated
Lab 2 user could actually log in (`bcrypt.compare` against the stored hash) and
that ticket and attachment ownership survived. Approved.


### PR #50 — feat: Administrator User Management & Safety Rules (Issue 7)

- **PR:** https://github.com/copter549365/toktickit/pull/50
- **Review verdict:** `COMMENTED` by @AlphabetCG, 2026-09-22.

Reviewed their Admin User Management (their latest open PR): the
`/api/admin/users` CRUD + reset-password endpoints, the safety rules, and
`serializeUser`. The work is strong:

- The three-gate order is correct on every endpoint
  (`requireAuth → requirePasswordChangeCompleted → requireRole('ADMINISTRATOR')`) —
  the password gate precedes authorization (api-spec §1.3).
- `wouldRemoveLastActiveAdministrator` covers **both** demotion and deactivation
  and only fires when the target is genuinely the last active admin (BR-19);
  self-deactivation is blocked (BR-18); email uniqueness is case-insensitive with
  a 409 and is re-checked only when the email actually changes (BR-17).
- `serializeUser` returns an explicit field list, so `passwordHash` never leaks
  from the list or create/update responses. Search escapes LIKE wildcards.

One substantive point and one minor:

1. **Session revocation on admin reset/deactivate.** Neither reset-password nor
   deactivate/demote deletes the target's existing `Session` rows. This is safe
   *only if* `requireAuth` reloads the user and re-checks `isActive`, and the
   password gate re-reads `mustChangePassword`, on **every** request — then a
   deactivated user 401s next request and a reset user is bounced to the change
   screen. If `requireAuth` trusts the session row without re-checking, a
   deactivated/reset user keeps working on the old cookie until expiry, against
   BR-09/AC-09's intent. Asked them to confirm `requireAuth`'s behaviour, and to
   `session.deleteMany({ where: { userId }})` on deactivate/reset if it does not
   re-check.
2. Minor: create-user trusts a client-supplied `initialPassword` (validated for
   complexity). Fine, unless the spec wants the server to generate and reveal it
   once.

**Their response:** `15df1e9` fixed the root cause rather than the symptom —
`requireAuth` now re-checks the user against the database on every request. I
re-verified against a live server and PostgreSQL using a session established
*before* the admin acted:

| Admin action | Before the fix | After |
|---|---|---|
| Deactivate user 6 | staff queue → 200 | **401** |
| Demote user 7 to Requester | staff queue → 200 | staff queue **403**, `/api/tickets` **200** |
| Reset user 8's password | passed the gate | **403** `PASSWORD_CHANGE_REQUIRED`, `/api/auth/me` still 200 so the change screen is reachable |
| Untouched admin | — | `/api/admin/users` → 200 |

They added API-35 to cover it. The server suite also became deterministic
(`fileParallelism: false`), passing 172/172 twice in a row, and the flaky
`StaffTicketDetail` assertion moved to `await findByText`.

- **Resolution:** `APPROVED` by @AlphabetCG 2026-09-25; PR #50 merged the same day.
  One non-blocking note carried forward for their Issue 8: a remaining flaky
  assertion in `MyTickets.test.tsx`.
