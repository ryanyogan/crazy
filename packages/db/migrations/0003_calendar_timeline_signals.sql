-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "who" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "calendar_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timeline_hour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "sourceKind" TEXT,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" DATETIME NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceUrl" TEXT,
    "todoId" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "signal_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "signal_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "calendar_event_userId_startsAt_idx" ON "calendar_event"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_userId_connectionId_itemId_key" ON "calendar_event"("userId", "connectionId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_hour_userId_day_hour_key" ON "timeline_hour"("userId", "day", "hour");

-- CreateIndex
CREATE INDEX "signal_userId_kind_at_idx" ON "signal"("userId", "kind", "at");

-- CreateIndex
CREATE UNIQUE INDEX "signal_userId_connectionId_sourceItemId_kind_key" ON "signal"("userId", "connectionId", "sourceItemId", "kind");

