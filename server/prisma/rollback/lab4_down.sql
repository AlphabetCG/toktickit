-- Schema rollback for the Lab 4 migration `lab4_actions_workflow_dashboards`
-- (specification §7.3, AC-56). Reverses every step of the migration in reverse
-- order, in one transaction, and leaves the database exactly at the Lab 3 schema.
--
-- This DELETES all Lab 4 data: every Action Taken, the whole status history, and
-- each Ticket's version and resolvedAt. Take `pg_dump -Fc` first (README).
--
-- Usage:
--   psql -v ON_ERROR_STOP=1 -d <database> -f server/prisma/rollback/lab4_down.sql

BEGIN;

-- 7. The append-only guard. Dropping the table below would drop the trigger too;
--    it is removed first so the order mirrors the migration exactly.
DROP TRIGGER IF EXISTS "TicketStatusChange_append_only" ON "TicketStatusChange";
DROP FUNCTION IF EXISTS "reject_status_change_mutation"();

-- 5 and 6. Status history, with its backfilled rows.
DROP TABLE IF EXISTS "TicketStatusChange";

-- 4. Actions Taken, with its keys and CHECK constraints.
DROP TABLE IF EXISTS "ActionTaken";

-- 8. The new indexes on columns that existed in Lab 3. The resolvedAt index goes
--    with its column below.
DROP INDEX IF EXISTS "Ticket_requesterId_updatedAt_idx";
DROP INDEX IF EXISTS "Ticket_updatedAt_idx";

-- 2 and 3. The two Ticket columns.
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "resolvedAt";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "version";

-- 1. The enum, once nothing references it.
DROP TYPE IF EXISTS "ActionStatus";

-- Prisma's record of the migration, so `prisma migrate status` reports the Lab 3
-- schema and a later `migrate deploy` can re-apply Lab 4 cleanly.
DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%\_lab4\_actions\_workflow\_dashboards';

COMMIT;
