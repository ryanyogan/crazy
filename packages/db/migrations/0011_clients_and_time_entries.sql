-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "arrangement" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "roundingMinutes" INTEGER NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL,
    "cadence" TEXT NOT NULL,
    "budgetHours" INTEGER,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "todoId" TEXT,
    "note" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "time_entry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "time_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "project" ADD COLUMN "clientId" TEXT REFERENCES "client" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project" ADD COLUMN "rateCents" INTEGER;

-- CreateIndex
CREATE INDEX "client_userId_idx" ON "client"("userId");

-- CreateIndex
CREATE INDEX "time_entry_userId_startedAt_idx" ON "time_entry"("userId", "startedAt");

-- At most one Time entry per user has no end: the running timer.
CREATE UNIQUE INDEX "time_entry_userId_running_key" ON "time_entry"("userId") WHERE "endedAt" IS NULL;
