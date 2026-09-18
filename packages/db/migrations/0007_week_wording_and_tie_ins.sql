-- CreateTable
CREATE TABLE "tie_in" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "when" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "tie_in_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "week_day_note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "week_day_line" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "todoId" TEXT,
    "calendarEventId" TEXT,
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "week_day_line_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "week_day_line_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendar_event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "tie_in_userId_week_idx" ON "tie_in"("userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "tie_in_userId_projectId_week_key" ON "tie_in"("userId", "projectId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "week_day_note_userId_day_key" ON "week_day_note"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "week_day_line_userId_day_position_key" ON "week_day_line"("userId", "day", "position");

-- CreateIndex
CREATE INDEX "todo_userId_state_doneAt_idx" ON "todo"("userId", "state", "doneAt");

