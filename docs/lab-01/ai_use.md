# Lab 1 — AI Use and Reflection

## AI ที่ใช้งาน (LLM/agent used)
- Claude Code
  - Model Opus 5 (ใช้เพื่อ Implementing, Debugging)
  - Model Sonnet 5 (ใช้เพื่อสอบถามเรื่องทั่วไปเกี่ยวกับ Project)

## Prompt ที่เลือกใช้งาน (Selected key prompts)

# Issue 1 — Set up the project foundation
Prompt :
"on this labsheet, i need to do following request of issue 1. setup the branch then conclude it for me"

การใช้งาน :
ใช้เพื่อ Setup Project ตาม Labsheet โดยแนบ Folder "Lab1_Starter_Scaffold" ไปด้วย เพื่อให้โครงสร้างที่ Setup มาตรงตามรูปแบบของ Lab 1

Prompt :
"after setup, implementing issue 1 for me"

การใช้งาน :
หลังจาก Setup Project แล้ว สั่งให้ Implement ให้ครบตาม Requirement ของ Issue 1 (ทำเพื่อความแน่ใจว่าครบทุกข้อ)

ผลลัพธ์ของทั้งสอง Prompt :
- สร้างโครงสร้างพื้นฐานของ `client/` และ `server/`
- ตรวจสอบว่า frontend และ backend เริ่มทำงานได้จริง
- ตรวจสอบว่า Vitest/Supertest รันได้
- ตรวจสอบว่ามีไฟล์ `.gitignore` / `.env.example` และไม่ได้ commit `.env`

Subagent task prompt (decomposed) :
```
Sub-agent task: Implement Issue 1 — TokTickIT project foundation.
Context: repo `toktickit`, branch `feature/1-project-foundation`. Required stack:
React + TS + Vite + Bootstrap (client), Node + Express + TS (server),
Prisma + PostgreSQL, Vitest + Supertest. Follow the required folder structure
(client/, server/{prisma,src,tests/lab-01}, docs/lab-01, root .gitignore + README).
Do not add feature functionality beyond the foundation.
Do:
 1. Scaffold client/ (Vite React-TS); import Bootstrap in main.tsx; App shows the
    "TokTickIT" heading.
 2. Scaffold server/ (Express + TS): src/app.ts exports the app (no listen),
    src/index.ts boots it; init Prisma with a PostgreSQL datasource.
 3. Configure Vitest + Supertest (server) and Vitest (client); add one smoke test
    each so `npm test` runs green.
 4. Add root .gitignore (node_modules, dist, .env), client/.env.example,
    server/.env.example, and a README with setup steps. Never commit .env.
 5. docs/lab-01: ai_use.md, reviewer.md, tests.md.
Verify: `vite build` (client) succeeds, backend boots and responds, `npm test`
green in both, node_modules/.env not tracked. Report results; commit on the branch.
```

# Issue 2 — Implement the API health check
Prompt :
"implementing issue 2 for me, a requirement is:
    -GET /api/health returns HTTP 200.
    -The JSON response contains status = ok and service = TokTickIT API.
    -A Supertest test verifies the endpoint.
    -The React page displays the backend status based on a real API call.
    -A useful error message appears when the backend is unavailable."

การใช้งาน :
สั่งให้ลงมือทำ Issue 2 ตาม Requirement ที่ระบุ (Health check API และการแสดงสถานะ backend บนหน้าเว็บ)

ผลลัพธ์ของ Prompt :
- สร้าง Endpoint `/api/health` ให้คืน 200 พร้อม `{ status: "ok", service: "TokTickIT API" }`
- เชื่อม `checkSystem()` กับ UI เพื่อแสดงสถานะ Online/Offline
- เพิ่ม UI Test (Vitest) สำหรับกรณี Online และ Offline

Subagent task prompt (decomposed) :
```
Sub-agent task: Implement Issue 2 — API health check.
Context: branch `feature/2-health-check` based on `lab1-staging` (has the Issue 1
foundation). ESM (`.js` import specifiers), Vitest/Supertest. Health only —
categories belong to Issue 4. Do not change dependencies.
Do:
 1. server/src/app.ts: GET /api/health returns 200 { status: "ok",
    service: "TokTickIT API" }.
 2. Confirm server/tests/lab-01/health.test.ts (Supertest) passes.
 3. client/src/api.ts: checkSystem() calls /api/health and throws on failure.
 4. client/src/App.tsx: on click show loading, then "System Status: Online" on
    success, or "Offline / Unable to connect to TokTickIT API" on failure.
 5. client/tests/lab-01/App.test.tsx: add Vitest tests for the Online and Offline
    states (mock checkSystem).
Verify: server + client `npm test` green, `tsc --noEmit` clean, live
`curl /api/health` → 200 JSON. Report; commit on the branch.
```

# Issue 3 — Create and seed IT request categories
Prompt :
"implementing issue 3 for me
requirement is
A Prisma Category model exists with id, unique name, and createdAt.
A migration creates the Category table.
The seed inserts Account and Access, Hardware, Software, and Network.
The seed is safe to run more than once without duplicates.
Database credentials are not committed.

testing file then debug everything, also checking unimportant file then reduce it
test everythings that it pass the criteria of issue 3"

การใช้งาน :
สั่งให้ลงมือทำ Issue 3 (เตรียมและ seed ฐานข้อมูล) พร้อมกำชับให้ทดสอบและ debug ทั้งหมด, ตรวจไฟล์ที่ไม่จำเป็นแล้วลดออก และทดสอบให้ผ่านทุก criteria ของ Issue 3

ผลลัพธ์ของ Prompt :
- เพิ่ม Model `Category` (`id`, `name` แบบ unique, `createdAt`) ใน `schema.prisma`
- สร้าง Migration ของตาราง `Category`
- เขียน `seed.ts` ใหม่ให้มี `CATEGORY_NAMES` และ export `seedCategories()` โดยใช้ `upsert` บน `name` จึงรันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ (idempotent)
- เขียน `category-seed.test.ts` และยืนยันด้วย `prisma migrate reset --force` แล้วรัน test ใหม่ทั้งหมดผ่าน
- ยืนยันว่า `.env` ไม่ถูก commit (มีเฉพาะ `.env.example`)

Subagent task prompt (decomposed) :
```
Sub-agent task: Implement Issue 3 — create and seed IT request categories.
Branch feature/3-category-seed based on lab1-staging. Prisma + PostgreSQL.

Recon:
 - git branch -a, git log, git status, repo tree.
 - Read schema.prisma, seed.ts, package.json, app.ts, prisma.ts,
   categories.test.ts, .gitignore, .env.example, vitest.config.ts,
   health.test.ts, README.md, tests.md.
Environment check:
 - Get-Service postgresql* + probe port 5432 -> PostgreSQL 18 running.
 - npm install in server; locate psql.exe; try DB login (postgres/postgres -> fail).
Write the code (before the DB existed):
 - Add the Category model (id, name @unique, createdAt) to schema.prisma.
 - Rewrite seed.ts with CATEGORY_NAMES + exported seedCategories().
Blocked -> ask the user:
 - No existing toktickit role found; ask the user for DB access (-> password).
Provision + migrate:
 - CREATE ROLE toktickit ... CREATEDB; CREATE DATABASE toktickit OWNER toktickit.
 - cp .env.example .env; git check-ignore -v .env to prove it is ignored.
 - prisma migrate dev --name init; read the generated migration.sql.
 - Run the seed twice in one command and dump the table -> verify idempotency.
Test + verify:
 - Write category-seed.test.ts.
 - npm test (server), tsc --noEmit, npm test (client).
 - prisma migrate reset --force -> rebuild from scratch, re-run tests.
 - git ls-files | grep '.env$' -> confirm no credentials tracked.
 - Final psql column/default introspection against each acceptance criterion.
```

# Issue 4 — Display the IT request category list
Prompt :
"implementing issue 4, requirement is:
GET /api/categories retrieves categories from PostgreSQL through Prisma.
The API returns each category ID and name in a predictable order.
A Supertest test verifies the response.
React displays the categories returned by the API, not hard-coded values.
Loading and error states are shown.
A Vitest test verifies the category-list UI behavior. — testing and debugging it, also reduce unnecessary code."

การใช้งาน :
สั่งให้ลงมือทำ Issue 4 ตาม Requirement พร้อมกำชับให้ "ทดสอบ + debug และลดโค้ดที่ไม่จำเป็น"

ผลลัพธ์ของ Prompt :
- เพิ่ม Endpoint `/api/categories` ที่ดึงข้อมูลผ่าน Prisma เรียงตาม `id` และคืน 500 เมื่อผิดพลาด
- เพิ่ม Supertest ตรวจสอบว่าคืน 4 หมวดหมู่ตามลำดับ
- ให้ React แสดงรายการหมวดหมู่จากข้อมูลของ API (ไม่ hard-code)
- ลดโค้ดที่ไม่จำเป็น โดยตัด flag `SystemStatus.online` ที่ไม่ได้ใช้ ทำให้ `checkSystem()` คืนค่าเป็น `Category[]` ตรง ๆ

Subagent task prompt (decomposed) :
```
Sub-agent task: Implement Issue 4 — display the IT request category list.
Context: branch `feature/4-category-list` based on `lab1-staging` (already has the
Prisma Category model, migration, and seed from Issue 3). Express + TS + Prisma
(server), React + TS + Vite (client), Vitest + Supertest, ESM. Do not touch other
issues' code or change dependencies.
Do:
 1. server/src/app.ts: add GET /api/categories using
    getPrisma().category.findMany({ orderBy: { id: "asc" },
    select: { id: true, name: true } }); return 200 with the array, 500 on failure.
 2. server/tests/lab-01/categories.test.ts: replace the describe.todo with a real
    Supertest test asserting 200 and the four seeded names in id order
    (import CATEGORY_NAMES from the seed).
 3. client/src/api.ts: checkSystem() calls /api/health then /api/categories,
    throwing if either fails. Drop the unused SystemStatus.online flag — return
    Category[] directly.
 4. client/src/App.tsx: render the returned categories as an ordered list on
    success; keep the loading and Offline/error states.
 5. client/tests/lab-01/App.test.tsx: replace the categories it.todo with a test
    that mocks checkSystem and asserts the list renders from the API response
    (not hard-coded).
Verify (needs a migrated+seeded DB): server + client `npm test` green,
`tsc --noEmit` clean in both. Report the test output. Commit on the branch.
```

# Debug & Cleanup — Sub-prompts
Prompt :
"there is some error on test structure on vite.config.ts"

การใช้งาน :
แจ้งให้ช่วยแก้ Error เรื่องโครงสร้าง test ในไฟล์ `vite.config.ts`

ผลลัพธ์ของ Prompt :
- พบว่าเกิดจากมี Vite ซ้ำสองเวอร์ชัน (App ใช้ Vite 6 ส่วน Vitest ใช้ Vite 5 ที่ฝังมา) ทำให้ type ของ key `test` ไม่ตรงกัน
- แก้โดยแยกส่วน `test` ออกไปไว้ในไฟล์ `vitest.config.ts` แยกต่างหาก (ให้ `vite.config.ts` เป็น Vite ล้วน)

Prompt :
"debug and testing all project and reducing all of unnecessary file"

การใช้งาน :
สั่งให้รันทดสอบทั้งโปรเจกต์ และลบไฟล์ที่ไม่จำเป็นออก

ผลลัพธ์ของ Prompt :
- รัน Test + Typecheck + Build ทั้ง server และ client ผ่านทั้งหมด (server 4/4, client 4/4)
- ยืนยันว่าไม่มีไฟล์ build/ที่ค้างถูก track และลบโฟลเดอร์ `dist/` ที่เกิดจากการ build ออก

## Reflection (ข้อสังเกต)

- Prompt แรกที่สั่งว่า **ห้ามเขียนโค้ด** ให้ผลดีกว่า เพราะได้แผนที่เข้าใจก่อนลงมือ แทนที่จะได้โค้ดที่อธิบายไม่ได้
- การสั่งให้ Agent **ตรวจสอบสถานะ (verify state)** แทนการสร้างของใหม่ ช่วยให้เจอว่าฝั่ง `client/` ยังไม่มีไฟล์ test ตั้งแต่ก่อนเปิด PR
- รูปแบบที่ได้ผลดีที่สุดคือการจับคู่ Prompt ของแต่ละ Feature กับ Sub-prompt แนว "test and debug it / reduce unnecessary code" ซึ่งเป็นตัวที่ทำให้เจอทั้ง Error ของ Vite ที่ซ้ำเวอร์ชัน และ flag `online` ที่ไม่ได้ใช้งาน
- ปัญหาใหญ่ที่สุดคือการลืมรหัสผ่าน PostgreSQL ซึ่ง Agent ไม่สามารถ (และปฏิเสธที่จะ) เดารหัสผ่านให้ จึง reset รหัสผ่านเอง แล้ว Agent จึงสร้าง role/database และ seed ข้อมูลให้จนใช้งานได้
