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

_(Adjust this into your own words before submitting — the points below are what
actually happened.)_

Three things made my prompts better across this sprint.

**Asking for a plan before code.** Prompt 1 explicitly said to summarise what I
needed to do rather than start building. That gave me the sequencing insight that
mattered most — that Lab 2 grades the specification separately, and the commit
timestamp is part of the evidence. Had I opened with "implement Lab 2", the spec
would have been written afterwards and Part 2 would have been unrecoverable.

**Asking the agent to separate what was given from what it invented.** In prompt
2 I asked it to list the handout's rules *and* recommend additions. It came back
with the 3 stated rules, 10 more that were fixed but scattered across other
sections, and 50 proposals clearly marked as needing my approval. That separation
is what let me review the set honestly instead of accepting 63 rules as if the
handout had supplied them all.

**Making it name its open decisions.** Rather than filling gaps silently, the
agent listed ten choices it could not make for me — ticket-number format, storage
strategy, field limits, and whether cross-Requester access should return 403 or
404. I chose them, and each now has a documented rationale in §11 that I can
defend.

**Where I had to correct it.** The agent wrote the first `AGENTS.md` directly on
the `main` branch, which breaks the branch discipline this course requires. I
deleted the file and made it redo the work on a proper feature branch off
`lab2-staging`. A related slip in the same session created GitHub issue #17 twice
(#18 was the duplicate); I had it close the duplicate and repair the
cross-reference in #17. Both were process errors rather than content errors, and
both confirm the labsheet's point — the agent produces the artifact, but the
engineering discipline around it stays my responsibility.

**What I would keep doing.** Asking the agent to verify state before declaring
success. In Lab 1 this caught a client test suite that failed because no test
file existed; in Lab 2 it caught the cross-document consistency I would not have
checked by hand — that all 39 acceptance criteria appear in the traceability
table and that every endpoint, BR, AC, and test id referenced across four
documents actually resolves.
