-- CreateTable
CREATE TABLE "connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "defaultSide" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "syncCursor" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "circle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "circleId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusNote" TEXT,
    "milestone" TEXT,
    "milestoneDay" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "project_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "projectId" TEXT,
    "estimateMinutes" INTEGER,
    "energy" TEXT,
    "carryCount" INTEGER NOT NULL DEFAULT 0,
    "stackPosition" INTEGER,
    "stackReason" TEXT,
    "sourceConnectionId" TEXT,
    "sourceKind" TEXT,
    "sourceItemId" TEXT,
    "sourceRef" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL,
    "touchedAt" DATETIME NOT NULL,
    "sentBackAt" DATETIME,
    "doneAt" DATETIME,
    CONSTRAINT "todo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "todo_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "connection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "slot_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyShort" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "connection_userId_externalAccountId_key" ON "connection"("userId", "externalAccountId");

-- CreateIndex
CREATE INDEX "circle_userId_idx" ON "circle"("userId");

-- CreateIndex
CREATE INDEX "project_userId_idx" ON "project"("userId");

-- CreateIndex
CREATE INDEX "todo_userId_state_stackPosition_idx" ON "todo"("userId", "state", "stackPosition");

-- CreateIndex
CREATE UNIQUE INDEX "todo_userId_sourceConnectionId_sourceItemId_key" ON "todo"("userId", "sourceConnectionId", "sourceItemId") WHERE state IN ('backlog', 'today');

-- CreateIndex
CREATE INDEX "slot_userId_day_idx" ON "slot"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "slot_todoId_day_hour_key" ON "slot"("todoId", "day", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "brief_userId_kind_day_key" ON "brief"("userId", "kind", "day");

