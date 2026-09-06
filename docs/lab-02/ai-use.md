# Lab 2 — AI Use and Reflection

**Author:** Naphat Utabuawong (67070501015, @AlphabetCG)

## LLM / agent used

**Claude Code** (Anthropic), run in the terminal against this repository.

| Model | Used for |
|-------|----------|
| Claude Sonnet 5 | Reading the labsheet, general questions about the lab process, Git/GitHub mechanics |
| Claude Opus 5 | Drafting the engineering contract, decomposing Issues, implementation work |

The agent had read access to the repository and to the Lab 2 labsheet PDF. It was
used as an engineering assistant; every document below was reviewed and approved
by me before being committed.

---

## Selected key prompts

Prompts are listed in the order they were used. Prompts 1–9 cover the
specification phase; the table is extended as each implementation Issue lands.

| # | Prompt (as typed) | What I did with the result |
|---|-------------------|----------------------------|
| 1 | *"[labsheet PDF attached] สรุปสิ่งที่ผมต้องทำใน Lab ครั้งนี้ก่อน ว่าผมต้องทำอะไรบ้าง ทั้งในก่อนที่จะเริ่มการ Implementation และอื่น ๆ"* | Got a breakdown separating pre-implementation work from build work. Used it to understand that Lab 2 requires me to **write** the acceptance criteria rather than receive them, and that the spec must be committed before any implementation PR. This shaped the whole sprint order. |
| 2 | *"list business rules ที่เขาให้มากับแนะนำผมเพิ่มเติมหน่อย"* | The agent separated the 3 rules the handout states outright (BR-01…BR-03) from 10 more that are fixed but buried in other sections (attachment limits, seed requirements), then proposed 50 more covering the 11 areas §4.3 demands. I reviewed each one and approved the set as BR-01…BR-63. |
| 3 | *"เอาตามที่แนะนำทั้งหมด เขียน specification.md ให้เลย"* | Approved the ten open decisions the agent had flagged (ticket-number format, priority values, storage strategy, field lengths, 404-vs-403) and had it produce the full contract. |
| 4 | *"[starter AGENTS.md template attached] เขียน specification.md ให้เลย ใช้ที่แนะนำมาทั้งหมด (เขียนใหม่ตะกี้อยู่ใน Main เลยลบ Agent.md ทิ้ง) ถ้าเป็นไปได้ ขึ้นโครงสร้างใหม่ของ Agents.md กับลง skill ต่าง ๆ ของ Agents ให้หน่อยลงในโปรเจค"* | Reissued after I deleted the agent's first `AGENTS.md` because it had been written on `main`. This time it created `lab2-staging` and a feature branch first, then wrote `specification.md`, a restructured `AGENTS.md`, and two agent skill playbooks under `docs/skills/`. |
| 5 | *"เขียน tests.md ต่อเลย"* | Produced the Test DD plan — 69 planned tests across six levels with every AC mapped. I checked the traceability table covered all 39 criteria before committing. |
| 6 | *"เขียน ui-spec.md ต่อเลย"* | Produced the Zen Green UI contract covering all 19 items Appendix C requires. I verified the colour tokens matched `specification.md` §6.1 exactly. |
| 7 | *"เขียน api-spec.md ต่อเลย"* | Produced the REST contract with success, validation, ownership, missing-resource, and unexpected-error behaviour documented per endpoint. |
| 8 | *"วางแผนแตก issue และ dependency และสร้าง branch ตามชื่อได้เลย รวมถึงเตรียม pr feature 1 ให้หน่อย และจัดการ update kanban board ให้ที"* | Got the 8-Issue decomposition with a dependency graph and justification, plus the Issues created on GitHub and PR #20 opened against `lab2-staging`. |
| 9 | *"ทำ ai-use.md ต่อเลย และคอยแจ้งผมหน่อยว่า ใน step ทีทำไปเรื่อย ๆ มีอะไรที่ผมควรต้อง screenshot เก็บไว้เพื่อส่งในใบแลปบ้าง"* | This document, plus a running evidence checklist tied to the nine submission parts so screenshots are captured at the moment each state exists rather than reconstructed at the end. |

### Implementation phase — per Issue

| # | Issue | Prompt (as typed) | What I did with the result |
|---|-------|-------------------|----------------------------|
| 10 | #12 Zen Green — review response | *"เริ่ม session ด้วยการอ่าน AGENTS.md เพื่อเตรียมตัวสำหรับการ Implement session"* → *"Read current peer review from my reviewer (he doesn't approve with a reason), check the reason of change suggest, implement along it but if some comment is not aligned with the requirement of this PR issue please prepare a comment that describes a non-fix."* → *"do it"* | The agent read @copter549365's COMMENTED review on PR #21 (4 points) and split them by whether they fit the Issue's scope. It fixed the two real gaps — the Description textarea was missing the `max-height` ui-spec §2 requires, and nothing locked the palette to the spec, so it added a test asserting the 11 fixed Zen Green tokens equal their `ui-spec §1.1` hex (plus the shell breakpoint and textarea resize). It verified the token values were already correct, drafted a Thai reply, recorded the exchange in `reviewer.md`, and prepared a documented **non-fix** for the IT-Priority-badge suggestion, which is out of Lab 2 scope (`specification §3.2`). Result: client 35/35, tsc clean, build passes. |
| 11 | #13 Data model, migration, seed | *"now my pr review approve code, moving kanban board for me then start implementing next issue (don't forget to change branch)"* → *"don't forget to update md (ai-use) for me (tracking what have you done with each issue, all prompt in ai-use)"* | The agent moved #12 → Done and #13 → Started on the Kanban, then recut `feature/3-data-model-seed` fresh off the updated `lab2-staging` (the pre-existing branch had been cut too early and was empty). It added the §7.1 models, both enums, and the two composite indexes; created migration `lab2_requester_ticketing` as an additive `ALTER TABLE` so the Lab 1 `Category` rows survived with `isActive = true`; extended the idempotent seed (7 related systems, 4 active + 1 inactive requester, upserts on natural keys); and wrote `seed.test.ts` for content + idempotency (BR-09…BR-13, BR-63). Verified with `migrate reset`, a double-seed row dump (Category 4 / RelatedSystem 7 / RequesterUser 5), server 9/9, client 35/35, tsc clean, `.env` untracked. |
| 12 | #13 delivery | *"move board, push and open PR for me"* → *"complete every docs (ai-use and others)"* | The agent pushed `feature/3-data-model-seed`, opened PR #22 with the base explicitly set to `lab2-staging` (not the GitHub default `main`), and moved #13 → PR Review. It then brought the evidence docs current: `reviewer.md` (PR #21 approval recorded, PR #22 logged as awaiting review) and this file, and reminded me to capture the open-PR page and the mid-sprint Kanban spread before they become unrecoverable. |
| 13 | #14 Development Requester context | *"changing branch, start implementing next issue"* + sub-instructions: record both review directions in `reviewer.md`; find out why issue #2 was still open; note my reviewer's PR #22 comment I agreed to fix; then open a PR and add @copter549365 as reviewer. | The agent first recorded the real PR #22 exchange and my `CHANGES_REQUESTED` review of the partner's PR #22 in `reviewer.md`, then diagnosed why #12 stayed open (the "Closes #12" keyword only auto-closes on a merge into the default branch `main`, but our PRs target `lab2-staging`) and closed it to match #11/#13. It confirmed the reviewer's PR #22 concern is about **#15** (atomic ticket-number allocation), not the #13 schema, and carried it forward as a recorded commitment. Then it cut `feature/4-requester-context` off the updated staging and implemented the issue: `GET /api/requesters` (public), the `X-Requester-Id` middleware (401 on all four rejection cases, scoping `/api/categories` per api-spec §1.6), and the client — a `RequesterProvider` (localStorage persistence), the Selection screen with loading/empty/error states, route guard, and Change Requester with a keyed remount so no previous-Requester data survives. It replaced the Lab 1 "Check System" screen (removing its now-obsolete test) and proved AC-01…AC-06 with API-01/02 and UI-01…06. Verified: server 17/17, client 39/39, both `tsc` clean, client build, and a live smoke test (requesters list, 401 without header, 200 with). |
| 14 | #15 Create Ticket | *"merge success, changing branch, start implementing next issue"* + sub-instructions: record both review directions in `reviewer.md` first; then open a PR and add @copter549365 as reviewer. | The agent recorded PR #23's approval in `reviewer.md` (Direction A) and confirmed Direction B was already current, then cut `feature/5-create-ticket` off staging. Backend: `GET /api/related-systems`, and `POST /api/tickets` that validates every field, checks reference ids are active (BR-41), and allocates the Ticket Number with an atomic `upsert … { increment }` **inside the creation transaction** — honouring the race-condition commitment from the PR #22 review (specification §7.3). Frontend: the Create Ticket screen (ui-spec §8.2) with database-loaded selects, a priority radio group, character counters, read-only system fields, per-field validation, a duplicate-submit guard, a preserved-values error path, and a success panel showing the Ticket Number. Proved UNIT-01/02/03, API-03…09, UI-07…11. Verified: server 35/35, client 44/44, both tsc clean, client build, and a live smoke test (201 with `TKT-2026-…`, 400 on a short summary). |
| 15 | #16 My Tickets | *"merge success, changing branch, start implementing next issue"* + the standing sub-instructions: record both review directions in `reviewer.md` first, then open a PR and add @copter549365 as reviewer. | The agent recorded PR #24's approval (Direction A) and **posted a substantive COMMENTED review of the partner's PR #23** (Ticket Detail & attachments) — verifying their ownership handling was correct (checking their schema before filing anything, so no false bug), then raising an `isRemoved`/`removedAt` drift risk and loose id parsing (Direction B). Cut `feature/6-my-tickets` off staging. Backend: `GET /api/tickets` — owner-scoped, with a pure `normalizeTicketQuery` helper so invalid parameters fall back to defaults instead of 400 (BR-36), search over number+summary (BR-31), filters that compose with ownership (BR-38), and an `id DESC` secondary sort (BR-34). Frontend: My Tickets screen — debounced search, four filters, sort + direction, pagination with rows-per-page, distinct empty vs no-results states, a responsive table→cards layout, and an `AbortController` to avoid the stale-response race (the same defect it had flagged in the partner's PR #22). Proved UNIT-06, API-10…16, UI-12…16. Verified: server 45/45, client 49/49, both tsc clean, client build, and a live smoke test (pagination metadata, `pageSize=5` correctly falling back to 10, invalid params → 200). |
| 16 | #17 Ticket Detail & attachment lifecycle | *"merge success, changing branch, start implementing next issue"* + the standing sub-instructions: record both review directions in `reviewer.md`, then open a PR and add @copter549365 as reviewer. | Recorded PR #25's approval (Direction A) and reviewed the partner's PR #24 (E2E + responsive) — flagging a red `API-08b` (a `%`/`_` SQL-wildcard fixture) that must be green before a release PR reaches `main`. **A process slip:** I posted the review without checking that I had already reviewed #24 earlier, creating a duplicate — I noted it transparently in `reviewer.md` and recorded my earlier, authoritative review. Then implemented the largest issue and the deferred D-12 attachment work: added `multer`; **magic-byte MIME sniffing** so type is validated by content not extension (BR-51); the 5 MB / five-active limits; server-generated UUID stored names so an original name can never be a path segment (BR-50); an embedded-attachments ticket-detail endpoint; a download guard returning an identical 404 for removed/not-owned/missing (BR-08); and soft-removal-with-reason (ownership checked before validation so ids can't be probed). Frontend: read-only Ticket Detail (label/value pairs, never disabled inputs) and an Attachment section (upload with client pre-validation, download via blob, and a remove-with-reason dialog gated on a valid reason). Proved UNIT-04/05, API-17…29, UI-17…20, STYLE-02. Verified: server 65/65, client 55/55, both tsc clean, client build, and a live end-to-end smoke via Node `fetch` (upload→201, download→200, `.exe`→415, remove→200, removed download→404); the curl CLI hit a Windows multipart quirk, so the Node client confirmed it instead. |
| 17 | #19 E2E, responsive evidence, release integration | *"merge success, changing branch, start implementing next issue"* + the standing sub-instructions: record both review directions in `reviewer.md`, then open the release PR and add @copter549365 as reviewer. | Recorded PR #26's approval (Direction A — "ดีมากเด้งดึ๋งไม่มีอะไรต้องแก้ไข") and updated the partner's PR #24 resolution in `reviewer.md` (their last Lab 2 PR, merged; nothing newer to review). Cut `feature/8-e2e-visual-release` off staging and built the whole E2E layer against **real servers + real PostgreSQL** (no mocks): a root `package.json` + `playwright.config.ts` whose `webServer` starts the API and Vite client itself, five end-to-end journeys (`requester-ticket-flow.spec.ts`: full intake, Requester-switch scoping, upload→download→soft-remove→refuse, direct-URL ownership 404, and a **keyboard-only** selection+create path asserting `:focus-visible`), and a responsive spec asserting `scrollWidth <= clientWidth` at desktop/tablet/mobile plus the table→cards switch — which also captures all **24 ui-spec §13 screenshots** (using route interception for the loading/empty/failure/submitting states so they are deterministic). The by-hand §12 visual inspection then found and I had it fix a real defect: the removal dialog rendered its label *beside* the textarea (no `Field` wrapper), fixed with a `.zg-dialog`-scoped stacking rule in `theme.css`. Filled `tests.md` §6 (69/69), the §4 and ui-spec §12 checklists, and the `specification.md` §10 DoD. Verified: server 65/65, client 55/55 (32 style assertions still green after the CSS change), both tsc clean, client build, Playwright **13/13**. Then opened the release PR `lab2-staging → main`. |

---

## Decomposed sub-agent task prompts

The contract documents are the agent's instruction set for the implementation
Issues. Each Issue is handed over with a bounded prompt of this shape:

```
Sub-agent task: Implement Lab 2 Issue <n> — <title>.
Contract: docs/lab-02/specification.md, tests.md, ui-spec.md, api-spec.md.
Branch: feature/<n>-<slug>, based on lab2-staging.
Playbook: docs/skills/skill-sprint-implementation.md.

Scope: only the acceptance criteria listed in GitHub issue #<n>.
Out of scope: authentication, IT Staff workflow, comments, status changes.

Do:
 1. Write the planned tests from tests.md for this Issue FIRST and confirm they
    fail for the expected reason.
 2. Implement the smallest correct behaviour until they pass.
 3. Enforce ownership in the backend; prove it with a test that bypasses the UI.
 4. Implement every screen state the contract names, including the unhappy ones.
 5. Update tests.md with real paths and pass status.

Closed-world rule: if the contract is silent on a design choice, STOP and ask.
Do not invent business rules or widen scope.

Report: which acceptance criteria are proven and by which test; what is missing.
Do not claim completion with skipped, .todo, or unrelated tests.
```

---

## My Reflection

### สิ่งที่ทำให้ prompt ดีขึ้นตลอด sprint นี้

**ขอให้วางแผนก่อนลงมือเขียนโค้ด.** Prompt แรกผมสั่งให้มัน "สรุปว่าผมต้องทำอะไรบ้าง"
แทนที่จะให้เริ่มสร้างเลย ตรงนี้ทำให้ผมเห็นลำดับงานที่สำคัญที่สุด — ว่า Lab 2 ให้คะแนน
ตัว specification แยกต่างหาก และ commit timestamp ของ spec ก็เป็นหลักฐานส่วนหนึ่ง ถ้า
ผมเปิดด้วยคำสั่งว่า "implement Lab 2" ไปเลย spec จะถูกเขียนทีหลัง แล้ว Part 2 จะกู้คืน
ไม่ได้อีก

**ให้ AI แยก "สิ่งที่โจทย์ให้มา" ออกจาก "สิ่งที่มันคิดเพิ่มเอง".** ตอนถาม business rules
ผมสั่งให้มันลิสต์กฎจากใบแลปพร้อมกับเสนอเพิ่ม มันแยกกลับมาเป็น 3 กฎที่โจทย์บอกตรง ๆ,
อีก 10 กฎที่ตายตัวแต่กระจายอยู่ในหัวข้ออื่น, และอีก 50 ข้อที่ทำเครื่องหมายชัดว่า "ต้องรอ
ผมอนุมัติ" การแยกแบบนี้ทำให้ผมรีวิวได้อย่างซื่อสัตย์ แทนที่จะรับกฎทั้ง 63 ข้อมาเหมือน
ใบแลปให้มาเองทั้งหมด

**บังคับให้มันบอก decision ที่มันตัดสินใจแทนผมไม่ได้.** แทนที่จะเติมช่องว่างเงียบ ๆ AI
ลิสต์สิบเรื่องที่มันเลือกแทนผมไม่ได้ — รูปแบบเลขที่ตั๋ว, วิธีเก็บไฟล์แนบ, ความยาวฟิลด์,
และการเข้าถึงข้ามผู้ใช้ควรตอบ 403 หรือ 404 ผมเป็นคนเลือกเอง และทุกข้อมีเหตุผลบันทึกไว้
ใน §11 ที่ผมอธิบายป้องกันได้

**ตรวจสอบสถานะจริงก่อนจะประกาศว่าเสร็จ.** ทุก Issue ผมให้มันรัน test / tsc / build
จริงและแนบผลก่อนบอกว่าเสร็จ — เช่น เทียบ token ใน `theme.css` กับ `ui-spec §1.1`,
ยิง smoke test สด, หรือใน #17 ที่ curl เจอปัญหา multipart บน Windows มันก็ไปพิสูจน์
ด้วย Node `fetch` แทน ไม่ได้เชื่อว่า "โค้ดน่าจะถูก" เฉย ๆ

### จุดที่ต้องเข้าไปแก้/ควบคุม AI (เป็น process error ไม่ใช่ content error)

- **เขียน `AGENTS.md` ลงบน `main` โดยตรง** 
- **สร้าง GitHub issue #17 ซ้ำเป็น #18** ในเซสชันเดียวกัน 
- **แตก branch เร็วเกินไป** — `feature/3-data-model-seed` ถูกตัดไว้ก่อน spec/UI merge เลย
  ว่างเปล่าและตามหลัง staging อยู่ 8 commit; และตอน #15 มัน commit ผิด branch ครั้งหนึ่ง
  ทั้งสองครั้งต้อง recut branch ใหม่จาก staging ที่อัปเดตแล้ว
- **โพสต์รีวิว PR #24 ของเพื่อนซ้ำ** โดยไม่ได้เช็คว่าผมเคยรีวิวไปแล้วก่อนหน้า เกิด
  `CHANGES_REQUESTED` ซ้ำสองอัน ผมบันทึกไว้อย่างโปร่งใสใน `reviewer.md` และยึดฉบับแรก
  เป็นฉบับจริง — บทเรียนคือ **ต้องเช็ครีวิวที่มีอยู่ก่อนโพสต์เสมอ**

### บทเรียนเฉพาะช่วง implementation (Issues #12–#19)

**คัดกรอง peer review ตาม scope ไม่ใช่ทำตามทุกข้อ (#12).** สำหรับรีวิว PR #21 ผมไม่ได้
สั่งแค่ "แก้ตาม comment" แต่สั่งให้ทำเฉพาะข้อที่อยู่ใน scope ของ Issue และข้อที่อยู่นอก
scope ให้เขียน **non-fix ที่มีเหตุผล** แทนการเงียบหรือทำตามหมด ได้ผลเป็นการแก้จริงสองข้อ
(เพิ่ม `max-height`, และ test ที่ล็อกค่าสี token) กับการปฏิเสธหนึ่งข้อที่มีเหตุผล (badge
IT-Priority ถูกกันออกโดย `specification §3.2`) — การปฏิเสธมีค่าเท่ากับการแก้ เพราะแสดงว่า
รีวิวถูกอ่านเทียบกับ contract จริง ๆ

**เปลี่ยนคำถามของรีวิวเวอร์ให้เป็น test เชิงกลไก (#12).** รีวิวเวอร์ทักว่า "ไม่มีสีดิบใน
component" พิสูจน์แค่ว่า component ใช้ class ไม่ได้พิสูจน์ว่า class ถือค่าที่ถูก ผมจึงให้เพิ่ม
test ที่อ่าน `theme.css` แล้ว assert ว่า token ตายตัวทุกตัวตรงกับค่า hex ใน `ui-spec §1.1`
พิมพ์ผิดเมื่อไรก็ test แดงทันที — นี่คือ pattern ที่ผมอยากทำซ้ำ: เปลี่ยน "เช็คหรือยัง" เป็น
การเช็คอัตโนมัติ ไม่ใช่คำตอบครั้งเดียว

**migration แบบ additive ปกป้องข้อมูลเดิม (#13).** ผมให้มันยืนยันว่า migration เพิ่ม
`Category.isActive` ด้วย `ALTER TABLE … ADD COLUMN` (default `true`) แทนการสร้างตาราง
ใหม่ แล้วพิสูจน์ว่าแถว `Category` เดิมจาก Lab 1 ยังอยู่ครบสี่แถว — การตรวจ SQL ที่ถูก
generate และนับจำนวนแถวจริง ไม่ใช่แค่ "migration รันผ่าน" คือสิ่งที่ทำให้เชื่อได้

**การจองเลขที่ตั๋วต้อง atomic ตามที่รับปากไว้ในรีวิว (#15).** รีวิวเวอร์ PR #22 เตือนเรื่อง
race condition ตั้งแต่ตอน schema ผมบันทึกเป็น commitment แล้วพอถึง Create Ticket ก็ให้
จัดสรรเลขด้วย `upsert … { increment }` **ภายใน transaction เดียวกับที่สร้างตั๋ว** — ปิด
ช่องที่สองคำขอพร้อมกันจะได้เลขซ้ำ

**ownership เป็นเรื่องของ backend และต้องพิสูจน์ด้วย test ที่ข้าม UI (#14/#16/#17).** ทุก
route ที่ผูกกับผู้ใช้ ผมให้เขียน test ที่ยิง API ตรง ๆ ด้วย header ของผู้ใช้คนอื่น และคาดหวัง
404 ที่เหมือนกันหมดสำหรับ "ไม่มี / ไม่ใช่เจ้าของ / ถูกลบ" เพราะปุ่มที่ซ่อนไว้ไม่ใช่การพิสูจน์
ความปลอดภัย

**ความปลอดภัยของไฟล์แนบ (#17).** ตรวจชนิดไฟล์จาก **magic byte** ของเนื้อไฟล์ ไม่ใช่
นามสกุล (BR-51), เก็บไฟล์ด้วยชื่อ UUID ที่ server สร้าง เพื่อไม่ให้ชื่อไฟล์เดิมกลายเป็นส่วน
ของ path (กัน path traversal, BR-50), และเช็ค ownership ก่อน validation เพื่อไม่ให้เดา id
ได้ — สิ่งเหล่านี้ตรวจจากภายนอกด้วย test เสมอ

**E2E + การตรวจด้วยตาจริง เจอบั๊กที่ test อัตโนมัติมองไม่เห็น (#19).** ผมให้เขียน E2E ที่
รันกับ server และ PostgreSQL จริง (ไม่ mock) และให้ทำ visual inspection ตาม `ui-spec §12`
เทียบกับ screenshot 24 รูปด้วยมือ — ซึ่งเจอว่า dialog ลบไฟล์วาง label ไว้ข้าง textarea
แทนที่จะอยู่บน (เพราะไม่ได้ห่อด้วย `Field` component) จึงแก้ CSS scoped เฉพาะ `.zg-dialog`
test อัตโนมัติผ่านหมดแต่จับ layout แบบนี้ไม่ได้ ต้องใช้ตาคน

### สิ่งที่จะทำต่อไปใน Lab หน้า

ยึดสามอย่างที่ได้ผล: (1) ให้ AI วางแผนและระบุ decision ที่ยังเปิดอยู่ก่อนเขียนโค้ด,
(2) เปลี่ยนข้อสังเกตของรีวิวเวอร์ให้เป็น automated test เมื่อทำได้, และ (3) บังคับให้พิสูจน์
สถานะจริง (รัน test/build จริง, ตรวจ SQL/row count จริง) ก่อนสรุปว่าเสร็จ — และเพิ่มนิสัย
ใหม่จาก sprint นี้คือ **เช็คสถานะฝั่ง GitHub (review/issue/branch) ที่มีอยู่ก่อนลงมือ** เพื่อ
ไม่ให้เกิดงานซ้ำอย่างที่พลาดใน PR #24
