-- Lab 3 — Users, roles, and the ticket workflow.
-- Hand-written from a `--create-only` diff (specification §8.2/§8.3): the model
-- rename is expressed as ALTER TABLE ... RENAME, NOT the DROP + CREATE that Prisma
-- would otherwise generate, so every RequesterUser id — and therefore every
-- Ticket.requesterId and Attachment.uploadedById — is preserved (BR-58, BR-59).
-- Steps follow specification §8.3 in order.

-- 1. Role enum.
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- 2. Extend the TicketStatus lifecycle (additive, no data migration; §7.3).
--    PostgreSQL 12+ permits ADD VALUE inside the migration transaction as long as
--    the new values are not *used* in the same transaction — the seed uses them.
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- 3. Rename RequesterUser -> User, carrying its rows, PK, unique index, and
--    sequence. PostgreSQL keeps every inbound foreign key through a table rename,
--    so Ticket_requesterId_fkey / Attachment_*_fkey now point at "User" untouched.
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER SEQUENCE "RequesterUser_id_seq" RENAME TO "User_id_seq";

-- 4. New User columns. passwordHash is NOT NULL, so it is added with a transient
--    empty-string default (dropped immediately) that the seed replaces for every
--    row; an unusable hash cannot authenticate regardless (BR-01, §8.3).
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- 5. Normalise stored emails to lower case (BR-12).
UPDATE "User" SET "email" = lower("email");

-- 6. IT Priority: add nullable, backfill from Requested Priority for every
--    existing Ticket, then enforce NOT NULL (BR-31).
ALTER TABLE "Ticket" ADD COLUMN "itPriority" "RequestedPriority";
UPDATE "Ticket" SET "itPriority" = "requestedPriority";
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;

-- 7. Ownership and resolution-signal columns — all nullable, all with FKs.
ALTER TABLE "Ticket" ADD COLUMN "ownerId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "resolutionSignalledAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "resolutionSignalledById" INTEGER;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_resolutionSignalledById_fkey"
  FOREIGN KEY ("resolutionSignalledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Session, PublicComment, InternalNote.
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- 9. Indexes and the remaining foreign keys.
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");
CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Ticket_ownerId_updatedAt_idx" ON "Ticket"("ownerId", "updatedAt" DESC);
CREATE INDEX "Ticket_currentStatus_itPriority_idx" ON "Ticket"("currentStatus", "itPriority");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
