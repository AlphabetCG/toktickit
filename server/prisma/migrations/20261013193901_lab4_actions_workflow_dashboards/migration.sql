-- Lab 4 — Actions Taken, ticket workflow, dashboards (specification §7.3).
-- Purely additive (BR-54): it adds an enum, two columns, two tables, two CHECK
-- constraints, a trigger, and indexes. It drops, renames, or rewrites no
-- existing column or row, so every Lab 3 id and relationship survives (BR-55).
-- Created with `prisma migrate dev --create-only` and ordered by hand.

-- 1. The Action Taken lifecycle (BR-13).
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- 2. Optimistic-concurrency version (BR-37). The DEFAULT gives every existing
--    Ticket version 1 in this same statement (BR-56).
ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- 3. Resolution time (BR-31). Lab 3 recorded none, so updatedAt is the best
--    available truth for Tickets already Resolved or Closed (BR-56).
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "currentStatus" IN ('RESOLVED', 'CLOSED');

-- 4. Actions Taken, with foreign keys, the idempotency key (BR-44), and the two
--    CHECK constraints that back up BR-07 and BR-08 for any write that bypasses
--    the API (§7.2 decision 6).
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "result" VARCHAR(2000) NOT NULL DEFAULT '',
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "performedById" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(1000) NOT NULL DEFAULT '',
    "attachmentNotes" VARCHAR(500) NOT NULL DEFAULT '',
    "clientRequestId" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");

-- BR-08: a follow-up needs its note.
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followUp_note"
  CHECK (NOT "followUpRequired" OR length(btrim("followUpNote")) > 0);
-- BR-07: a completed action needs its result.
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_completed_result"
  CHECK ("status" <> 'COMPLETED' OR length(btrim("result")) > 0);

-- 5. Status history (BR-32).
CREATE TABLE "TicketStatusChange" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusChange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Backfill: one row per legacy Ticket recording the status it held at the
--    upgrade (BR-56). A null fromStatus and null changedById are how the UI
--    labels it "Recorded at upgrade".
INSERT INTO "TicketStatusChange" ("ticketId", "fromStatus", "toStatus", "changedById", "changedAt")
SELECT "id", NULL, "currentStatus", NULL, "updatedAt" FROM "Ticket";

-- 7. Append-only guard (BR-33), created after the backfill. The API exposes no
--    update or delete route; this makes the database itself refuse as well.
CREATE FUNCTION "reject_status_change_mutation"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'TicketStatusChange is append-only'; END $$ LANGUAGE plpgsql;

CREATE TRIGGER "TicketStatusChange_append_only"
  BEFORE UPDATE OR DELETE ON "TicketStatusChange"
  FOR EACH ROW EXECUTE FUNCTION "reject_status_change_mutation"();

-- 8. Indexes (§7.1).
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");
CREATE INDEX "ActionTaken_performedById_status_idx" ON "ActionTaken"("performedById", "status");
CREATE INDEX "TicketStatusChange_ticketId_changedAt_id_idx" ON "TicketStatusChange"("ticketId", "changedAt", "id");
CREATE INDEX "Ticket_requesterId_resolvedAt_idx" ON "Ticket"("requesterId", "resolvedAt" DESC);
CREATE INDEX "Ticket_requesterId_updatedAt_idx" ON "Ticket"("requesterId", "updatedAt" DESC);
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt" DESC);
